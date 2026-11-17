/** @jest-environment jsdom */
/* Eighth round, step 3: the activity log and replay. */
import {
  checkLezerEditor,
  createLezerBlockEditor,
  LezerBlockEditor,
} from "../src/lezer-view";
import { replay, applyChanges } from "../src/activity";
import { LANGS, mulberry32, randomStep } from "./steps";
import { make, OPTS, TEXT } from "./helpers";
import { walk } from "../src/doc";
import type { BNode } from "../src/types";

const NAMES = ["scheme", "javascript", "python"];
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
const ser = (n: BNode): string =>
  `${n.kind}[${n.from},${n.to}]${n.value ?? ""}(${n.slots.map((s) => s.name + ":" + s.nodes.map(ser).join(",")).join(";")})`;
const tree = (ed: LezerBlockEditor): string => ed.roots().map(ser).join("\n");
const actions = (ed: LezerBlockEditor) => ed.activityLog().map((e) => e.action);
const ptr = (
  el: Element | Document,
  type: string,
  x: number,
  y = 10,
  pointerType = "mouse"
) => {
  const e = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: x,
    clientY: y,
  });
  Object.defineProperty(e, "pointerType", { value: pointerType });
  Object.defineProperty(e, "pointerId", { value: 1 });
  el.dispatchEvent(e);
};

test("applyChanges: changes in the offsets of the text before them", () => {
  expect(
    applyChanges("abcdef", [
      { from: 4, to: 5, insert: "X" },
      { from: 1, to: 2, insert: "YY" },
    ])
  ).toBe("aYYcdXf");
});

