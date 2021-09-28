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

function pasteHandler(this: Env, _: Editor, e: React.KeyboardEvent) {
  if (!this.isNodeEnv) {
    return CodeMirror.Pass;
  }
  const before = e.shiftKey; // shiftKey=down => we paste BEFORE the active node
  const pos = before ? this.node.srcRange().from : this.node.srcRange().to;
  // Case 1: Overwriting selected nodes
  if (this.state.selections.includes(this.node.id)) {
    paste(new ReplaceNodeTarget(this.node));
  }
  // Case 2: Inserting to the left or right of the root
  else if (!this.node.parent) {
    paste(new OverwriteTarget(pos, pos));
  }
  // Case 3: Pasting to an adjacent dropTarget. Make sure it's a valid field!
  else {
    const DTnode = document.getElementById(
      "block-drop-target-" + getDTid(this.node, before)
    );
    if (DTnode?.dataset?.field) {
      // We're somewhere valid in the AST. Initiate paste on the target field!
      paste(new InsertTarget(this.node.parent, DTnode.dataset.field, pos));
    } else {
      playSound(BEEP);
      say(`Cannot paste ${e.shiftKey ? "before" : "after"} this node.`);
    }
  }
}

export const commandMap: {
  [index: string]: (this: Env, cm: Editor, e: React.KeyboardEvent) => void;
} = {
  "Shift Focus": function (_, e) {
    e.preventDefault();
    KeyDownContext.toolbarRef.current.focus();
  },
  // NAVIGATION
  "Previous Block": function (_, e) {
    e.preventDefault();
    if (this.isNodeEnv) {
      let prev = this.fastSkip((node) => node.prev);
      if (prev) {
        return this.activateByNid(prev.nid);
      } else {
        return playSound(BEEP);
      }
    }
    const prevNode =
      this.state.cur && this.state.ast.getNodeBeforeCur(this.state.cur);
    return prevNode
      ? this.activateByNid(prevNode.nid, { allowMove: true })
      : playSound(BEEP);
  },

  "Next Block": function (_, e) {
    e.preventDefault();
    if (this.isNodeEnv) {
      let next = this.fastSkip((node) => node.next);
      if (next) {
        return this.activateByNid(next.nid);
      } else {
        return playSound(BEEP);
      }
    }
    const nextNode =
      this.state.cur && this.state.ast.getNodeAfterCur(this.state.cur);
    return nextNode
      ? this.activateByNid(nextNode.nid, { allowMove: true })
      : playSound(BEEP);
  },

  "First Block": function (_) {
    if (!this.isNodeEnv) {
      return CodeMirror.Pass;
    }
    this.activateByNid(0, { allowMove: true });
  },

  "Last Visible Block": function (_) {
    if (!this.isNodeEnv) {
      return CodeMirror.Pass;
    } else {
      this.activateByNid(getLastVisibleNode(this.state).nid);
    }
  },

  "Collapse or Focus Parent": function (_, e) {
    e.preventDefault();
    if (!this.isNodeEnv) {
      return CodeMirror.Pass;
    }
    if (this.expandable && !this.isCollapsed && !this.isLocked()) {
      this.collapse(this.node.id);
    } else if (this.node.parent) {
      this.activateByNid(this.node.parent.nid);
    } else {
      playSound(BEEP);
    }
  },

  "Expand or Focus 1st Child": function (_, e) {
    if (!this.isNodeEnv) {
      return CodeMirror.Pass;
    }
    const node = this.node;
    e.preventDefault();
    if (this.expandable && this.isCollapsed && !this.isLocked()) {
      this.uncollapse(node.id);
    } else if (node.next?.parent === node) {
      this.activateByNid(node.next.nid);
    } else {
      playSound(BEEP);
    }
  },

  "Collapse All": function (_) {
    if (!this.isNodeEnv) {
      return CodeMirror.Pass;
    }
    this.dispatch({ type: "COLLAPSE_ALL" });
    this.activateByNid(getRoot(this.node).nid);
  },

  "Expand All": function (_) {
    if (!this.isNodeEnv) {
      return CodeMirror.Pass;
    } else {
      return this.dispatch({ type: "UNCOLLAPSE_ALL" });
    }
  },

  "Collapse Current Root": function (_) {
    if (!this.isNodeEnv) {
      return CodeMirror.Pass;
    }
    if (!this.node.parent && (this.isCollapsed || !this.expandable)) {
      playSound(BEEP);
    } else {
      let root = getRoot(this.node);
      let descendants = [...root.descendants()];
      descendants.forEach((d) => this.isNodeEnv && this.collapse(d.id));
      this.activateByNid(root.nid);
    }
  },

  "Expand Current Root": function (_) {
    if (!this.isNodeEnv) {
      return CodeMirror.Pass;
    }
    let root = getRoot(this.node);
    [...root.descendants()].forEach(
      (d) => this.isNodeEnv && this.uncollapse(d.id)
    );
    this.activateByNid(root.nid);
  },

  "Jump to Root": function (_) {
    if (!this.isNodeEnv) {
      return CodeMirror.Pass;
    } else {
      this.activateByNid(getRoot(this.node).nid);
    }
  },

  "Read Ancestors": function (_) {
    if (!this.isNodeEnv) {
      return CodeMirror.Pass;
    }
    const parents = [this.node.shortDescription()];
    let next = this.node.parent;
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

  "Read Children": function (_) {
    if (!this.isNodeEnv) {
      return CodeMirror.Pass;
    } else {
      say(this.node.describe(this.node.level));
    }
  },

  // SEARCH, SELECTION & CLIPBOARD
  "Toggle Selection": function (_, e) {
    if (!this.isNodeEnv) {
      return CodeMirror.Pass;
    }
    e.preventDefault();
    const node = this.node;
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
    if (this.state.selections.includes(this.node.id)) {
      const prunedSelection = this.state.selections
        .filter((s) => !descendantIds(node).includes(s))
        .filter((s) => !ancestorIds(node).includes(s));
      this.dispatch({
        type: "SET_SELECTIONS",
        selections: prunedSelection,
      });
      // TODO(Emmanuel): announce removal
    } else {
      const isContained = (id: string) =>
        this.state.ast.isAncestor(node.id, id);
      const doesContain = (id: string) =>
        this.state.ast.isAncestor(id, node.id);
      let [removed, newSelections] = partition(
        this.state.selections,
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
        this.dispatch({
          type: "SET_SELECTIONS",
          selections: newSelections,
        });
      }
    }
  },

  Edit: function (_, e) {
    if (!this.isNodeEnv) {
      return CodeMirror.Pass;
    }
    if (this.normallyEditable) {
      this.handleMakeEditable(e);
      e.preventDefault();
    } else if (this.expandable && !this.isLocked()) {
      (this.isCollapsed ? this.uncollapse : this.collapse)(this.node.id);
    } else {
      playSound(BEEP);
    }
  },

  "Edit Anything": function (_, e) {
    if (!this.isNodeEnv) {
      return CodeMirror.Pass;
    } else {
      return this.handleMakeEditable(e);
    }
  },

  "Clear Selection": function (_) {
    if (!this.isNodeEnv) {
      return CodeMirror.Pass;
    }
    this.dispatch({ type: "SET_SELECTIONS", selections: [] });
  },

  "Delete Nodes": function (_) {
    if (!this.isNodeEnv) {
      return CodeMirror.Pass;
    }
    if (!this.state.selections.length) {
      return say("Nothing selected");
    }
    const nodesToDelete = this.state.selections.map(this.state.ast.getNodeById);
    delete_(nodesToDelete, "deleted");
  },

  // use the srcRange() to insert before/after the node *and*
  // any associated comments
  "Insert Right": function (_) {
    if (!this.isNodeEnv) {
      return CodeMirror.Pass;
    }
    if (!this.setRight()) {
      this.setCursor(this.node.srcRange().to);
    }
  },
  "Insert Left": function (_) {
    if (!this.isNodeEnv) {
      return CodeMirror.Pass;
    }
    if (!this.setLeft()) {
      this.setCursor(this.node.srcRange().from);
    }
  },

  Cut: function (_) {
    if (!this.isNodeEnv) {
      return CodeMirror.Pass;
    }
    if (!this.state.selections.length) {
      return say("Nothing selected");
    }
    const nodesToCut = this.state.selections.map(this.state.ast.getNodeById);
    copy(nodesToCut, "cut");
    delete_(nodesToCut);
  },

  Copy: function (_) {
    if (!this.isNodeEnv) {
      return CodeMirror.Pass;
    }
    // if no nodes are selected, do it on focused node's id instead
    const nodeIds = !this.state.selections.length
      ? [this.node.id]
      : this.state.selections;
    const nodesToCopy = nodeIds.map(this.state.ast.getNodeById);
    copy(nodesToCopy, "copied");
  },

  Paste: pasteHandler,
  "Paste Before": pasteHandler,

  "Activate Search Dialog": function (_) {
    SHARED.search.onSearch(
      this.state,
      () => {},
      () => this.activateNoRecord(SHARED.search.search(true, this.state))
    );
  },

  "Search Previous": function (_, e) {
    e.preventDefault();
    this.activateNoRecord(SHARED.search.search(false, this.state));
  },

  "Search Next": function (_, e) {
    e.preventDefault();
    this.activateNoRecord(SHARED.search.search(true, this.state));
  },

  Undo: function (_, e) {
    e.preventDefault();
    preambleUndoRedo("undo");
    SHARED.cm.undo();
  },

  Redo: function (_, e) {
    e.preventDefault();
    preambleUndoRedo("redo");
    SHARED.cm.redo();
  },

  Help: function (_) {
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
      handler.bind(env)(SHARED.cm, e);
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
