import CodeMirror from 'codemirror';
import {store} from './store';
import patch from './ast-patch';
import SHARED from './shared';

export function commitChanges(
  changes,
  onSuccess=() => {},
  onError=() => {}
) {
  const tmpDiv = document.createElement('div');
  const tmpCM = CodeMirror(tmpDiv, {value: SHARED.cm.getValue()});
  tmpCM.on('changes', () => {
    let newAST = null;
    try {
      newAST = SHARED.parser.parse(tmpCM.getValue());
    } catch (exception) {
      onError(exception);
      return;
    }

    SHARED.cm.operation(changes(SHARED.cm));
    const {ast: oldAST} = store.getState();
    const patched = patch(oldAST, newAST);
    store.dispatch({type: 'SET_AST', ast: patched.tree});
    onSuccess(patched);
  });

  tmpCM.operation(changes(tmpCM));
}
