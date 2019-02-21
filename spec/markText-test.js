import CodeMirrorBlocks from '../src/CodeMirrorBlocks';
import wescheme from '../src/languages/wescheme';
import 'codemirror/addon/search/searchcursor.js';
/* eslint-disable */ //temporary
import {store} from '../src/store';
import {wait, cleanupAfterTest} from './support/test-utils';

// ms delay to let the DOM catch up before testing
const DELAY = 750;
/* eslint-enable */ //temporary

describe('The CodeMirrorBlocks Class', function() {
  beforeEach(function() {
      const fixture = `
        <div id="root">
          <div id="cmb-editor" class="editor-container"/>
        </div>
      `;
      document.body.insertAdjacentHTML('afterbegin', fixture);
      const container = document.getElementById('cmb-editor');
      this.cmb = new CodeMirrorBlocks(container, wescheme, "");
      this.editor = this.cmb;
      this.cm = this.editor.cm;
      this.editor.blocks.setBlockMode(true);
    });

    afterEach(function() {
      cleanupAfterTest('root', store);
    });


  describe('text marking api,', function() {
    
    beforeEach(async function() {
      this.editor.cm.setValue('11\n12\n(+ 3 4 5)');
      this.editor.cm.getAllMarks().forEach(m => m.clear());
      this.ast = this.editor.blocks.getAst();
      this.literal1 = this.ast.rootNodes[0];
      this.literal2 = this.ast.rootNodes[1];
      this.expression = this.ast.rootNodes[2];
    });

    it("should allow you to mark nodes with the markText method", async function() {
      this.editor.cm.markText(this.literal1.from, this.literal1.to, {css:"color: red"});
      expect(this.literal1.element.style.color).toBe('red');
    });

    it("it should allow you to set a className value", async function() {
      this.editor.cm.markText(this.expression.from, this.expression.to, {className:"error"});
      expect(this.expression.element.className).toMatch(/error/);
    });
    
    it("it should allow you to set a className on a child node", function() {
      let child = this.expression.args[2];
      this.editor.cm.markText(child.from, child.to, {className:"error"});
      expect(child.element.className).toMatch(/error/);
      expect(this.expression.element.className).not.toMatch(/error/);
    });

    it("it should allow you to set a title value", function() {
      this.editor.cm.markText(this.expression.from, this.expression.to, {title:"woot"});
      expect(this.expression.element.title).toBe("woot");
    });

    describe("which provides some getters,", function() {
      beforeEach(async function() {
        this.editor.cm.markText(this.literal1.from, this.literal1.to, {css:"color: red"});
        this.editor.cm.markText(this.expression.from, this.expression.to, {title:"woot"});
      });

      it("should return marks with findMarks", function() {
        let marks = this.editor.cm.findMarks(this.literal1.from, this.literal1.to);
        expect(marks.length).toBe(1);

        marks = this.editor.cm.findMarks(this.literal1.from, this.expression.to);
        expect(marks.length).toBe(2);
      });

      it("should return marks with findMarksAt", function() {
        let marks = this.editor.cm.findMarksAt(this.literal1.from, this.literal1.to);
        expect(marks.length).toBe(1);
      });

      it("should return all marks with getAllMarks", function() {
        let marks = this.editor.cm.getAllMarks();
        expect(marks.length).toBe(2);
      });
    });

    describe("which spits out TextMark-like objects,", function() {
      beforeEach(function() {
        this.mark = this.editor.cm.markText(
          this.literal1.from, this.literal1.to, {css:"color: red"}
        );
      });

      it("should expose a clear function to remove the mark", function() {
        this.mark.clear();
        expect(this.literal1.element.style.color).toBeFalsy();
        expect(this.editor.cm.getAllMarks().length).toBe(0);
      });

      it("should expose a find function", function() {
        expect(this.mark.find().from.line).toEqual(this.literal1.from.line);
        expect(this.mark.find().from.ch).toEqual(this.literal1.from.ch);
        expect(this.mark.find().to.line).toEqual(this.literal1.to.line);
        expect(this.mark.find().to.ch).toEqual(this.literal1.to.ch);
      });
    });
  });
});
