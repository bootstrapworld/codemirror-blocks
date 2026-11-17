/** @jest-environment jsdom */
/* Seventh round, step 2: cut and copy take the comment that goes with a block; comments inside blocks with no list (a Scheme define). */
import { checkLezerEditor, LezerBlockEditor } from "../src/lezer-view";
import { make } from "./helpers";
import type { BNode } from "../src/types";

const LANGS = ["scheme", "javascript", "python"];
const TEXTS: Record<string, string> = {
  scheme: "; about f\n(f 1)\n(g 2)\n(h 3) ; about h\n",
  javascript: "// about f\nf(1);\ng(2);\nh(3); // about h\n",
  python: "# about f\nf(1)\ng(2)\nh(3)  # about h\n",
};
const text = (ed: LezerBlockEditor) => ed.view.state.doc.toString();
const ok = (ed: LezerBlockEditor) => expect(checkLezerEditor(ed)).toEqual([]);
const root = (ed: LezerBlockEditor, name: string): BNode =>
  ed
    .roots()
    .find(
      (r) =>
        r.kind !== "comment" &&
        new RegExp(`^[(]?${name}[( ]`).test(text(ed).slice(r.from, r.to))
    )!;
const key = (el: Element, k: string, mods: Partial<KeyboardEventInit> = {}) =>
  el.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: k,
      bubbles: true,
      cancelable: true,
      ...mods,
    })
  );
function clip(type: string, data: { v: string }): Event {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(e, "clipboardData", {
    value: {
      setData: (_t: string, v: string) => (data.v = v),
      getData: () => data.v,
    },
  });
  return e;
}

