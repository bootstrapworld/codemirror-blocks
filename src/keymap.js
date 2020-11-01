import React from 'react';
import CodeMirror from 'codemirror';
import {playSound, BEEP} from './sound';
import SHARED from './shared';
import {delete_, copy, paste, InsertTarget, activate,
  ReplaceNodeTarget, OverwriteTarget} from './actions';
import {partition, getRoot, sayActionForNodes, skipCollapsed,
  say, getLastVisibleNode, preambleUndoRedo} from './utils';

const userAgent = navigator.userAgent;
const platform = navigator.platform;
const edge = /Edge\/(\d+)/.exec(userAgent);
const ios = !edge && /AppleWebKit/.test(userAgent) && /Mobile\/\w+/.test(userAgent);
const mac = ios || /Mac/.test(platform);

export const keyMap = {
  'Down'      : 'nextNode',
  'Up'        : 'prevNode',
  'Home'      : 'firstNode',
  'End'       : 'lastVisibleNode',
  'Left'      : 'collapseOrSelectParent',
  'Right'     : 'expandOrSelectFirstChild',
  'Shift-Left': 'collapseAll',
  'Shift-Right':'expandAll',
  'Shift-Alt-Left': 'collapseCurrentRoot',
  'Shift-Alt-Right':'expandCurrentRoot',
  'Enter'     : 'edit',
  'Space'     : 'toggleSelection',
  'Esc'       : 'clearSelection',
  'Ctrl-Esc'  : 'clearSelection',
  'Alt-Q'     : 'clearSelection',
  'Delete'    : 'deleteNodes',
  'Backspace' : 'deleteNodes',
  'Ctrl-['    : 'insertLeft',
  'Ctrl-]'    : 'insertRight',
  'Shift-,'   : 'jumpToRoot',
  '\\'        : 'readAncestors',
  'Shift-\\'  : 'readChildren',
  'PageUp'    : 'searchPrevious',
  'PageDown'  : 'searchNext',
  'F3'        : 'activateSearchDialog',
};

const macKeyMap = {
  'Cmd-Enter': 'editAnything',
  'Cmd-F'     : 'activateSearchDialog',
  'Cmd-Z'     : 'undo',
  'Shift-Cmd-Z': 'redo',
  'Cmd-Y'     : 'redo',
  'Cmd-C'     : 'copy',
  'Cmd-V'     : 'paste',
  'Shift-Cmd-V': 'pasteBefore',
  'Cmd-X'     : 'cut',
  'Shift-Ctrl-/': 'help',
};

const pcKeyMap = {
  'Ctrl-Enter': 'editAnything',
  'Ctrl-F'    : 'activateSearchDialog',
  'Ctrl-Z'    : 'undo',
  'Ctrl-Y'    : 'redo',
  'Shift-Ctrl-Z':'redo',
  'Ctrl-C'    : 'copy',
  'Ctrl-V'    : 'paste',
  'Shift-Ctrl-V'    : 'pasteBefore',
  'Ctrl-X'    : 'cut',
  'Shift-Ctrl-/': 'help',
};

// Add platform-specific keys
Object.assign(keyMap, mac? macKeyMap : pcKeyMap);
// see https://codemirror.net/doc/manual.html#keymaps
CodeMirror.normalizeKeyMap(keyMap);

