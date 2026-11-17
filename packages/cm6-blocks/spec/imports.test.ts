/** @jest-environment jsdom */
/* Fifth round, step 3: Python imports are blocks (import a.b as c, from x import y as z, w). */
import { checkLezerEditor } from "../src/lezer-view";
import { walk } from "../src/doc";
import { make } from "./helpers";
import type { BNode } from "../src/types";

const SRC = [
  "import os",
  "import a.b as c, d",
  "from x import y as z, w",
  "from . import a",
  "from .a.b import (c, d as e)",
  "from x import *",
  "from x import y\n",
].join("\n");

const shape = (n: BNode, text: string): string => {
  if (n.slots.length === 0)
    return JSON.stringify(text.slice(n.from, n.to).trim());
  return `${n.kind}${n.keyword ? ":" + n.keyword : ""}(${n.slots.map((s) => s.name + "=[" + s.nodes.map((c) => shape(c, text)).join(" ") + "]").join(" ")})`;
};

describe("python imports", () => {
  test("every import statement is a block with its parts as blocks", () => {
    const ed = make("python", SRC);
    const text = ed.view.state.doc.toString();
    expect(ed.roots().map((r) => shape(r, text))).toEqual([
      'import:import(names=[alias(name=["os"] alias=[])])',
      'import:import(names=[alias(name=["a.b"] alias=["c"]) alias(name=["d"] alias=[])])',
      'import:from(module=["x"] names=[alias(name=["y"] alias=["z"]) alias(name=["w"] alias=[])])',
      'import:from(module=["."] names=[alias(name=["a"] alias=[])])',
      'import:from(module=[".a.b"] names=[alias(name=["c"] alias=[]) alias(name=["d"] alias=["e"])])',
      'import:from(module=["x"] names=[alias(name=["*"] alias=[])])',
      'import:from(module=["x"] names=[alias(name=["y"] alias=[])])',
    ]);
    expect(checkLezerEditor(ed)).toEqual([]);
  });

  test("the words are drawn (from, import, as) and spoken", () => {
    const ed = make("python", "from x import y as z, w\nimport a.b as c\n");
    const els = Array.from(ed.view.dom.querySelectorAll(".blocks-node")).map(
      (e) => e.textContent
    );
    expect(els[0]).toContain("from");
    expect(els[0]).toContain("import");
    expect(els[0]).toContain("as");
    expect(
      ed.view.dom.querySelector('[aria-label="from x import 2 names"]')
    ).not.toBeNull();
    expect(
      ed.view.dom.querySelector('[aria-label="import a.b as c"]')
    ).not.toBeNull();
  });

  test("a name can be removed, one inserted, and the text edited; the oracle stays clean; undo restores", () => {
    const ed = make("python", "from x import y as z, w\nimport a, b\n");
    const text = () => ed.view.state.doc.toString();
    const names = (r: BNode) => r.slots.find((s) => s.name === "names")!;
    ed.removeNode(names(ed.roots()[0]).nodes[0]);
    expect(text()).toBe("from x import w\nimport a, b\n");
    expect(checkLezerEditor(ed)).toEqual([]);
    ed.insertText(names(ed.roots()[0]), 1, "q as r");
    expect(text()).toBe("from x import w, q as r\nimport a, b\n");
    expect(checkLezerEditor(ed)).toEqual([]);
    ed.insertText(names(ed.roots()[1]), 2, "c");
    expect(text()).toBe("from x import w, q as r\nimport a, b, c\n");
    ed.replaceText(ed.roots()[1].slots[0].nodes[1].slots[0].nodes[0], "bb");
    expect(text()).toBe("from x import w, q as r\nimport a, bb, c\n");
    expect(checkLezerEditor(ed)).toEqual([]);
    let all = 0;
    ed.roots().forEach((r) => walk(r, () => all++));
    expect(all).toBeGreaterThan(12);
  });

  test("the import template writes a block; imports in bodies; text that is not an import is accepted", () => {
    const ed = make("python", "def f():\n    import os\n    return os\n");
    expect(ed.templates().map((t) => t.name)).toContain("import");
    ed.insertTemplate("import", null);
    ed.view.dom
      .querySelector("input.blocks-edit")
      ?.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        })
      );
    expect(checkLezerEditor(ed)).toEqual([]);
    const imp: BNode[] = [];
    ed.roots().forEach((r) =>
      walk(r, (n) => n.kind === "import" && imp.push(n))
    );
    expect(imp.length).toBe(2);
    ed.view.dispatch({
      changes: { from: 0, insert: "from import (\nimport , as\n" },
    });
    expect(checkLezerEditor(ed)).toEqual([]);
  });
});
