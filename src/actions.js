import {withDefaults, say, poscmp, copyToClipboard, pasteFromClipboard} from './utils';
import {commitChanges} from './codeMirror';
import SHARED from './shared';
import {playSound, WRAP} from './sound';

/* This file is for _shared_ actions */

let queuedAnnouncement = null;

export function deleteNodes(id, selectionEditor) {
  return (dispatch, getState) => {
    const {ast, selections} = getState();
    const nodeSelections = selectionEditor(selections).map(ast.getNodeById);
    // we delete from the end of the document to the beginning so that
    // the next deletion still has a valid pos
    nodeSelections.sort((a, b) => poscmp(b.from, a.from));
    if (nodeSelections.length === 0) {
      return; // Not much to do.
    }
    commitChanges(
      cm => () => {
        for (const node of nodeSelections) {
          const {from, to} = node.srcRange();
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

    // Drag the _whole_ source node, comments and all.
    if (srcNode) {
      var {from: srcFrom, to: srcTo} = srcNode.srcRange();
      content = SHARED.cm.getRange(srcFrom, srcTo);
    }

    let value = null;
    if (isDropTarget) {
      value = ' ' + content + ' '; // add spaces around inserted content
    } else {
      value = content;
    }

    // Make sure we don't accidentally merge with a comment.
    if (ast.followsComment(destFrom) || srcFrom && ast.precedesComment(srcFrom)) {
      value = "\n" + value;
    }
    if (ast.precedesComment(destTo) || srcTo && ast.followsComment(srcTo)) {
      value = value + "\n";
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

export function copyNodes(id, selectionEditor) {
  return (dispatch, getState) => {
    const {ast, selections} = getState();
    const nodeSelections = selectionEditor(selections).map(ast.getNodeById);
    if (nodeSelections.length === 0) {
      return; // Not much to do.
    }
    nodeSelections.sort((a, b) => poscmp(a.from, b.from));
    const texts = nodeSelections.map(node => {
      const {from, to} = node.srcRange();
      return SHARED.cm.getRange(from, to);
    });
    // Make sure we don't accidentally merge with a comment.
    if (ast.precedesComment(nodeSelections[0].srcRange().from)) {
      texts[0] = "\n" + texts[0];
    }
    const last = nodeSelections.length - 1;
    if (ast.followsComment(nodeSelections[last].srcRange().to)) {
      texts[last] = texts[last] + "\n";
    }
    copyToClipboard(texts.join(' '));
    dispatch(activateByNId(null, {allowMove: false}));
  };
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
      text = ' ' + text + ' '; // add spaces around inserted content
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

export function activateByNId(nid, options) {
  return (dispatch, getState) => {
    const {ast, focusId} = getState();
    if (nid === null) nid = focusId;
    const node = ast.getNodeByNId(nid);
    if (node) {
      dispatch(activate(node.id, options));
    }
  };
}

export function activate(id, options) {
  return (dispatch, getState) => {
    // TODO(Oak): is this a dead code?
    if (id === null) return;

    options = withDefaults(options, {allowMove: true, record: true});
    const state = getState();
    const {ast, focusId, collapsedList} = state;
    const node = ast.getNodeById(id);

    // If the node is part of the toolbar...
    // TODO(Emmanuel): right now we bail, but shouldn't we at least say the label?
    if (!node) { return; }

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

/* Note(Emmanuel): Oak says this used to be needed to avoid a bug
  // currently fixed a different way, by allowing CM to preserve state and letting
  // CMB's cur state remain unchanged (see SET_FOCUS in reducers.js)
SHARED.cm.setCursor({line: -1, ch: 0});
*/

    setTimeout(() => {
      dispatch({type: 'SET_FOCUS', focusId: node.nid});
      
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
      
    }, 100);
  };
}

