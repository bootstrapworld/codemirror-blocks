import { act } from "@testing-library/react";
import wescheme from "../src/languages/wescheme";

import { teardown, mountCMB } from "../src/toolkit/test-utils";
import { API } from "../src/CodeMirrorBlocks";
import { AST, ASTNode } from "../src/ast";
import { MarkerRange, TextMarker } from "codemirror";
import { FunctionAppNode } from "../src/nodes";

describe("The CodeMirrorBlocks Class", function () {
  describe("text marking api,", function () {
    let cmb!: API;
    let ast!: AST;
    let literal1!: ASTNode;
    let expression!: FunctionAppNode;
    beforeEach(async function () {
      cmb = mountCMB(wescheme).cmb;
      cmb.setValue("11\n12\n(+ 3 4 5)");
      cmb.getAllMarks().forEach((m) => m.clear());
      ast = cmb.getAst();
      literal1 = ast.rootNodes[0];
      expression = ast.rootNodes[2] as typeof expression;
    });

    afterEach(function () {
      teardown();
    });

    it("should allow you to mark nodes with the markText method", function () {
      cmb.markText(literal1.from, literal1.to, {
        css: "color: red",
      });
      expect(literal1.element!.style.color).toBe("red");
    });

    it("it should allow you to set a className value", function () {
      cmb.markText(expression.from, expression.to, {
        className: "error",
      });
      expect(expression.element!.className).toMatch(/error/);
    });

    it("it should allow you to set a className on a child node", function () {
      const child = expression.fields.args[2];
      cmb.markText(child.from, child.to, { className: "error" });
      expect(child.element!.className).toMatch(/error/);
      expect(expression.element!.className).not.toMatch(/error/);
    });

    it("it should allow you to set a title value", function () {
      cmb.markText(expression.from, expression.to, {
        title: "woot",
      });
      expect(expression.element!.title).toBe("woot");
    });

    describe("which provides some getters,", function () {
      beforeEach(function () {
        cmb.markText(literal1.from, literal1.to, {
          css: "color: red",
        });
        cmb.markText(expression.from, expression.to, {
          title: "woot",
        });
      });

      it("should return marks with findMarks", function () {
        let marks = cmb.findMarks(literal1.from, literal1.to);
        expect(marks.length).toBe(1);
        marks = cmb.findMarks(literal1.from, expression.to);
        expect(marks.length).toBe(2);
      });

      it("should return marks with findMarksAt", function () {
        const marks = cmb.findMarksAt(literal1.from);
        expect(marks.length).toBe(1);
      });

      it("should return all marks with getAllMarks", function () {
        const marks = cmb.getAllMarks();
        expect(marks.length).toBe(2);
      });
    });

    describe("which spits out TextMark-like objects,", function () {
      let mark!: TextMarker<MarkerRange>;
      beforeEach(function () {
        mark = cmb.markText(literal1.from, literal1.to, {
          css: "color: red",
        });
      });

      it("should expose a clear function to remove the mark", function () {
        act(() => mark.clear());
        expect(literal1.element!.style.color).toBeFalsy();
        expect(cmb.getAllMarks().length).toBe(0);
      });

      it("should expose a find function", function () {
        expect(mark.find()!.from.line).toEqual(literal1.from.line);
        expect(mark.find()!.from.ch).toEqual(literal1.from.ch);
        expect(mark.find()!.to.line).toEqual(literal1.to.line);
        expect(mark.find()!.to.ch).toEqual(literal1.to.ch);
      });
    });
  });

  describe("marks and mode switches,", function () {
    let cmb!: API;
    let store!: ReturnType<typeof mountCMB>["store"];
    const marked = () => Object.keys(store.getState().markedMap);
    beforeEach(function () {
      ({ cmb, store } = mountCMB(wescheme));
      cmb.setValue("11\n12\n(+ 3 4 5)");
      cmb.setBlockMode(true);
    });
    afterEach(teardown);

    it("a mark on a block shows on it, and is remembered by the block's id", function () {
      const [first] = cmb.getAst().rootNodes;
      cmb.markText(first.from, first.to, { className: "flagged" });
      expect(marked()).toEqual([first.id]);
      expect(first.element!.classList.contains("flagged")).toBe(true);
    });

    it("a mark does not outlast its block: deleting the block forgets it", function () {
      const [first] = cmb.getAst().rootNodes;
      cmb.markText(first.from, first.to, { className: "flagged" });
      cmb.replaceRange("", first.from, { line: 1, ch: 0 });
      expect(cmb.getValue()).toBe("12\n(+ 3 4 5)");
      expect(marked()).toEqual([]);
    });

    it("a mark stays while other blocks are edited", function () {
      const [first] = cmb.getAst().rootNodes;
      cmb.markText(first.from, first.to, { className: "flagged" });
      cmb.replaceRange("13", { line: 1, ch: 0 }, { line: 1, ch: 2 });
      expect(marked()).toEqual([cmb.getAst().rootNodes[0].id]);
    });

    // The text editor is a new CodeMirror each time the mode changes, so the
    // marks made on the old one are gone, and so are what the store remembered
    // about them (it used to keep entries for blocks that no longer exist).
    it("switching to text and back clears the marks, and what was remembered", function () {
      const [first] = cmb.getAst().rootNodes;
      cmb.markText(first.from, first.to, { className: "flagged" });
      expect(cmb.getAllMarks()).toHaveLength(1);
      cmb.setBlockMode(false);
      expect(cmb.getAllMarks()).toHaveLength(0);
      expect(marked()).toEqual([]);
      cmb.setBlockMode(true);
      expect(cmb.getAllMarks()).toHaveLength(0);
      expect(marked()).toEqual([]);
      expect(document.querySelectorAll(".flagged")).toHaveLength(0);
    });

    // KNOWN GAP (#571): marks should survive a mode switch. `it.failing`
    // passes while they do not; when they do, remove the `.failing`.
    it.failing("a mark survives switching to text and back", function () {
      const [first] = cmb.getAst().rootNodes;
      cmb.markText(first.from, first.to, { className: "flagged" });
      cmb.setBlockMode(false);
      cmb.setBlockMode(true);
      expect(cmb.getAllMarks()).toHaveLength(1);
    });
  });
});