export const commandMap = {
  prevNode : function (_) {
    if(this.node) return this.activate(this.fastSkip(node => node.prev));
    const prevNode = this.ast.getNodeBeforeCur(this.cur);
    if (prevNode) { this.activate(prevNode, {allowMove: true}); }
    else { playSound(BEEP); }
  },

  nextNode : function (_) {
    if(this.node) return this.activate(this.fastSkip(node => node.next));
    const nextNode = this.ast.getNodeAfterCur(this.cur);
    if (nextNode) { this.activate(nextNode, {allowMove: true}); }
    else { playSound(BEEP); }
  },

  firstNode : function (_) {
    if(!this.node) { return CodeMirror.Pass; }
    const root = this.ast.getFirstRootNode();
    this.activate(root, {allowMove: true});
  },

  lastVisibleNode : function (_) {
    if(!this.node) { return CodeMirror.Pass; }
    else { this.activate(getLastVisibleNode(this.state)); }
  },

  jumpToRoot : function (_) {
    if(!this.node) { return CodeMirror.Pass; }
    else { this.activate(getRoot(this.node)); }
  },

  readAncestors : function (_) {
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

  readChildren : function (_) {
    if(!this.node) { return CodeMirror.Pass; }
    else { say(this.node.describe(this.node.level)); }
  },

  collapseAll : function (_) {
    if(!this.node) { return CodeMirror.Pass; }
    this.dispatch({type: 'COLLAPSE_ALL'});
    this.activate(getRoot(this.node));
  },

  collapseOrSelectParent : function(_) {
    if(!this.node) { return CodeMirror.Pass; }
    if (this.expandable && !this.isCollapsed && !this.isLocked()) {
      this.collapse(this.props.node.id);
    } else if (this.props.node.parent) {
      this.activate(this.props.node.parent);
    } else {
      playSound(BEEP);
    }
  },

  collapseCurrentRoot : function (_) {
    if(!this.node) { return CodeMirror.Pass; }
    if(!this.node.parent && (this.isCollapsed || !this.expandable)) {
      playSound(BEEP);
    } else {
      let root = getRoot(this.node);
      let descendants = [...root.descendants()];
      descendants.forEach(d => this.collapse(d.id));
      this.activate(root);
    }
  },

  expandAll : function (_) {
    if(!this.node) { return CodeMirror.Pass; }
    else { return this.dispatch({type: 'UNCOLLAPSE_ALL'}); }
  },

  expandOrSelectFirstChild : function (_) {
    if(!this.node) { return CodeMirror.Pass; }
    const node = this.node;
    if (this.expandable && this.isCollapsed && !this.isLocked()) {
      this.uncollapse(node.id);
    } else if (node.next && node.next.parent === node) {
      this.activate(node.next);
    } else {
      playSound(BEEP);
    }
  },

  expandCurrentRoot : function (_) {
    if(!this.node) { return CodeMirror.Pass; }
    let root = getRoot(this.node);
    [...root.descendants()].forEach(d => this.uncollapse(d.id));
    this.activate(root);
  },

  toggleSelection : function (_, e) {
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
      const {from: addedFrom, to: addedTo} = node;
      const isContained = id => this.ast.isAncestor(node.id, id);
      const doesContain = id => this.ast.isAncestor(id, node.id);
      const [removed, newSelections] = partition(this.selections, isContained);
      for (const r of removed) {
        // TODO(Emmanuel): announce removal
      }
      if (newSelections.some(doesContain)) {
        // TODO(Emmanuel): announce failure
      } else {
        // announce addition
        newSelections.push(this.node.id);
        this.dispatch({
          type: 'SET_SELECTIONS',
          selections: newSelections
        });
      }
    }
  },

  edit : function (_, e) {
    if(!this.node) { return CodeMirror.Pass; }
    if (this.normallyEditable) {
      this.handleMakeEditable(e);
    } else if (this.expandable && !this.isLocked()) {
      (this.isCollapsed ? this.uncollapse : this.collapse)(this.node.id);
    } else {
      playSound(BEEP);
    }
  },

  editAnything : function (_, e) {
    if(!this.node) { return CodeMirror.Pass; }
    else { return this.handleMakeEditable(e); }
  },

  clearSelection : function (_) {
    if(!this.node) { return CodeMirror.Pass; }
    this.dispatch({type: 'SET_SELECTIONS', selections: []});
  },

  deleteNodes : function (_) {
    if(!this.node) { return CodeMirror.Pass; }
    if(!this.selections.length) { return say('Nothing selected'); }
    const nodesToDelete = this.selections.map(this.ast.getNodeById);
    sayActionForNodes(nodesToDelete, "deleted");
    delete_(nodesToDelete);
  },

  insertRight : function (_) {
    if(!this.node) { return CodeMirror.Pass; }
    if(!this.setRight()) { this.setCursor(this.node.to); }
  },

  insertLeft : function (_) {
    if(!this.node) { return CodeMirror.Pass; }
    if(!this.setLeft()) { this.setCursor(this.node.from); }
  },

  cut : function (_) {
    if(!this.node) { return CodeMirror.Pass; }
    if(!this.selections.length) { return say('Nothing selected'); }
    const nodesToCut = this.selections.map(this.ast.getNodeById);
    sayActionForNodes(nodesToCut, "cut");
    copy(nodesToCut);
    delete_(nodesToCut);
  },

  copy : function (_) {
    if(!this.node) { return CodeMirror.Pass; }
    // if no nodes are selected, do it on focused node's id instead
    const nodeIds = !this.selections.length? [this.node.id] : this.selections;
    const nodesToCopy = nodeIds.map(this.ast.getNodeById);
    sayActionForNodes(nodesToCopy, "copied");
    copy(nodesToCopy);
  },

  paste : function (_, e) {
    if(!this.node) { return CodeMirror.Pass; }
    const node = this.node;
    if (this.selections.includes(this.node.id)) {
      paste(new ReplaceNodeTarget(this.node));
    } else if (this.props.node.parent) {
      // We're inside the AST somewhere. Try to paste to the left/right.
      const pos = e.shiftKey ? node.srcRange().from : node.srcRange().to;
      const target = new InsertTarget(this.context.node, this.context.field, pos);
      if (target) { paste(target); }
      else { say(`Cannot paste ${(e.shiftKey ? "before" : "after")} this node.`); }
    } else {
      // We're at a root node. Insert to the left or right, at the top level.
      const pos = e.shiftKey ? node.srcRange().from : node.srcRange().to;
      paste(new OverwriteTarget(pos, pos));
    }
  },
  // TODO(Emmanuel): fix search
  activateSearchDialog : function (_) {
    SHARED.search.onSearch(
      this.state,
      () => { this.props.activate },
      () => this.activateNoRecord(SHARED.search.search(true, this.state))
    );
  },
  // TODO(Emmanuel): fix search
  searchPrevious : function (_) {
    this.activateNoRecord(SHARED.search.search(false, this.state));
  },
  // TODO(Emmanuel): fix search
  searchNext : function (_) {
    this.activateNoRecord(SHARED.search.search(true, this.state));
  },

  undo : function(cm, e) {
    preambleUndoRedo('undo');
    e.preventDefault();
    cm.undo();
  },

  redo : function(cm, e) {
    preambleUndoRedo('redo');
    e.preventDefault();
    cm.redo();
  },

  help : function (_) {
    this.showDialog(renderKeyMap(this.keyMap));
  }
};

