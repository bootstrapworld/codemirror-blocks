import SHARED from '../shared';
import {commitChanges} from './commitChanges';


// When a user hits `undo` or `redo`, we would like to not only undo/redo, but
// also restore focus to the correct place. Unfortunately, it is in general
// impossible to tell where focus _should_ be just looking at the edit itself.
// Therefore, even though CodeMirror keeps an undo/redo history, we need to keep
// our own shadow undo/redo history to keep track of where focus should be. This
// is stored in `undoFocusStack` and `redoFocusStack` in the Redux store (see
// `reducers.js`).

export function undo() {
  return (dispatch, getState) => {
    if (SHARED.cm.historySize().undo === 0) return;
    const changes = (cm) => () => {
      console.log(`@?undo cm.name:${cm.name} cm.curOp:${cm.curOp} cm.getHistory():${cm.getHistory()}`);
      cm.undo();
    }
    const undoFocusStack = getState().undoFocusStack;
    const {oldFocusNId, newFocusNId} = undoFocusStack[undoFocusStack.length - 1];
    const focusHint = (newAST) => newAST.getNodeByNId(oldFocusNId);
    const onSuccess = () => dispatch({type: 'UNDO'});
    const onFailure = () => {};
    commitChanges(changes, focusHint, true, onSuccess, onFailure);
  }
}

export function redo() {
  return (dispatch, getState) => {
    if (SHARED.cm.historySize().redo === 0) return;
    const changes = (cm) => () => cm.redo();
    const redoFocusStack = getState().redoFocusStack;
    const {oldFocusNId, newFocusNId} = redoFocusStack[redoFocusStack.length - 1];
    const focusHint = (newAST) => newAST.getNodeByNId(newFocusNId);
    const onSuccess = () => dispatch({type: 'REDO'});
    const onFailure = () => {};
    commitChanges(changes, focusHint, true, onSuccess, onFailure);
  }
}
