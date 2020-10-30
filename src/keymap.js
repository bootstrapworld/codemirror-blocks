import React from 'react';
import {playSound, BEEP} from './sound';
import SHARED from './shared';
import {delete_, copy, paste, InsertTarget,
        ReplaceNodeTarget, OverwriteTarget} from './actions';
import {partition, getRoot, sayActionForNodes, 
        say, getLastVisibleNode} from './utils';

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
  prevNode : function (cm) {
    if(this) {
      this.activate(this.fastSkip(node => node.prev));
    } else {
      const prevNode = this.getAst().getNodeBeforeCur(this.props.cur);
      if (prevNode) {
        this.activate(prevNode.id, {allowMove: true});
      } else {
        playSound(BEEP);
      }
    }
  },

  nextNode : function (cm) {
    if(this) {
      this.activate(this.fastSkip(node => node.next));
    } else {
      const nextNode = this.getAst().getNodeAfterCur(this.props.cur);
      if (nextNode) {
        this.activate(nextNode.id, {allowMove: true});
      } else {
        playSound(BEEP);
      }
    }
  },

  firstNode : function (cm) {
    if(this) {
      this.activate(this.ast.getFirstRootNode(), {allowMove: true});
    } else {
      return CodeMirror.Pass;
    }
  },

  lastVisibleNode : function (cm) {
    if(this) {
      this.activate(getLastVisibleNode(this.state));
    } else {
      const idx = SHARED.cm.lastLine(), text = SHARED.cm.getLine(idx);
      this.props.setCursor(null, {line: idx, ch: text.length});
    }
  },

  jumpToRoot : function (cm) {
    if(!this) { return CodeMirror.Pass; }
    this.activate(getRoot(this.node));
  },

  readAncestors : function (cm) {
    if(!this) { return CodeMirror.Pass; }
    const parents = [this.node.options['aria-label']];
    let next = this.node.parent;
    while (next) {
      parents.push(next.options['aria-label'] + ", at level " + next.level);
      next = next.parent;
    }
    if (parents.length > 1) say(parents.join(", inside "));
    else playSound(BEEP);
  },

  readChildren : function (cm) {
    if(!this) { return CodeMirror.Pass; }
    say(this.node.describe(this.node.level));
  },

  collapseAll : function (cm) {
    if(!this) { return CodeMirror.Pass; }
    this.props.dispatch({type: 'COLLAPSE_ALL'});
    this.activate(getRoot(this.node));
  },

  collapseOrSelectParent : function(cm) {
    if(!this) { return CodeMirror.Pass; }
    if (this.props.expandable && !this.props.isCollapsed && !this.isLocked()) {
      this.props.collapse(this.props.node.id);
    } else if (this.props.node.parent) {
      this.activate(this.props.node.parent);
    } else {
      playSound(BEEP);
    }
  },

  collapseCurrentRoot : function (cm) {
    if(!this) { return CodeMirror.Pass; }
    if(!this.node.parent && (this.props.isCollapsed || !this.props.expandable)) {
      playSound(BEEP);
    } else {
      let root = getRoot(this.node);
      let descendants = [...root.descendants()];
      descendants.forEach(d => this.props.collapse(d.id));
      this.activate(root);
    }
  },

  expandAll : function (cm) {
    if(!this) { return CodeMirror.Pass; }
    this.props.dispatch({type: 'UNCOLLAPSE_ALL'});
  },

  expandOrSelectFirstChild : function (cm) {
    if(!this) { return CodeMirror.Pass; }
    const node = this.node;
    if (this.props.expandable && this.props.isCollapsed && !this.isLocked()) {
      this.props.uncollapse(node.id);
    } else if (node.next && node.next.parent === node) {
      activate(node.next);
    } else {
      playSound(BEEP);
    }
  },

  expandCurrentRoot : function (cm) {
    if(!this) { return CodeMirror.Pass; }
    let root = getRoot(this.node);
    let descendants = [...root.descendants()];
    descendants.forEach(d => this.props.uncollapse(d.id));
    this.activate(root);
  },

  toggleSelection : function (cm) {
    if(!this) { return CodeMirror.Pass; }
    const node = this.node;
    if (this.selections.includes(this.node.id)) {
      this.props.dispatch({
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
        this.props.dispatch({
          type: 'SET_SELECTIONS',
          selections: newSelections
        });
      }
    }
  },

  edit : function (cm, e) {
    if(!this) { return CodeMirror.Pass; }
    if (this.props.normallyEditable) {
      this.handleMakeEditable(e);
    } else if (this.props.expandable && !this.isLocked()) {
      (this.props.isCollapsed ? this.props.uncollapse : this.props.collapse)(this.node.id);
    } else {
      playSound(BEEP);
    }
  },

  editAnything : function (cm, e) {
    if(!this) { return CodeMirror.Pass; }
    this.handleMakeEditable(e);
  },

  clearSelection : function (cm) {
    if(!this) { return CodeMirror.Pass; }
    this.props.dispatch({type: 'SET_SELECTIONS', selections: []});
  },

  deleteNodes : function (cm) {
    if(!this) { return CodeMirror.Pass; }
    if (this.selections.length === 0) {
      say('Nothing selected');
      return;
    }
    const nodesToDelete = this.selections.map(this.ast.getNodeById);
    sayActionForNodes(nodesToDelete, "deleted");
    delete_(nodesToDelete);
  },

  insertRight : function (cm) {
    if(!this) { return CodeMirror.Pass; }
    if (!this.setRight()) {
      this.props.setCursor(this.node.to);
    }
  },

  insertLeft : function (cm) {
    if(!this) { return CodeMirror.Pass; }
    if (!this.setLeft()) {
      this.props.setCursor(this.node.from);
    }
  },

  copy : function (cm) {
    if(!this) { return CodeMirror.Pass; }
    // if no nodes are selected, do it on focused node's id instead
    const nodeIds = this.selections.length == 0 ? [this.node.id] : this.selections;
    const nodesToCopy = nodeIds.map(this.ast.getNodeById);
    sayActionForNodes(nodesToCopy, "copied");
    copy(nodesToCopy);
  },

  paste : function (cm, e) {
    if(!this) { return CodeMirror.Pass; }
    const node = this.node;
    if (this.selections.includes(this.node.id)) {
      paste(new ReplaceNodeTarget(this.node));
    } else if (this.props.node.parent) {
      // We're inside the AST somewhere. Try to paste to the left/right.
      const pos = e.shiftKey ? node.srcRange().from : node.srcRange().to;
      const target = new InsertTarget(this.context.node, this.context.field, pos);
      if (target) {
        paste(target);
      } else {
        let direction = e.shiftKey ? "before" : "after";
        say(`Cannot paste ${direction} this node.`);
      }
    } else {
      // We're at a root node. Insert to the left or right, at the top level.
      const pos = e.shiftKey ? node.srcRange().from : node.srcRange().to;
      paste(new OverwriteTarget(pos, pos));
    }
  },

  cut : function (cm) {
    if(!this) { return CodeMirror.Pass; }
    if (this.selections.length === 0) {
      say('Nothing selected');
      return;
    }
    const nodesToCut = this.selections.map(this.ast.getNodeById);
    sayActionForNodes(nodesToCut, "cut");
    copy(nodesToCut);
    delete_(nodesToCut);
  },
  // TODO(Emmanuel): fix search
  activateSearchDialog : function (cm) {
    SHARED.search.onSearch(
      this.state,
      () => { this.props.activate },
      () => this.activateNoRecord(SHARED.search.search(true, this.state))
    );
  },
  // TODO(Emmanuel): fix search
  searchPrevious : function (cm) {
    this.activateNoRecord(SHARED.search.search(false, this.state));
  },
  // TODO(Emmanuel): fix search
  searchNext : function (cm) {
    console.log('searchNext', 'THIS is', this);
    this.activateNoRecord(SHARED.search.search(true, this.state));
  },

  help : function (cm) {
    this.showDialog(renderKeyMap(this.keyMap));
  }
}