describe.each(NAMES)("activity log: %s", (l) => {
  test("a key through the key table: the action's name, what it acted on, the key; a time and a number", () => {
    const ed = make(l);
    expect(ed.activityLog()).toEqual([]);
    const first = ed.roots().find((r) => r.kind !== "error")!;
    ed.focusNode(first);
    const before = Date.now();
    key(ed.renderer.element(first), "ArrowDown");
    key(ed.renderer.element(ed.focusedNode()!), "ArrowDown");
    const log = ed.activityLog();
    expect(log.map((e) => e.action)).toEqual(["next", "next"]);
    expect(log[0].seq).toBeLessThan(log[1].seq);
    expect(log[0].t).toBeGreaterThanOrEqual(before);
    expect(log[0].target).toEqual({
      kind: first.kind,
      from: first.from,
      to: first.to,
    });
    expect(log[0].detail).toEqual({ key: "ArrowDown", mods: "" });
    expect(log[0].change).toBeUndefined();
    // a key that did nothing (not in the table, or a character on a block that is not a hole) is not an action
    key(ed.renderer.element(ed.focusedNode()!), "q");
    expect(ed.activityLog().length).toBe(2);
  });

  test("a delete: the change is in the entry, with the length of the text after it; a refusal is an entry without one", () => {
    const ed = make(l);
    const x = lit(ed, "4");
    ed.focusNode(x);
    key(ed.renderer.element(x), "Delete"); // nothing selected: refused
    key(ed.renderer.element(x), " ");
    key(ed.renderer.element(x), "Delete");
    const log = ed.activityLog();
    expect(log.map((e) => e.action)).toEqual([
      "delete",
      "toggleSelection",
      "delete",
    ]);
    expect(log[0].change).toBeUndefined();
    expect(log[2].change?.length).toBe(1);
    expect(log[2].length).toBe(text(ed).length);
    expect(log[2].target?.kind).toBe("literal");
  });

  test("an edit box: only the committed text is recorded, never a keystroke; blur commits too; Escape is a cancel", () => {
    const ed = make(l);
    const n = lit(ed, "4");
    ed.focusNode(n);
    key(ed.renderer.element(n), "Enter");
    const input = ed.view.dom.querySelector(
      "input.blocks-edit"
    ) as HTMLInputElement;
    const n0 = ed.activityLog().length; // (the Enter that opened the box)
    for (const v of ["4", "44", "445"]) {
      input.value = v;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      key(input, v[v.length - 1]);
    }
    expect(ed.activityLog().length).toBe(n0); // no keystroke
    key(input, "Enter");
    const e = ed.activityLog().slice(n0);
    expect(e.map((x) => x.action)).toEqual(["edit"]);
    expect(e[0].detail).toEqual({ how: "enter", text: "445" });
    expect(e[0].change?.[0].insert).toBe("445");
    // blur
    const m = lit(ed, "5");
    ed.focusNode(m);
    key(ed.renderer.element(m), "Enter");
    const input2 = ed.view.dom.querySelector(
      "input.blocks-edit"
    ) as HTMLInputElement;
    input2.value = "55";
    input2.dispatchEvent(new FocusEvent("blur"));
    expect(ed.activityLog().pop()?.detail).toEqual({ how: "blur", text: "55" });
    // Escape
    const k = lit(ed, "55");
    ed.focusNode(k);
    key(ed.renderer.element(k), "Enter");
    key(ed.view.dom.querySelector("input.blocks-edit")!, "Escape");
    expect(actions(ed).pop()).toBe("editCancel");
  });

  test("the character that opens a box on a hole is not recorded (the box's text is, when it is committed)", () => {
    const ed = make(
      l,
      l === "scheme"
        ? "(f 1 2)\n(if x 1 2)\n"
        : l === "javascript"
          ? "f(1, 2);\nif (x) { f(1); } else { f(2); }\n"
          : "f(1, 2)\nif x:\n    f(1)\nelse:\n    f(2)\n"
    );
    ed.removeNode(
      all(ed).find(
        (n) =>
          n.slot &&
          n.slot.kind === "one" &&
          n.slots.length === 0 &&
          n.parent &&
          n.parent.kind !== "program"
      )!
    );
    ed.clearActivityLog();
    const hole = all(ed).find((n) => ed.isBlank(n) && n.slots.length === 0)!;
    ed.focusNode(hole);
    key(ed.renderer.element(hole), "Q");
    const e = ed.activityLog().pop()!;
    expect(e.action).toBe("typeIntoHole");
    expect(e.detail).toEqual({ mods: "" });
    expect(JSON.stringify(e)).not.toContain("Q");
  });

  test("clicks, a click in a gap, a double click, a drag, the toolbar, search, mode, undo, typing in text mode", () => {
    const ed = make(l);
    const two = lit(ed, "2");
    ed.renderer
      .element(two)
      .dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 })
      );
    ed.view.dom
      .querySelector(".blocks-edit")
      ?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
    const args = all(ed).find((n) => n.slots.some((s) => s.name === "args"))!;
    const gap = ed.renderer
      .element(args)
      .querySelector(
        `.blocks-args[data-slot="args"] > .blocks-gap[data-index="0"]`
      ) as HTMLElement;
    gap.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    );
    (
      ed.view.dom.querySelector("input.blocks-edit") as HTMLInputElement
    ).dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
    );
    ed.renderer
      .element(args)
      .dispatchEvent(
        new MouseEvent("dblclick", { bubbles: true, cancelable: true })
      );
    // a drag of 3 onto the gap
    const three = lit(ed, "3");
    document.elementFromPoint = () => gap;
    ptr(ed.renderer.element(three), "pointerdown", 10);
    ptr(document, "pointermove", 60);
    ptr(document, "pointerup", 60);
    // the toolbar
    ed.insertTemplate("number", ed.focusedNode());
    ed.view.dom
      .querySelector("input.blocks-edit")
      ?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
    // search
    key(ed.renderer.element(ed.focusedNode()!), "F3");
    const d = document.querySelector(
      ".blocks-search input[type=text]"
    ) as HTMLInputElement;
    d.value = "4";
    d.dispatchEvent(new Event("input", { bubbles: true }));
    key(d, "Enter");
    key(ed.renderer.element(ed.focusedNode()!), "PageDown");
    ed.setBlockMode(false);
    ed.setBlockMode(true);
    ed.view.dispatch({ changes: { from: 0, to: 0, insert: " " } });
    const a = actions(ed);
    // (F3 and PageDown are commands of the key table, so they are named so; the dialog's own changes and its closing are search.*)
    for (const w of [
      "click",
      "editCancel",
      "gapClick",
      "insertCancel",
      "dblclick",
      "drag",
      "template",
      "search",
      "search.set",
      "search.close",
      "searchNext",
      "mode",
      "text",
    ])
      expect(a).toContain(w);
    expect(a.filter((x) => x === "mode").length).toBe(2);
    const drag = ed.activityLog().find((e) => e.action === "drag")!;
    expect(drag.change).toBeDefined();
    expect(drag.detail).toMatchObject({ count: 1, touch: false });
    expect((drag.detail!.to as { slot: string }).slot).toBe(
      gap.parentElement!.dataset.slot
    );
    const set = ed
      .activityLog()
      .filter((e) => e.action === "search.set")
      .pop()!;
    expect(
      (set.detail!.settings as { text: { searchString: string } }).text
        .searchString
    ).toBe("4");
    const typed = ed.activityLog().pop()!;
    expect(typed).toMatchObject({
      action: "text",
      change: [{ from: 0, to: 0, insert: " " }],
    });
    // undo, by the key table
    key(ed.renderer.element(ed.focusedNode() ?? ed.roots()[0]), "z", {
      ctrlKey: true,
    });
    expect(actions(ed).pop()).toBe("undo");
    expect(ed.activityLog().pop()?.change).toBeDefined();
  });

  test("a template dropped from the toolbar, and a block dropped nowhere, are entries", async () => {
    const ed = make(l);
    const args = all(ed).find((n) => n.slots.some((s) => s.name === "args"))!;
    const gap = ed.renderer
      .element(args)
      .querySelector(
        `.blocks-args[data-slot="args"] > .blocks-gap[data-index="0"]`
      ) as HTMLElement;
    document.elementFromPoint = () => gap;
    const e = new MouseEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: 0,
      clientY: 0,
    });
    Object.defineProperty(e, "pointerId", { value: 1 });
    ed.beginTemplateDrag(e as PointerEvent, "number");
    ptr(document, "pointermove", 40);
    ptr(document, "pointerup", 40);
    const log = ed.activityLog();
    expect(log[0].action).toBe("templateDrop");
    expect(log[0].detail).toMatchObject({ name: "number", touch: false });
    expect(log[0].change).toBeDefined();
    await new Promise((r) => setTimeout(r, 5)); // (the click that ends a drag is swallowed until the next turn of the event loop)
  });

  test("the log is bounded; what is dropped is folded into the starting text; clear forgets", () => {
    const ed = make(l, undefined, { activityLimit: 5 });
    const start = text(ed);
    for (let i = 0; i < 20; i++)
      ed.view.dispatch({ changes: { from: 0, to: 0, insert: "\n" } });
    expect(ed.activityLog().length).toBe(5);
    const ex = ed.exportActivity();
    expect(ex.dropped).toBe(15);
    expect(ex.base.length).toBe(start.length + 15);
    ed.clearActivityLog();
    expect(ed.activityLog()).toEqual([]);
    const cleared = text(ed);
    ed.view.dispatch({ changes: { from: 0, to: 1, insert: "" } });
    const r = replay(ed.exportActivity(), undefined, (t) => make(l, t));
    expect(text(r)).toBe(text(ed));
    expect(ed.exportActivity().base).toBe(cleared);
  });

  test("replay refuses a log that does not start from the text it is given", () => {
    const ed = make(l);
    ed.view.dispatch({ changes: { from: 0, to: 0, insert: "x x x " } });
    const log = ed.activityLog();
    expect(() => replay(log, "", (t) => make(l, t))).toThrow(
      /diverged|beyond|Invalid/
    );
  });
});

