/** @jest-environment jsdom */
// A block that goes with a line comment AFTER it on its line, put where the comment would swallow what follows (inside an argument
// list), takes the comment to a line of its own directly above it, in every language (doc/experiments/cm6-api-map.md, Decisions).
import { checkLezerEditor, LezerBlockEditor } from "../src/lezer-view";
import type { BNode } from "../src/types";
import { make } from "./helpers";

const text = (ed: LezerBlockEditor) => ed.view.state.doc.toString();
const all = (ed: LezerBlockEditor): BNode[] => {
  const out: BNode[] = [];
  const walk = (n: BNode) => {
    out.push(n);
    n.slots.forEach((s) => s.nodes.forEach(walk));
  };
  ed.roots().forEach(walk);
  return out;
};
const src = (ed: LezerBlockEditor, n: BNode) =>
  ed.view.state.doc.sliceString(n.from, n.to);
const find = (ed: LezerBlockEditor, s: string): BNode =>
  all(ed).filter((n) => n.kind !== "comment" && src(ed, n) === s)[0];
/** the list of the last call, which has the two arguments the block goes between */
const target = (ed: LezerBlockEditor) =>
  all(ed)
    .filter((n) => /^\(?g[( ]/.test(src(ed, n)))
    .pop()!
    .slots.find((s) => s.nodes.length >= 2)!;
const done = (ed: LezerBlockEditor, comment: string) => {
  const a = find(ed, "a");
  const c = ed.commentOf(a);
  // (the comment goes with the moved block, directly above it, and is no block of its own: no root comment, no drawn comment)
  expect(c?.value).toBe(comment);
  expect(ed.isAttachedComment(c as BNode)).toBe(true);
  expect(ed.roots().filter((r) => r.kind === "comment")).toEqual([]);
  const el = ed.renderer.element(c as BNode);
  expect(el.hasAttribute("role")).toBe(false);
  expect(el.getAttribute("aria-hidden")).toBe("true");
  expect(
    ed.renderer.element(a).querySelector(":scope > span.blocks-comment")
      ?.textContent
  ).toContain(comment.replace(/^(;|#|\/\/) /, ""));
  expect(checkLezerEditor(ed)).toEqual([]);
};

describe("a line comment of a moved block goes on its own line above it when it would swallow the rest of the line", () => {
  test("scheme", () => {
    const ed = make("scheme", "(f\n  a ; the a\n  b)\n(g 1 2)\n");
    ed.moveNode(find(ed, "a"), { slot: target(ed), index: 1 });
    expect(text(ed)).toBe("(f\n  b)\n(g 1\n; the a\na 2)\n");
    done(ed, "; the a");
  });
  test("javascript", () => {
    const ed = make("javascript", "f(\n  a, // the a\n  b\n);\ng(1, 2);\n");
    ed.moveNode(find(ed, "a"), { slot: target(ed), index: 1 });
    expect(text(ed)).toBe("f(\n  b\n);\ng(1,\n// the a\na, 2);\n");
    done(ed, "// the a");
  });
  test("python", () => {
    const ed = make("python", "f(\n    a,  # the a\n    b\n)\ng(1, 2)\n");
    ed.moveNode(find(ed, "a"), { slot: target(ed), index: 1 });
    expect(text(ed)).toBe("f(\n    b\n)\ng(1,\n# the a\na, 2)\n");
    done(ed, "# the a");
  });
  test("insertText of a snippet with a line comment after it, inline (python)", () => {
    const ed = make("python", "g(1, 2)\n");
    ed.insertText(target(ed), 1, "a  # the a");
    expect(text(ed)).toBe("g(1,\n# the a\na, 2)\n");
    done(ed, "# the a");
  });
  test("a comment that already ends its line, and a block comment, stay as they are", () => {
    const ed = make("python", "x = 1  # the x\ny = 2\n");
    ed.moveNode(find(ed, "x = 1"), { slot: ed.roots()[0].slot!, index: 2 });
    expect(text(ed)).toContain("x = 1 # the x");
    expect(checkLezerEditor(ed)).toEqual([]);
    const js = make("javascript", "f(\n  a, /* the a */\n  b\n);\ng(1, 2);\n");
    js.moveNode(find(js, "a"), { slot: target(js), index: 1 });
    expect(text(js)).toContain("g(1, a /* the a */, 2)");
  });
});
