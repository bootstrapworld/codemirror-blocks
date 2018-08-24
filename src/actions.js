import {skipWhile, poscmp, partition} from './utils';
import patch from './ast-patch';

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

export function setAST(newAST, changes, cm) {
  return (dispatch, getState) => {
    const {ast: oldAST} = getState();
    dispatch({type: 'SET_AST', ast: patch(oldAST, newAST, changes, cm)});
  };
}
