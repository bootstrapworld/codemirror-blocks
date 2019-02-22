import CodeMirror from 'codemirror';
import {store} from './store';
import patch from './ast-patch';
import SHARED from './shared';
import {activate} from './actions';
import {computeFocusIdFromChanges, posAfterChanges} from './utils';

const tmpDiv = document.createElement('div');
const tmpCM = CodeMirror(tmpDiv, {value: ""});
const raw = lines => lines.join('').trim();

export function commitChanges(
  changes,
  onSuccess=() => {},
  onError=() => {}
) {
  tmpCM.setValue(SHARED.cm.getValue());
  let handler = (cm, changeArr) => {
    let newAST = null;
    try {
      newAST = SHARED.parser.parse(tmpCM.getValue());
    } catch (exception) {
      onError(exception);
      return;
    }
    // patch the tree and set the state
    SHARED.cm.operation(changes(SHARED.cm));
    let {ast: oldAST} = store.getState();
    let lastChange = changeArr[0], dragId, dragTo;
    // walk through the change array to look for drag events, defined as
    // consecutive changes where identical text is removed in one and inserted
    // in the other. For each one, perform an interim patch operation using
    // the drag info.
    changeArr.slice(1).forEach(c => {
      let lastInserted  = raw(lastChange.text);
      let lastRemoved   = raw(lastChange.removed);
      let inserted      = raw(c.text);
      let removed       = raw(c.removed);
      if(lastRemoved && (inserted === lastRemoved)) {
        dragId = oldAST.getNodeAfterCur(lastChange.from).id;
        dragTo = posAfterChanges([lastChange, c], c.from, true);
      } else if(lastInserted && (removed === lastInserted)) {
        dragId = oldAST.getNodeAfterCur(c.from).id;
        dragTo = posAfterChanges([lastChange, c], lastChange.from, true);
      }
      if(dragId) {
        oldAST = patch(oldAST, newAST, {id: dragId, loc: dragTo});
      } 
      lastChange = c;
    });
    // if there are still (non-DnD) changes to be patched, do so
    if(oldAST.hash !== newAST.hash) newAST = patch(oldAST, newAST);
    let focusId = computeFocusIdFromChanges(changeArr, newAST);
    store.dispatch({type: 'SET_AST', ast: newAST});
    store.dispatch(activate(focusId));
    onSuccess({newAST, focusId});
  };

  tmpCM.on('changes', handler);
  tmpCM.operation(changes(tmpCM));
  tmpCM.off('changes', handler);
}

SHARED.keyName = CodeMirror.keyName;
