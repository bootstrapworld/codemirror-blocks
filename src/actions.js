import {withDefaults, say, poscmp, srcRangeIncludes, warn, createAnnouncement} from './utils';
import SHARED from './shared';
import {store} from './store';
import {performEdits, edit_insert, edit_delete, edit_replace,
  edit_overwrite} from './edits/performEdits';


// All editing actions are defined here.
//
// Many actions take a Target as an option. A Target may be constructed by any
// of the methods on the `Targets` export below.
//
// Just about every action can take an optional `onSuccess` and `onError`
// callback. If the action is successful, it will call `onSuccess(newAST)`. If
// it fails, it will call `onError(theError)`.
//
// The implementation of actions is in the folder `src/edits/`. IT IS PRIVATE,
// AND FOR THE MOST PART, NO FILE EXCEPT src/actions.js SHOULD NEED TO IMPORT IT.
// (Exception: speculateChanges and commitChanges are sometimes imported.)
// The implementation is complex, because while edits are best thought of as
// operations on the AST, they must all be transformed into text edits, and the
// only interface we have into the language's textual syntax are the `pretty`
// and `parse` methods.


// A _Target_ says where an action is directed. For example, a target may be a
// node or a drop target.
//
// These are the kinds of targets:
// - InsertTarget: insert at a location inside the AST.
// - ReplaceNodeTarget: replace an ast node.
// - OverwriteTarget: replace a range of text at the top level.
//
// These kinds of actions _have_ a target:
// - Paste: the target says where to paste.
// - Drag&Drop: the target says what's being dropped on.
// - Insert/Edit: the target says where the text is being inserted/edited.
//
// Targets are defined at the bottom of this file.


// Insert `text` at the given `target`.
// See the comment at the top of the file for what kinds of `target` there are.
export function insert(text, target, onSuccess, onError, annt) {
  checkTarget(target);
  const {ast} = store.getState();
  const edits = [target.toEdit(text)];
  performEdits('cmb:insert', ast, edits, onSuccess, onError, annt);
}

// Delete the given nodes.
export function delete_(nodes, editWord) { // 'delete' is a reserved word
  if (nodes.length === 0) return;
  const {ast} = store.getState();
  nodes.sort((a, b) => poscmp(b.from, a.from)); // To focus before first deletion
  const edits = nodes.map(node => edit_delete(node));
  let annt = false;
  if (editWord) {
    annt = createAnnouncement(nodes, editWord);
    say(annt);
  }
  performEdits('cmb:delete-node', ast, edits, undefined, undefined, annt);
  store.dispatch({type: 'SET_SELECTIONS', selections: []});
}

