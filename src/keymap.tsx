import React from "react";
import CodeMirror, { Editor } from "codemirror";
import SHARED from "./shared";
import {
  delete_,
  copy,
  paste,
  InsertTarget,
  ReplaceNodeTarget,
  OverwriteTarget,
  activateByNid,
} from "./actions";
import {
  partition,
  getRoot,
  skipCollapsed,
  mac,
  getLastVisibleNode,
  preambleUndoRedo,
  playSound,
  BEEP,
} from "./utils";
import { say } from "./announcer";
import { findAdjacentDropTargetId as getDTid } from "./components/DropTarget";

import type { AppDispatch } from "./store";
import type { ASTNode } from "./ast";
import type { RootState } from "./reducers";
import { KeyDownContext } from "./ui/ToggleEditor";

type BlockEditorEnv = {
  isNodeEnv: false;
  dispatch: AppDispatch;
  activateByNid: (
    nid: number,
    options?: { allowMove: boolean; record?: boolean }
  ) => void;
  setCursor: (cur: CodeMirror.Position) => void;
};

type NodeEnv = {
  isNodeEnv: true;

  // defined by Node react component
  isLocked: () => boolean;
  handleMakeEditable: (e?: React.KeyboardEvent) => void;
  setRight: () => boolean;
  setLeft: () => boolean;

  // These somehow come from somewhere. Either a BlockEditor or a Node
  // elements presumably.
  dispatch: AppDispatch;
  activateByNid: (
    nid: number,
    options?: { allowMove: boolean; record?: boolean }
  ) => void;

  // the following are from Node.tsx
  collapse: (id: string) => void;
  uncollapse: (id: string) => void;
  setCursor: (cur: CodeMirror.Position) => void;
  isCollapsed: boolean;
  expandable: boolean;
  normallyEditable: boolean;
  node: ASTNode;
};

export type InputEnv = BlockEditorEnv | NodeEnv;

type Env = InputEnv & {
  state: RootState;
  fastSkip?: (next: (node: ASTNode) => ASTNode) => ASTNode;
  activate?: (
    n: ASTNode | null | undefined,
    options: { allowMove: boolean; record: boolean }
  ) => void;
  activateNoRecord?: (node?: ASTNode) => void;
};

type KeyMap = { [index: string]: string };

export const defaultKeyMap: KeyMap = {
  // NAVIGATION
  Down: "Next Block",
  Up: "Previous Block",
  Home: "First Block",
  End: "Last Visible Block",
  Left: "Collapse or Focus Parent",
  Right: "Expand or Focus 1st Child",
  "Shift-Left": "Collapse All",
  "Shift-Right": "Expand All",
  "Shift-Alt-Left": "Collapse Current Root",
  "Shift-Alt-Right": "Expand Current Root",
  "Shift-,": "Jump to Root",
  "\\": "Read Ancestors",
  "Shift-\\": "Read Children",
  "Shift-Tab": "Shift Focus",

  // EDITING
  Enter: "Edit",
  "Ctrl-[": "Insert Left",
  "Ctrl-]": "Insert Right",

  // SEARCH, SELECTION & CLIPBOARD
  Space: "Toggle Selection",
  Esc: "Clear Selection",
  "Ctrl-Esc": "Clear Selection",
  "Alt-Q": "Clear Selection",
  Delete: "Delete Nodes",
  Backspace: "Delete Nodes",
  PageUp: "Search Previous",
  PageDown: "Search Next",
  F3: "Activate Search Dialog",
  "Ctrl-F": "Activate Search Dialog",
};

const macKeyMap: KeyMap = {
  "Cmd-Enter": "Edit Anything",
  "Cmd-F": "Activate Search Dialog",
  "Cmd-Z": "Undo",
  "Shift-Cmd-Z": "Redo",
  "Cmd-Y": "Redo",
  "Cmd-C": "Copy",
  "Cmd-V": "Paste",
  "Shift-Cmd-V": "Paste Before",
  "Cmd-X": "Cut",
  "Shift-Ctrl-/": "Help",
};

const pcKeyMap: KeyMap = {
  "Ctrl-Z": "Undo",
  "Ctrl-Y": "Redo",
  "Shift-Ctrl-Z": "Redo",
  "Ctrl-C": "Copy",
  "Ctrl-V": "Paste",
  "Shift-Ctrl-V": "Paste Before",
  "Ctrl-X": "Cut",
  "Shift-Ctrl-/": "Help",
};

const punctuation: KeyMap = {
  ",": "Comma",
  ".": "Period",
  "'": "Backslash",
  "/": "Forward Slash",
  Esc: "Escape",
  Ctrl: "Control",
  Cmd: "Command",
  Alt: mac ? "Option" : "Alt",
  "[": "Left Bracket",
  "]": "Right Bracket",
};

