import {withDefaults, say, poscmp} from '../utils';
import SHARED from '../shared';
import {store} from '../store';
import {playSound, WRAP} from '../sound';
import {performEdits, edit_insert, edit_delete, edit_replace, copyTextWithPadding} from './edit';


/* This file is for _shared_ actions */

let queuedAnnouncement = null;

export function deleteSelectedNodes(id, selectionEditor) {
  return (dispatch, getState) => {
    const {ast, selections} = getState();
    const selectedNodes = selectionEditor(selections).map(ast.getNodeById);
    deleteNodes(selectedNodes);
  }
}

function deleteNodes(nodes) {
  const {ast, focusId} = store.getState();
  if (nodes.length === 0) {
    return;
  }
  performEdits(nodes.map(node => {
    edit_delete(node, 'cmb:delete-node');
  }));
  dispatch({type: 'SET_SELECTIONS', selections: []});
}

export function deleteNodes(id, selectionEditor) {
  return (dispatch, getState) => {
    const {ast, selections} = getState();
    const nodeSelections = selectionEditor(selections).map(ast.getNodeById);
    // we delete from the end of the document to the beginning so that
    // the next deletion still has a valid pos
    nodeSelections.sort((a, b) => poscmp(b.from, a.from));
    if (nodeSelections.length === 0) {
      return;
    }
    commitChanges(
      cm => () => {
        for (const node of nodeSelections) {
          var {from, to} = node.srcRange();
          var {from, to} = removeClearedSpace(from, to);
          cm.replaceRange('', from, to, 'cmb:delete-nodes');
        }
      },
      () => {},
      () => {},
    );
    // since we sort in descending order, this is the last one in the array
    const firstNode = nodeSelections.pop();
    dispatch({type: 'SET_SELECTIONS', selections: []});
  };
}

export function dropNode({id: srcId, content}, {from: destFrom, to: destTo, isDropTarget}) {
  return (dispatch, getState) => {
    if (!destFrom) {
      // TODO: Where are these spurious events coming from?
      return;
    }
    const {ast} = getState();
    // srcNode is null if there's nothing to delete; e.g. if dragged from toolbar
    const srcNode = srcId ? ast.getNodeById(srcId) : null;
    if (srcNode && poscmp(destFrom, srcNode.from) > 0 && poscmp(destTo, srcNode.to) < 0) {
      return;
    }

    // Drag the pretty-printed source node, comments and all.
    if (srcNode) {
      var {from: srcFrom, to: srcTo} = srcNode.srcRange();
      var {from: srcFrom, to: srcTo} = removeClearedSpace(srcFrom, srcTo);
      content = srcNode.toString();
    }

    let value = null;
    if (isDropTarget) {
      let needsPrecedingNewline = !!(srcNode && srcNode.options.comment);
      value = copyTextWithPadding(ast, destFrom, destTo, needsPrecedingNewline);
    } else {
      value = content;
    }

    commitChanges(
      cm => () => {
        if (srcNode === null) {
          cm.replaceRange(value, destFrom, destTo, 'cmb:drop-node');
        } else if (poscmp(srcFrom, destFrom) < 0) {
          cm.replaceRange(value, destFrom, destTo, 'cmb:drop-node');
          cm.replaceRange('', srcFrom, srcTo, 'cmb: drop-node');
        } else {
          cm.replaceRange('', srcFrom, srcTo, 'cmb:drop-node');
          cm.replaceRange(value, destFrom, destTo, 'cmb:drop-node');
        }
      },
      () => {},
      () => {}
    );
  };
}

export function copySelectedNodes(id, selectionEditor) {
  return (dispatch, getState) => {
    const {ast, selections} = getState();
    const selectedNodes = selectionEditor(selections).map(ast.getNodeById);
    copyNodes(selectedNodes);
  }
}

