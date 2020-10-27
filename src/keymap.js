import React from 'react';

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
  'Ctrl-Enter': 'edit',
  'Space'     : 'toggleSelection',
  'Esc'       : 'cancel',
  'Ctrl-Esc'  : 'cancel',
  'Delete'    : 'delete',
  'Backspace' : 'delete',
  'Ctrl-['    : 'insertLeft',
  'Ctrl-]'    : 'insertRight',
  'Shift-,'   : 'jumpToRoot',
  '\\'        : 'readAncestors',
  'Shift-\\'  : 'readChildren',
  'PageUp'    : 'searchPrevious',
  'PageDown'  : 'searchNext',
  'F3'        : 'activateSearchDialog',
  'Tab'       : 'changeFocus',
};

const macKeyMap = {
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
  'Ctrl-F'    : 'activateSearchDialog',
  'Ctrl-Z'    : 'undo',
  'Shift-Ctrl-Z':'redo',
  'Ctrl-C'    : 'copy',
  'Ctrl-V'    : 'paste',
  'Shift-Ctrl-V'    : 'pasteBefore',
  'Ctrl-X'    : 'cut',
  'Shift-Ctrl-/': 'help',
};

Object.assign(keyMap, mac? macKeyMap : pcKeyMap);

export function renderKeyMap(keyMap) {
  const reverseMap = {};
  Object.keys(keyMap).forEach(key => {
    if(reverseMap[keyMap[key]]){
      reverseMap[keyMap[key]] = reverseMap[keyMap[key]] + " or " + key;
      console.log(reverseMap[keyMap[key]]);
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
