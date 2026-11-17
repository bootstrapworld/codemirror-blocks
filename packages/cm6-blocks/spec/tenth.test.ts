/** @jest-environment jsdom */
// Tenth round: the differences from the old editor that the owner asked to match (1 to 3, 5, 6)
import { undo } from "@codemirror/commands";
import { checkLezerEditor } from "../src/lezer-view";
import { make, TEXT } from "./helpers";

const textOf = (ed: ReturnType<typeof make>) => ed.view.state.doc.toString();
const ok = (ed: ReturnType<typeof make>) => expect(checkLezerEditor(ed)).toEqual([]);

describe("1. active descendant and ids", () => {
  test("ids are block-node-<id> and unique across two editors on one page", () => {
    const a = make("scheme", "(f 1)\n(g 2)");
    const b = make("scheme", "(f 1)\n(g 2)");
    const ids = [...document.querySelectorAll(".blocks-node")].map((e) => e.id);
    expect(ids.length).toBeGreaterThan(6);
    expect(ids.every((i) => /^block-node-\d+$/.test(i))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(a.view.dom.querySelector("[id^=cmb6-]")).toBeNull();
    expect(b.view.dom.querySelector("[id^=cmb6-]")).toBeNull();
  });
  test("focus on a block sets aria-activedescendant on the role=tree element, and the shim on the scroller; leaving clears", () => {
    const ed = make("scheme", "(f 1)\n(g 2)");
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    const [r0, r1] = ed.roots();
    ed.focusNode(r0);
    const tree = ed.view.dom.querySelector("[role=tree]")!;
    expect(tree.getAttribute("aria-activedescendant")).toBe(`block-node-${r0.id}`);
    expect(ed.view.scrollDOM.getAttribute("aria-activedescendent")).toBe(`block-node-${r0.id}`);
    ed.focusNode(r1);
    expect(tree.getAttribute("aria-activedescendant")).toBe(`block-node-${r1.id}`);
    outside.focus();
    expect(tree.hasAttribute("aria-activedescendant")).toBe(false);
    expect(ed.view.scrollDOM.hasAttribute("aria-activedescendent")).toBe(false);
    outside.remove();
  });
});

describe.each(["scheme", "javascript", "python"])("2. a root that goes leaves its line: %s", (l) => {
  test("delete: the line stays, blank lines pile up, undo restores the text exactly", () => {
    const ed = make(l);
    const start = textOf(ed);
    const lines = start.split("\n");
    ed.removeNodes([ed.roots()[1]]);
    expect(textOf(ed).split("\n")).toEqual([lines[0], "", lines[2]]);
    ok(ed);
    ed.removeNodes([ed.roots()[0]]);
    expect(textOf(ed).split("\n")).toEqual(["", "", lines[2]]);
    ed.removeNodes([ed.roots()[0]]);
    expect(textOf(ed)).toBe("\n\n");
    expect(ed.roots().length).toBe(0);
    ok(ed);
    undo(ed.view);
    undo(ed.view);
    undo(ed.view);
    expect(textOf(ed)).toBe(start);
    ok(ed);
  });
  test("cut and drag-out of a root leave the line too", () => {
    const ed = make(l);
    const lines = textOf(ed).split("\n");
    ed.removeNodes([ed.roots()[0]], true);
    expect(textOf(ed).split("\n")).toEqual(["", lines[1], lines[2]]);
    ok(ed);
  });
  test("several roots at once", () => {
    const ed = make(l);
    const lines = textOf(ed).split("\n");
    ed.removeNodes([ed.roots()[0], ed.roots()[2]]);
    expect(textOf(ed).split("\n")).toEqual(["", lines[1], ""]);
    ok(ed);
  });
});

describe("2. details of the old rule", () => {
  test("within a line: one space goes with the block (old removeWhitespace)", () => {
    const ed = make("scheme", "(a) (b) (c)");
    ed.removeNodes([ed.roots()[1]]);
    expect(textOf(ed)).toBe("(a) (c)");
    const ed2 = make("scheme", "(a) (b)");
    ed2.removeNodes([ed2.roots()[0]]);
    expect(textOf(ed2)).toBe("(b)");
    const ed3 = make("scheme", "(a) (b) (c)");
    ed3.removeNodes([ed3.roots()[0], ed3.roots()[1]]);
    expect(textOf(ed3)).toBe("(c)");
  });
  test("python: the indentation of later statements is untouched", () => {
    const ed = make("python", "x = 1\ndef f():\n    a = 1\n    b = 2\ny = 2\n");
    ed.removeNodes([ed.roots()[0]]);
    expect(textOf(ed)).toBe("\ndef f():\n    a = 1\n    b = 2\ny = 2\n");
    ok(ed);
  });
  test("a block inside another block still takes its separator (not this round)", () => {
    const ed = make("scheme", "(f 1 2 3)");
    const call = ed.roots()[0];
    ed.removeNodes([call.slots.find((s) => s.name === "args")!.nodes[0]]);
    expect(textOf(ed)).toBe("(f 2 3)");
  });
  test("dragging a root into another block leaves its line", () => {
    const ed = make("scheme", "(f 1)\n(g 2)");
    const [f, g] = ed.roots();
    const args = f.slots.find((s) => s.name === "args")!;
    ed.moveNode(g, { slot: args, index: 1 });
    expect(textOf(ed)).toBe("(f 1 (g 2))\n");
    ok(ed);
  });
});

describe("3. Down and Up from the text cursor with no block focused", () => {
  const press = (ed: ReturnType<typeof make>, key: string, init: KeyboardEventInit = {}) => {
    const e = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
    ed.view.contentDOM.dispatchEvent(e);
    return e;
  };
  const at = (ed: ReturnType<typeof make>, pos: number) => {
    ed.view.dispatch({ selection: { anchor: pos } });
    ed.view.contentDOM.focus();
  };
  const textOfFocus = (ed: ReturnType<typeof make>) => {
    const n = ed.focusedNode();
    return n ? textOf(ed).slice(n.from, n.to) : null;
  };
  //            0123456789...
  const TXT = "(f 1 (g 2))  (h)\n\n(k)";
  test.each([
    // [cursor, key, the block that gets the focus]
    [0, "ArrowDown", "(f 1 (g 2))"], // before a block: that block
    [1, "ArrowDown", "f"], // inside a block: its first child that ends after the cursor, starts at or after it...
    [4, "ArrowDown", "(g 2)"], // inside a call, before the next child
    [11, "ArrowDown", "(h)"], // right after a block, between two: the next one
    [12, "ArrowDown", "(h)"],
    [16, "ArrowDown", "(k)"], // end of a line: the block on a later line
    [TXT.length, "ArrowDown", null], // at the end: nothing (beeps)
    [0, "ArrowUp", null], // before everything: nothing
    [1, "ArrowUp", "(f 1 (g 2))"], // just inside the first block's bracket: that block (the rule drills while a child starts before the cursor)
    [11, "ArrowUp", "2"], // after a block: its last descendant that starts before the cursor (the old rule drills in)
    [TXT.length, "ArrowUp", ")"],
  ] as [number, string, string | null][])("cursor %i, %s", (pos, key, expected) => {
    const ed = make("scheme", TXT);
    at(ed, pos);
    const e = press(ed, key);
    if (expected === "(h)" || expected === "(k)" || expected === "(f 1 (g 2))" || expected === "f" || expected === "(g 2)" || expected === "2") {
      expect(e.defaultPrevented).toBe(true);
    }
    if (expected === null) {
      expect(ed.focusedNode()).toBeNull();
      expect(e.defaultPrevented).toBe(true); // (the old editor keeps the key from moving the cursor here too)
    } else if (expected === ")") {
      expect(textOfFocus(ed)).not.toBeNull();
    } else expect(textOfFocus(ed)).toBe(expected);
  });
  test("an empty document: nothing to activate", () => {
    const ed = make("scheme", "");
    ed.view.contentDOM.focus();
    press(ed, "ArrowDown");
    press(ed, "ArrowUp");
    expect(ed.focusedNode()).toBeNull();
  });
  test("not in text mode, and not with a modifier", () => {
    const ed = make("scheme", TXT);
    at(ed, 0);
    press(ed, "ArrowDown", { shiftKey: true }); // (CodeMirror's own: extends the selection)
    expect(ed.focusedNode()).toBeNull();
    ed.setBlockMode(false);
    at(ed, 0);
    press(ed, "ArrowDown");
    expect(ed.focusedNode()).toBeNull();
  });
});
