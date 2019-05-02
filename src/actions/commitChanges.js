import CodeMirror from 'codemirror';
import {store} from '../store';
import SHARED from '../shared';
import {computeFocusNodeFromChanges, posAfterChanges} from '../utils';
import {activate} from './actions';
import patch from './ast-patch';


const tmpDiv = document.createElement('div');
const tmpCM = CodeMirror(tmpDiv, {value: ""});
const raw = lines => lines.join('').trim();

// changes: [{text: string, from: Pos, to: Pos, label: string}]
export function commitChanges(
  changes,
  onSuccess = () => {},
  onError = () => {}
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
    let {ast: oldAST, collapsedList} = store.getState();
    if(oldAST.hash !== newAST.hash) newAST = patch(oldAST, newAST);
    let focusNode = computeFocusNodeFromChanges(changeArr, newAST);
    let focusId = focusNode? focusNode.id : null;
    store.dispatch({type: 'SET_AST', ast: newAST});
    while (focusNode && focusNode.parent && (focusNode = focusNode.parent)) {
      if (collapsedList.includes(focusNode.id)) focusId = focusNode.id;
    }
    store.dispatch(activate(focusId));
    onSuccess({newAST, focusId});
  };

  tmpCM.on('changes', handler);
  tmpCM.operation(changes(tmpCM));
  tmpCM.off('changes', handler);
}
