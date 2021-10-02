import wescheme from "../src/languages/wescheme";

/*eslint no-unused-vars: "off"*/
import {
  mac,
  cmd_ctrl,
  wait,
  removeEventListeners,
  teardown,
  activationSetup,
  click,
  mouseDown,
  mouseenter,
  mouseover,
  mouseleave,
  doubleClick,
  blur,
  paste,
  cut,
  copy,
  dragstart,
  dragover,
  drop,
  dragenter,
  dragenterSeq,
  dragend,
  dragleave,
  keyDown,
  keyPress,
  insertText,
  finishRender,
} from "../src/toolkit/test-utils";

console.log("Doing markText-test.js");

// be sure to call with `apply` or `call`
let setup = async function () {
  await activationSetup.call(this, wescheme);
};

describe("The CodeMirrorBlocks Class", function () {
  beforeEach(async function () {
    await setup.call(this);
  });

  afterEach(function () {
    teardown();
  });

  describe("text marking api,", function () {
    beforeEach(async function () {
      this.cmb.setValue("11\n12\n(+ 3 4 5)");
      await finishRender(this.cmb); // give the editor a chance to re-render
      this.cmb.getAllMarks().forEach((m) => m.clear());
      this.ast = this.cmb.getAst();
      this.literal1 = this.ast.rootNodes[0];
      this.literal2 = this.ast.rootNodes[1];
      this.expression = this.ast.rootNodes[2];
    });

    it("should allow you to mark nodes with the markText method", function () {
      this.cmb.markText(this.literal1.from, this.literal1.to, {
        css: "color: red",
      });
      expect(this.literal1.element.style.color).toBe("red");
    });

    it("it should allow you to set a className value", function () {
      this.cmb.markText(this.expression.from, this.expression.to, {
        className: "error",
      });
      expect(this.expression.element.className).toMatch(/error/);
    });

    it("it should allow you to set a className on a child node", function () {
      let child = this.expression.args[2];
      this.cmb.markText(child.from, child.to, { className: "error" });
      expect(child.element.className).toMatch(/error/);
      expect(this.expression.element.className).not.toMatch(/error/);
    });

    it("it should allow you to set a title value", function () {
      this.cmb.markText(this.expression.from, this.expression.to, {
        title: "woot",
      });
      expect(this.expression.element.title).toBe("woot");
    });

    describe("which provides some getters,", function () {
      beforeEach(function () {
        this.cmb.markText(this.literal1.from, this.literal1.to, {
          css: "color: red",
        });
        this.cmb.markText(this.expression.from, this.expression.to, {
          title: "woot",
        });
      });

      it("should return marks with findMarks", function () {
        let marks = this.cmb.findMarks(this.literal1.from, this.literal1.to);
        expect(marks.length).toBe(1);
        marks = this.cmb.findMarks(this.literal1.from, this.expression.to);
        expect(marks.length).toBe(2);
      });

      it("should return marks with findMarksAt", function () {
        let marks = this.cmb.findMarksAt(this.literal1.from, this.literal1.to);
        expect(marks.length).toBe(1);
      });

      it("should return all marks with getAllMarks", function () {
        let marks = this.cmb.getAllMarks();
        expect(marks.length).toBe(2);
      });
    });

    describe("which spits out TextMark-like objects,", function () {
      beforeEach(function () {
        this.mark = this.cmb.markText(this.literal1.from, this.literal1.to, {
          css: "color: red",
        });
      });

      it("should expose a clear function to remove the mark", function () {
        this.mark.clear();
        expect(this.literal1.element.style.color).toBeFalsy();
        expect(this.cmb.getAllMarks().length).toBe(0);
      });

      it("should expose a find function", function () {
        expect(this.mark.find().from.line).toEqual(this.literal1.from.line);
        expect(this.mark.find().from.ch).toEqual(this.literal1.from.ch);
        expect(this.mark.find().to.line).toEqual(this.literal1.to.line);
        expect(this.mark.find().to.ch).toEqual(this.literal1.to.ch);
      });
    });

    /*
        // TODO(Emmanuel): add tests for crossing mode transitions
        describe("should preserve marks across mode transitions,", function() {
    
          it("such as a red background", async function() {
            expect(this.cmb.getAllMarks().length).toBe(0);
            this.cmb.markText(this.literal1.from, this.literal1.to, {css:"background: red"});
            expect(this.cmb.getAllMarks().length).toBe(1); 
            expect(this.literal1.element.style.background).toBe('red');
            this.cmb.setBlockMode(false);
            await finishRender(this.cmb);
            console.log(this.cmb.getAllMarks());
            expect(this.cmb.getAllMarks().length).toBe(1);
          });
        });
    */
  });
});