describe.each(NAMES)("replay of a random session: %s", (name) => {
  const L = LANGS[name];
  test.each([1, 2, 3, 4])(
    "seed %i: 60 steps (the fuzzer's generator, with keys and a search between), replayed: same text and same tree",
    (seed) => {
      const rnd = mulberry32(seed * 104729 + name.length);
      const start = L.start[seed % L.start.length];
      const ed = make(name, start);
      const logLines: string[] = [];
      const first = ed.roots().find((r) => r.kind !== "error");
      if (first) ed.focusNode(first);
      for (let i = 0; i < 60; i++) {
        randomStep(ed, L, rnd, logLines);
        // keys, as a person would press them, now and then
        if (i % 4 === 1) {
          const f = all(ed)[Math.floor(rnd() * all(ed).length)];
          if (f) {
            ed.focusNode(f);
            key(ed.renderer.element(f), rnd() < 0.5 ? "ArrowDown" : "ArrowUp");
          }
        }
        if (i === 20) ed.search.set({ searchString: "x" });
        if (i % 9 === 3 && ed.focusedNode())
          key(ed.renderer.element(ed.focusedNode()!), "PageDown");
      }
      expect(checkLezerEditor(ed)).toEqual([]);
      const log = ed.activityLog();
      expect(log.length).toBeGreaterThan(60);
      expect(log.some((e) => e.change)).toBe(true);
      expect(new Set(log.map((e) => e.action)).size).toBeGreaterThan(4);
      // the log survives being sent as JSON
      const sent = JSON.parse(JSON.stringify(ed.exportActivity()));
      const copy = replay(log, start, (t) => make(name, t));
      expect(text(copy)).toBe(text(ed));
      expect(tree(copy)).toBe(tree(ed));
      expect(checkLezerEditor(copy)).toEqual([]);
      const copy2 = replay(sent, undefined, (t) => make(name, t));
      expect(text(copy2)).toBe(text(ed));
      expect(tree(copy2)).toBe(tree(ed));
      // (and the replayed editor has a log of its own: the text changes, in the same order)
      expect(copy.activityLog().map((e) => e.change)).toEqual(
        log.filter((e) => e.change).map((e) => e.change)
      );
    }
  );
});

test("TEXT and OPTS are what these tests use", () => {
  expect(Object.keys(OPTS)).toEqual(NAMES);
  expect(Object.keys(TEXT)).toEqual(NAMES);
  void createLezerBlockEditor;
});