// given an array of keys, produce a spoken string that
// verbalizes punctuation and key names
function prounounce(keys: string[]) {
  const match = new RegExp("Esc|Ctrl|Cmd|Alt|[.,/#!$%^&*;:{}=_`~()]", "gi");
  let ws = keys.map((k) => k.replace(match, (m) => punctuation[m]));
  return ws.length < 3
    ? ws.join(" or ")
    : ws
        .slice(0, ws.length - 1)
        .concat(`or ${ws.slice(-1)}`)
        .join(", ");
}

// Add platform-specific keys
Object.assign(defaultKeyMap, mac ? macKeyMap : pcKeyMap);
// see https://codemirror.net/doc/manual.html#keymaps
CodeMirror.normalizeKeyMap(defaultKeyMap);

const pasteHandler = (env: Env, e: React.KeyboardEvent) => {
  if (!env.isNodeEnv) {
    return CodeMirror.Pass;
  }
  const before = e.shiftKey; // shiftKey=down => we paste BEFORE the active node
  const pos = before ? env.node.srcRange().from : env.node.srcRange().to;
  // Case 1: Overwriting selected nodes
  if (env.state.selections.includes(env.node.id)) {
    paste(new ReplaceNodeTarget(env.node));
  }
  // Case 2: Inserting to the left or right of the root
  else if (!env.node.parent) {
    paste(new OverwriteTarget(pos, pos));
  }
  // Case 3: Pasting to an adjacent dropTarget. Make sure it's a valid field!
  else {
    const DTnode = document.getElementById(
      "block-drop-target-" + getDTid(env.node, before)
    );
    if (DTnode?.dataset?.field) {
      // We're somewhere valid in the AST. Initiate paste on the target field!
      paste(new InsertTarget(env.node.parent, DTnode.dataset.field, pos));
    } else {
      playSound(BEEP);
      say(`Cannot paste ${e.shiftKey ? "before" : "after"} this node.`);
    }
  }
};