export function renderKeyMap(keyMap) {
  const reverseMap = {};
  Object.keys(keyMap).forEach(key => {
    if(reverseMap[keyMap[key]]){
      reverseMap[keyMap[key]] = reverseMap[keyMap[key]] + " or " + key;
    } else {
      reverseMap[keyMap[key]] = key;
    }
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
          <thead><tr><th>Command</th><th>Shortcut</th></tr></thead> 
          <tbody>         
          <tr><td>Previous Block</td><td><kbd>{reverseMap['prevNode']}</kbd></td></tr>
          <tr><td>Next Block</td><td><kbd>{reverseMap['nextNode']}</kbd></td></tr>
          <tr><td>Collapse Block</td><td><kbd>{reverseMap['collapseOrSelectParent']}</kbd></td></tr>
          <tr><td>Expand Block</td><td><kbd>{reverseMap['expandOrSelectFirstChild']}</kbd></td></tr>
          <tr><td>Collapse Root</td><td><kbd>{reverseMap['collapseCurrentRoot']}</kbd></td></tr>
          <tr><td>Expand Root</td><td><kbd>{reverseMap['expandCurrentRoot']}</kbd></td></tr>
          <tr><td>Collapse All</td><td><kbd>{reverseMap['collapseAll']}</kbd></td></tr>
          <tr><td>Expand All</td><td><kbd>{reverseMap['expandAll']}</kbd></td></tr>
          <tr><td>First Visible Block</td><td><kbd>{reverseMap['firstNode']}</kbd></td></tr>
          <tr><td>Last Visible Block</td><td><kbd>{reverseMap['lastVisibleNode']}</kbd></td></tr>
          <tr><td>Read Ancestors</td><td><kbd aria-label="backslash">{reverseMap['readAncestors']}</kbd></td></tr>
          <tr><td>Read Block and Children</td><td><kbd aria-label="shift-backslash">{reverseMap['readChildren']}</kbd></td></tr>
          </tbody>
        </table>
      </div>
      <div className="shortcutGroup" tabIndex="-1">
        <h2>Editing</h2>
        <table className="shortcuts">
          <thead><tr><th>Command</th><th>Shortcut</th></tr></thead>
          <tbody>
          <tr><td>Edit a Literal</td><td><kbd>{reverseMap['edit']}</kbd></td></tr>
          <tr><td>Edit any Block</td><td><kbd>{reverseMap['edit']}</kbd></td></tr>
          <tr><td>Cancel</td><td><kbd>{reverseMap['cancel']}</kbd></td></tr>
          <tr><td>Insert Before</td><td><kbd>{reverseMap['insertLeft']}</kbd></td></tr>
          <tr><td>Insert After</td><td><kbd>{reverseMap['insertRight']}</kbd></td></tr>
          <tr><td>Delete Selected Blocks</td><td><kbd>{reverseMap['delete']}</kbd></td></tr>
          </tbody>
        </table>
      </div>
      <div className="shortcutGroup" tabIndex="-1">
        <h2>Search</h2>
        <table className="shortcuts">
          <thead><tr><th>Command</th><th>Shortcut</th></tr></thead>
          <tbody>
          <tr><td>Enter Search Mode</td><td><kbd>{reverseMap['activateSearchDialog']}</kbd></td></tr>
          <tr><td>Exit Search Mode</td><td><kbd>ESC</kbd> or <kbd>Shift-ESC</kbd></td></tr>
          <tr><td>Find next</td><td><kbd>{reverseMap['searchNext']}</kbd></td></tr>
          <tr><td>Find previous</td><td><kbd>{reverseMap['searchPrevious']}</kbd></td></tr>
          </tbody>
        </table>
      </div>
      <div className="shortcutGroup" tabIndex="-1">
        <h2>Selection and Clipboard</h2>
        <table className="shortcuts">
          <thead><tr><th>Command</th><th>Shortcut</th></tr></thead>
          <tbody>
          <tr><td>Toggle selection</td><td><kbd>{reverseMap['toggleSelection']}</kbd></td></tr>
          <tr><td>Cut </td><td><kbd>{reverseMap['cut']}</kbd></td></tr>
          <tr><td>Copy</td><td><kbd>{reverseMap['copy']}</kbd></td></tr>
          <tr><td>Paste after active node</td><td><kbd>{reverseMap['paste']}</kbd></td></tr>
          <tr><td>Paste before active node</td><td><kbd>{reverseMap['pasteBefore']}</kbd></td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
