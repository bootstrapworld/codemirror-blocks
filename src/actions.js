import {skipWhile, poscmp, partition,
        copyToClipboard, pasteFromClipboard} from './utils';
import {commitChanges} from './codeMirror';
import global from './global';


export function focusNextNode(id, next) {
  return (dispatch, getState) => {
    const {collapsedList, ast} = getState();
    const collapsedNodeList = collapsedList.map(ast.getNodeById);
    // NOTE(Oak): if this is too slow, consider adding a
    // next/prevSibling attribute to short circuit navigation
    const node = skipWhile(
      node => node !== null && collapsedNodeList.some(
        collapsed => ast.isAncestor(collapsed.id, node.id)
      ),
      next(ast.getNodeById(id)),
      next
    );
    if (node) {
      dispatch({type: 'SET_FOCUS', focusId: node.nid});
      setTimeout(() => {
        dispatch(focusSelf());
      }, 20);
    } else {
      // announce beep
    }
  };
}

export function focusNode(id) {
  return (dispatch, getState) => {
    const {ast} = getState();
    const focusId = ast.getNodeById(id).nid;
    dispatch({type: 'SET_FOCUS', focusId});
    // const node = ast.getNodeByNId(focusId);
    // if (node) node.element.focus();
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
    const {ast, selections} = getState();
    const nodeSelections = selections.map(ast.getNodeById);
    // we delete from the end of the document to the beginning so that
    // the next deletion still has a valid pos
    nodeSelections.sort((a, b) => poscmp(b.from, a.from));
    if (nodeSelections.length === 0) {
      // TODO(Oak)
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

export function copyNodes(id, selectionEditor) {
  return (dispatch, getState) => {
    const {ast, selections} = getState();
    const nodeSelections = selectionEditor(selections).map(ast.getNodeById);
    nodeSelections.sort((a, b) => poscmp(a.from, b.from));
    const texts = nodeSelections.map(node => global.cm.getRange(node.from, node.to));
    copyToClipboard(texts.join(' '));
    dispatch(focusSelf());
  };
}

export function pasteNodes(id, isBackward) {
  return (dispatch, getState) => {
    const {ast, selections} = getState();
    const node = ast.getNodeById(id);
    let from = null, to = null, textTransform = x => x;
    if (selections.includes(id)) {
      // NOTE(Oak): overwrite in this case
      from = node.from;
      to = node.to;
    } else {
      // NOTE(Oak): otherwise, we do not overwrite
      const pos = isBackward ? node.from : node.to;
      from = pos;
      to = pos;
      if (global.options.willInsertNode) {
        textTransform = text =>
          global.options.willInsertNode(
            global.cm,
            text,
            undefined, // TODO(Oak): just only for the sake of backward compat. Get rid if possible
            pos,
          );
      }
    }

    pasteFromClipboard(text => {
      text = textTransform(text);
      commitChanges(
        cm => () => {
          cm.replaceRange(text, from, to);
        },
        () => {},
        () => {}
      );
      // NOTE(Oak): always clear selections. Should this be a callback instead?
      dispatch({type: 'SET_SELECTIONS', selections: []});
      // TODO(Oak): set focus for the new node
    });

  };
}

export function focusSelf() {
  return (_, getState) => {
    const {ast, focusId} = getState();
    const node = ast.getNodeByNId(focusId);
    if (node) node.element.focus();
  };
}