const commandMap: {
  [index: string]: (env: Env, e: React.KeyboardEvent) => void;
} = {
  "Shift Focus": (env, e) => {
    e.preventDefault();
    KeyDownContext.toolbarRef.current.focus();
  },
  // NAVIGATION
  "Previous Block": (env, e) => {
    e.preventDefault();
    if (env.isNodeEnv) {
      let prev = env.fastSkip((node) => node.prev);
      if (prev) {
        return env.activateByNid(prev.nid);
      } else {
        return playSound(BEEP);
      }
    }
    const prevNode =
      env.state.cur && env.state.ast.getNodeBeforeCur(env.state.cur);
    return prevNode
      ? env.activateByNid(prevNode.nid, { allowMove: true })
      : playSound(BEEP);
  },

  "Next Block": (env, e) => {
    e.preventDefault();
    if (env.isNodeEnv) {
      let next = env.fastSkip((node) => node.next);
      if (next) {
        return env.activateByNid(next.nid);
      } else {
        return playSound(BEEP);
      }
    }
    const nextNode =
      env.state.cur && env.state.ast.getNodeAfterCur(env.state.cur);
    return nextNode
      ? env.activateByNid(nextNode.nid, { allowMove: true })
      : playSound(BEEP);
  },

  "First Block": (env, _) => {
    if (!env.isNodeEnv) {
      return CodeMirror.Pass;
    }
    env.activateByNid(0, { allowMove: true });
  },

  "Last Visible Block": (env, _) => {
    if (!env.isNodeEnv) {
      return CodeMirror.Pass;
    } else {
      env.activateByNid(getLastVisibleNode(env.state).nid);
    }
  },

  "Collapse or Focus Parent": (env, e) => {
    e.preventDefault();
    if (!env.isNodeEnv) {
      return CodeMirror.Pass;
    }
    if (env.expandable && !env.isCollapsed && !env.isLocked()) {
      env.collapse(env.node.id);
    } else if (env.node.parent) {
      env.activateByNid(env.node.parent.nid);
    } else {
      playSound(BEEP);
    }
  },

  "Expand or Focus 1st Child": (env, e) => {
    if (!env.isNodeEnv) {
      return CodeMirror.Pass;
    }
    const node = env.node;
    e.preventDefault();
    if (env.expandable && env.isCollapsed && !env.isLocked()) {
      env.uncollapse(node.id);
    } else if (node.next?.parent === node) {
      env.activateByNid(node.next.nid);
    } else {
      playSound(BEEP);
    }
  },

  "Collapse All": (env, _) => {
    if (!env.isNodeEnv) {
      return CodeMirror.Pass;
    }
    env.dispatch({ type: "COLLAPSE_ALL" });
    env.activateByNid(getRoot(env.node).nid);
  },

  "Expand All": (env, _) => {
    if (!env.isNodeEnv) {
      return CodeMirror.Pass;
    } else {
      return env.dispatch({ type: "UNCOLLAPSE_ALL" });
    }
  },

  "Collapse Current Root": (env, _) => {
    if (!env.isNodeEnv) {
      return CodeMirror.Pass;
    }
    if (!env.node.parent && (env.isCollapsed || !env.expandable)) {
      playSound(BEEP);
    } else {
      let root = getRoot(env.node);
      let descendants = [...root.descendants()];
      descendants.forEach((d) => env.isNodeEnv && env.collapse(d.id));
      env.activateByNid(root.nid);
    }
  },

  "Expand Current Root": (env, _) => {
    if (!env.isNodeEnv) {
      return CodeMirror.Pass;
    }
    let root = getRoot(env.node);
    [...root.descendants()].forEach(
      (d) => env.isNodeEnv && env.uncollapse(d.id)
    );
    env.activateByNid(root.nid);
  },

  "Jump to Root": (env, _) => {
    if (!env.isNodeEnv) {
      return CodeMirror.Pass;
    } else {
      env.activateByNid(getRoot(env.node).nid);
    }
  },

  "Read Ancestors": (env, _) => {
    if (!env.isNodeEnv) {
      return CodeMirror.Pass;
    }
    const parents = [env.node.shortDescription()];
    let next = env.node.parent;
    while (next) {
      parents.push(next.shortDescription() + ", at level " + next.level);
      next = next.parent;
    }
    if (parents.length > 1) {
      say(parents.join(", inside "));
    } else {
      playSound(BEEP);
    }
  },

  "Read Children": (env, _) => {
    if (!env.isNodeEnv) {
      return CodeMirror.Pass;
    } else {
      say(env.node.describe(env.node.level));
    }
  },

  // SEARCH, SELECTION & CLIPBOARD
  "Toggle Selection": (env, e) => {
    if (!env.isNodeEnv) {
      return CodeMirror.Pass;
    }
    e.preventDefault();
    const node = env.node;
    const descendantIds = (node: ASTNode) =>
      [...node.descendants()].map((d) => d.id);
    const ancestorIds = (node: ASTNode) => {
      let ancestors = [],
        next = node.parent;
      while (next) {
        ancestors.push(next.id);
        next = next.parent;
      }
      return ancestors;
    };

    // if the node is already selected, remove it, its descendants
    // and any ancestor
    if (env.state.selections.includes(env.node.id)) {
      const prunedSelection = env.state.selections
        .filter((s) => !descendantIds(node).includes(s))
        .filter((s) => !ancestorIds(node).includes(s));
      env.dispatch({
        type: "SET_SELECTIONS",
        selections: prunedSelection,
      });
      // TODO(Emmanuel): announce removal
    } else {
      const isContained = (id: string) => env.state.ast.isAncestor(node.id, id);
      const doesContain = (id: string) => env.state.ast.isAncestor(id, node.id);
      let [removed, newSelections] = partition(
        env.state.selections,
        isContained
      );
      for (const _r of removed) {
        // TODO(Emmanuel): announce removal
      }
      if (newSelections.some(doesContain)) {
        playSound(BEEP);
        say("This node is already has a selected ancestor");
      } else {
        // TODO(Emmanuel): announce addition
        newSelections = newSelections.concat(descendantIds(node));
        env.dispatch({
          type: "SET_SELECTIONS",
          selections: newSelections,
        });
      }
    }
  },

  Edit: (env, e) => {
    if (!env.isNodeEnv) {
      return CodeMirror.Pass;
    }
    if (env.normallyEditable) {
      env.handleMakeEditable(e);
      e.preventDefault();
    } else if (env.expandable && !env.isLocked()) {
      (env.isCollapsed ? env.uncollapse : env.collapse)(env.node.id);
    } else {
      playSound(BEEP);
    }
  },

  "Edit Anything": (env, e) => {
    if (!env.isNodeEnv) {
      return CodeMirror.Pass;
    } else {
      return env.handleMakeEditable(e);
    }
  },

  "Clear Selection": (env, _) => {
    if (!env.isNodeEnv) {
      return CodeMirror.Pass;
    }
    env.dispatch({ type: "SET_SELECTIONS", selections: [] });
  },

  "Delete Nodes": (env, _) => {
    if (!env.isNodeEnv) {
      return CodeMirror.Pass;
    }
    if (!env.state.selections.length) {
      return say("Nothing selected");
    }
    const nodesToDelete = env.state.selections.map(env.state.ast.getNodeById);
    delete_(nodesToDelete, "deleted");
  },

  // use the srcRange() to insert before/after the node *and*
  // any associated comments
  "Insert Right": (env, _) => {
    if (!env.isNodeEnv) {
      return CodeMirror.Pass;
    }
    if (!env.setRight()) {
      env.setCursor(env.node.srcRange().to);
    }
  },
  "Insert Left": (env, _) => {
    if (!env.isNodeEnv) {
      return CodeMirror.Pass;
    }
    if (!env.setLeft()) {
      env.setCursor(env.node.srcRange().from);
    }
  },

  Cut: (env, _) => {
    if (!env.isNodeEnv) {
      return CodeMirror.Pass;
    }
    if (!env.state.selections.length) {
      return say("Nothing selected");
    }
    const nodesToCut = env.state.selections.map(env.state.ast.getNodeById);
    copy(nodesToCut, "cut");
    delete_(nodesToCut);
  },

  Copy: (env, _) => {
    if (!env.isNodeEnv) {
      return CodeMirror.Pass;
    }
    // if no nodes are selected, do it on focused node's id instead
    const nodeIds = !env.state.selections.length
      ? [env.node.id]
      : env.state.selections;
    const nodesToCopy = nodeIds.map(env.state.ast.getNodeById);
    copy(nodesToCopy, "copied");
  },

  Paste: pasteHandler,
  "Paste Before": pasteHandler,

  "Activate Search Dialog": (env, _) => {
    SHARED.search.onSearch(
      env.state,
      () => {},
      () => env.activateNoRecord(SHARED.search.search(true, env.state))
    );
  },

  "Search Previous": (env, e) => {
    e.preventDefault();
    env.activateNoRecord(SHARED.search.search(false, env.state));
  },

  "Search Next": (env, e) => {
    e.preventDefault();
    env.activateNoRecord(SHARED.search.search(true, env.state));
  },

  Undo: (env, e) => {
    e.preventDefault();
    preambleUndoRedo("undo");
    SHARED.cm.undo();
  },

  Redo: (env, e) => {
    e.preventDefault();
    preambleUndoRedo("redo");
    SHARED.cm.redo();
  },

  Help: (env, _) => {
    KeyDownContext.showDialog({
      title: "Keyboard Shortcuts",
      content: <KeyMapTable keyMap={defaultKeyMap} />,
    });
  },
};

