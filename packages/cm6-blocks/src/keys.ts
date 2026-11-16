/*
 * EXPERIMENT. The keys of the editor, as DATA: one table says which key is which command, what it is called, and how it is
 * written for a person. `interact.ts` finds the command of a key press here and has one handler for each command (its type is
 * `Record<Command, ...>`, so a command without a handler does not compile), and the help dialog is made from the same table:
 * neither can fall behind the other.
 */

export type Command =
  | "clearSelection" | "editComment" | "help" | "focusToolbar"
  | "collapseAll" | "expandAll" | "collapseRoot" | "expandRoot"
  | "editAll" | "undo" | "redo" | "paste" | "pasteBefore" | "insertBefore" | "insertAfter"
  | "jumpToRoot" | "readChildren"
  | "toggleSelection" | "readAncestors" | "first" | "last" | "next" | "previous" | "expandOrChild" | "collapseOrParent"
  | "delete" | "enter" | "typeIntoHole"
  | "copy" | "cut";

export interface KeySpec {
  command: Command;
  /** what the help says it does */
  description: string;
  /** how it is written, `Mod` being Cmd on a Mac and Ctrl elsewhere */
  keys: string[];
  /** does this key press mean the command? (the first entry of the table that says yes wins) */
  test(e: KeyboardEvent, mac: boolean): boolean;
}

const mod = (e: KeyboardEvent): boolean => e.ctrlKey || e.metaKey;
/** no Ctrl, Cmd, Alt or Shift */
const plain = (e: KeyboardEvent): boolean => !mod(e) && !e.altKey && !e.shiftKey;
/** Cmd or Ctrl (the platform's), no Alt */
const pmod = (e: KeyboardEvent): boolean => mod(e) && !e.altKey;

export const KEYS: KeySpec[] = [
  { command: "clearSelection", description: "Clear the selection", keys: ["Escape", "Alt-Q"], test: (e) => e.key === "Escape" || (e.altKey && !mod(e) && e.code === "KeyQ") },
  { command: "editComment", description: "Edit the comment of the block", keys: ["Shift-Ctrl-]"], test: (e) => e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && (e.code === "BracketRight" || e.key === "}" || e.key === "]") },
  { command: "help", description: "Show this list of keys", keys: ["Shift-Ctrl-/"], test: (e) => e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && (e.code === "Slash" || e.key === "?" || e.key === "/") },
  { command: "focusToolbar", description: "Move the focus to the toolbar (Tab there comes back)", keys: ["Shift-Tab"], test: (e) => e.key === "Tab" && e.shiftKey && !mod(e) && !e.altKey },
  { command: "collapseRoot", description: "Collapse the current top-level block and what is in it", keys: ["Shift-Alt-Left"], test: (e) => !mod(e) && e.shiftKey && e.altKey && e.key === "ArrowLeft" },
  { command: "expandRoot", description: "Expand the current top-level block and what is in it", keys: ["Shift-Alt-Right"], test: (e) => !mod(e) && e.shiftKey && e.altKey && e.key === "ArrowRight" },
  { command: "collapseAll", description: "Collapse all blocks", keys: ["Shift-Left"], test: (e) => !mod(e) && e.shiftKey && !e.altKey && e.key === "ArrowLeft" },
  { command: "expandAll", description: "Expand all blocks", keys: ["Shift-Right"], test: (e) => !mod(e) && e.shiftKey && !e.altKey && e.key === "ArrowRight" },
  { command: "editAll", description: "Edit the whole block as text (Enter saves, Shift-Enter is a new line)", keys: ["Mod-Enter"], test: (e, mac) => pmod(e) && e.key === "Enter" && (mac ? e.metaKey && !e.ctrlKey : e.ctrlKey) },
  { command: "undo", description: "Undo", keys: ["Mod-Z"], test: (e) => pmod(e) && !e.shiftKey && (e.key === "z" || e.key === "Z") },
  { command: "redo", description: "Redo", keys: ["Shift-Mod-Z", "Mod-Y"], test: (e) => pmod(e) && ((e.shiftKey && (e.key === "z" || e.key === "Z")) || e.key === "y") },
  { command: "pasteBefore", description: "Paste before the block", keys: ["Shift-Mod-V"], test: (e) => pmod(e) && e.shiftKey && (e.key === "v" || e.key === "V") },
  { command: "paste", description: "Paste after the block (over a hole)", keys: ["Mod-V"], test: (e) => pmod(e) && !e.shiftKey && (e.key === "v" || e.key === "V") },
  { command: "copy", description: "Copy the selected blocks, or the block (with its comment)", keys: ["Mod-C"], test: () => false },
  { command: "cut", description: "Cut the selected blocks, or the block (with its comment)", keys: ["Mod-X"], test: () => false },
  { command: "insertBefore", description: "Insert a new block before", keys: ["Ctrl-["], test: (e) => pmod(e) && e.key === "[" },
  { command: "insertAfter", description: "Insert a new block after", keys: ["Ctrl-]"], test: (e) => pmod(e) && e.key === "]" },
  { command: "jumpToRoot", description: "Jump to the top-level block", keys: ["Shift-,"], test: (e) => !mod(e) && !e.altKey && e.shiftKey && (e.key === "<" || e.key === ",") },
  { command: "readChildren", description: "Read the children", keys: ["Shift-\\"], test: (e) => !mod(e) && !e.altKey && e.shiftKey && (e.key === "|" || e.key === "\\") },
  { command: "toggleSelection", description: "Select or unselect the block", keys: ["Space"], test: (e) => plain(e) && e.key === " " },
  { command: "readAncestors", description: "Read the ancestors", keys: ["\\"], test: (e) => plain(e) && e.key === "\\" },
  { command: "first", description: "First block", keys: ["Home"], test: (e) => plain(e) && e.key === "Home" },
  { command: "last", description: "Last visible block", keys: ["End"], test: (e) => plain(e) && e.key === "End" },
  { command: "next", description: "Next block", keys: ["Down"], test: (e) => plain(e) && e.key === "ArrowDown" },
  { command: "previous", description: "Previous block", keys: ["Up"], test: (e) => plain(e) && e.key === "ArrowUp" },
  { command: "expandOrChild", description: "Expand, or go to the first child", keys: ["Right"], test: (e) => plain(e) && e.key === "ArrowRight" },
  { command: "collapseOrParent", description: "Collapse, or go to the parent", keys: ["Left"], test: (e) => plain(e) && e.key === "ArrowLeft" },
  { command: "delete", description: "Delete the selected blocks (nothing is deleted when none is selected)", keys: ["Delete", "Backspace"], test: (e) => plain(e) && (e.key === "Delete" || e.key === "Backspace") },
  { command: "enter", description: "Edit a literal; collapse or expand another block", keys: ["Enter"], test: (e) => plain(e) && e.key === "Enter" },
  { command: "typeIntoHole", description: "On a hole: type to fill it", keys: ["any character"], test: (e) => !mod(e) && !e.altKey && e.key.length === 1 },
];

/** the command a key press means, or null */
export function commandOf(e: KeyboardEvent, mac: boolean): Command | null {
  for (const k of KEYS) if (k.test(e, mac)) return k.command;
  return null;
}

/** how a key is written for this platform: `Mod` is Cmd on a Mac, Ctrl elsewhere */
export function writeKey(key: string, mac: boolean): string {
  return key.replace(/\bMod\b/g, mac ? "Cmd" : "Ctrl");
}