describe.each(LANGS)("cut and copy take the comment: %s", (l) => {
  test("copy puts the comment (above, or after it on its line) before the block, and leaves the text alone", () => {
    const ed = make(l, TEXTS[l]);
    const data = { v: "" };
    ed.focusNode(root(ed, "f"));
    ed.renderer.element(root(ed, "f")).dispatchEvent(clip("copy", data));
    expect(data.v).toMatch(/about f\n/);
    expect(data.v).toMatch(/f\(?\s?1/);
    ed.focusNode(root(ed, "h"));
    ed.renderer.element(root(ed, "h")).dispatchEvent(clip("copy", data));
    expect(data.v.indexOf("about h")).toBeLessThan(data.v.indexOf("h"));
    expect(text(ed)).toBe(TEXTS[l]);
    ok(ed);
  });
  test("cut removes the block and its comment; paste puts both back, with the comment attached, and focus on the block", () => {
    const ed = make(l, TEXTS[l]);
    const data = { v: "" };
    ed.focusNode(root(ed, "f"));
    ed.renderer.setSelected(root(ed, "f"), true); // (cut takes only what is selected)
    ed.renderer.element(root(ed, "f")).dispatchEvent(clip("cut", data));
    expect(text(ed)).not.toContain("about f");
    expect(text(ed)).not.toMatch(/f\(?\s?1/);
    expect(text(ed)).toContain("about h"); // (other comments stay)
    ok(ed);
    const g = root(ed, "g");
    ed.focusNode(g);
    ed.renderer.element(g).dispatchEvent(clip("paste", data));
    expect(text(ed)).toContain("about f");
    const f = root(ed, "f");
    expect(ed.renderer.element(f).getAttribute("aria-label")).toContain(
      "with comment: about f"
    );
    expect(ed.focusedNode()).toBe(f);
    ok(ed);
  });
  test("cut of the block that has a comment after it on its line takes that comment too; Delete leaves the comment", () => {
    const ed = make(l, TEXTS[l]);
    const data = { v: "" };
    ed.focusNode(root(ed, "h"));
    ed.renderer.setSelected(root(ed, "h"), true); // (cut takes only what is selected)
    ed.renderer.element(root(ed, "h")).dispatchEvent(clip("cut", data));
    expect(text(ed)).not.toContain("about h");
    ok(ed);
    const ed2 = make(l, TEXTS[l]);
    const g = root(ed2, "g");
    ed2.focusNode(g);
    key(ed2.renderer.element(g), " ");
    key(ed2.renderer.element(g), "Delete");
    expect(text(ed2)).not.toMatch(/g\(?\s?2/);
    const f = root(ed2, "f");
    ed2.focusNode(f);
    key(ed2.renderer.element(f), " ");
    key(ed2.renderer.element(f), "Delete");
    expect(text(ed2)).toContain("about f"); // (the old editor's delete keeps the comment)
    ok(ed2);
  });
  test("Delete with nothing selected deletes nothing and says so", () => {
    const ed = make(l, TEXTS[l]);
    const f = root(ed, "f");
    ed.focusNode(f);
    key(ed.renderer.element(f), "Delete");
    expect(text(ed)).toBe(TEXTS[l]);
    expect(ed.said[ed.said.length - 1]).toBe("Nothing selected");
  });
});

describe("comments inside a block that has no list (a Scheme define)", () => {
  const T =
    "(define x ; about x\n  5)\n(define (f a)\n  ; about the body\n  (* a a))\n";
  const find = (ed: LezerBlockEditor, src: string): BNode => {
    let found: BNode | null = null;
    const go = (n: BNode) => {
      if (
        n.kind !== "program" &&
        text(ed).slice(n.from, n.to) === src &&
        !found
      )
        found = n;
      for (const s of n.slots) for (const c of s.nodes) go(c);
    };
    go(ed.roots()[0].parent!);
    return found!;
  };
  test("a comment after a child on its line, and one above a child, are drawn with that child and said in its label", () => {
    const ed = make("scheme", T);
    const x = find(ed, "x");
    expect(
      ed.renderer.element(x).classList.contains("blocks-has-comment")
    ).toBe(true);
    expect(ed.renderer.element(x).getAttribute("aria-label")).toContain(
      "with comment: about x"
    );
    const five = find(ed, "5");
    expect(
      ed.renderer.element(five).classList.contains("blocks-has-comment")
    ).toBe(false);
    const body = find(ed, "(* a a)");
    expect(ed.renderer.element(body).getAttribute("aria-label")).toContain(
      "with comment: about the body"
    );
    ok(ed);
  });
  test("Shift-Ctrl-] writes, changes and removes such a comment; undo takes it back", () => {
    const ed = make("scheme", T);
    const five = find(ed, "5");
    ed.setComment(five, "five");
    expect(text(ed)).toContain("; five");
    expect(
      ed.renderer.element(find(ed, "5")).getAttribute("aria-label")
    ).toContain("with comment: five");
    ok(ed);
    ed.setComment(find(ed, "5"), "number five");
    expect(text(ed)).toContain("; number five");
    expect(text(ed)).not.toContain("; five");
    ed.setComment(find(ed, "5"), "");
    expect(text(ed)).not.toContain("five");
    expect(
      ed.renderer
        .element(find(ed, "5"))
        .classList.contains("blocks-has-comment")
    ).toBe(false);
    ok(ed);
    const x = find(ed, "x");
    ed.setComment(x, ""); // (the comment on x's line: removed with the break after it)
    expect(text(ed)).not.toContain("about x");
    expect(text(ed).startsWith("(define x")).toBe(true);
    ok(ed);
  });
  test("cut of a child takes its comment; text of the comment is in copy", () => {
    const ed = make("scheme", T);
    const data = { v: "" };
    const body = find(ed, "(* a a)");
    ed.focusNode(body);
    ed.renderer.element(body).dispatchEvent(clip("copy", data));
    expect(data.v).toBe("; about the body\n(* a a)");
    ed.renderer.setSelected(body, true); // (cut takes only what is selected)
    ed.renderer.element(body).dispatchEvent(clip("cut", data));
    expect(text(ed)).not.toContain("about the body");
    expect(text(ed)).toContain("(define (f a)");
    ok(ed);
  });
});
