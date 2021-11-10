import {
  poscmp,
  srcRangeIncludes,
  warn,
  createEditAnnouncement,
} from "../utils";
import { say, cancelAnnouncement } from "../announcer";
import { AppDispatch, AppThunk } from "./store";
import {
  performEdits,
  edit_insert,
  edit_delete,
  edit_replace,
  edit_overwrite,
  EditInterface,
} from "../edits/performEdits";
import { AST, ASTNode, Pos } from "../ast";
import { AppAction } from "./reducers";
import { CMBEditor, ReadonlyCMBEditor, ReadonlyRangedText } from "../editor";
import { useDispatch } from "react-redux";
import type { Language } from "../CodeMirrorBlocks";
import { Result } from "../edits/result";
import { useContext } from "react";
import { LanguageContext } from "../components/Context";
import * as selectors from "./selectors";
import { pasteFromClipboard } from "../copypaste";

export const setAST = (ast: AST) => ({
  type: "SET_AST" as const,
  ast,
});

export const collapseNode = (node: ASTNode) => ({
  type: "COLLAPSE" as const,
  id: node.id,
});

export const uncollapseNode = (node: ASTNode) => ({
  type: "UNCOLLAPSE" as const,
  id: node.id,
});

export const collapseAll = () => ({ type: "COLLAPSE_ALL" as const });
export const uncollapseAll = () => ({ type: "UNCOLLAPSE_ALL" as const });

export const setErrorId = (errorId: string) => ({
  type: "SET_ERROR_ID" as const,
  errorId,
});

export const clearError = () => ({
  type: "SET_ERROR_ID" as const,
  errorId: "",
});

export const setFocusedNode = (node: ASTNode) => ({
  type: "SET_FOCUS" as const,
  focusId: node.id,
});

export const setSelectedNodeIds = (ids: string[]) => ({
  type: "SET_SELECTIONS" as const,
  selections: ids,
});

export const setQuarantine = (start: Pos, end: Pos, text: string) => ({
  type: "SET_QUARANTINE" as const,
  start,
  end,
  text,
});

export const changeQuarantine = (newValue: string) => ({
  type: "CHANGE_QUARANTINE" as const,
  text: newValue,
});

export const disableQuarantine = () => ({
  type: "DISABLE_QUARANTINE" as const,
});

export const setBlockMode = (enabled: boolean) => ({
  type: "SET_BLOCK_MODE" as const,
  enabled,
});

// All editing actions are defined here.
//
// Many actions take a Target as an option. A Target may be constructed by any
// of the methods on the `Targets` export below.
//
// Just about every action will return a result object, containing the new ast
// if successful, or an error value if unssucessful. See the types.
//
// The implementation of actions is in the folder `src/edits/`. IT IS PRIVATE,
// AND FOR THE MOST PART, NO FILE EXCEPT src/actions.js SHOULD NEED TO IMPORT IT.
// (Exception: speculateChanges and commitChanges are sometimes imported.)
// The implementation is complex, because while edits are best thought of as
// operations on the AST, they must all be transformed into text edits, and the
// only interface we have into the language's textual syntax are the `pretty`
// and `parse` methods.

// A _Target_ says where an action is directed. For example, a target may be a
// node or a drop target.
//
// These are the kinds of targets:
// - InsertTarget: insert at a location inside the AST.
// - ReplaceNodeTarget: replace an ast node.
// - OverwriteTarget: replace a range of text at the top level.
//
// These kinds of actions _have_ a target:
// - Paste: the target says where to paste.
// - Drag&Drop: the target says what's being dropped on.
// - Insert/Edit: the target says where the text is being inserted/edited.
//
// Targets are defined at the bottom of this file.

// Insert `text` at the given `target`.
// See the comment at the top of the file for what kinds of `target` there are.
export const insert =
  (
    text: string,
    target: Target,
    editor: CMBEditor,
    parse: Language["parse"],
    annt?: string
  ): AppThunk<Result<{ newAST: AST; focusId?: string | undefined }>> =>
  (dispatch, getState) => {
    checkTarget(target);
    const edits = [target.toEdit(selectors.getAST(getState()), text)];
    return dispatch(performEdits(edits, parse, editor, annt));
  };

