import React from "react";
import CodeMirror from "codemirror";
import {
  delete_,
  copy,
  paste,
  InsertTarget,
  ReplaceNodeTarget,
  OverwriteTarget,
  activateByNid,
  setCursor,
} from "./actions";
import {
  partition,
  getRoot,
  skipCollapsed,
  mac,
  getLastVisibleNode,
  playSound,
  BEEP,
} from "./utils";
import { say } from "./announcer";
import { findAdjacentDropTargetId as getDTid } from "./components/DropTarget";

import type { AppThunk } from "./store";
import type { AST, ASTNode } from "./ast";
import { CMBEditor } from "./editor";
import { Language } from "./CodeMirrorBlocks";
import type { AppHelpers } from "./components/Context";

type BlockEditorEnv = {
  isNodeEnv: false;
  appHelpers: AppHelpers;
  editor: CMBEditor;
  language: Language;
};

type NodeEnv = {
  isNodeEnv: true;

  appHelpers: AppHelpers;

  editor: CMBEditor;
  language: Language;
  isLocked: () => boolean;
  handleMakeEditable: (e?: React.KeyboardEvent) => void;
  setRight: (ast: AST) => boolean;
  setLeft: (ast: AST) => boolean;

  isCollapsed: boolean;
  expandable: boolean;
  normallyEditable: boolean;
  node: ASTNode;
};

export type InputEnv = BlockEditorEnv | NodeEnv;

