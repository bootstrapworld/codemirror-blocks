import CodeMirror from 'codemirror';
import store from './store';
import patch from './ast-patch';
import global from './global';

export function commitChanges(
  changes,
  onSuccess=() => {},
  onError=() => {}
) {
  const tmpDiv = document.createElement('div');
  const tmpCM = CodeMirror(tmpDiv, {value: global.cm.getValue()});
  tmpCM.on('changes', () => {
    let newAST = null;
    try {
      newAST = global.parser.parse(tmpCM.getValue());
    } catch (exception) {
      onError(exception);
      return;
    }

    const {ast: oldAST} = store.getState();
    if (oldAST.hash !== newAST.hash) {
      store.dispatch({type: 'SET_AST', ast: patch(oldAST, newAST)});
    }
    onSuccess();
    global.cm.operation(changes(global.cm));
  });

  tmpCM.operation(changes(tmpCM));
}
