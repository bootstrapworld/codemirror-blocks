/** @jest-environment jsdom */
/* Seventh round, step 3: the announcements of the old editor that were missing (compared with its `say` calls). */
import { redo, undo } from "@codemirror/commands";
import { LezerBlockEditor } from "../src/lezer-view";
import { make } from "./helpers";
import { walk } from "../src/doc";
import type { BNode } from "../src/types";

const LANGS = ["scheme", "javascript", "python"];
const find = (ed: LezerBlockEditor, src: string): BNode => {
  let f: BNode | null = null;
  ed.roots().forEach((r) =>
    walk(
      r,
      (n) =>
        !f &&
        n.slots.length === 0 &&
        ed.view.state.doc.sliceString(n.from, n.to) === src &&
        (f = n)
    )
  );
  return f!;
};
const key = (el: Element, k: string, mods: Partial<KeyboardEventInit> = {}) =>
  el.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: k,
      bubbles: true,
      cancelable: true,
      ...mods,
    })
  );

describe.each(LANGS)("announcements: %s", (l) => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test("the first drawing says what is at the top level", () => {
    const ed = make(l);
    expect(ed.said[0]).toMatch(
      /^At the top level, this program contains 3 (calls|statements)\./
    );
  });
  test("an edit commit says what was changed or inserted; undo and redo say what they undid and redid", () => {
    const ed = make(l);
    ed.focusNode(find(ed, "4"));
    key(ed.renderer.element(find(ed, "4")), "Enter");
    const box = ed.view.dom.querySelector(
      "input.blocks-edit"
    ) as HTMLInputElement;
    box.value = "44";
    key(box, "Enter");
    expect(ed.said).toContain("changed 44");
    undo(ed.view);
    expect(ed.said[ed.said.length - 1]).toBe("UNDID: changed 44");
    redo(ed.view);
    expect(ed.said[ed.said.length - 1]).toBe("REDID: changed 44");
    // an insertion through the gap box
    ed.focusNode(find(ed, "44"));
    key(ed.renderer.element(find(ed, "44")), "]", { ctrlKey: true });
    const b2 = ed.view.dom.querySelector(
      "input.blocks-edit"
    ) as HTMLInputElement;
    b2.value = "7";
    key(b2, "Enter");
    expect(ed.said).toContain("inserted 7");
    undo(ed.view);
    expect(ed.said[ed.said.length - 1]).toBe("UNDID: inserted 7");
  });
  test("a literal that gets focus says 'Use enter to edit' after 1.25 s, unless something else is said or the focus moves first", () => {
    const ed = make(l);
    ed.focusNode(find(ed, "4"));
    jest.advanceTimersByTime(1200);
    expect(ed.said).not.toContain("Use enter to edit");
    jest.advanceTimersByTime(100);
    expect(ed.said[ed.said.length - 1]).toBe("Use enter to edit");
    // moved away first
    const n = ed.said.length;
    ed.focusNode(find(ed, "5"));
    jest.advanceTimersByTime(600);
    ed.focusNode(ed.roots()[0]);
    jest.advanceTimersByTime(3000);
    expect(ed.said.length).toBe(n);
    // something else said first
    ed.focusNode(find(ed, "4"));
    jest.advanceTimersByTime(500);
    ed.say("x");
    jest.advanceTimersByTime(3000);
    expect(ed.said.slice(n)).toEqual(["x"]);
  });
  test("switching modes says which mode is on, after half a second", () => {
    const ed = make(l);
    ed.setBlockMode(false);
    jest.advanceTimersByTime(400);
    expect(ed.said).not.toContain("Text Mode Enabled");
    jest.advanceTimersByTime(200);
    expect(ed.said[ed.said.length - 1]).toBe("Text Mode Enabled");
    ed.setBlockMode(true);
    jest.advanceTimersByTime(600);
    expect(ed.said[ed.said.length - 1]).toBe("Block Mode Enabled");
  });
});