type Env = InputEnv & {
  fastSkip: (
    next: (node: ASTNode) => ASTNode | undefined
  ) => ASTNode | undefined;
  activateNoRecord: (node?: ASTNode) => void;
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
  const ws = keys.map((k) => k.replace(match, (m) => punctuation[m]));
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

const pasteHandler =
  (env: Env, e: React.KeyboardEvent): AppThunk =>
  (dispatch, getState) => {
    if (!env.isNodeEnv) {
      return;
    }
    const before = e.shiftKey; // shiftKey=down => we paste BEFORE the active node
    const pos = before ? env.node.srcRange().from : env.node.srcRange().to;
    const { selections, ast } = getState();
    const parent = ast.getNodeParent(env.node);
    // Case 1: Overwriting selected nodes
    if (selections.includes(env.node.id)) {
      dispatch(
        paste(env.editor, new ReplaceNodeTarget(env.node), env.language.parse)
      );
    }
    // Case 2: Inserting to the left or right of the root
    else if (!parent) {
      dispatch(
        paste(
          env.editor,

          new OverwriteTarget(pos, pos),
          env.language.parse
        )
      );
    }
    // Case 3: Pasting to an adjacent dropTarget. Make sure it's a valid field!
    else {
      const DTnode = document.getElementById(
        "block-drop-target-" + getDTid(ast, env.node, before)
      );
      if (DTnode?.dataset?.field) {
        // We're somewhere valid in the AST. Initiate paste on the target field!
        dispatch(
          paste(
            env.editor,

            new InsertTarget(parent, DTnode.dataset.field, pos),
            env.language.parse
          )
        );
      } else {
        playSound(BEEP);
        say(`Cannot paste ${e.shiftKey ? "before" : "after"} this node.`);
      }
    }
  };

const commandMap: {
  [index: string]: (env: Env, e: React.KeyboardEvent) => void | AppThunk;
} = {
  "Shift Focus": (env, e) => {
    e.preventDefault();
    env.appHelpers.focusToolbar && env.appHelpers.focusToolbar();
  },
  // NAVIGATION
  "Previous Block": (env, e) => (dispatch, getState) => {
    const state = getState();
    e.preventDefault();
    if (env.isNodeEnv) {
      const prev = env.fastSkip(
        (node) => state.ast.getNodeBefore(node) || undefined
      );
      if (prev) {
        return dispatch(activateByNid(env.editor, prev.nid));
      } else {
        return playSound(BEEP);
      }
    }
    const prevNode = state.cur && state.ast.getNodeBeforeCur(state.cur);
    return prevNode
      ? dispatch(
          activateByNid(env.editor, prevNode.nid, {
            allowMove: true,
          })
        )
      : playSound(BEEP);
  },

  "Next Block": (env, e) => (dispatch, getState) => {
    e.preventDefault();
    if (env.isNodeEnv) {
      const { ast } = getState();
      const next = env.fastSkip((node) => ast.getNodeAfter(node) || undefined);
      if (next) {
        return dispatch(activateByNid(env.editor, next.nid));
      } else {
        return playSound(BEEP);
      }
    }
    const { cur, ast } = getState();
    const nextNode = cur && ast.getNodeAfterCur(cur);
    return nextNode
      ? dispatch(
          activateByNid(env.editor, nextNode.nid, {
            allowMove: true,
          })
        )
      : playSound(BEEP);
  },

  "First Block": (env, _) => {
    if (!env.isNodeEnv) {
      return;
    }
    return activateByNid(env.editor, 0, { allowMove: true });
  },

  "Last Visible Block": (env, _) => (dispatch, getState) => {
    if (!env.isNodeEnv) {
      return;
    } else {
      const lastVisible = getLastVisibleNode(getState());
      lastVisible && dispatch(activateByNid(env.editor, lastVisible.nid));
    }
  },

  "Collapse or Focus Parent": (env, e) => (dispatch, getState) => {
    e.preventDefault();
    if (!env.isNodeEnv) {
      return;
    }
    const { ast } = getState();
    const parent = ast.getNodeParent(env.node);
    if (env.expandable && !env.isCollapsed && !env.isLocked()) {
      dispatch({ type: "COLLAPSE", id: env.node.id });
    } else if (parent) {
      dispatch(activateByNid(env.editor, parent.nid));
    } else {
      playSound(BEEP);
    }
  },

  "Expand or Focus 1st Child": (env, e) => (dispatch, getState) => {
    if (!env.isNodeEnv) {
      return;
    }
    const node = env.node;
    const { ast } = getState();
    const nextNode = ast.getNodeAfter(node);
    e.preventDefault();
    if (env.expandable && env.isCollapsed && !env.isLocked()) {
      dispatch({ type: "UNCOLLAPSE", id: node.id });
    } else if (nextNode && ast.getNodeParent(nextNode) === node) {
      dispatch(activateByNid(env.editor, nextNode.nid));
    } else {
      playSound(BEEP);
    }
  },

  "Collapse All": (env, _) => (dispatch, getState) => {
    if (!env.isNodeEnv) {
      return;
    }
    dispatch({ type: "COLLAPSE_ALL" });
    dispatch(
      activateByNid(
        env.editor,

        getRoot(getState().ast, env.node).nid
      )
    );
  },

  "Expand All": (env, _) => {
    if (!env.isNodeEnv) {
      return;
    } else {
      return (dispatch) => dispatch({ type: "UNCOLLAPSE_ALL" });
    }
  },

  "Collapse Current Root": (env, _) => (dispatch, getState) => {
    if (!env.isNodeEnv) {
      return;
    }
    const ast = getState().ast;
    if (!ast.getNodeParent(env.node) && (env.isCollapsed || !env.expandable)) {
      playSound(BEEP);
    } else {
      const root = getRoot(ast, env.node);
      const descendants = [...root.descendants()];
      descendants.forEach(
        (d) => env.isNodeEnv && dispatch({ type: "COLLAPSE", id: d.id })
      );
      dispatch(activateByNid(env.editor, root.nid));
    }
  },

  "Expand Current Root": (env, _) => (dispatch, getState) => {
    if (!env.isNodeEnv) {
      return;
    }
    const root = getRoot(getState().ast, env.node);
    [...root.descendants()].forEach(
      (d) => env.isNodeEnv && dispatch({ type: "UNCOLLAPSE", id: d.id })
    );
    dispatch(activateByNid(env.editor, root.nid));
  },

  "Jump to Root": (env, _) => (dispatch, getState) => {
    if (!env.isNodeEnv) {
      return;
    } else {
      return dispatch(
        activateByNid(
          env.editor,

          getRoot(getState().ast, env.node).nid
        )
      );
    }
  },

  "Read Ancestors": (env, _) => (dispatch, getState) => {
    if (!env.isNodeEnv) {
      return;
    }
    const parents = [env.node.shortDescription()];
    const { ast } = getState();
    let next = ast.getNodeParent(env.node);
    while (next) {
      parents.push(next.shortDescription() + ", at level " + next.level);
      next = ast.getNodeParent(next);
    }
    if (parents.length > 1) {
      say(parents.join(", inside "));
    } else {
      playSound(BEEP);
    }
  },

  "Read Children": (env, _) => {
    if (!env.isNodeEnv) {
      return;
    } else {
      const description = env.node.describe(env.node.level);
      description && say(description);
    }
  },

  // SEARCH, SELECTION & CLIPBOARD
  "Toggle Selection": (env, e) => (dispatch, getState) => {
    if (!env.isNodeEnv) {
      return;
    }
    e.preventDefault();
    const { selections, ast } = getState();
    const node = env.node;
    const descendantIds = (node: ASTNode) =>
      [...node.descendants()].map((d) => d.id);
    const ancestorIds = (node: ASTNode) => {
      const ancestors = [];
      let next = ast.getNodeParent(node);
      while (next) {
        ancestors.push(next.id);
        next = ast.getNodeParent(next);
      }
      return ancestors;
    };

    // if the node is already selected, remove it, its descendants
    // and any ancestor
    if (selections.includes(env.node.id)) {
      const prunedSelection = selections
        .filter((s) => !descendantIds(node).includes(s))
        .filter((s) => !ancestorIds(node).includes(s));
      dispatch({
        type: "SET_SELECTIONS",
        selections: prunedSelection,
      });
      // TODO(Emmanuel): announce removal
    } else {
      const isContained = (id: string) => ast.isAncestor(node.id, id);
      const doesContain = (id: string) => ast.isAncestor(id, node.id);
      const [removed, newSelections] = partition(selections, isContained);
      for (const _r of removed) {
        // TODO(Emmanuel): announce removal
      }
      if (newSelections.some(doesContain)) {
        playSound(BEEP);
        say("This node is already has a selected ancestor");
      } else {
        // TODO(Emmanuel): announce addition
        dispatch({
          type: "SET_SELECTIONS",
          selections: newSelections.concat(descendantIds(node)),
        });
      }
    }
  },

  Edit: (env, e) => (dispatch) => {
    if (!env.isNodeEnv) {
      return;
    }
    if (env.normallyEditable) {
      env.handleMakeEditable(e);
      e.preventDefault();
    } else if (env.expandable && !env.isLocked()) {
      if (env.isCollapsed) {
        dispatch({ type: "UNCOLLAPSE", id: env.node.id });
      } else {
        dispatch({ type: "COLLAPSE", id: env.node.id });
      }
    } else {
      playSound(BEEP);
    }
  },

  "Edit Anything": (env, e) => {
    if (!env.isNodeEnv) {
      return;
    } else {
      return env.handleMakeEditable(e);
    }
  },

  "Clear Selection": (env, _) => (dispatch) => {
    if (!env.isNodeEnv) {
      return;
    }
    dispatch({ type: "SET_SELECTIONS", selections: [] });
  },

  "Delete Nodes": (env, _) => (dispatch, getState) => {
    if (!env.isNodeEnv) {
      return;
    }
    const { selections, ast } = getState();
    if (!selections.length) {
      return say("Nothing selected");
    }
    const nodesToDelete = selections.map(ast.getNodeByIdOrThrow);
    dispatch(delete_(env.editor, nodesToDelete, env.language.parse, "deleted"));
  },

  // use the srcRange() to insert before/after the node *and*
  // any associated comments
  "Insert Right": (env, _) => (dispatch, getState) => {
    if (!env.isNodeEnv) {
      return;
    }
    if (!env.setRight(getState().ast)) {
      dispatch(setCursor(env.editor, env.node.srcRange().to));
    }
  },
  "Insert Left": (env, _) => (dispatch, getState) => {
    if (!env.isNodeEnv) {
      return;
    }
    if (!env.setLeft(getState().ast)) {
      dispatch(setCursor(env.editor, env.node.srcRange().from));
    }
  },

  Cut: (env, _) => (dispatch, getState) => {
    if (!env.isNodeEnv) {
      return;
    }
    const { selections, ast } = getState();
    if (!selections.length) {
      return say("Nothing selected");
    }
    const nodesToCut = selections.map(ast.getNodeByIdOrThrow);
    copy(getState(), nodesToCut, "cut");
    dispatch(delete_(env.editor, nodesToCut, env.language.parse));
  },

  Copy: (env, _) => (dispatch, getState) => {
    if (!env.isNodeEnv) {
      return;
    }
    // if no nodes are selected, do it on focused node's id instead
    const { selections, ast } = getState();
    const nodeIds = !selections.length ? [env.node.id] : selections;
    const nodesToCopy = nodeIds.map(ast.getNodeByIdOrThrow);
    copy(getState(), nodesToCopy, "copied");
  },

  Paste: pasteHandler,
  "Paste Before": pasteHandler,

  // Search is disabled for now. We will revisit it in https://github.com/bootstrapworld/codemirror-blocks/issues/485
  //
  // "Activate Search Dialog": (env, _) => (dispatch, getState) => {
  //   env.search.onSearch(
  //     () => {},
  //     () =>
  //       env.activateNoRecord(env.search.search(true, getState()) ?? undefined)
  //   );
  // },

  // "Search Previous": (env, e) => (dispatch, getState) => {
  //   e.preventDefault();
  //   env.activateNoRecord(env.search.search(false, getState()) ?? undefined);
  // },

  // "Search Next": (env, e) => (dispatch, getState) => {
  //   e.preventDefault();
  //   env.activateNoRecord(env.search.search(true, getState()) ?? undefined);
  // },

  Undo: (env, e) => doTopmostAction(env, e, "undo"),

  Redo: (env, e) => doTopmostAction(env, e, "redo"),

  Help: (env, _) => {
    if (!env.appHelpers.showDialog) {
      throw new Error(
        "Expected Help to be used in a context that can show a dialog."
      );
    }
    env.appHelpers.showDialog({
      title: "Keyboard Shortcuts",
      content: <KeyMapTable keyMap={defaultKeyMap} />,
    });
  },
};

const doTopmostAction =
  ({ editor }: Env, e: React.KeyboardEvent, which: "undo" | "redo"): AppThunk =>
  (dispatch, getState) => {
    e.preventDefault();
    const topmostAction = editor.getTopmostAction(which);
    const state = getState();
    state.undoableAction = topmostAction.undoableAction;
    state.actionFocus = topmostAction.actionFocus;
    if (which === "undo") {
      say(`UNDID: ${topmostAction.undoableAction}`);
      editor.undo();
    } else {
      say(`REDID: ${topmostAction.undoableAction}`);
      editor.redo();
    }
  };

// Recieves the key event, an environment (BlockEditor or Node), and the
// editor's keyMap. If there is a handler for that event, add some utility
// methods and call the handler with the environment.
export const keyDown =
  (e: React.KeyboardEvent, inputEnv: InputEnv): AppThunk =>
  (dispatch) => {
    const handler = commandMap[defaultKeyMap[CodeMirror.keyName(e)]];
    if (handler) {
      e.stopPropagation();
      dispatch((dispatch, getState) => {
        // set up the environment
        const state = getState();
        const env: Env = {
          ...inputEnv,
          // add convenience methods
          fastSkip: (next: (node: ASTNode) => ASTNode) =>
            env.isNodeEnv ? skipCollapsed(env.node, next, state) : undefined,
          activateNoRecord: (node?: ASTNode) => {
            if (!node) {
              return playSound(BEEP);
            } // nothing to activate
            dispatch(
              activateByNid(env.editor, node.nid, {
                record: false,
                allowMove: true,
              })
            );
          },
        };
        // If there's a node, make sure it's fresh
        if (env.isNodeEnv) {
          const updatedNode = state.ast.getNodeByIdOrThrow(env.node.id);
          env.node =
            updatedNode && state.ast.getNodeByNIdOrThrow(updatedNode.nid);
        }
        const action = handler(env, e);
        if (action) {
          dispatch(action);
        }
      });
    }
  };

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
