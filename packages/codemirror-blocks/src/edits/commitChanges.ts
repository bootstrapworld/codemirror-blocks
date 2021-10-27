import { AppThunk } from "../store";
import { poscmp, adjustForChange, minimizeChange, logResults } from "../utils";
import { activateByNid } from "../actions";
import patch from "./patchAst";
import { AST, ASTNode } from "../ast";
import type { EditorChange } from "codemirror";
import { getReducerActivities } from "../reducers";
import { err, ok, Result } from "./result";
import { ReadonlyCMBEditor, ReadonlyRangedText } from "../editor";
import { ChangeObject } from "./performEdits";
import { Language } from "../CodeMirrorBlocks";

export type FocusHint = (ast: AST) => ASTNode | undefined | null | "fallback";
// commitChanges :
//   Changes, Parser, Editor, bool, FocusHint|undefined, AST|undefined, String|undefined
//   -> {newAST, focusId}
//
// Commit a set of text changes to CodeMirror. This can only be called if you
// _know_ that the changes are valid (will parse successfully); to determine
// this, call `speculateChanges()`.
//
// Returns {newAST, focusId};
//
// - Changes has the form:
//     [{text: Array<string>, from: Pos, to: Pos, origin: string}]
// - isUndoOrRedo must be `true` iff these changes originated from an undo or
//   redo event.
// - FocusHint is a function of type:
//     ast -> ASTNode|null|"fallback"
//   (If null, remove focus. If "fallback", fall back on computeFocusNodeFromChanges.)
// - astHint is the AST you get from parsing the result of these changes (which
//   you may know from a call to `speculateChanges()`).
export const commitChanges =
  (
    changes: ChangeObject[],
    parse: Language["parse"],
    editor: ReadonlyCMBEditor,
    isUndoOrRedo = false,
    focusHint?: FocusHint | -1,
    astHint?: AST,
    annt?: string | false
  ): AppThunk<Result<{ newAST: AST; focusId?: string }>> =>
  (dispatch, getState) => {
    try {
      const { ast: oldAST, focusId: oldFocusId } = getState();
      let oldFocusNId = null;
      if (!isUndoOrRedo) {
        // Remember the previous focus. See the next `!isUndoOrRedo` block.
        const oldFocus = oldFocusId && oldAST.getNodeById(oldFocusId);
        oldFocusNId = oldFocus ? oldFocus.nid : null;
      }
      // If we haven't already parsed the AST during speculateChanges, parse it now.
      const newNodes: ASTNode[] = astHint
        ? [...astHint.rootNodes]
        : parse(editor.getValue());
      // Patch the tree and set the state
      const newAST = new AST(patch([...oldAST.rootNodes], newNodes));
      dispatch({ type: "SET_AST", ast: newAST });
      // Try to set the focus using hinting data. If that fails, use the first root
      const focusId =
        dispatch(setFocus(editor, changes, focusHint, newAST)) ||
        newAST.getFirstRootNode()?.id;
      if (!isUndoOrRedo) {
        // `DO` must be dispatched every time _any_ edit happens on CodeMirror:
        // this is what populates our undo stack.
        let newFocus = null;
        if (focusId) {
          newFocus = newAST.getNodeById(focusId);
        }
        const newFocusNId = newFocus?.nid || null;
        const topmostAction = editor.getTopmostAction("undo");
        topmostAction.undoableAction = annt || undefined;
        topmostAction.actionFocus = { oldFocusNId, newFocusNId };
        dispatch({ type: "DO", focusId: focusId || null });
      }
      return ok({ newAST, focusId });
    } catch (e) {
      logResults(getReducerActivities(), e);
      throw err(e);
    }
  };

// Use the focus hint to determine focus, unless:
// 1. There is no focus hint, or
// 2. There is a focus hint, but when you call it it returns "fallback".
// In those cases, use `computeFocusNodeFromChanges` instead.
// Note: a focusHint of -1 means "let CodeMirror set the focus"
const setFocus =
  (
    editor: ReadonlyCMBEditor,
    changes: EditorChange[],
    focusHint: FocusHint | -1 | undefined,
    newAST: AST
  ): AppThunk<string | 0 | null | undefined> =>
  (dispatch, getState) => {
    if (focusHint == -1) {
      return;
    }
    const { collapsedList } = getState();
    const focusNodeOrFallback = focusHint ? focusHint(newAST) : "fallback";
    let focusNode =
      focusNodeOrFallback === "fallback"
        ? computeFocusNodeFromChanges(editor, changes, newAST)
        : focusNodeOrFallback;
    let focusNId = focusNode ? focusNode.nid : null;
    while (focusNode) {
      const parent = newAST.refFor(focusNode).parent;
      if (parent) {
        focusNode = parent.node;
      } else {
        break;
      }
      if (collapsedList.includes(focusNode.id)) {
        focusNId = focusNode.nid;
      }
    }
    // get the nid and activate
    if (focusNId !== null) {
      dispatch(activateByNid(editor, focusNId));
    }

    const focusNode2 = focusNId && newAST.getNodeByNId(focusNId);
    const focusId = focusNode2 && focusNode2.id;

    return focusId;
  };

// computeFocusNodeFromChanges : [CMchanges], AST -> Number
// compute the focusId by identifying the node in the newAST that was
//   (a) most-recently added (if there's any insertion)
//   (b) before the first-deleted (in the case of deletion)
//   (c) first root node (in the case of deleting a pre-existing first node)
//   (d) null (in the case of deleting the only nodes in the tree)
// NOTE(Justin): This is a set of _heuristics_ that are likely but not
// guaranteed to work, because textual edits may obscure what's really going on.
// Whenever possible, a `focusHint` should be given.
function computeFocusNodeFromChanges(
  text: ReadonlyRangedText,
  changes: EditorChange[],
  newAST: AST
) {
  let insertion = false as EditorChange | false;
  const startLocs = changes.map((change) => {
    let { removed } = change;
    if (!removed) {
      removed = text.getRange(change.from, change.to).split("\n");
    }
    change = minimizeChange({ ...change, removed });
    change.from = adjustForChange(change.from, change, true);
    change.to = adjustForChange(change.to, change, false);
    if (change.text.join("").length > 0) insertion = change; // remember the most-recent insertion
    return change.from; // return the starting srcLoc of the change
  });
  if (insertion) {
    // Case A: grab the inserted node, *or* the node that ends in
    // insertion's ending srcLoc (won't ever be null post-insertion)
    const insertedNode = newAST.getNodeAt(insertion.from, insertion.to);
    const lastNodeInserted = newAST.getNodeBeforeCur(insertion.to);
    return insertedNode || lastNodeInserted;
  } else {
    startLocs.sort(poscmp); // sort the deleted ranges
    const focusNode = newAST.getNodeBeforeCur(startLocs[0]); // grab the node before the first
    // Case B: If the node exists, use the Id.
    // Case C: If not, use the first node...unless...
    // Case D: the tree is empty, so return null
    return focusNode || newAST.getFirstRootNode() || null;
  }
}
