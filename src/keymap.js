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
}

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
}

const pcKeyMap = {
      'Ctrl-F'    : 'activateSearchDialog',
      'Ctrl-Z'    : 'undo',
      'Shift-Ctrl-Z':'redo',
      'Ctrl-C'    : 'copy',
      'Ctrl-V'    : 'paste',
      'Shift-Ctrl-V'    : 'pasteBefore',
      'Ctrl-X'    : 'cut',
      'Shift-Ctrl-/': 'help',
}

Object.assign(keyMap, mac? macKeyMap : pcKeyMap);