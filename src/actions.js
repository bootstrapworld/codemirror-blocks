import {skipWhile, poscmp, partition} from './utils';
import {commitChanges} from './codeMirror';
import global from './global';

/**
 * Returns whether `u` is a strict ancestor of `v`
 */
function isAncestor(u, v) {
  v = v.parent;
  while (v && v.level > u.level) {
    v = v.parent;
  }
  return u === v;
}

export function focusNextNode(id, next) {
  return (dispatch, getState) => {
    const {collapsedList, ast} = getState();
    const collapsedNodeList = collapsedList.map(ast.getNodeById);
    // NOTE(Oak): if this is too slow, consider adding a
    // next/prevSibling attribute to short circuit navigation
    const node = skipWhile(
      node => node !== null && collapsedNodeList.some(
        collapsed => isAncestor(collapsed, node)
      ),
      next(ast.getNodeById(id)),
      next
    );
    if (node) {
      dispatch({type: 'SET_FOCUS', focusId: node.nid});
    } else {
      // announce beep
    }
  };
}

export function focusNode(id) {
  return (dispatch, getState) => {
    const {ast} = getState();
    dispatch({type: 'SET_FOCUS', focusId: ast.getNodeById(id).nid});
  };
}

export function toggleSelection(id) {
  return (dispatch, getState) => {
    const {selections, ast} = getState();
    if (selections.includes(id)) {
      dispatch({
        type: 'SET_SELECTIONS',
        selections: selections.filter(s => s !== id)
      });
      // announce removal
    } else {
      const {from: addedFrom, to: addedTo} = ast.getNodeById(id);
      const isContained = id => {
        const {from, to} = ast.getNodeById(id);
        return poscmp(addedFrom, from) <= 0 && poscmp(to, addedTo) <= 0;
      };
      const doesContain = id => {
        const {from, to} = ast.getNodeById(id);
        return poscmp(from, addedFrom) <= 0 && poscmp(addedTo, to) <= 0;
      };
      const [removed, newSelections] = partition(selections, isContained);
      for (const r of removed) {
        // announce removal
      }
      if (newSelections.some(doesContain)) {
        // announce failure
      } else {
        // announce addition
        newSelections.push(id);
        dispatch({
          type: 'SET_SELECTIONS',
          selections: newSelections
        });
      }
    }
  };
}

export function deleteNodes() {
  return (dispatch, getState) => {
    const {ast, selections, focusId} = getState();
    const nodeSelections = selections.map(ast.getNodeById);
    // we delete from the end of the document to the beginning so that
    // the next deletion still has a valid pos
    nodeSelections.sort((a, b) => poscmp(b.from, a.from));
    if (nodeSelections.length === 0) {
    } else {
      commitChanges(
        cm => () => {
          for (const node of nodeSelections) {
            cm.replaceRange('', node.from, node.to);
          }
        },
        () => {},
        () => {},
      );
      // since we sort in descending order, this is the last one in the array
      const firstNode = nodeSelections.pop();
      dispatch({type: 'SET_FOCUS', focusId: firstNode.nid});
      dispatch({type: 'SET_SELECTIONS', selections: []});
    }
  };
}

export function dropNode({id: srcId}, {from: destFrom, to: destTo, isDropTarget}) {
  return (dispatch, getState) => {
    const {ast} = getState();
    const srcNode = ast.getNodeById(srcId);
    if (poscmp(destFrom, srcNode.from) > 0 && poscmp(destTo, srcNode.to) < 0) {
      return;
    }
    const srcText = global.cm.getRange(srcNode.from, srcNode.to);

    let value = null;
    if (isDropTarget && global.options.willInsertNode) {
      value = global.options.willInsertNode(
        global.cm,
        srcText,
        undefined, // TODO(Oak): just only for the sake of backward compat. Get rid if possible
        destFrom,
      );
    } else {
      value = srcText;
    }

    commitChanges(
      cm => () => {
        if (poscmp(srcNode.from, destFrom) < 0) {
          cm.replaceRange(value, destFrom, destTo);
          cm.replaceRange('', srcNode.from, srcNode.to);
        } else {
          cm.replaceRange('', srcNode.from, srcNode.to);
          cm.replaceRange(value, destFrom, destTo);
        }
      },
      () => {},
      () => {}
    );
  };
}
