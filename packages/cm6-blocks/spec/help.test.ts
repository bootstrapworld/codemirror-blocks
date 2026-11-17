/** @jest-environment jsdom */
/* Seventh round, step 3: the help dialog is made from the key table; every command of the table has a handler (the type says so) and a key that means it. */
import { commandOf, KEYS, writeKey } from "../src/keys";
import { make } from "./helpers";
import { walk } from "../src/doc";
import type { BNode } from "../src/types";

const LANGS = ["scheme", "javascript", "python"];
const key = (el: Element, k: string, mods: Partial<KeyboardEventInit> = {}) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...mods }));

test("every command in the table that can be pressed is found by commandOf from the first key written for it", () => {
  const events: Record<string, Partial<KeyboardEventInit>> = {
    Escape: { key: "Escape" }, "Alt-Q": { key: "q", altKey: true, code: "KeyQ" }, "Shift-Ctrl-]": { key: "}", ctrlKey: true, shiftKey: true, code: "BracketRight" },
    "Shift-Ctrl-/": { key: "?", ctrlKey: true, shiftKey: true, code: "Slash" }, "Shift-Tab": { key: "Tab", shiftKey: true }, "Shift-Alt-Left": { key: "ArrowLeft", shiftKey: true, altKey: true },
    "Shift-Alt-Right": { key: "ArrowRight", shiftKey: true, altKey: true }, "Shift-Left": { key: "ArrowLeft", shiftKey: true }, "Shift-Right": { key: "ArrowRight", shiftKey: true },
    "Mod-Enter": { key: "Enter", ctrlKey: true }, "Mod-Z": { key: "z", ctrlKey: true }, "Shift-Mod-Z": { key: "Z", ctrlKey: true, shiftKey: true }, "Mod-Y": { key: "y", ctrlKey: true },
    "Shift-Mod-V": { key: "V", ctrlKey: true, shiftKey: true }, "Mod-V": { key: "v", ctrlKey: true }, "Ctrl-[": { key: "[", ctrlKey: true }, "Ctrl-]": { key: "]", ctrlKey: true },
    "Shift-,": { key: "<", shiftKey: true }, "Shift-\\": { key: "|", shiftKey: true }, Space: { key: " " }, "\\": { key: "\\" }, Home: { key: "Home" }, End: { key: "End" },
    Down: { key: "ArrowDown" }, Up: { key: "ArrowUp" }, Right: { key: "ArrowRight" }, Left: { key: "ArrowLeft" }, Delete: { key: "Delete" }, Backspace: { key: "Backspace" },
    Enter: { key: "Enter" }, "any character": { key: "x" },
    F3: { key: "F3" }, "Mod-F": { key: "f", ctrlKey: true }, PageDown: { key: "PageDown" }, PageUp: { key: "PageUp" }, "Ctrl-F3": { key: "F3", ctrlKey: true }, "Shift-Ctrl-F3": { key: "F3", ctrlKey: true, shiftKey: true },
  };
  for (const k of KEYS) {
    if (k.command === "copy" || k.command === "cut") continue; // (the browser's own events)
    for (const w of k.keys) {
      expect(events[w]).toBeDefined();
      expect(commandOf(new KeyboardEvent("keydown", events[w]), false)).toBe(k.command);
    }
  }
  expect(writeKey("Shift-Mod-Z", true)).toBe("Shift-Cmd-Z");
  expect(writeKey("Mod-Enter", false)).toBe("Ctrl-Enter");
});

describe.each(LANGS)("help dialog: %s", (l) => {
  test("Shift-Ctrl-/ opens a dialog listing every key of the table; Escape closes it and the focus goes back", () => {
    const ed = make(l);
    let f: BNode | null = null;
    ed.roots().forEach((r) => walk(r, (n) => !f && n.slots.length === 0 && (f = n)));
    ed.focusNode(f!);
    const el = ed.renderer.element(f!);
    key(el, "?", { ctrlKey: true, shiftKey: true, code: "Slash" });
    const dlg = document.querySelector(".blocks-help") as HTMLElement;
    expect(dlg).not.toBeNull();
    expect(dlg.getAttribute("role")).toBe("dialog");
    const rows = Array.from(dlg.querySelectorAll("tr"));
    expect(rows.length).toBe(KEYS.length);
    for (const k of KEYS) expect(dlg.textContent).toContain(k.description);
    expect(dlg.textContent).toContain("Ctrl-Enter"); // (jsdom's platform is not a Mac)
    key(dlg, "Escape");
    expect(document.querySelector(".blocks-help")).toBeNull();
    expect(ed.focusedNode()).toBe(f);
  });
});
