import React from 'react';
import CodeMirror from 'codemirror';
import SHARED from './shared';
import {delete_, copy, paste, InsertTarget,
  ReplaceNodeTarget, OverwriteTarget, activateByNid} from './actions';
import {partition, getRoot, skipCollapsed, say, mac, assert,
  getLastVisibleNode, preambleUndoRedo, playSound, BEEP} from './utils';
import {findAdjacentDropTargetId as getDTid} from './components/DropTarget';

export const defaultKeyMap = {
  // NAVIGATION
  'Down'      : 'Next Block',
  'Up'        : 'Previous Block',
  'Home'      : 'First Block',
  'End'       : 'Last Visible Block',
  'Left'      : 'Collapse or Select Parent',
  'Right'     : 'Expand or Select 1st Child',
  'Shift-Left': 'Collapse All',
  'Shift-Right':'Expand All',
  'Shift-Alt-Left': 'Collapse Current Root',
  'Shift-Alt-Right':'Expand Current Root',
  'Shift-,'   : 'Jump to Root',
  '\\'        : 'Read Ancestors',
  'Shift-\\'  : 'Read Children',
  'Shift-Tab' : 'Shift Focus',

  // EDITING
  'Enter'     : 'Edit',
  'Ctrl-['    : 'Insert Left',
  'Ctrl-]'    : 'Insert Right',

  // SEARCH, SELECTION & CLIPBOARD
  'Space'     : 'Toggle Selection',
  'Esc'       : 'Clear Selection',
  'Ctrl-Esc'  : 'Clear Selection',
  'Alt-Q'     : 'Clear Selection',
  'Delete'    : 'Delete Nodes',
  'Backspace' : 'Delete Nodes',
  'PageUp'    : 'Search Previous',
  'PageDown'  : 'Search Next',
  'F3'        : 'Activate Search Dialog',
  'Ctrl-F'    : 'Activate Search Dialog',
};

const macKeyMap = {
  'Cmd-Enter'  : 'Edit Anything',
  'Cmd-F'      : 'Activate Search Dialog',
  'Cmd-Z'      : 'Undo',
  'Shift-Cmd-Z': 'Redo',
  'Cmd-Y'      : 'Redo',
  'Cmd-C'      : 'Copy',
  'Cmd-V'      : 'Paste',
  'Shift-Cmd-V': 'Paste Before',
  'Cmd-X'      : 'Cut',
  'Shift-Ctrl-/':'Help',
};

const pcKeyMap = {
  'Ctrl-Z'     : 'Undo',
  'Ctrl-Y'     : 'Redo',
  'Shift-Ctrl-Z':'Redo',
  'Ctrl-C'     : 'Copy',
  'Ctrl-V'     : 'Paste',
  'Shift-Ctrl-V':'Paste Before',
  'Ctrl-X'     : 'Cut',
  'Shift-Ctrl-/':'Help',
};

// Add platform-specific keys
Object.assign(defaultKeyMap, mac? macKeyMap : pcKeyMap);
// see https://codemirror.net/doc/manual.html#keymaps
CodeMirror.normalizeKeyMap(defaultKeyMap);

function pasteHandler(_, e) {
  if(!this.node) { return CodeMirror.Pass; }
  const node = this.node;
  const before = e.shiftKey; // shiftKey=down => we paste BEFORE the active node
  const pos = before ? node.srcRange().from : node.srcRange().to;
  if (this.selections.includes(node.id)) {
    paste(new ReplaceNodeTarget(node));
  } else if (node.parent) {
    let dropTarget = document.getElementById(getDTid(node, before));
    // We're inside the AST somewhere. Try to paste to the left/right.
    const target = new InsertTarget(this.node.parent, dropTarget, pos);
    if (target) { paste(target); }
    else { say(`Cannot paste ${(e.shiftKey ? "before" : "after")} this node.`); }
  } else {
    // We're at a root node. Insert to the left or right, at the top level.
    paste(new OverwriteTarget(pos, pos));
  }
}

