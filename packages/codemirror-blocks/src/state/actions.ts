import {
  poscmp,
  srcRangeIncludes,
  warn,
  createEditAnnouncement,
} from "../utils";
import { say, cancelAnnouncement } from "../announcer";
import { AppThunk } from "./store";
import {
  performEdits,
  edit_insert,
  edit_delete,
  edit_replace,
  edit_overwrite,
  EditInterface,
  PerformEditsResult,
} from "../edits/performEdits";
import { FakeAstInsertion } from "../edits/fakeAstEdits";
import { AST, ASTNode, Pos } from "../ast";
import {
  CMBEditor,
  isBlockNodeMarker,
  ReadonlyCMBEditor,
  ReadonlyRangedText,
} from "../editor";
import type CodeMirror from "codemirror";
import type { Language } from "../CodeMirrorBlocks";
import { err, ok, Result } from "../edits/result";
import * as selectors from "./selectors";
import type { ActionFocus } from "./reducers";
import { pasteFromClipboard } from "../copypaste";
import { Comment } from "../nodes";
import { recordEvent } from "./activityLog";

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

/**
 * Set the currently focused node. If no node is provided,
 * then the existing focused node will no longer be focused.
 *
 * @param node The node to focus, or undefined to clear the focus
 */
export const setFocusedNode = (node: ASTNode | undefined) => ({
  type: "SET_FOCUS" as const,
  focusId: node?.id,
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

export const setUndoableAction = (undoableAction: string | undefined) => ({
  type: "SET_UNDOABLE_ACTION" as const,
  undoableAction,
});

export const setActionFocus = (actionFocus: ActionFocus | undefined) => ({
  type: "SET_ACTION_FOCUS" as const,
  actionFocus,
});

/**
 * Perform an undo or redo in `editor`, remembering the description and focus
 * of the action being undone/redone so that it can be restored later.
 */
export const undoOrRedo =
  (which: "undo" | "redo", editor: CMBEditor): AppThunk =>
  (dispatch) => {
    const topmostAction = editor.getTopmostAction(which);
    dispatch(setUndoableAction(topmostAction.undoableAction));
    dispatch(setActionFocus(topmostAction.actionFocus));
    if (which === "undo") {
      say(`UNDID: ${topmostAction.undoableAction}`);
      editor.undo();
    } else {
      say(`REDID: ${topmostAction.undoableAction}`);
      editor.redo();
    }
  };

/**
 * Once codemirror has finished an undo or redo, move the pending description
 * and focus onto the history item that now sits on the opposite stack, and
 * clear them from the store.
 */
export const finishUndoOrRedo =
  (which: "undo" | "redo", editor: ReadonlyCMBEditor): AppThunk =>
  (dispatch, getState) => {
    const { undoableAction, actionFocus } = getState();
    const historyItem = editor.getTopmostAction(
      which === "undo" ? "redo" : "undo"
    );
    historyItem.undoableAction = undoableAction;
    historyItem.actionFocus = actionFocus;
    dispatch({ type: which === "undo" ? "UNDO" : "REDO" });
  };

/**
 * Show a CodeMirror mark on the block `id`: the block draws its className, css
 * and title, and forgets the mark when it is cleared.
 */
export const showMarkOnBlock =
  (mark: CodeMirror.TextMarker, id: string): AppThunk =>
  (dispatch, getState) => {
    const clear = mark.clear.bind(mark);
    if (!("shownOnBlocks" in mark)) {
      Object.assign(mark, { shownOnBlocks: true });
      mark.clear = () => {
        clear();
        for (const [key, m] of Object.entries(getState().markedMap)) {
          if (m === mark) dispatch({ type: "CLEAR_MARK", id: key });
        }
      };
    }
    dispatch({ type: "ADD_MARK", id, mark });
  };

/**
 * The CodeMirror outlives a mode switch, and so do its marks, but the blocks
 * are new (and have new ids) each time block mode comes back: show each mark
 * that is on exactly the text of a block on that block again. (Marks that are
 * not on a block stay marks of the text only.)
 */
export const showMarksOnBlocks =
  (codemirror: CodeMirror.Editor): AppThunk =>
  (dispatch, getState) => {
    const ast = selectors.getAST(getState());
    for (const mark of codemirror.getAllMarks()) {
      const range = isBlockNodeMarker(mark) ? undefined : mark.find();
      if (!range || "line" in range) continue;
      const node = ast.getNodeAt(range.from, range.to);
      if (!node) continue;
      if (!mark.options) {
        // a mark made as text: its options were copied onto the mark itself
        const { className, css, title } = mark as CodeMirror.TextMarkerOptions;
        mark.options = JSON.parse(JSON.stringify({ className, css, title }));
      }
      dispatch(showMarkOnBlock(mark, node.id));
    }
  };

export const setCode = (code: string) => ({ type: "SET_CODE" as const, code });

export const setBlockMode =
  (
    enabled: boolean,
    code: string,
    language: Language
  ): AppThunk<ReturnType<typeof checkASTRoundtripConversion>> =>
  (dispatch) => {
    const result = checkASTRoundtripConversion(code, language);
    if (result.successful) {
      // the text is printed again, so the place a top-level edit box was
      // opened at (which it keeps as a position) would be somewhere else
      dispatch(disableQuarantine());
      dispatch({
        type: "SET_BLOCK_MODE" as const,
        enabled,
      });
      dispatch(setAST(result.value.newAst));
      dispatch(setCode(result.value.newCode));
    }
    return result;
  };

/**
 * Deletes a single node from the AST
 */
export const deleteASTNode =
  (editor: CMBEditor, srcNodeId: string): AppThunk<PerformEditsResult> =>
  (dispatch, getState) => {
    const ast = selectors.getAST(getState());
    const node = ast.getNodeById(srcNodeId);
    if (!node) {
      // the block was edited away (or given a new id, as the edit of an
      // identical sibling does) while it was being dragged
      return err(new Error(`Node with id ${srcNodeId} not found`));
    }
    const edits = [edit_delete(ast, node)];
    return dispatch(performEdits(edits, editor));
  };

/**
 * Check whether the given code can be parsed into an AST and then
 * pretty printed back into code again, and then back into an AST again.
 *
 * @param oldCode text content of the code to parse
 * @param language language to use to parse the code
 * @returns returns a result object with the following properties:
 *   - `oldAst`: the ast generated by parsing `oldCode`
 *   - `newCode`: the code generated by pretty printing the old ast
 *   - `newAst`: the ast generated by parsing the pretty printed code
 */
function checkASTRoundtripConversion(
  oldCode: string,
  language: Language
): Result<{ oldAst: AST; newAst: AST; newCode: string }, string | Error> {
  let oldAst: AST;
  try {
    oldAst = language.buildAST(oldCode); // parse the code (WITH annotations)
  } catch (e) {
    // console.error(e);
    if (language.getExceptionMessage) {
      try {
        return err(language.getExceptionMessage(e));
      } catch (e) {
        // fall through to the default error message
      }
    }
    return err("The parser failed, and the error could not be retrieved");
  }
  try {
    const newCode = oldAst.toString();
    const newAst = language.buildAST(newCode);
    return ok({ oldAst, newCode, newAst });
  } catch (e) {
    // console.error("COULD NOT PARSE PRETTY-PRINTED CODE FROM:\n", oldAst);
    // console.error("PRETTY-PRINTED CODE WAS", oldAst.toString());
    return err(`An error occured in the language module: 
          the pretty-printer probably produced invalid code.
          See the JS console for more detailed reporting.`);
  }
}

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
    annt?: string
  ): AppThunk<Result<{ newAST: AST; focusId?: string | undefined }>> =>
  (dispatch, getState) => {
    checkTarget(target);
    const edits = [target.toEdit(selectors.getAST(getState()), text)];
    return dispatch(performEdits(edits, editor, annt));
  };

// Delete the given nodes.
// 'delete' is a reserved word, hence the trailing underscore
export const delete_ =
  (
    editor: CMBEditor,
    nodes: ASTNode[],
    editWord?: string,
    keepComments = true
  ): AppThunk =>
  (dispatch, getState) => {
    if (nodes.length === 0) {
      return;
    }
    nodes.sort((a, b) => poscmp(b.from, a.from)); // To focus before first deletion
    const ast = selectors.getAST(getState());
    const edits = nodes.map((node) => edit_delete(ast, node, keepComments));
    let annt: string | undefined = undefined;
    if (editWord) {
      annt = createEditAnnouncement(nodes, editWord);
      say(annt);
    }
    dispatch(performEdits(edits, editor, annt));
    dispatch(setSelectedNodeIds([]));
  };

// Paste from the clipboard at the given `target`.
// See the comment at the top of the file for what kinds of `target` there are.
export const paste =
  (editor: CMBEditor, target: Target): AppThunk =>
  (dispatch, getState) => {
    checkTarget(target);
    pasteFromClipboard((text) => {
      recordEvent({ type: "CLIP", text });
      if (text.trim() === "") {
        // an empty clipboard must not insert anything (not even whitespace)
        return;
      }
      const edits = [target.toEdit(selectors.getAST(getState()), text)];
      dispatch(performEdits(edits, editor));
      dispatch(setSelectedNodeIds([]));
    });
  };

export function drop(
  editor: CMBEditor,
  src: { id: string; content: string },
  target: Target
): AppThunk {
  return (dispatch, getState) => {
    checkTarget(target);
    const { id: srcId, content: srcContent } = src;
    const state = getState();
    const { collapsedList } = state;
    let ast = selectors.getAST(state); // get the AST, and which nodes are collapsed
    const srcNode = srcId ? ast.getNodeById(srcId) : null; // null if dragged from toolbar
    const content = srcNode ? srcNode.toString() : srcContent;

    // Pressing a toolbar block to drag it gave the toolbar keyboard focus, and
    // the block that is dropped will not take focus from another element. The
    // user is working in the editor now: bring focus back, so that the new block
    // (and shortcuts such as undo) get it.
    if (!srcNode) {
      editor.focus();
    }

    // If we dropped the node _inside_ where we dragged it from, do nothing.
    if (srcNode && srcRangeIncludes(srcNode.srcRange(), target.srcRange())) {
      return;
    }

    const edits = [];
    let droppedHash: unknown;

    // Assuming it did not come from the toolbar...
    // (1) Delete the text of the dragged node, (2) and save the id and hash
    if (srcNode) {
      // (the node takes its comment along)
      edits.push(edit_delete(ast, ast.getNodeByIdOrThrow(srcNode.id), false));
      droppedHash = ast.getNodeByIdOrThrow(srcNode.id).hash;
    }

    // Insert or replace at the drop location, depending on what we dropped it on.
    edits.push(target.toEdit(ast, content));
    // Perform the edits.
    const editResult = dispatch(performEdits(edits, editor));

    // Assuming it did not come from the toolbar, and the srcNode was collapsed...
    // Find the matching node in the new tree and collapse it
    if (srcNode && collapsedList.find((id) => id == srcNode.id)) {
      if (editResult.successful) {
        ast = editResult.value.newAST;
      }
      const newNode = [...ast.getAllNodes()].find((n) => n.hash == droppedHash);
      newNode && dispatch(collapseNode(newNode));
      dispatch(uncollapseNode(srcNode));
    }
  };
}

type ActivateOptions = { allowMove?: boolean; record?: boolean };

export function activateNode(
  editor: ReadonlyCMBEditor,
  node: ASTNode,
  options: ActivateOptions
): AppThunk {
  return (dispatch, getState) => {
    const ast = selectors.getAST(getState());
    // nid can be stale!! Always obtain a fresh copy of the node
    // from getState() before calling activateByNid
    // TODO(pcardune): figure out why this is the case and make it
    // not the case.
    const currentNode = ast.getNodeByIdOrThrow(node.id);
    dispatch(activateByNid(editor, currentNode.nid, options));
  };
}

// Activate the node with the given `nid`.
export function activateByNid(
  editor: ReadonlyCMBEditor,
  nid: number | null,
  options: ActivateOptions = {}
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

    cancelAnnouncement(); // clear any overrideable announcements
    // FIXME(Oak): if possible, let's not hard code like this
    if (
      ["blank", "literal"].includes(newNode.type) &&
      !collapsedList.includes(newNode.id)
    ) {
      say("Use enter to edit", 1250, true); // wait 1.25s, and allow to be overridden
    }

    dispatch(setFocusedNode(newNode));
    // The editor's keeper gives the block focus: or, if CodeMirror has taken the
    // block off the page (which can leave the screenreader without the block it
    // was on), waits for it on the "stand by" placeholder (see ToggleEditor.tsx)
    // and brings its line into view, so that CodeMirror draws it again.
    editor.focusBlock(newNode);
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
// It is element `index` of the list field `fieldName` of `parentNode` (the
// index of the element it goes before, or the length of the list for the end),
// or, for an optional field that is empty, what it holds (and `index` is left out).
export class InsertTarget extends Target {
  parent: ASTNode;
  field: string;
  index?: number;
  pos: Pos;
  constructor(parentNode: ASTNode, fieldName: string, index?: number) {
    const pos = new FakeAstInsertion(parentNode, fieldName, index).pos;
    super(pos, pos);
    this.parent = parentNode;
    this.field = fieldName;
    this.index = index;
    this.pos = pos;
  }

  getText() {
    return "";
  }

  toEdit(ast: AST, text: string): EditInterface {
    return edit_insert(text, this.parent, this.field, this.index);
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

// Target the comment of a node, or the place for one: the node is replaced,
// comment and all, by the new comment followed by the node's own text (which
// is the text of the node without its comment, taken before the edit starts).
export class CommentTarget extends Target {
  node: ASTNode;
  ownText: string;

  constructor(node: ASTNode, ownText: string) {
    const range = node.srcRange();
    super(range.from, range.to);
    this.node = node;
    this.ownText = ownText;
  }

  getText() {
    const comment = this.node.options.comment;
    return comment ? String(comment.fields.comment).trim() : "";
  }

  toEdit(ast: AST, text: string): EditInterface {
    const dummy = { line: -1, ch: 0 };
    const blockComment = ast.language.blockComment;
    if (!blockComment) {
      throw new Error(`${ast.language.name} has no comments`);
    }
    // (a comment cannot hold its own closing mark)
    const { close } = blockComment;
    const words = text
      .split(close)
      .join(close[0] + " " + close.slice(1))
      .trim();
    const node = ast.getNodeByIdOrThrow(this.node.id);
    if (!words) {
      return edit_replace(this.ownText, ast, node);
    }
    const comment = Comment(dummy, dummy, words, { blockComment }).toString();
    return edit_replace(`${comment}\n${this.ownText}`, ast, node);
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
