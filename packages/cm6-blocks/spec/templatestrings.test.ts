/** @jest-environment jsdom */
/* Fifth round, step 4: template strings (JavaScript) and f-strings (Python): blocks inside, the text between them drawn as pieces. */
import { checkLezerEditor, LezerBlockEditor } from "../src/lezer-view";
import { walk } from "../src/doc";
import { make } from "./helpers";
import type { BNode } from "../src/types";

const CASES: Record<string, { text: string; head: string }> = {
  javascript: { text: "const s = `a ${x + 1} b ${f(y)} c`;\nconst t = `plain`;\nconst u = `${a}${b}`;\n", head: "`a ${x + 1} b ${f(y)} c`" },
  python: { text: 's = f"a {x + 1} b {f(y)!r} c {z:>5}"\nt = f"plain"\nu = f"{a}{b}"\n', head: 'f"a {x + 1} b {f(y)!r} c {z:>5}"' },
};
const all = (ed: LezerBlockEditor): BNode[] => {
  const o: BNode[] = [];
  ed.roots().forEach((r) => walk(r, (n) => o.push(n)));
  return o;
};
/** the text pieces drawn in the gaps of a template string's own list */
const pieces = (ed: LezerBlockEditor, n: BNode): string[] => Array.from(ed.renderer.element(n).querySelectorAll(":scope > .blocks-args > .blocks-gap")).map((g) => g.textContent ?? "");
const ok = (ed: LezerBlockEditor) => expect(checkLezerEditor(ed)).toEqual([]);

describe.each(Object.keys(CASES))("template strings: %s", (l) => {
  const C = CASES[l];
  test("a template string is a block whose children are the blocks inside it; the text between is drawn as pieces", () => {
    const ed = make(l, C.text);
    const ts = all(ed).filter((n) => n.kind === "template");
    expect(ts.length).toBe(3);
    const text = ed.view.state.doc.toString();
    expect(text.slice(ts[0].from, ts[0].to)).toBe(C.head);
    expect(ts[0].slots[0].nodes.map((n) => text.slice(n.from, n.to))).toEqual(l === "javascript" ? ["x + 1", "f(y)"] : ["x + 1", "f(y)", "z"]);
    expect(ts[1].slots[0].nodes.length).toBe(0);
    expect(ts[2].slots[0].nodes.length).toBe(2);
    // drawn: the owner's text is the gaps' text plus the children's
    const el = ed.renderer.element(ts[0]);
    expect(pieces(ed, ts[0])).toEqual(l === "javascript" ? ["`a ${", "} b ${", "} c`"] : ['f"a {', "} b {", "!r} c {", ':>5}"']);
    expect(pieces(ed, ts[1])).toEqual([l === "javascript" ? "`plain`" : 'f"plain"']);
    expect(pieces(ed, ts[2])).toEqual(l === "javascript" ? ["`${", "}${", "}`"] : ['f"{', "}{", '}"']);
    expect(el.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(-1);
    expect(el.getAttribute("aria-label")).toMatch(/with \d parts$/);
    ok(ed);
  });

  test("edit a block inside: the pieces stay right; remove one: it becomes the blank; undo", () => {
    const ed = make(l, C.text);
    const t0 = () => all(ed).filter((n) => n.kind === "template")[0];
    const lit = all(ed).find((n) => n.kind === "literal" && ed.view.state.doc.sliceString(n.from, n.to) === "x")!;
    ed.replaceText(lit, "longername");
    expect(ed.view.state.doc.toString()).toContain("longername + 1");
    expect(pieces(ed, t0())[0]).toBe(l === "javascript" ? "`a ${" : 'f"a {');
    ok(ed);
    const second = t0().slots[0].nodes[1];
    ed.removeNode(second);
    expect(ed.view.state.doc.toString()).toContain(l === "javascript" ? "b ${" + (ed.options.table.blank ?? "...") + "} c" : "b {" + (ed.options.table.blank ?? "...") + "!r} c");
    expect(t0().slots[0].nodes.length).toBe(l === "javascript" ? 2 : 3);
    ok(ed);
    const { undo } = jest.requireActual("@codemirror/commands");
    undo(ed.view);
    undo(ed.view);
    expect(ed.view.state.doc.toString()).toBe(C.text);
    ok(ed);
  });

  test("nothing is inserted into the text of a template string; the gaps hold text and do not open boxes", () => {
    const ed = make(l, C.text);
    const t = all(ed).filter((n) => n.kind === "template")[0];
    expect(() => ed.insertText(t.slots[0], 0, "zz")).toThrow(/text with blocks/);
    expect(ed.view.state.doc.toString()).toBe(C.text);
    const gap = ed.renderer.element(t).querySelector(".blocks-gap") as HTMLElement;
    expect(gap.classList.contains("blocks-piece")).toBe(true);
    expect(gap.hasAttribute("aria-hidden")).toBe(false);
    gap.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(ed.view.dom.querySelector(".blocks-edit")).toBeNull();
    // pasting after a block inside goes after the template string, not into it
    const inner = t.slots[0].nodes[0];
    ed.pasteText(inner, "zz");
    expect(ed.view.state.doc.toString()).not.toContain("${zz") ;
    ok(ed);
  });

  test("edit as text (Ctrl-Enter) on the whole template string", () => {
    const ed = make(l, C.text);
    const t = all(ed).filter((n) => n.kind === "template")[0];
    ed.focusNode(t);
    ed.renderer.element(t).dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true, cancelable: true }));
    const box = ed.view.dom.querySelector("textarea.blocks-edit") as HTMLTextAreaElement;
    expect(box.value).toBe(C.head);
    box.value = l === "javascript" ? "`only ${q} here`" : 'f"only {q} here"';
    box.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    const t2 = all(ed).filter((n) => n.kind === "template")[0];
    expect(t2.slots[0].nodes.length).toBe(1);
    expect(pieces(ed, t2)).toEqual(l === "javascript" ? ["`only ${", "} here`"] : ['f"only {', '} here"']);
    ok(ed);
  });
});
