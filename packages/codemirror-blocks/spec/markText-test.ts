import { act } from "@testing-library/react";
import wescheme from "@bootstrapworld/cmb-wescheme";

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

    // The one CodeMirror is kept across modes, so its marks are too. A mark
    // made on a block is a real mark in text mode (on the text, with no block
    // to show it on), and is on the block again when blocks come back.
    it("a mark survives switching to text and back", function () {
      const [first] = cmb.getAst().rootNodes;
      cmb.markText(first.from, first.to, { className: "flagged" });
      cmb.setBlockMode(false);
      expect(cmb.getAllMarks()).toHaveLength(1);
      expect(document.querySelectorAll(".flagged")).toHaveLength(1);
      cmb.setBlockMode(true);
      expect(cmb.getAllMarks()).toHaveLength(1);
      expect(cmb.getAllMarks()[0].find()).toMatchObject({
        from: { line: 0, ch: 0 },
        to: { line: 0, ch: 2 },
      });
      expect(document.querySelectorAll(".flagged")).toHaveLength(1);
    });

    it("a mark moves with the text edited in text mode", function () {
      const [, second] = cmb.getAst().rootNodes;
      cmb.markText(second.from, second.to, { className: "flagged" });
      cmb.setBlockMode(false);
      cmb.replaceRange("99\n", { line: 0, ch: 0 });
      cmb.setBlockMode(true);
      expect(cmb.getValue()).toBe("99\n11\n12\n(+ 3 4 5)");
      const [mark] = cmb.getAllMarks();
      expect(mark.find()).toMatchObject({
        from: { line: 2, ch: 0 },
        to: { line: 2, ch: 2 },
      });
      expect(document.querySelectorAll(".flagged")).toHaveLength(1);
    });

    it("the selection survives too", function () {
      cmb.setBlockMode(false);
      cmb.setSelection({ line: 1, ch: 0 }, { line: 1, ch: 2 });
      cmb.setBlockMode(true);
      cmb.setBlockMode(false);
      expect(cmb.getSelection()).toBe("12");
    });
  });
});
