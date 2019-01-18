import CodeMirror from 'codemirror';
import {store} from './store';
import patch from './ast-patch';
import SHARED from './shared';
import {activateByNId} from './actions';
import {computeFocusIdFromChanges} from './utils';

export function commitChanges(
  changes,
  onSuccess=() => {},
  onError=() => {}
) {
  const tmpDiv = document.createElement('div');
  const tmpCM = CodeMirror(tmpDiv, {value: SHARED.cm.getValue()});
  tmpCM.on('changes', (cm, changeArr) => {
    let newAST = null;
    try {
      newAST = SHARED.parser.parse(tmpCM.getValue());
    } catch (exception) {
      onError(exception);
      return;
    }
    // patch the tree and set the state
    SHARED.cm.operation(changes(SHARED.cm));
    const {ast: oldAST} = store.getState();
    const tree = patch(oldAST, newAST);
    let focusNId = computeFocusIdFromChanges(changeArr, tree);
    store.dispatch({type: 'SET_AST', ast: tree});
    store.dispatch(activateByNId(focusNId, {allowMove: false}));
    onSuccess({tree, focusNId});
  });

  tmpCM.operation(changes(tmpCM));
}