export function keyDown(cm, e, env, keyMap) {
  env.props.dispatch((_, getState) => {
    // set up the environment
    const state = getState();
    const {ast, selections} = state;
    Object.assign(env, env.props, {ast, selections, state});
    // add convenience methods
    env.fastSkip = next => skipCollapsed(env.node, next, state);
    env.activate = (n, options={allowMove: true, record: true}) => {
      if (n === null) { playSound(BEEP); }
      env.props.activate((n === undefined)? env.node.id : n.id, options);
    };
    env.activateNoRecord = node => {
      if(!node){ playSound(BEEP); } // nothing to activate
      else { env.props.dispatch(activate(env.node.id, {record: false, allowMove: true})); }
    };
  });
  // if a key handler exists, stopPropagation and execute
  var handler = commandMap[keyMap[CodeMirror.keyName(e)]];
  if(handler) {
    e.stopPropagation();
    handler = handler.bind(env);
    return handler(cm, e);
  }
}

export function renderKeyMap(keyMap) {
  const reverseMap = {};
  Object.keys(keyMap).forEach(key => {
    if(!reverseMap[keyMap[key]]) { reverseMap[keyMap[key]] = key; }
    else reverseMap[keyMap[key]] = reverseMap[keyMap[key]] + " or " + key;
  });
  return (
    <>
      <h1>Blocks Shortcuts</h1>
      <span style={{display: 'block'}}>(Note: on MacOS, <kbd>Cmd</kbd> replaces <kbd>Ctrl</kbd>.)</span>
      <span className="screenreader">
        Screenreader users: Make sure to either increase the verbosity of your screenreader, or character over the shortcut column in the tables below. Some shortcuts use punctuation keys that may not always be spoken.
      </span>
      <div className="shortcutGroup" tabIndex="-1">
        <h2>Navigation</h2>
        <table className="shortcuts">
          <thead><tr><th>Command</th>     <th>Shortcut</th></tr></thead> 
          <tbody>         
          <tr><td>Previous Block</td>     <td><kbd>{reverseMap['prevNode']}</kbd></td></tr>
          <tr><td>Next Block</td>         <td><kbd>{reverseMap['nextNode']}</kbd></td></tr>
          <tr><td>Collapse Block</td>     <td><kbd>{reverseMap['collapseOrSelectParent']}</kbd></td></tr>
          <tr><td>Expand Block</td>       <td><kbd>{reverseMap['expandOrSelectFirstChild']}</kbd></td></tr>
          <tr><td>Collapse Root</td>      <td><kbd>{reverseMap['collapseCurrentRoot']}</kbd></td></tr>
          <tr><td>Expand Root</td>        <td><kbd>{reverseMap['expandCurrentRoot']}</kbd></td></tr>
          <tr><td>Collapse All</td>       <td><kbd>{reverseMap['collapseAll']}</kbd></td></tr>
          <tr><td>Expand All</td>         <td><kbd>{reverseMap['expandAll']}</kbd></td></tr>
          <tr><td>First Visible Block</td><td><kbd>{reverseMap['firstNode']}</kbd></td></tr>
          <tr><td>Last Visible Block</td> <td><kbd>{reverseMap['lastVisibleNode']}</kbd></td></tr>
          <tr><td>Read Ancestors</td>     <td><kbd>{reverseMap['readAncestors']}</kbd></td></tr>
          <tr><td>Read Block and Children</td><td><kbd>{reverseMap['readChildren']}</kbd></td></tr>
          </tbody>
        </table>
      </div>
      <div className="shortcutGroup" tabIndex="-1">
        <h2>Editing</h2>
        <table className="shortcuts">
          <thead><tr><th>Command</th>     <th>Shortcut</th></tr></thead>
          <tbody>
          <tr><td>Edit a Literal</td>     <td><kbd>{reverseMap['edit']}</kbd></td></tr>
          <tr><td>Edit any Block</td>     <td><kbd>{reverseMap['editAnything']}</kbd></td></tr>
          <tr><td>Cancel</td>             <td><kbd>{reverseMap['cancel']}</kbd></td></tr>
          <tr><td>Insert Before</td>      <td><kbd>{reverseMap['insertLeft']}</kbd></td></tr>
          <tr><td>Insert After</td>       <td><kbd>{reverseMap['insertRight']}</kbd></td></tr>
          </tbody>
        </table>
      </div>
      <div className="shortcutGroup" tabIndex="-1">
        <h2>Search</h2>
        <table className="shortcuts">
          <thead><tr><th>Command</th>     <th>Shortcut</th></tr></thead>
          <tbody>
          <tr><td>Enter Search Mode</td>  <td><kbd>{reverseMap['activateSearchDialog']}</kbd></td></tr>
          <tr><td>Exit Search Mode</td>   <td><kbd>{reverseMap['cancel']}</kbd></td></tr>
          <tr><td>Find Next</td>          <td><kbd>{reverseMap['searchNext']}</kbd></td></tr>
          <tr><td>Find Previous</td>      <td><kbd>{reverseMap['searchPrevious']}</kbd></td></tr>
          </tbody>
        </table>
      </div>
      <div className="shortcutGroup" tabIndex="-1">
        <h2>Selection and Clipboard</h2>
        <table className="shortcuts">
          <thead><tr><th>Command</th>     <th>Shortcut</th></tr></thead>
          <tbody>
          <tr><td>Toggle Selection</td>   <td><kbd>{reverseMap['toggleSelection']}</kbd></td></tr>
          <tr><td>Cut </td>               <td><kbd>{reverseMap['cut']}</kbd></td></tr>
          <tr><td>Copy</td>               <td><kbd>{reverseMap['copy']}</kbd></td></tr>
          <tr><td>Paste After Block</td>  <td><kbd>{reverseMap['paste']}</kbd></td></tr>
          <tr><td>Paste Before Block</td> <td><kbd>{reverseMap['pasteBefore']}</kbd></td></tr>
          <tr><td>Delete Selection</td>   <td><kbd>{reverseMap['delete']}</kbd></td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
