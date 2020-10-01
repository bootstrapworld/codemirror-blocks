import {store} from '../store';
import SHARED from '../shared';
import {poscmp, adjustForChange, minimizeChange, logResults, say} from '../utils';
import {activate} from '../actions';
import patch from './patchAst';
import {playSound, BEEP} from '../sound';

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
  changes,
  isUndoOrRedo = false,
  focusHint = undefined,
  astHint = undefined,
) {
  try{
    let {ast: oldAST, focusId: oldFocusId} = store.getState();
    if (!isUndoOrRedo) {
      // Remember the previous focus. See the next `!isUndoOrRedo` block.
      let oldFocus = oldAST.getNodeById(oldFocusId);
      var oldFocusNId = oldFocus ? oldFocus.nid : null;
    }
    // If we haven't already parsed the AST during speculateChanges, parse it now.
    let newAST = astHint || SHARED.parser.parse(SHARED.cm.getValue());
    // Patch the tree and set the state
    newAST = patch(oldAST, newAST);
    store.dispatch({type: 'SET_AST', ast: newAST});
    // Set the focus.
    let focusId = setFocus(changes, focusHint, newAST);
    if (!isUndoOrRedo) {
      // `DO` must be dispatched every time _any_ edit happens on CodeMirror:
      // this is what populates our undo stack.
      let newFocus = newAST.getNodeById(focusId);
      let newFocusNId = newFocus ? newFocus.nid : null;
      store.dispatch({type: 'DO', focus: {oldFocusNId, newFocusNId}});
      SHARED.undoAnnouncementHistory.undo.shift(
        "undoable action");
      SHARED.undoAnnouncementHistory.redo = [];
      say("an undoable action");
    } else {
      if (isUndoOrRedo === "undo") {
        if (SHARED.undoAnnouncementHistory.undo.length > 0) {
          SHARED.undoAnnouncementHistory.redo.unshift(
            SHARED.undoAnnouncementHistory.undo.shift());
          say("undo");
        } else {
          say("nothing to undo");
          playSound(BEEP);
        }
      } else if (isUndoOrRedo === "redo") {
        if (SHARED.undoAnnouncementHistory.redo.length > 0) {
          SHARED.undoAnnouncementHistory.undo.unshift(
            SHARED.undoAnnouncementHistory.redo.shift());
          say("redo");
        } else {
          say("nothing to redo");
          playSound(BEEP);
        }
      } else {
        playSound(BEEP);
      }
    }
    return {newAST, focusId};
  } catch(e){
    logResults(window.reducerActivities, e);
  }
}

// Use the focus hint to determine focus, unless:
// 1. There is no focus hint, or
// 2. There is a focus hint, but when you call it it returns "fallback".
// In those cases, use `computeFocusNodeFromChanges` instead.
// Note: a focusHint of -1 means "let CodeMirror set the focus"
function setFocus(changes, focusHint, newAST) {
  if(focusHint == -1) return;
  let {collapsedList} = store.getState();
  let focusNode = focusHint ? focusHint(newAST) : "fallback";
  if (focusNode === "fallback") {
    focusNode = computeFocusNodeFromChanges(changes, newAST);
  }
  let focusId = focusNode ? focusNode.id : null;
  while (focusNode && focusNode.parent && (focusNode = focusNode.parent)) {
    if (collapsedList.includes(focusNode.id)) focusId = focusNode.id;
  }
  store.dispatch(activate(focusId));
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
function computeFocusNodeFromChanges(changes, newAST) {
  let insertion = false;
  let startLocs = changes.map(c => {
    c = minimizeChange(c);
    c.from = adjustForChange(c.from, c, true);
    c.to   = adjustForChange(c.to,   c, false);
    if(c.text.join("").length > 0) insertion = c; // remember the most-recent insertion
    return c.from;                                // return the starting srcLoc of the change
  });
  if(insertion) {
    // Case A: grab the inserted node, *or* the node that ends in
    // insertion's ending srcLoc (won't ever be null post-insertion)
    let insertedNode = newAST.getNodeAt(insertion.from, insertion.to);
    let lastNodeInserted = newAST.getNodeBeforeCur(insertion.to);
    return insertedNode || lastNodeInserted;
  } else {
    startLocs.sort(poscmp);                                // sort the deleted ranges
    let focusNode = newAST.getNodeBeforeCur(startLocs[0]); // grab the node before the first
    // Case B: If the node exists, use the Id.
    // Case C: If not, use the first node...unless...
    // Case D: the tree is empty, so return null
    return focusNode || newAST.getFirstRootNode() || null;
  }
}
