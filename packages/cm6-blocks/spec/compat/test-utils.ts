/*
 * Ninth round, step 2c: the old editor's `src/toolkit/test-utils.tsx` and `cmb-toolkit/simulate.ts` helpers, same names and signatures, over this editor.
 * Events are plain DOM events (no React). A press focuses what it presses, as a browser does (jsdom does not).
 */
import { fireEvent } from "@testing-library/dom";
import {
  checkLezerEditor,
  createLezerBlockEditor,
  LezerBlockEditor,
} from "../../src/lezer-view";
import { schemeParser, schemeTable } from "../../src/lang-scheme";
import { makeAPI, ASTNode, CompatAPI } from "./api";
import * as announcer from "./announcer";
import * as utils from "./utils";

export type API = CompatAPI;
export { ASTNode };

const userAgent = navigator.userAgent;
export const mac =
  /Mac/.test(navigator.platform) || /Mobile\/\w+/.test(userAgent);
export const cmd_ctrl = mac ? { metaKey: true } : { ctrlKey: true };
export const wait = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

let mounted: { cmb: API; store: object; ed: LezerBlockEditor } | undefined;
export const getMountedCMB = () => mounted;

/** the editor's own checker after every test that mounted one (the old setup checks its invariants the same way) */
afterEach(() => {
  if (!mounted) return;
  // (a box a test leaves open is not a fault of the editor: close it, as the old setup's invariants allowed an editing node)
  for (const box of Array.from(
    mounted.ed.view.dom.querySelectorAll(".blocks-edit")
  ))
    box.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      })
    );
  expect(checkLezerEditor(mounted.ed)).toEqual([]);
});

const fixture = `<div id="root"><div id="cm6-editor" class="editor-container"></div><div class="TrashCan" aria-hidden="true">🗑️</div></div>`;

/** the language argument is ignored: the Scheme table is what the old tests' WeScheme documents need */
export function mountCMB(
  _language?: unknown,
  _options: Record<string, unknown> = {}
) {
  document.body.insertAdjacentHTML("afterbegin", fixture);
  const container = document.getElementById("cm6-editor")!;
  const ed = createLezerBlockEditor(container, "", {
    parser: schemeParser as never,
    table: schemeTable,
    playSound: (sound: string) =>
      utils.playSound(sound === "wrap" ? utils.WRAP : utils.BEEP),
  } as never);
  const say = ed.say;
  ed.say = (text: string) => {
    say(text);
    announcer.say(text);
  };
  // (the old editor's input is the focused element after it mounts; tests send their first key to document.activeElement)
  ed.view.contentDOM.focus();
  const cmb = makeAPI(ed) as unknown as API;
  mounted = { cmb, store: {}, ed };
  return { cmb, store: mounted.store };
}
export function teardown() {
  clipboardSlot.text = "";
  clipboardSlot.pasteCount = 0;
  mounted?.ed.destroy();
  mounted = undefined;
  document.getElementById("root")?.remove();
}

type ElementLike = Node | Element | { element?: Element | Node | null };
function toElement(node: ElementLike): Element {
  if (node instanceof Element) return node;
  const e = (node as { element?: Element | Node | null }).element;
  if (e instanceof Element) return e;
  throw new Error("Cannot convert value into a DOM node: " + node);
}
const active = (): Element => {
  if (!document.activeElement) throw new Error("No element has focus");
  return document.activeElement;
};
/** what a press does in a browser: the pressed element, or its nearest focusable ancestor, takes focus */
const pressFocus = (el: Element) => {
  let t: Element | null = el;
  while (
    t &&
    !t.hasAttribute("tabindex") &&
    !t.matches("a[href], button, input, textarea, select")
  )
    t = t.parentElement;
  if (t instanceof HTMLElement) t.focus();
  else if (document.activeElement instanceof HTMLElement)
    document.activeElement.blur();
};

export function mouseDown(node: ElementLike) {
  const el = toElement(node);
  const pe = new MouseEvent("pointerdown", {
    bubbles: true,
    cancelable: true,
    button: 0,
  });
  Object.defineProperty(pe, "pointerType", { value: "mouse" });
  Object.defineProperty(pe, "pointerId", { value: 1 });
  el.dispatchEvent(pe);
  if (fireEvent.mouseDown(el)) pressFocus(el);
}
export function click(node: ElementLike) {
  fireEvent.click(toElement(node));
}
export function doubleClick(node: ElementLike) {
  fireEvent.dblClick(toElement(node));
}
export function blur(node: ElementLike = active()) {
  fireEvent.blur(toElement(node));
}
export function paste(text: string, node: ElementLike = active()) {
  fireEvent.paste(toElement(node), {
    clipboardData: {
      getData: (f: string) => (f === "text/plain" ? text : ""),
      types: ["text/plain"],
    },
  });
}
export function cut(node: ElementLike = active()) {
  fireEvent.cut(toElement(node));
}