// Delete the given nodes.
// 'delete' is a reserved word, hence the trailing underscore
export const delete_ =
  (
    editor: CMBEditor,
    nodes: ASTNode[],
    parse: Language["parse"],
    editWord?: string
  ): AppThunk =>
  (dispatch, getState) => {
    if (nodes.length === 0) {
      return;
    }
    nodes.sort((a, b) => poscmp(b.from, a.from)); // To focus before first deletion
    const ast = selectors.getAST(getState());
    const edits = nodes.map((node) => edit_delete(ast, node));
    let annt: string | undefined = undefined;
    if (editWord) {
      annt = createEditAnnouncement(nodes, editWord);
      say(annt);
    }
    dispatch(performEdits(edits, parse, editor, annt));
    dispatch(setSelectedNodeIds([]));
  };

// Paste from the clipboard at the given `target`.
// See the comment at the top of the file for what kinds of `target` there are.
export const paste =
  (editor: CMBEditor, target: Target, parse: Language["parse"]): AppThunk =>
  (dispatch, getState) => {
    checkTarget(target);
    pasteFromClipboard((text) => {
      const edits = [target.toEdit(selectors.getAST(getState()), text)];
      dispatch(performEdits(edits, parse, editor));
      dispatch(setSelectedNodeIds([]));
    });
  };

export function useDropAction() {
  // Drag from `src` (which should be a d&d monitor thing) to `target`.
  // See the comment at the top of the file for what kinds of `target` there are.
  const dispatch: AppDispatch = useDispatch();
  const language = useContext(LanguageContext);
  return function drop(
    editor: CMBEditor,
    src: { id: string; content: string },
    target: Target
  ) {
    if (!language) {
      throw new Error(`Can't use dropAction outside of a language context`);
    }
    checkTarget(target);
    const { id: srcId, content: srcContent } = src;
    dispatch((dispatch, getState) => {
      const state = getState();
      const { collapsedList } = state;
      let ast = selectors.getAST(state); // get the AST, and which nodes are collapsed
      const srcNode = srcId ? ast.getNodeById(srcId) : null; // null if dragged from toolbar
      const content = srcNode ? srcNode.toString() : srcContent;

      // If we dropped the node _inside_ where we dragged it from, do nothing.
      if (srcNode && srcRangeIncludes(srcNode.srcRange(), target.srcRange())) {
        return;
      }

      const edits = [];
      let droppedHash: unknown;

      // Assuming it did not come from the toolbar...
      // (1) Delete the text of the dragged node, (2) and save the id and hash
      if (srcNode) {
        edits.push(edit_delete(ast, ast.getNodeByIdOrThrow(srcNode.id)));
        droppedHash = ast.getNodeByIdOrThrow(srcNode.id).hash;
      }

      // Insert or replace at the drop location, depending on what we dropped it on.
      edits.push(target.toEdit(ast, content));
      // Perform the edits.
      const editResult = dispatch(performEdits(edits, language.parse, editor));

      // Assuming it did not come from the toolbar, and the srcNode was collapsed...
      // Find the matching node in the new tree and collapse it
      if (srcNode && collapsedList.find((id) => id == srcNode.id)) {
        if (editResult.successful) {
          ast = editResult.value.newAST;
        }
        const newNode = [...ast.getAllNodes()].find(
          (n) => n.hash == droppedHash
        );
        newNode && dispatch(collapseNode(newNode));
        dispatch(uncollapseNode(srcNode));
      }
    });
  };
}

// Set the cursor position.
export const setCursor = (editor: CMBEditor, cur: Pos | null): AppAction => {
  if (editor && cur) {
    editor.focus();
    editor.setCursor(cur);
  }
  return { type: "SET_CURSOR", cur };
};

