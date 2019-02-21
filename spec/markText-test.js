import CodeMirrorBlocks from '../src/CodeMirrorBlocks';
import wescheme from '../src/languages/wescheme';
import 'codemirror/addon/search/searchcursor.js';
/* eslint-disable */ //temporary
import {
  click,
  dblclick,
  blur,
  keydown,
  keypress,
  dragstart,
  dragenter,
  dragleave,
  drop,
  cut,
} from './support/events';

import {
  LEFT,
  UP,
  RIGHT,
  DOWN,
  LESS_THAN,
  DELETE,
  ENTER,
  SPACE,
  HOME,
  END,
  ESC,
  LEFTBRACKET,
  RIGHTBRACKET,
  ISMAC,
  DKEY,
} from 'codemirror-blocks/keycode';

import {wait} from './support/test-utils';

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
    this.blocks = new CodeMirrorBlocks(container, wescheme, "");
    this.blocks.handleToggle(true);
  });

  afterEach(function() {
    const root = document.getElementById('root');
    if (root)
      root.parentNode.removeChild(root);

    const portals = document.getElementsByClassName("ReactModalPortal");
    while (portals[0]) {
      const current = portals[0];
      current.parentNode.removeChild(current);
    }
    
    const textareas = document.getElementsByTagName("textarea");
    while (textareas[0]) {
      const current = textareas[0];
      current.parentNode.removeChild(current);
    }
  });

  describe('text marking api,', function() {
    
    beforeEach(async function() {
      this.blocks.setValue('11 12 (+ 3 4 5)');
      await wait(DELAY);
      this.state = this.blocks.getState();
      this.blocks.handleToggle(true);
      this.literal1 = this.state.ast.rootNodes[0];
      this.literal2 = this.state.ast.rootNodes[1];
      this.expression = this.state.ast.rootNodes[2];
    });

    it("should allow you to mark nodes with the markText method", function() {
      this.blocks.markText(this.literal1.from, this.literal1.to, {css:"color: red"});
      expect(this.literal1.element.style.color).toBe('red');
    });
    it("should return a BlockMarker object", function() {
      let mark = this.blocks.markText(this.literal1.from, this.literal1.to, {css:"color: red"})[0];
      expect(mark).toEqual(jasmine.any(BlockMarker));
    });

    it("it should allow you to set a className value", function() {
      this.blocks.markText(this.expression.from, this.expression.to, {className:"error"});
      expect(this.expression.element.className).toMatch(/error/);
    });

    it("it should allow you to set a className on a child node", function() {
      let child = this.expression.args[2];
      this.blocks.markText(child.from, child.to, {className:"error"});
      expect(child.element.className).toMatch(/error/);
      expect(this.expression.element.className).not.toMatch(/error/);
    });

    it("it should allow you to set a title value", function() {
      this.blocks.markText(this.expression.from, this.expression.to, {title:"woot"});
      expect(this.expression.element.title).toBe("woot");
    });

    describe("which provides some getters,", function() {
      beforeEach(function() {
        this.blocks.markText(this.literal1.from, this.literal1.to, {css:"color: red"});
        this.blocks.markText(this.expression.from, this.expression.to, {title:"woot"});
      });

      it("should return marks with findMarks", function() {
        let marks = this.blocks.findMarks(this.literal1.from, this.literal1.to);
        expect(marks.length).toBe(1);

        marks = this.blocks.findMarks(this.literal1.from, this.expression.to);
        expect(marks.length).toBe(2);
      });

      it("should return marks with findMarksAt", function() {
        let marks = this.blocks.findMarksAt(this.literal1.from, this.literal1.to);
        expect(marks.length).toBe(1);
      });

      it("should return all marks with getAllMarks", function() {
        let marks = this.blocks.getAllMarks();
        expect(marks.length).toBe(2);
      });
    });

    describe("which spits out BlockMarker objects,", function() {
      beforeEach(function() {
        this.mark = this.blocks.markText(
          this.literal1.from, this.literal1.to, {css:"color: red"}
        )[0];
      });

      it("should expose a clear function to remove the mark", function() {
        this.mark.clear();
        expect(this.literal1.element.style.color).toBeFalsy();
        expect(this.blocks.getAllMarks().length).toBe(0);
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
