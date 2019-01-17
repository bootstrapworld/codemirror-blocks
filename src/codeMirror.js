import CodeMirror from 'codemirror';
import {store} from './store';
import patch from './ast-patch';
import global from './global';
import {activateByNId} from './actions';
import {poscmp} from './utils';

export function commitChanges(
  changes,
  onSuccess=() => {},
  onError=() => {}
) {
  const tmpDiv = document.createElement('div');
  const tmpCM = CodeMirror(tmpDiv, {value: global.cm.getValue()});
  tmpCM.on('changes', (cm, changeArr) => {
    let newAST = null;
    try {
      newAST = global.parser.parse(tmpCM.getValue());
    } catch (exception) {
      onError(exception);
      return;
    }
    global.cm.operation(changes(global.cm));
    // patch the tree and set the state
    const {ast: oldAST} = store.getState();
    const {tree} = patch(oldAST, newAST);
    store.dispatch({type: 'SET_AST', ast: tree});
    // compute the focusNId
    let insertion = false, deletedFroms = [], focusNId = null, focusNode = null;
    changeArr.forEach(c => {
      c.from = adjustForChange(c.from, c, true);
      c.to   = adjustForChange(c.to,   c, false);
      if(c.text.join("").length > 0) insertion = c;
      else deletedFroms.push(c.from);
    });
    if(insertion) {
      focusNode = newAST.getNodeBeforeCur(insertion.to);
      focusNId = focusNode? focusNode.nid : -1;
    } else {
      deletedFroms.sort(poscmp);
      focusNode = newAST.getNodeBeforeCur(deletedFroms[0]);
      focusNId = focusNode? focusNode.nid : -1;
    }
    store.dispatch(activateByNId(focusNId, {allowMove: false}));
    onSuccess({tree, focusNId});
  });

  tmpCM.operation(changes(tmpCM));
}

// Compute the position of the end of a change (its 'to' property refers to the pre-change end).
// based on https://github.com/codemirror/CodeMirror/blob/master/src/model/change_measurement.js
function changeEnd({from, to, text}) {
  if (!text) return to;
  let lastText = text[text.length-1];
  return {line: from.line+text.length-1, ch: lastText.length+(text.length==1 ? from.ch : 0)};
}

// Adjust a Pos to refer to the post-change position, or the end of the change if the change covers it.
// based on https://github.com/codemirror/CodeMirror/blob/master/src/model/change_measurement.js
function adjustForChange(pos, change, from) {
  if (poscmp(pos, change.from) < 0)           return pos;
  if (poscmp(pos, change.from) == 0 && from)  return pos; // if node.from==change.from, no change
  if (poscmp(pos, change.to) <= 0)            return changeEnd(change);
  let line = pos.line + change.text.length - (change.to.line - change.from.line) - 1, ch = pos.ch;
  if (pos.line == change.to.line) ch += changeEnd(change).ch - change.to.ch;
  return {line: line, ch: ch};
}