// Activate the node with the given `nid`.
export function activateByNid(
  editor: ReadonlyCMBEditor,
  nid: number | null,
  options: { allowMove?: boolean; record?: boolean } = {}
): AppThunk {
  return (dispatch, getState) => {
    options = { ...options, allowMove: true, record: true };
    const state = getState();
    const ast = selectors.getAST(state);
    const focusedNode = selectors.getFocusedNode(state);
    const { collapsedList } = state;

    // If nid is null, try to get it from the focusId
    if (nid === null && focusedNode) {
      nid = focusedNode.nid ?? null;
    }

    // Get the new node from the nid
    const newNode = nid === null ? null : ast.getNodeByNId(nid);

    // If there is no valid node found in the AST, bail.
    // (This could also mean a node was selected in the toolbar!
    // It's ok to do nothing: screenreaders will still announce it -
    // we just don't want to activate them.)
    if (!newNode) {
      return;
    }

    // If the element has been ellided by CM, it won't be in the DOM. This
    // can lead to situations where CM ellides the *currently-focused* elt,
    // which confuses the screenreader. In these situations, we focus on
    // a dummy element that just says "stand by" (see ToggleEditor.js).
    // When the new node is available, focus will shift automatically.
    if (!document.contains(newNode.element)) {
      const sr = document.getElementById("SR_fix_for_slow_dom");
      // In the event that everything has been unmounted,
      // for example in a unit test, then neither newNode.element nor
      // SR_fix_for_slow_down will exist. So check to see if it's still
      // there before attempting to focus it.
      if (sr) {
        sr.focus();
      }
    }

    cancelAnnouncement(); // clear any overrideable announcements
    // FIXME(Oak): if possible, let's not hard code like this
    if (
      ["blank", "literal"].includes(newNode.type) &&
      !collapsedList.includes(newNode.id)
    ) {
      say("Use enter to edit", 1250, true); // wait 1.25s, and allow to be overridden
    }

    dispatch(setFocusedNode(newNode));
    if (newNode.element) {
      if (options.allowMove) {
        editor.scrollASTNodeIntoView(newNode);
      }
      newNode.element.focus();
    }
  };
}

function checkTarget(target: Target) {
  if (!(target instanceof Target)) {
    warn(
      "actions",
      `Expected target ${target} to be an instance of the Target class.`
    );
  }
}

// The class of all targets.
export abstract class Target {
  from: Pos;
  to: Pos;
  node?: ASTNode;

  constructor(from: Pos, to: Pos) {
    this.from = from;
    this.to = to;
  }

  srcRange() {
    return { from: this.from, to: this.to };
  }
  abstract getText(ast: AST, text: ReadonlyRangedText): string;
  abstract toEdit(ast: AST, text: string): EditInterface;
}

// Insert at a location inside the AST.
export class InsertTarget extends Target {
  parent: ASTNode;
  field: string;
  pos: Pos;
  constructor(parentNode: ASTNode, fieldName: string, pos: Pos) {
    super(pos, pos);
    this.parent = parentNode;
    this.field = fieldName;
    this.pos = pos;
  }

  getText() {
    return "";
  }

  toEdit(ast: AST, text: string): EditInterface {
    return edit_insert(text, this.parent, this.field, this.pos);
  }
}

// Target an ASTNode. This will replace the node.
export class ReplaceNodeTarget extends Target {
  node: ASTNode;

  constructor(node: ASTNode) {
    const range = node.srcRange();
    super(range.from, range.to);
    this.node = node;
  }

  getText(ast: AST, text: ReadonlyRangedText) {
    const { from, to } = ast.getNodeByIdOrThrow(this.node.id);
    return text.getRange(from, to);
  }

  toEdit(ast: AST, text: string): EditInterface {
    return edit_replace(text, ast, this.node);
  }
}

// Target a source range at the top level. This really has to be at the top
// level: neither `from` nor `to` can be inside any root node.
export class OverwriteTarget extends Target {
  constructor(from: Pos, to: Pos) {
    super(from, to);
  }

  getText(ast: AST, text: ReadonlyRangedText) {
    return text.getRange(this.from, this.to);
  }

  toEdit(ast: AST, text: string): EditInterface {
    return edit_overwrite(text, this.from, this.to);
  }
}
