import { AppDispatch, AppStore } from "../store";
import {
  poscmp,
  adjustForChange,
  minimizeChange,
  logResults,
  topmostUndoable,
} from "../utils";
import { activateByNid } from "../actions";
import patch from "./patchAst";
import { AST, ASTNode } from "../ast";
import type { Editor, EditorChange } from "codemirror";
import { getReducerActivities, RootState } from "../reducers";

type FocusHint = (ast: AST) => ASTNode | null | "fallback";
// commitChanges :
//   Changes, bool, FocusHint|undefined, AST|undefined
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
export function commitChanges(
  state: Pick<RootState, "ast" | "focusId" | "collapsedList">,
  dispatch: AppDispatch,
  changes: EditorChange[],
  parse: (code: string) => AST,
  cm: Editor,
  isUndoOrRedo: boolean = false,
  focusHint: FocusHint | -1 = undefined,
  astHint: AST = undefined,
  annt?: string | false
) {
  //debugLog('XXX commitChanges:34 doing commitChanges');
  try {
    let { ast: oldAST, focusId: oldFocusId } = state;
    if (!isUndoOrRedo) {
      // Remember the previous focus. See the next `!isUndoOrRedo` block.
      let oldFocus = oldAST.getNodeById(oldFocusId);
      var oldFocusNId = oldFocus ? oldFocus.nid : null;
    }
    // If we haven't already parsed the AST during speculateChanges, parse it now.
    let newAST: AST = astHint || parse(cm.getValue());
    // Patch the tree and set the state
    newAST = patch(oldAST, newAST);
    dispatch({ type: "SET_AST", ast: newAST });
    // Try to set the focus using hinting data. If that fails, use the first root
    let focusId =
      setFocus(state, dispatch, cm, changes, focusHint, newAST) ||
      newAST.getFirstRootNode()?.id;
    //debugLog('XXX commitChanges:50 setFocus retd focusId=', focusId);
    if (!isUndoOrRedo) {
      // `DO` must be dispatched every time _any_ edit happens on CodeMirror:
      // this is what populates our undo stack.
      //debugLog('commitChanges:54 focusId=', focusId);
      let newFocus = null;
      if (focusId) {
        newFocus = newAST.getNodeById(focusId);
      }
      let newFocusNId = newFocus?.nid;
      //debugLog('XXX commitChanges:58 oldFocusNId=', oldFocusNId);
      //debugLog('XXX commitChanges:59 newFocusNId=', newFocusNId);
      //debugLog('XXX commitChanges:60 annt=', annt);
      let tU = topmostUndoable(cm, "undo");
      tU.undoableAction = annt || undefined;
      tU.actionFocus = { oldFocusNId, newFocusNId };
      dispatch({ type: "DO", focusId: focusId });
    }
    return { newAST, focusId };
  } catch (e) {
    logResults(getReducerActivities(), e);
  }
}

// Use the focus hint to determine focus, unless:
// 1. There is no focus hint, or
// 2. There is a focus hint, but when you call it it returns "fallback".
// In those cases, use `computeFocusNodeFromChanges` instead.
// Note: a focusHint of -1 means "let CodeMirror set the focus"
function setFocus(
  state: Pick<RootState, "collapsedList">,
  dispatch: AppDispatch,
  cm: Editor,
  changes: EditorChange[],
  focusHint: FocusHint | -1,
  newAST: AST
) {
  //debugLog('XXX commitChanges:78 doing setFocus');
  if (focusHint == -1) return;
  let { collapsedList } = state;
  let focusNode = focusHint ? focusHint(newAST) : "fallback";
  if (focusNode === "fallback") {
    focusNode = computeFocusNodeFromChanges(cm, changes, newAST);
  }
  let focusNId = focusNode ? focusNode.nid : null;
  while (focusNode && focusNode.parent && (focusNode = focusNode.parent)) {
    if (collapsedList.includes(focusNode.id)) focusNId = focusNode.nid;
  }
  // get the nid and activate
  //debugLog('XXX commitChanges:90 focusNId=', focusNId, 'focusId=', focusNode.id);
  if (focusNId !== null) {
    //debugLog('XXX commitChanges:92 calling dispatch of activateByNid', focusNId);
    dispatch(activateByNid(cm, focusNId));
  }

  let focusNode2 = newAST.getNodeByNId(focusNId);
  let focusId = focusNode2 && focusNode2.id;

  // let focusId = focusNode ? focusNode.id : null; // this is wrong
  //debugLog('XXX commitChanges:100 focusId=', focusId);
  return focusId;
}

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
  cm: Editor,
  changes: EditorChange[],
  newAST: AST
) {
  let insertion = false as EditorChange | false;
  let startLocs = changes.map((c) => {
    c = minimizeChange(c, cm);
    c.from = adjustForChange(c.from, c, true);
    c.to = adjustForChange(c.to, c, false);
    if (c.text.join("").length > 0) insertion = c; // remember the most-recent insertion
    return c.from; // return the starting srcLoc of the change
  });
  if (insertion) {
    // Case A: grab the inserted node, *or* the node that ends in
    // insertion's ending srcLoc (won't ever be null post-insertion)
    let insertedNode = newAST.getNodeAt(insertion.from, insertion.to);
    let lastNodeInserted = newAST.getNodeBeforeCur(insertion.to);
    return insertedNode || lastNodeInserted;
  } else {
    startLocs.sort(poscmp); // sort the deleted ranges
    let focusNode = newAST.getNodeBeforeCur(startLocs[0]); // grab the node before the first
    // Case B: If the node exists, use the Id.
    // Case C: If not, use the first node...unless...
    // Case D: the tree is empty, so return null
    return focusNode || newAST.getFirstRootNode() || null;
  }
}