export function copyNodes(nodes) {
  if (nodes.length === 0) {
    return;
  }
  const {ast, focusId} = store.getState();
  // Pretty-print each copied node. Join them with spaces, or newlines for
  // commented nodes (to prevent a comment from attaching itself to a
  // different node after pasting).
  nodes.sort((a, b) => poscmp(a.from, b.from));
  let text = "";
  let postfix = "";
  for (let node of nodes) {
    let prefix = (node.options && node.options.comment) ? "\n" : postfix;
    text = text + prefix + node.toString();
    postfix = (node.options && node.options.comment) ? "\n" : " ";
  }
  copyToClipboard(text);
  // Copy steals focus. Force it back to the node's DOM element
  // without announcing via activate() or activate().
  if (focusId) {
    ast.getNodeById(focusId).element.focus();
  }
}

export function pasteNodes(id, isBackward) {
  return (dispatch, getState) => {
    const {ast, selections} = getState();
    const node = ast.getNodeById(id);
    let from = null, to = null;
    let focusTarget = null;
    let range = node.srcRange(); // Include any comments the node has.
    if (selections.includes(id)) {
      // NOTE(Oak): overwrite in this case
      from = range.from;
      to = range.to;
      focusTarget = 'self';
    } else {
      // NOTE(Oak): otherwise, we do not overwrite
      const pos = isBackward ? range.from : range.to;
      focusTarget = isBackward ? 'back' : 'next';
      from = pos;
      to = pos;
    }

    pasteFromClipboard(text => {
      commitChanges(
        cm => () => {
          cm.replaceRange(text, from, to, 'cmb:paste');
        },
        () => {},
        () => {}
      );
      // NOTE(Oak): always clear selections. Should this be a callback instead?
      dispatch({type: 'SET_SELECTIONS', selections: []});
    });

  };
}

export function activate(id, options) {
  return (dispatch, getState) => {
    options = withDefaults(options, {allowMove: true, record: true});
    const state = getState();
    const {ast, focusId, collapsedList} = state;
    if (id === null) { id = focusId }
    const node = ast.getNodeById(id);

    // Don't activate a toolbar node. (Screenreaders will still announce it)
    if (!node) { return; }

    // force the screenreader to re-announce if we're on the same node by blurring/refocusing
    // check for node.element, since the test suite may run so fast that the element isn't there
    if (node.id === focusId && node.element) {
      node.element.blur();
      setTimeout(() => node.element.focus(), 10);
    }
    // FIXME(Oak): if possible, let's not hard code like this
    if (['blank', 'literal'].includes(node.type) && !collapsedList.includes(node.id)) {
      if(queuedAnnouncement) { clearTimeout(queuedAnnouncement); } 
      queuedAnnouncement = setTimeout(() => say('Use enter to edit'), 1250 );
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

/* Note(Emmanuel): Oak says this used to be needed to avoid a bug
  // currently fixed a different way, by allowing CM to preserve state and letting
  // CMB's cur state remain unchanged (see SET_FOCUS in reducers.js)
SHARED.cm.setCursor({line: -1, ch: 0});
*/

    setTimeout(() => {
      dispatch({type: 'SET_FOCUS', focusId: node.id});
      
      if (options.record) {
        SHARED.search.setCursor(node.from);
      }
      if (node.element) {
        const scroller = SHARED.cm.getScrollerElement();
        const wrapper = SHARED.cm.getWrapperElement();

        if (options.allowMove) {
          SHARED.cm.scrollIntoView(node.from);
          let {top, bottom, left, right} = node.element.getBoundingClientRect(); // get the *actual* bounding rect
          let offset = wrapper.getBoundingClientRect();
          let scroll = SHARED.cm.getScrollInfo();
          top    = top    + scroll.top  - offset.top;
          bottom = bottom + scroll.top  - offset.top;
          left   = left   + scroll.left - offset.left;
          right  = right  + scroll.left - offset.left;
          SHARED.cm.scrollIntoView({top, bottom, left, right});
        }
        scroller.setAttribute('aria-activedescendent', node.element.id);
        node.element.focus();
      }
      
    }, 25);
  };
}

function copyToClipboard(text) {
  SHARED.buffer.value = text;
  SHARED.buffer.select();
  document.execCommand('copy');
}

function pasteFromClipboard(done) {
  SHARED.buffer.value = '';
  SHARED.buffer.focus();
  setTimeout(() => {
    done(SHARED.buffer.value);
  }, 50);
}
