import {say, poscmp, copyToClipboard, pasteFromClipboard} from './utils';
import {commitChanges} from './codeMirror';
import global from './global';
import {playSound, WRAP} from './sound';

/* This file is for _shared_ actions */

let queuedAnnouncement = null;

export function deleteNodes() {
  return (dispatch, getState) => {
    const {ast, selections} = getState();
    const nodeSelections = selections.map(ast.getNodeById);
    // we delete from the end of the document to the beginning so that
    // the next deletion still has a valid pos
    nodeSelections.sort((a, b) => poscmp(b.from, a.from));
    if (nodeSelections.length === 0) {
      // TODO(Oak): say something
    } else {
      commitChanges(
        cm => () => {
          for (const node of nodeSelections) {
            cm.replaceRange('', node.from, node.to, 'cmb:delete-nodes');
          }
        },
        () => {},
        () => {},
      );
      // since we sort in descending order, this is the last one in the array
      const firstNode = nodeSelections.pop();
      dispatch(activateByNId(firstNode.nid, true));
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
          cm.replaceRange(value, destFrom, destTo, 'cmb:drop-node');
          cm.leplaceRange('', srcNode.from, srcNode.to, 'cmb: drop-node');
        } else {
          cm.replaceRange('', srcNode.from, srcNode.to, 'cmb:drop-node');
          cm.replaceRange(value, destFrom, destTo, 'cmb:drop-node');
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
    dispatch(activateByNId(null, false, node => node));
  };
}

export function pasteNodes(id, isBackward) {
  return (dispatch, getState) => {
    const {ast, selections} = getState();
    const node = ast.getNodeById(id);
    let from = null, to = null, textTransform = x => x;
    let focusTarget = null;
    if (selections.includes(id)) {
      // NOTE(Oak): overwrite in this case
      from = node.from;
      to = node.to;
      focusTarget = 'self';
    } else {
      // NOTE(Oak): otherwise, we do not overwrite
      const pos = isBackward ? node.from : node.to;
      focusTarget = isBackward ? 'back' : 'next';
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
          cm.replaceRange(text, from, to, 'cmb:paste');
        },
        () => {},
        () => {}
      );
      // NOTE(Oak): always clear selections. Should this be a callback instead?
      dispatch({type: 'SET_SELECTIONS', selections: []});
      if (focusTarget === 'self') {
        dispatch(activateByNId(null, false, node => node));
      }
    });

  };
}

export function activateByNId(nid, allowMove) {
  return (dispatch, getState) => {
    const {ast, focusId} = getState();
    if (nid === null) nid = focusId;
    const node = ast.getNodeByNId(nid);
    if (node) {
      dispatch(activate(node.id, allowMove));
    }
  };
}

export function activate(id, allowMove) {
  return (dispatch, getState) => {
    if (id === null) return;
    const state = getState();
    const {ast, focusId, collapsedList} = state;
    const node = ast.getNodeById(id);
    if (!node) {
      playSound(WRAP);
      return;
    }
    if (node.nid === focusId) {
      say(node.options['aria-label']);
    }
    // FIXME(Oak): if possible, let's not hard code like this
    if (['blank', 'literal'].includes(node.type) && !collapsedList.includes(node.id)) {
      if (queuedAnnouncement) clearTimeout(queuedAnnouncement);
      queuedAnnouncement = setTimeout(() => {
        say('Use enter to edit', 1250);
      });
    }
    // FIXME(Oak): here's a problem. When we double click, the click event will
    // be fired as well. That is, it tries to activate a node and then edit
    // this is bad because both `say(...)` and `.focus()` will be unnecessarily
    // invoked.
    // The proper way to fix this is to do some kind of debouncing to avoid
    // calling `activate` in the first place
    // but we will use a hacky one for now: we will let `activate`
    // happens, but we will detect that node.element is absent, so we won't do
    // anything
    // Note, however, that it is also a good thing that `activate` is invoked
    // when double click because we can set focusId on the to-be-focused node
    setTimeout(() => {
      if (node.element) {
        const scroller = global.cm.getScrollerElement();
        const wrapper = global.cm.getWrapperElement();

        if (allowMove) {
          global.cm.scrollIntoView(node.from);
          let {top, bottom, left, right} = node.element.getBoundingClientRect(); // get the *actual* bounding rect
          let offset = wrapper.getBoundingClientRect();
          let scroll = global.cm.getScrollInfo();
          top    = top    + scroll.top  - offset.top;
          bottom = bottom + scroll.top  - offset.top;
          left   = left   + scroll.left - offset.left;
          right  = right  + scroll.left - offset.left;
          global.cm.scrollIntoView({top, bottom, left, right});
        }
        scroller.setAttribute('aria-activedescendent', node.element.id);
        node.element.focus();
      }
    }, 100);
    dispatch({type: 'SET_FOCUS', focusId: node.nid});
  };
}

