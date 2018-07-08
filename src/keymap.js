export let keyMap = {
  "Up":       "findPrevVisibleNode",
  "Down":     "findNextVisibleNode",
  "Left":     "collapseOrFindParent",
  "Right":    "expandOrFindFirstChild",
  "Shift-Left": "collapseAll",
  "Shift-Right": "expandAll",
  "Home":     "activateFirstVisibleNode",
  "End":      "activateLastVisibleNode",
  "Space":    "toggleSelection",
  "Enter":    "editOrToggleExpanded",
  "\\":       "speakChildren",
  "Shift-\\": "speakParents",
  "Ctrl-[":   "insertToLeft",
  "Ctrl-]":   "insertToRight",
  "Delete":   "deleteSelectedNodes",
  "Backspace":"deleteSelectedNodes",
  "Ctrl-Delete":"deleteSelectedNodes",
  "Ctrl-Backspace":"deleteSelectedNodes",
};

const ISMAC   = navigator.platform.match(/(Mac|iPhone|iPod|iPad)/i);

if(ISMAC) {
  keyMap["Alt-Space"] = "toggleSelectionAndPreserveSelection";
  keyMap["Alt-Down"]  = "findNextVisibleNodeAndPreserveSelection";
  keyMap["Alt-Up"]    = "findPrevVisibleNodeAndPreserveSelection";
  keyMap["Cmd-Enter"] = "editNode";
  keyMap["Cmd-Z"]     = "undo";
  keyMap["Shift-Cmd-Z"]="redo";
} else {
  keyMap["Ctrl-Space"] = "toggleSelectionAndPreserveSelection";
  keyMap["Ctrl-Down"]  = "findNextVisibleNodeAndPreserveSelection";
  keyMap["Ctrl-Up"]    = "findPrevVisibleNodeAndPreserveSelection";
  keyMap["Ctrl-Enter"] = "editNode";
  keyMap["Ctrl-Z"]     = "undo";
  keyMap["Ctrl-Y"]     = "redo";
}