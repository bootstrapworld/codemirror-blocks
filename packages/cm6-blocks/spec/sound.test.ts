/** @jest-environment jsdom */
/* Eighth round, step 2: sounds. The player is injected, so a test says which sound was asked for which event. */
import * as fs from "fs";
import * as path from "path";
import { BEEP_URL, WRAP_URL } from "../src/sounds";
import { browserPlayer, SoundEvent, SoundName } from "../src/sound";
import { make, TEXT } from "./helpers";
import { walk } from "../src/doc";
import type { LezerBlockEditor } from "../src/lezer-view";
import type { BNode } from "../src/types";

const LANGS = ["scheme", "javascript", "python"];
const key = (el: Element, k: string, mods: Partial<KeyboardEventInit> = {}) =>
  el.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: k,
      bubbles: true,
      cancelable: true,
      ...mods,
    })
  );
const all = (ed: LezerBlockEditor): BNode[] => {
  const o: BNode[] = [];
  ed.roots().forEach((r) => walk(r, (n) => o.push(n)));
  return o.filter((n) => n.kind !== "error");
};
const text = (ed: LezerBlockEditor) => ed.view.state.doc.toString();
const lit = (ed: LezerBlockEditor, src: string): BNode =>
  all(ed).filter(
    (n) => n.kind === "literal" && text(ed).slice(n.from, n.to) === src
  )[0];
type Heard = [SoundName, SoundEvent];
function rig(l: string, src?: string, extra: object = {}) {
  const heard: Heard[] = [];
  const ed = make(l, src, {
    playSound: (s, e) => heard.push([s, e]),
    ...extra,
  });
  return { ed, heard };
}
const press = (
  ed: LezerBlockEditor,
  n: BNode,
  k: string,
  mods: Partial<KeyboardEventInit> = {}
) => {
  ed.focusNode(n);
  key(ed.renderer.element(n), k, mods);
};
const ptr = (el: Element | Document, type: string, x: number, y = 10) => {
  const e = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: x,
    clientY: y,
  });
  Object.defineProperty(e, "pointerType", { value: "mouse" });
  Object.defineProperty(e, "pointerId", { value: 1 });
  el.dispatchEvent(e);
};

test("the two sounds are the old editor's files, unchanged", () => {
  const old = path.join(__dirname, "../../codemirror-blocks/assets/sounds");
  const mine = path.join(__dirname, "../assets/sounds");
  const bytes = (url: string) =>
    Buffer.from(url.slice("data:audio/mpeg;base64,".length), "base64");
  expect(
    bytes(BEEP_URL).equals(fs.readFileSync(path.join(mine, "beep.mp3")))
  ).toBe(true);
  expect(
    bytes(WRAP_URL).equals(fs.readFileSync(path.join(mine, "wrap.mp3")))
  ).toBe(true);
  if (fs.existsSync(old))
    for (const f of ["beep.mp3", "wrap.mp3"])
      expect(
        fs
          .readFileSync(path.join(old, f))
          .equals(fs.readFileSync(path.join(mine, f)))
      ).toBe(true);
});

test("the default player is quiet where there is no audio (jsdom), and before the first user gesture", () => {
  expect(() => browserPlayer()("beep", "no-next")).not.toThrow();
  const real = (global as unknown as { Audio?: unknown }).Audio;
  let made = 0;
  (global as unknown as { Audio: unknown }).Audio = class {
    constructor() {
      made++;
    }
  };
  const ua = Object.getOwnPropertyDescriptor(window.navigator, "userAgent");
  Object.defineProperty(window.navigator, "userAgent", {
    value: "Mozilla/5.0 Chrome",
    configurable: true,
  });
  Object.defineProperty(window.navigator, "userActivation", {
    value: { hasBeenActive: false },
    configurable: true,
  });
  browserPlayer()("beep", "no-next");
  expect(made).toBe(0); // (no gesture yet: nothing is even made)
  Object.defineProperty(window.navigator, "userActivation", {
    value: { hasBeenActive: true },
    configurable: true,
  });
  // a rejected play() is swallowed
  (global as unknown as { Audio: unknown }).Audio = class {
    paused = true;
    readyState = 0;
    pause() {}
    play() {
      return Promise.reject(new Error("NotAllowedError"));
    }
  };
  expect(() => browserPlayer()("wrap", "wrapped")).not.toThrow();
  delete (window.navigator as unknown as Record<string, unknown>)
    .userActivation;
  if (ua) Object.defineProperty(window.navigator, "userAgent", ua);
  else
    delete (window.navigator as unknown as Record<string, unknown>).userAgent;
  (global as unknown as { Audio?: unknown }).Audio = real;
});

