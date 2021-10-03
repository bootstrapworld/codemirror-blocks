import wescheme from "../src/languages/wescheme";

import { teardown, finishRender, mountCMB } from "../src/toolkit/test-utils";
import { API, AST } from "../src/CodeMirrorBlocks";
import { ASTNode } from "../src/ast";
import { MarkerRange, TextMarker } from "codemirror";

console.log("Doing markText-test.js");

describe("The CodeMirrorBlocks Class", function () {
  describe("text marking api,", function () {
    let cmb!: API;
    let ast!: AST.AST;
    let literal1!: ASTNode;
    let literal2!: ASTNode;
    let expression!: ASTNode & { args: ASTNode[] };
    beforeEach(async function () {
      cmb = await mountCMB(wescheme);
      cmb.setValue("11\n12\n(+ 3 4 5)");
      await finishRender(cmb); // give the editor a chance to re-render
      cmb.getAllMarks().forEach((m) => m.clear());
      ast = cmb.getAst();
      literal1 = ast.rootNodes[0];
      literal2 = ast.rootNodes[1];
      expression = ast.rootNodes[2] as ASTNode & { args: ASTNode[] };
    });

    afterEach(function () {
      teardown();
    });

    it("should allow you to mark nodes with the markText method", function () {
      cmb.markText(literal1.from, literal1.to, {
        css: "color: red",
      });
      expect(literal1.element.style.color).toBe("red");
    });

    it("it should allow you to set a className value", function () {
      cmb.markText(expression.from, expression.to, {
        className: "error",
      });
      expect(expression.element.className).toMatch(/error/);
    });

    it("it should allow you to set a className on a child node", function () {
      let child = expression.args[2];
      cmb.markText(child.from, child.to, { className: "error" });
      expect(child.element.className).toMatch(/error/);
      expect(expression.element.className).not.toMatch(/error/);
    });

    it("it should allow you to set a title value", function () {
      cmb.markText(expression.from, expression.to, {
        title: "woot",
      });
      expect(expression.element.title).toBe("woot");
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
        let marks = cmb.findMarksAt(literal1.from);
        expect(marks.length).toBe(1);
      });

      it("should return all marks with getAllMarks", function () {
        let marks = cmb.getAllMarks();
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
        mark.clear();
        expect(literal1.element.style.color).toBeFalsy();
        expect(cmb.getAllMarks().length).toBe(0);
      });

      it("should expose a find function", function () {
        expect(mark.find().from.line).toEqual(literal1.from.line);
        expect(mark.find().from.ch).toEqual(literal1.from.ch);
        expect(mark.find().to.line).toEqual(literal1.to.line);
        expect(mark.find().to.ch).toEqual(literal1.to.ch);
      });
    });

    /*
        // TODO(Emmanuel): add tests for crossing mode transitions
        describe("should preserve marks across mode transitions,", function() {
    
          it("such as a red background", async function() {
            expect(cmb.getAllMarks().length).toBe(0);
            cmb.markText(literal1.from, literal1.to, {css:"background: red"});
            expect(cmb.getAllMarks().length).toBe(1); 
            expect(literal1.element.style.background).toBe('red');
            cmb.setBlockMode(false);
            await finishRender(cmb);
            console.log(cmb.getAllMarks());
            expect(cmb.getAllMarks().length).toBe(1);
          });
        });
    */
  });
});