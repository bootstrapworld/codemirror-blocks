import { ISMAC } from './keycode';

export let keyMap = {
  "Up":         "findPrevVisibleNode",
  "Shift-Tab":  "findPrevVisibleNode",
  "Down":       "findNextVisibleNode",
  "Tab":        "findNextVisibleNode",
  "Left":       "collapseOrFindParent",
  "Right":      "expandOrFindFirstChild",
  "Home":       "activateFirstVisibleNode",
  "End":        "activateLastVisibleNode",
  "Space":      "toggleSelection",
  "Enter":      "editOrToggleExpanded",
  "\\":         "speakChildren",
  "Shift-\\":   "speakParents",
  "Ctrl-[":     "insertToLeft",
  "Ctrl-]":     "insertToRight",
  "Shift-Left": "collapseAll",
  "Shift-Right":"expandAll",
  "Delete":     "deleteSelectedNodes",
  "Backspace":  "deleteSelectedNodes",
  "Ctrl-Delete":"deleteSelectedNodes",
  "Ctrl-Backspace":"deleteSelectedNodes",
  "Shift-,":     "activateRoot",
  "Shift-9":     "insertEmptyExpression"
};

if(ISMAC) {
  keyMap["Alt-Space"] = "toggleSelectionAndPreserveSelection";
  keyMap["Alt-Down"]  = "findNextVisibleNodeAndPreserveSelection";
  keyMap["Alt-Up"]    = "findPrevVisibleNodeAndPreserveSelection";
  keyMap["Cmd-Enter"] = "editNode";
  keyMap["Cmd-Z"]     = "undo";
  keyMap["Shift-Cmd-Z"]="redo";
  keyMap["Cmd-V"]     = "paste";
  keyMap["Shift-Cmd-V"]="paste";
} else {
  keyMap["Ctrl-Space"] = "toggleSelectionAndPreserveSelection";
  keyMap["Ctrl-Down"]  = "findNextVisibleNodeAndPreserveSelection";
  keyMap["Ctrl-Up"]    = "findPrevVisibleNodeAndPreserveSelection";
  keyMap["Ctrl-Enter"] = "editNode";
  keyMap["Ctrl-Z"]     = "undo";
  keyMap["Ctrl-Y"]     = "redo";
  keyMap["Ctrl-V"]     = "paste";
  keyMap["Shift-Ctrl-V"]="paste";
}