export const commandMap = {
  prevFocus : function (_, e) {
    e.preventDefault();
    this.toolbarRef.current.primitiveSearch.focus();
  },
  // NAVIGATION
  'Previous Block' : function (_, e) {
    e.preventDefault();
    if(this.node) {
      let prev = this.fastSkip(node => node.prev);
      if (prev) { return this.activateByNid(prev.nid); }
    }
    const prevNode = this.cur && this.ast.getNodeBeforeCur(this.cur);
    return prevNode? this.activateByNid(prevNode.nid, {allowMove: true})
      : playSound(BEEP);
  },

  'Next Block' : function (_, e) {
    e.preventDefault();
    if(this.node) {
      let next = this.fastSkip(node => node.next);
      if (next) { return this.activateByNid(next.nid); }
    }
    const nextNode = this.cur && this.ast.getNodeAfterCur(this.cur);
    return nextNode? this.activateByNid(nextNode.nid, {allowMove: true})
      : playSound(BEEP);
  },

  'First Block' : function (_) {
    if(!this.node) { return CodeMirror.Pass; }
    this.activateByNid(0, {allowMove: true});
  },

  'Last Visible Block' : function (_) {
    if(!this.node) { return CodeMirror.Pass; }
    else { this.activateByNid(getLastVisibleNode(this.state).nid); }
  },

  'Collapse or Select Parent' : function(_) {
    if(!this.node) { return CodeMirror.Pass; }
    if (this.expandable && !this.isCollapsed && !this.isLocked()) {
      this.collapse(this.node.id);
    } else if (this.node.parent) {
      this.activateByNid(this.node.parent.nid);
    } else {
      playSound(BEEP);
    }
  },

  'Expand or Select 1st Child' : function (_) {
    if(!this.node) { return CodeMirror.Pass; }
    const node = this.node;
    if (this.expandable && this.isCollapsed && !this.isLocked()) {
      this.uncollapse(node.id);
    } else if (node.next?.parent === node) {
      this.activateByNid(node.next.nid);
    } else {
      playSound(BEEP);
    }
  },

  'Collapse All' : function (_) {
    if(!this.node) { return CodeMirror.Pass; }
    this.dispatch({type: 'COLLAPSE_ALL'});
    this.activateByNid(getRoot(this.node).nid);
  },

  'Expand All' : function (_) {
    if(!this.node) { return CodeMirror.Pass; }
    else { return this.dispatch({type: 'UNCOLLAPSE_ALL'}); }
  },

  'Collapse Current Root' : function (_) {
    if(!this.node) { return CodeMirror.Pass; }
    if(!this.node.parent && (this.isCollapsed || !this.expandable)) {
      playSound(BEEP);
    } else {
      let root = getRoot(this.node);
      let descendants = [...root.descendants()];
      descendants.forEach(d => this.collapse(d.id));
      this.activateByNid(root.nid);
    }
  },

  'Expand Current Root' : function (_) {
    if(!this.node) { return CodeMirror.Pass; }
    let root = getRoot(this.node);
    [...root.descendants()].forEach(d => this.uncollapse(d.id));
    this.activateByNid(root.nid);
  },

  'Jump to Root' : function (_) {
    if(!this.node) { return CodeMirror.Pass; }
    else { this.activateByNid(getRoot(this.node).nid); }
  },

  'Read Ancestors' : function (_) {
    if(!this.node) { return CodeMirror.Pass; }
    const parents = [this.node.options['aria-label']];
    let next = this.node.parent;
    while (next) {
      parents.push(next.options['aria-label'] + ", at level " + next.level);
      next = next.parent;
    }
    if (parents.length > 1) { say(parents.join(", inside ")); }
    else { playSound(BEEP); }
  },

  'Read Children' : function (_) {
    if(!this.node) { return CodeMirror.Pass; }
    else { say(this.node.describe(this.node.level)); }
  },

  // SEARCH, SELECTION & CLIPBOARD
  'Toggle Selection' : function (_, e) {
    if(!this.node) { return CodeMirror.Pass; }
    e.preventDefault();
    const node = this.node;
    if (this.selections.includes(this.node.id)) {
      this.dispatch({
        type: 'SET_SELECTIONS',
        selections: this.selections.filter(s => s !== node.id)
      });
      // TODO(Emmanuel): announce removal
    } else {
      const isContained = id => this.ast.isAncestor(node.id, id);
      const doesContain = id => this.ast.isAncestor(id, node.id);
      const [removed, newSelections] = partition(this.selections, isContained);
      assert(removed.length == 0); 
      if (newSelections.some(doesContain)) {
        playSound(BEEP);
        say('This node is already has a selected ancestor');
        // TODO(Emmanuel): announce failure
      } else {
        // TODO(Emmanuel): announce addition
        newSelections.push(this.node.id);
        this.dispatch({
          type: 'SET_SELECTIONS',
          selections: newSelections
        });
      }
    }
  },

  'Edit' : function (_, e) {
    if(!this.node) { return CodeMirror.Pass; }
    if (this.normallyEditable) {
      this.handleMakeEditable(e);
      e.preventDefault();
    } else if (this.expandable && !this.isLocked()) {
      (this.isCollapsed ? this.uncollapse : this.collapse)(this.node.id);
    } else {
      playSound(BEEP);
    }
  },

  'Edit Anything' : function (_, e) {
    if(!this.node) { return CodeMirror.Pass; }
    else { return this.handleMakeEditable(e); }
  },

  'Clear Selection' : function (_) {
    if(!this.node) { return CodeMirror.Pass; }
    this.dispatch({type: 'SET_SELECTIONS', selections: []});
  },

  'Delete Nodes' : function (_) {
    if(!this.node) { return CodeMirror.Pass; }
    if(!this.selections.length) { return say('Nothing selected'); }
    const nodesToDelete = this.selections.map(this.ast.getNodeById);
    delete_(nodesToDelete, "deleted");
  },

  // use the srcRange() to insert before/after the node *and*
  // any associated comments
  'Insert Right' : function (_) {
    if(!this.node) { return CodeMirror.Pass; }
    if(!this.setRight()) { this.setCursor(this.node.srcRange().to); }
  },
  'Insert Left' : function (_) {
    if(!this.node) { return CodeMirror.Pass; }
    if(!this.setLeft()) { this.setCursor(this.node.srcRange().from); }
  },

  'Cut' : function (_) {
    if(!this.node) { return CodeMirror.Pass; }
    if(!this.selections.length) { return say('Nothing selected'); }
    const nodesToCut = this.selections.map(this.ast.getNodeById);
    copy(nodesToCut, "cut");
    delete_(nodesToCut);
  },

  'Copy' : function (_) {
    if(!this.node) { return CodeMirror.Pass; }
    // if no nodes are selected, do it on focused node's id instead
    const nodeIds = !this.selections.length? [this.node.id] : this.selections;
    const nodesToCopy = nodeIds.map(this.ast.getNodeById);
    copy(nodesToCopy, "copied");
  },

  'Paste' : pasteHandler,
  'Paste Before' : pasteHandler,

  'Activate Search Dialog' : function (_) {
    SHARED.search.onSearch(
      this.state,
      () => {},
      () => this.activateNoRecord(SHARED.search.search(true, this.state))
    );
  },

  'Search Previous' : function (_, e) {
    e.preventDefault();
    this.activateNoRecord(SHARED.search.search(false, this.state));
  },

  'Search Next' : function (_, e) {
    e.preventDefault();
    this.activateNoRecord(SHARED.search.search(true, this.state));
  },

  'Undo' : function(_, e) {
    e.preventDefault();
    preambleUndoRedo('undo');
    SHARED.cm.undo();
  },

  'Redo' : function(_, e) {
    e.preventDefault();
    preambleUndoRedo('redo');
    SHARED.cm.redo();
  },

  'Help' : function (_) {
    this.showDialog(renderKeyMap(this.keyMap));
  }
};