const CODES: Record<string, number> = {
  Enter: 13,
  Tab: 9,
  " ": 32,
  ArrowLeft: 37,
  ArrowRight: 39,
  ArrowDown: 40,
  ArrowUp: 38,
  Home: 36,
  End: 35,
  PageUp: 33,
  PageDown: 34,
  Backspace: 8,
  Delete: 46,
  Escape: 27,
  F3: 114,
  "[": 219,
  "]": 221,
  "/": 191,
  "\\": 220,
  "<": 188,
};
function getKeyCode(key: string): number {
  if (/^[A-Za-z0-9]$/.test(key)) return key.charCodeAt(0);
  if (key in CODES) return CODES[key];
  throw new Error("Unknown key: " + key);
}
const codeOf = (key: string): string =>
  /^[a-zA-Z]$/.test(key)
    ? `Key${key.toUpperCase()}`
    : /^[0-9]$/.test(key)
      ? `Digit${key}`
      : key === " "
        ? "Space"
        : key === "["
          ? "BracketLeft"
          : key === "]"
            ? "BracketRight"
            : key;
/** the clipboard `installFakeClipboard` made, if any: what the browser's own copy, cut and paste events carry */
export const clipboardSlot: { text?: string; pasteCount?: number } = {
  text: "",
  pasteCount: 0,
};
export function keyDown(
  key: string,
  props: Record<string, unknown> = {},
  node: ElementLike = active()
) {
  const el = toElement(node);
  const code = getKeyCode(key);
  // (a browser reports a letter pressed with Ctrl or Cmd, and not Shift, in lower case; the old tests write `"Z"`, `"Y"`)
  const p0 = props as {
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
  };
  const sent =
    /^[A-Z]$/.test(key) && (p0.ctrlKey || p0.metaKey) && !p0.shiftKey
      ? key.toLowerCase()
      : key;
  const proceed = fireEvent.keyDown(el, {
    which: code,
    keyCode: code,
    key: sent,
    code: codeOf(key),
    ...props,
  });
  // the browser's default action for Ctrl/Cmd-C, X and V is a copy, cut or paste event (the old editor handled the keys itself; this one handles the events)
  const p = props as { ctrlKey?: boolean; metaKey?: boolean };
  const clip = clipboardSlot as { text: string; pasteCount: number };
  if (proceed && clip && (p.ctrlKey || p.metaKey) && /^[cxv]$/i.test(key)) {
    const k = key.toLowerCase();
    const data = {
      setData: (_t: string, v: string) => {
        clip.text = v;
      },
      getData: () => (k === "v" ? (clip.pasteCount++, clip.text) : ""),
      clearData: () => {},
      types: ["text/plain"],
    };
    const ev = new Event(k === "c" ? "copy" : k === "x" ? "cut" : "paste", {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(ev, "clipboardData", { value: data });
    el.dispatchEvent(ev);
  }
}
export function keyPress(
  key: string,
  props: Record<string, unknown> = {},
  node: ElementLike = active()
) {
  const code = getKeyCode(key);
  fireEvent.keyPress(toElement(node), {
    which: code,
    keyCode: code,
    key,
    ...props,
  });
}
export function insertText(text: string) {
  const el = active();
  const tag = el.tagName.toLowerCase();
  if (tag === "textarea" || tag === "input") {
    // typing replaces the selected part of the edit box (it opens with its text selected)
    const box = el as HTMLInputElement;
    const from = box.selectionStart ?? box.value.length;
    const to = box.selectionEnd ?? box.value.length;
    fireEvent.input(box, {
      target: { value: box.value.slice(0, from) + text + box.value.slice(to) },
    });
    box.setSelectionRange(from + text.length, from + text.length);
  } else fireEvent.input(el, { target: { innerHTML: el.innerHTML + text } });
}
export const elementForNode = (node: ASTNode) => node.element;
/** (the old editor edits in a contenteditable; this one in an `input.blocks-edit` placed in the block) */
export const isNodeEditable = (node: ASTNode): boolean =>
  !!node.element?.querySelector("input.blocks-edit, textarea.blocks-edit") ||
  node.element?.classList.contains("blocks-editing") === true;