// Copy the given nodes onto the clipboard.
export function copy(nodes, editWord) {
  if (nodes.length === 0) return;
  const {ast, focusId} = store.getState();
  // Pretty-print each copied node. Join them with spaces, or newlines for
  // commented nodes (to prevent a comment from attaching itself to a
  // different node after pasting).
  nodes.sort((a, b) => poscmp(a.from, b.from));
  let annt = createAnnouncement(nodes, editWord);
  say(annt);
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
// See the comment at the top of the file for what kinds of `target` there are.
export function paste(target, onSuccess, onError) {
  checkTarget(target);
  pasteFromClipboard(text => {
    const {ast} = store.getState();
    const edits = [target.toEdit(text)];
    performEdits('cmb:paste', ast, edits, onSuccess, onError);
    store.dispatch({type: 'SET_SELECTIONS', selections: []});
  });
}

// Drag from `src` (which should be a d&d monitor thing) to `target`.
// See the comment at the top of the file for what kinds of `target` there are.
export function drop(src, target, onSuccess, onError) {
  checkTarget(target);
  const {id: srcId, content: srcContent} = src;
  let {ast, collapsedList} = store.getState(); // get the AST, and which nodes are collapsed
  const srcNode = srcId ? ast.getNodeById(srcId) : null; // null if dragged from toolbar
  const content = srcNode ? srcNode.toString() : srcContent;
  
  // If we dropped the node _inside_ where we dragged it from, do nothing.
  if (srcNode && srcRangeIncludes(srcNode.srcRange(), target.srcRange())) {
    return;
  }

  let edits = [];
  let droppedHash;

  // Assuming it did not come from the toolbar...
  // (1) Delete the text of the dragged node, (2) and save the id and hash
  if (srcNode !== null) {
    edits.push(edit_delete(srcNode));
    droppedHash = ast.nodeIdMap.get(srcNode.id).hash;
  }
  
  // Insert or replace at the drop location, depending on what we dropped it on.
  edits.push(target.toEdit(content));
  // Perform the edits.
  performEdits('cmb:drop-node', ast, edits, onSuccess, onError);

  // Assuming it did not come from the toolbar, and the srcNode was collapsed...
  // Find the matching node in the new tree and collapse it
  if((srcNode !== null) && collapsedList.find(id => id == srcNode.id)) {
    let {ast} = store.getState();
    const newNode = [...ast.nodeIdMap.values()].find(n => n.hash == droppedHash);
    store.dispatch({type: 'COLLAPSE', id: newNode.id});
    store.dispatch({type: 'UNCOLLAPSE', id: srcNode.id});
  }
}

// Drag from `src` (which should be a d&d monitor thing) to the trash can, which
// just deletes the block.
export function dropOntoTrashCan(src) {
  const {ast} = store.getState();
  const srcNode = src.id ? ast.getNodeById(src.id) : null; // null if dragged from toolbar
  if (!srcNode) return; // Someone dragged from the toolbar to the trash can.
  let edits = [edit_delete(srcNode)];
  performEdits('cmb:trash-node', ast, edits);
}

// Set the cursor position.
export function setCursor(cur) {
  return (dispatch, _getState) => {
    if (SHARED.cm && cur) {
      SHARED.cm.focus();
      SHARED.search.setCursor(cur);
      SHARED.cm.setCursor(cur);
    }
    dispatch({type: 'SET_CURSOR', cur});
  };
}

// Activate the node with the given `id`.
export function activate(id, options) {
  return (dispatch, getState) => {
    options = withDefaults(options, {allowMove: true, record: true});
    const state = getState();
    const {ast, focusId, collapsedList} = state;
    if (id === null) { id = focusId; }
    // FIXME DS26GTE: sometimes focusId is also null
    let node = null;
    if (ast && id) {
      node = ast.getNodeById(id);
    }

    // Don't activate a toolbar node. (Screenreaders will still announce it)
    if (!node) { return; }

    // check for element on focus, since tests or node editing may happen so fast 
    // that the element isn't there yet
    if (node.id === focusId) {
      setTimeout(() => { if(node.element) node.element.focus(); }, 10);
    }

    clearTimeout(store.queuedAnnouncement);  // clear any overrideable announcements
    // FIXME(Oak): if possible, let's not hard code like this
    if (['blank', 'literal'].includes(node.type) && !collapsedList.includes(node.id)) {
      say('Use enter to edit', 1250, true); // wait 1.25s, and allow to be overridden
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

function checkTarget(target) {
  if (!(target instanceof Target)) {
    warn('actions', `Expected target ${target} to be an instance of the Target class.`);
  }
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

// The class of all targets.
export class Target {
  constructor(from, to) {
    this.from = from;
    this.to = to;
  }

  srcRange() {
    return {from: this.from, to: this.to};
  }
}

// Insert at a location inside the AST.
export class InsertTarget extends Target {
  constructor(parentNode, fieldName, pos) {
    super(pos, pos);
    this.parent = parentNode;
    this.field = fieldName;
    this.pos = pos;
  }

  getText(_ast) {
    return "";
  }

  toEdit(text) {
    return edit_insert(text, this.parent, this.field, this.pos);
  }
}

// Target an ASTNode. This will replace the node.
export class ReplaceNodeTarget extends Target {
  constructor(node) {
    const range = node.srcRange();
    super(range.from, range.to);
    this.node = node;
  }

  getText(ast) {
    const {from, to} = ast.getNodeById(this.node.id);
    return SHARED.cm.getRange(from, to);
  }

  toEdit(text) {
    return edit_replace(text, this.node);
  }
}

// Target a source range at the top level. This really has to be at the top
// level: neither `from` nor `to` can be inside any root node.
export class OverwriteTarget extends Target {
  constructor(from, to) {
    super(from, to);
  }

  getText(_ast) {
    return SHARED.cm.getRange(this.from, this.to);
  }

  toEdit(text) {
    return edit_overwrite(text, this.from, this.to);
  }
}