// Recieves the key event, an environment (BlockEditor or Node), and the
// editor's keyMap. If there is a handler for that event, flatten the
// environment and add some utility methods, then set the key handler's
// "this" object to be that environment and call it.
export function keyDown(e, env, keyMap) {
  var handler = commandMap[keyMap[CodeMirror.keyName(e)]];
  if(handler) {
    e.stopPropagation();
    env.props.dispatch((_, getState) => {
      // set up the environment
      const state = getState();
      const {ast, selections} = state;
      Object.assign(env, env.props, {ast, selections, state});
      // add convenience methods
      env.fastSkip = function (next) {
        return skipCollapsed(env.node, next, state);
      };
      env.activate = (n, options={allowMove: true, record: true}) => {
        if (n === null) { playSound(BEEP); }
        env.props.activateByNid((n === undefined)? env.node.nid : n.nid, options);
      };
      env.activateNoRecord = node => {
        if(!node) { return playSound(BEEP); } // nothing to activate
        env.dispatch(activateByNid(node.nid, {record: false, allowMove: true}));
      };
      // If there's a node, make sure it's fresh
      if(env.node) {
        env.node = env.ast.getNodeByNId(env.ast.getNodeById(env.node.id).nid);
      }
    });
    handler = handler.bind(env);
    return handler(SHARED.cm, e);
  }
}

export function renderKeyMap(keyMap) {
  const reverseMap = {};
  Object.keys(keyMap).forEach(key => {
    if(!reverseMap[keyMap[key]]) { reverseMap[keyMap[key]] = [key]; }
    else reverseMap[keyMap[key]].push(key);
  });
  window.reverseMap = reverseMap;
  return (
    <>
      <h1>Blocks Shortcuts</h1>
      <span className="screenreader">
        Screenreader users: Make sure to either increase the verbosity of your screenreader, 
        or character over the shortcut column in the tables below. Some shortcuts use 
        punctuation keys that may not always be spoken.
      </span>

      <table className="shortcuts">
        <tbody>
        {
          Object.entries(reverseMap).map(  // for each command, make a row...
            (kv, i) =>                     // for each row, list the kbd shortcuts
              (<tr key={i}><td>{kv[0]}</td><td>{kv[1].map((shortcut, j) => 
                (<kbd key={j}>{shortcut}</kbd>))}</td></tr>)
          )
        }
        </tbody>
      </table>
    </>
  );
}
