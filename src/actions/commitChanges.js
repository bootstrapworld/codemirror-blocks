import CodeMirror from 'codemirror';
import {store} from '../store';
import SHARED from '../shared';
import {poscmp} from '../utils';
import {activate} from './actions';
import patch from './patchAst';


const tmpDiv = document.createElement('div');
const tmpCM = CodeMirror(tmpDiv, {value: ""});
const raw = lines => lines.join('').trim();

// commitChanges :
//   Changes, FocusHint, {newAST, focusId} -> Void, exception -> Void
//   -> Void
// where
//   Changes has the form:
//     [{text: string, from: Pos, to: Pos, label: string}]
//   FocusHint is a function of type:
//     ast -> ASTNode|null
//
// Attempt to commit a set of text changes to Code Mirror.
// If successful (i.e., if the resulting program parses),
//   then make the changes, update the focus, and call the success callback.
// If not successful,
//   then do not make the changes, leave the focus alone, and call the error callback.
export function commitChanges(
  changes,
  focusHint = undefined,
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
    let focusNode = (focusHint === undefined)
        ? computeFocusNodeFromChanges(changeArr, newAST)
        : focusHint(newAST);
    let focusId = focusNode ? focusNode.id : null;
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

// TODO: make this private
// computeFocusNodeFromChanges : [CMchanges], AST -> Number
// compute the focusId by identifying the node in the newAST that was
//   (a) most-recently added (if there's any insertion)
//   (b) before the first-deleted (in the case of deletion)
//   (c) first root node (in the case of deleting a pre-existing first node)
//   (d) null (in the case of deleting the only nodes in the tree)
// NOTE(Justin): This is a set of _heuristics_ that are likely but not
// guaranteed to work, because textual edits may obscure what's really going on.
// Whenever possible, a `focusHint` should be given.
export function computeFocusNodeFromChanges(changes, newAST) {
  let insertion = false, focusId = false;
  let startLocs = changes.map(c => {
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

function posAfterChanges(changes, pos, isFrom) {
  changes.forEach(c => pos = adjustForChange(pos, c, isFrom));
  return pos;
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
