import {withDefaults, say, poscmp, srcRangeContains, minposOfArray} from './utils';
import SHARED from './shared';
import {store} from './store';
import {playSound, WRAP} from './sound';
import {performEdits, edit_insert, edit_delete, edit_replace,
        edit_replace_toplevel_text, padCopiedText} from './edits/performEdits';


// All editing actions are defined here.
// 
// Just about every action can take an optional `onSuccess` and `onError`
// callback. If the action is successful, it will call `onSuccess(newAST)`. If
// it fails, it will call `onError(theError)`.
//
// The implementation of actions is in the folder `src/actions/`. IT IS PRIVATE,
// AND NO FILE EXCEPT src/actions.js AND src/targets.js SHOULD EVER NEED TO
// IMPORT IT. The implementation is complex, because while edits are best
// thought of as operations on the AST, they must all be transformed into text
// edits, and the only interface we have into the language's textual syntax are
// the `pretty` and `parse` methods.


// Insert `text` at the given `target`.
// See `src/targets.js` for what kinds of `Target` there are.
export function insert(text, target, onSuccess, onError) {
  const {ast} = store.getState();
  const edits = [target.toEdit(text)];
  const focusHint = (newAST) => target.findMe(newAST);
  performEdits('cmb:insert', ast, edits, focusHint, onSuccess, onError);
}

// Delete the given nodes.
export function delete_(nodes, onSuccess, onError) { // 'delete' is a reserved word
  if (nodes.length === 0) return;
  const {ast} = store.getState();
  const edits = nodes.map(node => edit_delete(node));
  const lastEdit = edits[edits.length - 1];
  const prevNode = ast.getNodeBefore(lastEdit.node);
  const focusHint = (newAST) => {
    return prevNode ? newAST.getNodeById(prevNode.id) : newAST.getFirstRootNode();
  };
  performEdits('cmb:delete-node', ast, edits, focusHint, onSuccess, onError);
  store.dispatch({type: 'SET_SELECTIONS', selections: []});
}

// Copy the given nodes onto the clipboard.
export function copy(nodes) {
  if (nodes.length === 0) return;
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

// Paste from the clipboard at the given `target`.
// See `src/targets.js` for what kinds of `target` there are.
export function paste(target, onSuccess, onError) {
  pasteFromClipboard(text => {
    const {ast} = store.getState();
    const edits = [target.toEdit(text)];
    const focusHint = (newAST) => target.findMe(newAST);
    performEdits('cmb:paste', ast, edits, focusHint, onSuccess, onError);
    store.dispatch({type: 'SET_SELECTIONS', selections: []});
  });
}

// Drag from `src` (which should be a d&d monitor thing) to `target`.
// See `src/targets.js` for what kinds of `target` there are.
export function drop(src, target, onSuccess, onError) {
  const {id: srcId, content: srcContent} = src;
  const {ast} = store.getState();
  const srcNode = srcId ? ast.getNodeById(srcId) : null; // null if dragged from toolbar
  const content = srcNode ? srcNode.toString() : srcContent;
  
  // If we dropped the node _inside_ where we dragged it from, do nothing.
  if (srcNode && srcRangeContains(srcNode.srcRange(), target.srcRange())) {
    return;
  }
  let edits = [];
  // Delete the dragged node, unless it came from the toolbar.
  if (srcNode !== null) {
    edits.push(edit_delete(srcNode));
  }
  // Insert or replace at the drop location, depending on what we dropped it on.
  edits.push(target.toEdit(content));
  // Perform the edits.
  const focusHint = (newAST) => target.findMe(newAST);
  performEdits('cmb:drop-node', ast, edits, focusHint);
}

let queuedAnnouncement = null;

// Activate the node with the given `id`.
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