describe.each(LANGS)("sounds: %s", (l) => {
  const top = (ed: LezerBlockEditor) =>
    ed.roots().filter((r) => r.kind !== "error");

  test("nothing is asked for by plain editing, and sounds can be turned off", () => {
    const { ed, heard } = rig(l);
    ed.insertText(
      ed.roots().find((r) => r.kind === "program")?.slots[0] ??
        top(ed)[0].parent!.slots[0],
      0,
      "7"
    );
    expect(heard).toEqual([]);
    ed.setSounds(false);
    expect(ed.soundsOn()).toBe(false);
    press(ed, top(ed)[0], "ArrowUp");
    expect(heard).toEqual([]);
    ed.setSounds(true);
    press(ed, top(ed)[0], "ArrowUp");
    expect(heard).toEqual([["beep", "no-previous"]]);
  });

  test("the option `sounds: false` starts silent", () => {
    const { ed, heard } = rig(l, undefined, { sounds: false });
    press(ed, top(ed)[0], "ArrowUp");
    expect(heard).toEqual([]);
    expect(ed.soundsOn()).toBe(false);
  });

  test("Up on the first block, Down on the last: beeps; a move that works does not", () => {
    const { ed, heard } = rig(l);
    const first = top(ed)[0];
    press(ed, first, "ArrowDown");
    expect(heard).toEqual([]);
    press(ed, first, "ArrowUp");
    expect(heard).toEqual([["beep", "no-previous"]]);
    heard.length = 0;
    const last = all(ed)[all(ed).length - 1];
    press(ed, last, "ArrowDown");
    expect(heard).toEqual([["beep", "no-next"]]);
  });

  test("Left on a collapsed top-level block (nothing above it), Right on a leaf", () => {
    const { ed, heard } = rig(l);
    const root = top(ed)[0];
    ed.collapse(root, true);
    press(ed, root, "ArrowLeft");
    expect(heard).toEqual([["beep", "no-parent"]]);
    heard.length = 0;
    ed.collapse(root, false);
    press(ed, lit(ed, "4"), "ArrowRight");
    expect(heard).toEqual([["beep", "no-child"]]);
    heard.length = 0;
    press(ed, lit(ed, "4"), "ArrowLeft"); // (a child: goes to the parent, quietly)
    expect(heard).toEqual([]);
  });

  test("Shift-Alt-Left on a top-level block that is collapsed already beeps; the first time it collapses quietly", () => {
    const { ed, heard } = rig(l);
    const call = top(ed).find((r) => r.slots.length > 0)!;
    press(ed, call, "ArrowLeft", { shiftKey: true, altKey: true });
    expect(heard).toEqual([]);
    press(ed, call, "ArrowLeft", { shiftKey: true, altKey: true });
    expect(heard).toEqual([["beep", "collapse-root"]]);
  });

  test("\\ on a top-level block (no ancestors) beeps", () => {
    const { ed, heard } = rig(l);
    press(ed, top(ed)[0], "\\");
    expect(heard).toEqual([["beep", "no-ancestors"]]);
    heard.length = 0;
    press(ed, lit(ed, "2"), "\\");
    expect(heard).toEqual([]);
  });

  test("Space on a block inside a selected one is refused with a beep", () => {
    const { ed, heard } = rig(l);
    const first = top(ed)[0];
    ed.renderer.setSelected(first, true); // (only the block: selecting by Space selects what is inside it too, and then Space on a child unselects)
    press(ed, lit(ed, "2"), " ");
    expect(heard).toEqual([["beep", "select-refused"]]);
  });

  test("Delete with nothing selected beeps and deletes nothing", () => {
    const { ed, heard } = rig(l);
    const before = text(ed);
    press(ed, lit(ed, "4"), "Delete");
    expect(heard).toEqual([["beep", "delete-nothing"]]);
    expect(text(ed)).toBe(before);
  });

  test("a delete that leaves a hole (a block that has to be there) beeps; deleting out of a list does not", () => {
    const { ed, heard } = rig(
      l,
      l === "scheme"
        ? "(f 1 2)\n(if x 1 2)\n"
        : l === "javascript"
          ? "f(1, 2);\nif (x) { f(1); } else { f(2); }\n"
          : "f(1, 2)\nif x:\n    f(1)\nelse:\n    f(2)\n"
    );
    ed.removeNode(lit(ed, "2"));
    expect(heard).toEqual([]);
    const one = all(ed).find(
      (n) =>
        n.slot &&
        n.slot.kind === "one" &&
        n.slots.length === 0 &&
        n.parent &&
        n.parent.kind !== "program"
    )!;
    expect(one).toBeDefined();
    ed.removeNode(one);
    expect(heard).toEqual([["beep", "left-blank"]]);
  });

  test("a paste that cannot go there beeps (and says so): two blocks copied, pasted onto a hole", () => {
    const { ed, heard } = rig(
      l,
      l === "scheme"
        ? "(f 1 2)\n(if x 1 2)\n"
        : l === "javascript"
          ? "f(1, 2);\nif (x) { f(1); } else { f(2); }\n"
          : "f(1, 2)\nif x:\n    f(1)\nelse:\n    f(2)\n"
    );
    const one = all(ed).find(
      (n) =>
        n.slot &&
        n.slot.kind === "one" &&
        n.slots.length === 0 &&
        n.parent &&
        n.parent.kind !== "program"
    )!;
    ed.removeNode(one);
    const hole = all(ed).find((n) => ed.isBlank(n) && n.slots.length === 0)!;
    expect(hole).toBeDefined();
    const one1 = all(ed).filter(
      (n) => n.kind === "literal" && text(ed).slice(n.from, n.to) === "1"
    )[0];
    const two = all(ed).filter(
      (n) => n.kind === "literal" && text(ed).slice(n.from, n.to) === "2"
    )[0];
    ed.toggleSelect(one1);
    ed.toggleSelect(two);
    let clip = "";
    const copy = new Event("copy", {
      bubbles: true,
      cancelable: true,
    }) as Event & { clipboardData: unknown };
    copy.clipboardData = {
      getData: () => clip,
      setData: (_t: string, v: string) => (clip = v),
    };
    ed.renderer.element(one1).dispatchEvent(copy);
    expect(clip.split("\n").length).toBe(2);
    heard.length = 0;
    const paste = new Event("paste", {
      bubbles: true,
      cancelable: true,
    }) as Event & { clipboardData: unknown };
    paste.clipboardData = { getData: () => clip, setData: () => undefined };
    ed.renderer.element(hole).dispatchEvent(paste);
    expect(ed.said.some((s) => /Cannot paste after this node/.test(s))).toBe(
      true
    );
    expect(heard).toEqual([["beep", "paste-refused"]]);
  });

  test("Shift-Ctrl-] on a comment block beeps", () => {
    const { ed, heard } = rig(
      l,
      l === "scheme"
        ? "; hi\n(f 1)\n"
        : l === "javascript"
          ? "// hi\nf(1);\n"
          : "# hi\nf(1)\n"
    );
    const c = all(ed).find((n) => n.kind === "comment")!;
    expect(c).toBeDefined();
    press(ed, c, "}", { ctrlKey: true, shiftKey: true, code: "BracketRight" });
    expect(heard).toEqual([["beep", "comment-of-comment"]]);
  });

  test("a block let go over the editor where nothing takes it beeps; one let go outside does not", () => {
    const { ed, heard } = rig(l);
    const el = ed.renderer.element(lit(ed, "4"));
    const target = ed.renderer.element(lit(ed, "5"));
    const where = { el: target as Element | null };
    document.elementFromPoint = () => where.el;
    ptr(el, "pointerdown", 10);
    ptr(document, "pointermove", 40);
    ptr(document, "pointerup", 40);
    expect(heard).toEqual([["beep", "drop-nowhere"]]);
    heard.length = 0;
    where.el = document.body;
    ptr(el, "pointerdown", 10);
    ptr(document, "pointermove", 40);
    ptr(document, "pointerup", 40);
    expect(heard).toEqual([]);
  });

  test("a template let go over a hole or gap that refuses it beeps (a statement into an expression list); nowhere beeps too", () => {
    const { ed, heard } = rig(l);
    const args = all(ed)
      .find((n) => n.slots.some((s) => s.name === "args"))!
      .slots.find((s) => s.name === "args")!;
    const gap = ed.renderer
      .element(args.owner)
      .querySelector(
        `.blocks-args[data-slot="args"] > .blocks-gap[data-index="0"]`
      ) as HTMLElement;
    const where = { el: gap as Element };
    document.elementFromPoint = () => where.el;
    const down = () => {
      const e = new MouseEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        button: 0,
        clientX: 0,
        clientY: 0,
      });
      Object.defineProperty(e, "pointerId", { value: 1 });
      ed.beginTemplateDrag(e as PointerEvent, "if-else");
    };
    if (l === "scheme") return; // (every Scheme template is an expression: it goes anywhere a gap is)
    down();
    ptr(document, "pointermove", 40);
    ptr(document, "pointerup", 40);
    expect(heard).toEqual([["beep", "drop-refused"]]);
    heard.length = 0;
    where.el = ed.view.dom.querySelector(".cm-content") as Element;
    down();
    ptr(document, "pointermove", 40);
    ptr(document, "pointerup", 40);
    expect(heard).toEqual([["beep", "drop-nowhere"]]);
  });
});

// every event of sound.ts has a test above or in search.test.ts (no-match, wrapped)
test("TEXT is what these tests rely on", () => {
  expect(Object.keys(TEXT)).toEqual(LANGS);
});