// Recieves the key event, an environment (BlockEditor or Node), and the
// editor's keyMap. If there is a handler for that event, flatten the
// environment and add some utility methods, then set the key handler's
// "this" object to be that environment and call it.
export function keyDown(e: React.KeyboardEvent, inputEnv: InputEnv) {
  var handler = commandMap[defaultKeyMap[CodeMirror.keyName(e)]];
  if (handler) {
    e.stopPropagation();
    inputEnv.dispatch((_, getState) => {
      // set up the environment
      const state = getState();
      const env: Env = {
        ...inputEnv,
        state,
        // add convenience methods
        fastSkip: (next: (node: ASTNode) => ASTNode) =>
          env.isNodeEnv && skipCollapsed(env.node, next, state),
        activate: (
          n: ASTNode | null | undefined,
          options = { allowMove: true, record: true }
        ) => {
          if (n === null) {
            playSound(BEEP);
          }
          env.isNodeEnv &&
            env.activateByNid(n === undefined ? env.node.nid : n.nid, options);
        },
        activateNoRecord: (node?: ASTNode) => {
          if (!node) {
            return playSound(BEEP);
          } // nothing to activate
          env.dispatch(
            activateByNid(node.nid, { record: false, allowMove: true })
          );
        },
      };
      // If there's a node, make sure it's fresh
      if (env.isNodeEnv) {
        const updatedNode = state.ast.getNodeById(env.node.id);
        env.node = updatedNode && state.ast.getNodeByNId(updatedNode.nid);
      }
      handler(env, e);
    });
  }
}

const KeyMapTable = (props: { keyMap: KeyMap }) => {
  const { keyMap } = props;
  const reverseMap: { [index: string]: string[] } = {};
  Object.keys(keyMap).forEach((key) => {
    if (!reverseMap[keyMap[key]]) {
      reverseMap[keyMap[key]] = [key];
    } else reverseMap[keyMap[key]].push(key);
  });
  return (
    <table className="shortcuts">
      <tbody>
        {Object.entries(reverseMap).map(
          // for each command, make a row...
          (
            kv,
            i // for each row, list the kbd shortcuts
          ) => (
            <tr key={i}>
              <td>{kv[0]}</td>
              <td>
                {kv[1].map((k, j) => (
                  <kbd aria-hidden="true" key={j}>
                    {k}
                  </kbd>
                ))}
                <span className="screenreader-only">{prounounce(kv[1])}</span>
              </td>
            </tr>
          )
        )}
      </tbody>
    </table>
  );
};
