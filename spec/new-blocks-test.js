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

const TOGGLE_SELECTION_KEYPRESS =
      keydown(SPACE, ISMAC ? {altKey: true} : {ctrlKey: true});
const PRESERVE_NEXT_KEYPRESS =
      keydown(DOWN, ISMAC ? {altKey: true} : {ctrlKey: true});
const PRESERVE_PREV_KEYPRESS =
      keydown(UP, ISMAC ? {altKey: true} : {ctrlKey: true});

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
    this.cm = this.blocks.cm;

    this.trackSetQuarantine = spyOn(this.blocks, 'setQuarantine').and.callThrough();
    // this.trackExecCommand   = spyOn(document   , 'execCommand').and.callThrough();
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


  describe('constructor,', function() {

    it("should create an empty editor", function() {
      const fixture = `
        <div id="temp">
          <div id="cmb-editor-temp" class="editor-container"/>
        </div>
      `;
      document.body.insertAdjacentHTML('afterbegin', fixture);
      const container = document.getElementById('cmb-editor-temp');
      const tempBlocks = new CodeMirrorBlocks(container, wescheme, "");
      tempBlocks.handleToggle(true);
      const state = tempBlocks.getState();
      expect(tempBlocks.blockMode).toBe(true);
      expect(state.ast.rootNodes.length).toBe(0);
      expect(state.collapsedList.length).toBe(0);
      expect(state.cur).toBe(null);
      expect(state.errorId).toBe("");
      expect(state.focusId).toBe(-1);
      expect(state.quarantine).toBe(null);
      expect(state.selections.length).toBe(0);

      console.log("BLOCKS:", this.blocks);
      console.log("STATE:", this.blocks.getState());

      document.body.removeChild(document.getElementById('temp'));
    });

    it("should set block mode to false", function() {
      this.blocks.handleToggle(false);
      expect(this.blocks.blockMode).toBe(false);
    });
  });

  // Should we make the language prop accessible externally so we can run this?
  // it('should optionally take a language object', function() {
  //   const b = new CodeMirrorBlocks(document.getElementById('root'), example, "");
  //   expect(b.language.id).toBe('example');
  // });

  describe('text marking api,', function() {
    /*
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
      // console.log("literal1", this.literal1);
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
    });*/
  });

  describe('events,', function() {
    beforeEach(function() {
      this.blocks.setValue('11');
      this.blocks.handleToggle(true);
      this.state = this.blocks.getState();
      this.literal = this.state.ast.rootNodes[0];
    });

    describe("when dealing with top-level input,", function() {

      beforeEach(function() {
        this.blocks.setValue('42 11');
      });

      it('typing at the end of a line', function() {
        this.blocks.setCursor({line: 0, ch: 5});
        this.blocks.getInputField().dispatchEvent(keypress(57));
        expect(this.blocks.getValue()).toEqual('42 119');
      });

      it('typing at the beginning of a line', function() {
        this.blocks.setCursor({line: 0, ch: 0});
        this.blocks.getInputField().dispatchEvent(keypress(57));
        expect(this.blocks.getValue()).toEqual('942 11');
      });

      it('typing between two blocks on a line', function() {
        this.blocks.setCursor({line: 0, ch: 3});
        this.blocks.getInputField().dispatchEvent(keypress(57));
        expect(this.blocks.getValue()).toEqual('42 911');
      });

      // TODO: figure out how to fire a paste event
    });

    describe("when dealing with node activation,", function() {

      beforeEach(function() {
        this.blocks.setValue('11 54');
        this.state = this.blocks.getState();
        this.literal = this.state.ast.rootNodes[0];
        this.literal2 = this.state.ast.rootNodes[1];
      });

      it('should only allow one node to be active at a time', function() {
        this.literal.element.dispatchEvent(click());
        this.literal2.element.dispatchEvent(click());
        const {ast, focusId} = this.blocks.getState();
        const activeNode = ast.getNodeByNId(focusId);
        expect(activeNode).not.toBe(this.literal);
        expect(activeNode).toBe(this.literal2);
      });

      it('should put focus on the active node', function() {
        this.literal.element.dispatchEvent(click());
        expect(document.activeElement).toBe(this.literal.element);
        expect(this.blocks.cm.getScrollerElement().getAttribute('aria-activedescendent')).toBe(this.literal.element.id);
      });
      
      it('should not delete active nodes when the delete key is pressed', async function() {
        expect(this.blocks.getValue()).toBe('11 54');
        this.literal.element.dispatchEvent(click());
        const {ast, focusId} = this.blocks.getState();
        const activeNode = ast.getNodeByNId(focusId);
        expect(activeNode).toBe(this.literal);
        this.blocks.getWrapperElement().dispatchEvent(keydown(DELETE));
        await wait(DELAY);
        expect(this.blocks.getValue()).toBe('11 54');
      });
      
      it('should activate the first node when down is pressed', function() {
        this.blocks.getWrapperElement().dispatchEvent(keydown(DOWN));
        const {ast, focusId} = this.blocks.getState();
        const activeNode = ast.getNodeByNId(focusId);
        expect(activeNode).toBe(this.literal);
        expect(this.blocks.cm.getScrollerElement().getAttribute('aria-activedescendent')).toBe(this.literal.element.id);
      });
      
      it('should activate the next node when down is pressed', function() {
        this.blocks.getWrapperElement().dispatchEvent(keydown(DOWN));
        this.blocks.getWrapperElement().dispatchEvent(keydown(DOWN));
        const {ast, focusId} = this.blocks.getState();
        const activeNode = ast.getNodeByNId(focusId);
        expect(activeNode).not.toBe(this.literal);
        expect(activeNode).toBe(this.literal2);
        expect(this.blocks.cm.getScrollerElement().getAttribute('aria-activedescendent')).toBe(this.literal2.element.id);
      });
      
      it('should activate the node after the cursor when down is pressed', function() {
        this.blocks.setCursor({line: 0, ch: 2});
        this.blocks.getWrapperElement().dispatchEvent(keydown(DOWN));
        const {ast, focusId} = this.blocks.getState();
        const activeNode = ast.getNodeByNId(focusId);
        expect(activeNode).not.toBe(this.literal);
        expect(activeNode).toBe(this.literal2);
        expect(this.blocks.cm.getScrollerElement().getAttribute('aria-activedescendent')).toBe(this.literal2.element.id);
      });
      
      it('should activate the node before the cursor when up is pressed', function() {
        this.cm.setCursor({line: 0, ch: 2});
        this.cm.getWrapperElement().dispatchEvent(keydown(UP));
        const {ast, focusId} = this.blocks.getState();
        const activeNode = ast.getNodeByNId(focusId);
        expect(activeNode).not.toBe(this.literal2);
        expect(activeNode).toBe(this.literal);
        expect(this.blocks.cm.getScrollerElement().getAttribute('aria-activedescendent')).toBe(this.literal.element.id);
      });
      
      it('should toggle the editability of activated node when Enter is pressed', async function() {
        this.literal.element.dispatchEvent(click());
        const {ast, focusId} = this.blocks.getState();
        const activeNode = ast.getNodeByNId(focusId);
        expect(activeNode).toBe(this.literal);
        this.literal.element.dispatchEvent(keydown(ENTER));
        await wait(DELAY);
        // not sure if this is the right approach
        expect(this.blocks.setQuarantine).toHaveBeenCalled();
      });
      
      it('should cancel the editability of activated node when Esc is pressed', async function() {
        this.literal.element.dispatchEvent(click());
        const {ast, focusId} = this.blocks.getState();
        const activeNode = ast.getNodeByNId(focusId);
        expect(activeNode).toBe(this.literal);
        this.literal.element.dispatchEvent(keydown(ENTER));
        await wait(DELAY);
        expect(this.blocks.setQuarantine).toHaveBeenCalled();
        this.literal.element.dispatchEvent(keydown(DKEY));
        this.literal.element.dispatchEvent(keydown(ESC));
        expect(this.blocks.getValue()).toBe('11 54');
      });

      describe('cut/copy/paste', function() {
        beforeEach(function() {
          this.literal.element.dispatchEvent(click());        // activate the node,
          this.literal.element.dispatchEvent(keydown(SPACE)); // then select it
          spyOn(document, 'execCommand');
        });

        it('should remove selected nodes on cut', async function() {
          document.dispatchEvent(cut());
          await wait(DELAY);
          expect(this.blocks.getValue()).toBe(' 54');
          expect(document.execCommand).toHaveBeenCalledWith('cut');
          const {ast, focusId} = this.blocks.getState();
          const activeNode = ast.getNodeByNId(focusId);
          expect(activeNode).toBe(ast.rootNodes[0]); // focus should shift
        });

        it('should remove multiple selected nodes on cut', async function() {
          this.literal.element.dispatchEvent(PRESERVE_NEXT_KEYPRESS);
          this.literal2.element.dispatchEvent(TOGGLE_SELECTION_KEYPRESS);
          const {selections} = this.blocks.getState();
          expect(selections.length).toBe(2);
          document.dispatchEvent(cut());
          await wait(DELAY);
          expect(this.blocks.getState().selections.length).toBe(0);
          expect(this.blocks.getValue()).toBe(' ');
          expect(document.execCommand).toHaveBeenCalledWith('cut');
        });

        xit('should create an activeElement with the text to be copied', function() {
          // TODO: figure out how to test this.
        });
      });

      describe('tree navigation', function() {
        beforeEach(function() {
          this.blocks.setValue('(+ 1 2 3) 99 (* 7 (* 1 2))');
          this.state = this.blocks.getState();
          this.firstRoot  = this.state.ast.rootNodes[0];
          this.secondRoot = this.state.ast.rootNodes[1];
          this.thirdRoot  = this.state.ast.rootNodes[2];
          this.funcSymbol = this.state.ast.rootNodes[0].func;
          this.firstArg   = this.state.ast.rootNodes[0].args[0];
          this.secondArg  = this.state.ast.rootNodes[0].args[1];
          this.thirdArg   = this.state.ast.rootNodes[0].args[2];
          this.firstRoot.element.dispatchEvent(click());
          this.firstRoot.element.dispatchEvent(keydown(LEFT));
          this.lastNode   = this.thirdRoot.args[1].args[1];
        });

        it('up-arrow should navigate to the previous visible node, but not beyond the tree', function() {
          this.secondRoot.element.dispatchEvent(click());
          expect(document.activeElement).toBe(this.secondRoot.element);
          expect(this.blocks.cm.getScrollerElement().getAttribute('aria-activedescendent')).toBe(this.secondRoot.element.id);
          this.firstRoot.element.dispatchEvent(keydown(UP));
          expect(document.activeElement).toBe(this.firstRoot.element);
          expect(this.blocks.cm.getScrollerElement().getAttribute('aria-activedescendent')).toBe(this.firstRoot.element.id);
          this.secondRoot.element.dispatchEvent(keydown(UP));
          expect(document.activeElement).toBe(this.firstRoot.element);
          expect(this.blocks.cm.getScrollerElement().getAttribute('aria-activedescendent')).toBe(this.firstRoot.element.id);
        });
        
        it('down-arrow should navigate to the next sibling, but not beyond the tree', function() {
          this.thirdRoot.args[1].args[0].element.dispatchEvent(click());
          expect(document.activeElement).toBe(this.thirdRoot.args[1].args[0].element);
          this.thirdRoot.args[1].args[0].element.dispatchEvent(keydown(DOWN));
          expect(document.activeElement).toBe(this.thirdRoot.args[1].args[1].element);
          expect(this.blocks.cm.getScrollerElement().getAttribute('aria-activedescendent')).toBe(this.thirdRoot.args[1].args[1].element.id);
          this.thirdRoot.args[1].args[1].element.dispatchEvent(keydown(DOWN));
          expect(document.activeElement).toBe(this.thirdRoot.args[1].args[1].element);
          expect(this.blocks.cm.getScrollerElement().getAttribute('aria-activedescendent')).toBe(this.thirdRoot.args[1].args[1].element.id);
        });
        
        it('left-arrow should collapse a block, if it can be', function() {
          this.firstRoot.element.dispatchEvent(click());
          this.firstRoot.element.dispatchEvent(keydown(LEFT));
          expect(this.firstRoot.element.getAttribute("aria-expanded")).toBe("false");
          this.secondRoot.element.dispatchEvent(click());
          this.secondRoot.element.dispatchEvent(keydown(LEFT));
          expect(this.secondRoot.element.getAttribute("aria-expanded")).toBe(null);
        });
        
        it('left-arrow should collapse a block & activate parent', function() {
          this.secondArg.element.dispatchEvent(click());
          this.secondArg.element.dispatchEvent(keydown(LEFT));
          expect(this.firstRoot.element.getAttribute("aria-expanded")).toBe("false");
          expect(document.activeElement).toBe(this.firstRoot.element);
        });
        
        it('less-than should activate root without collapsing', async function() {
          this.thirdRoot.args[1].args[1].element.dispatchEvent(click());
          this.thirdRoot.args[1].args[1].element.dispatchEvent(keydown(LESS_THAN, {shiftKey: true}));
          expect(this.thirdRoot.element.getAttribute("aria-expanded")).toBe("true");
          expect(document.activeElement).toBe(this.thirdRoot.element);
        });
        
        it('right-arrow should expand a block, or shift focus to 1st child', function() {
          this.firstRoot.element.dispatchEvent(click());
          this.firstRoot.element.dispatchEvent(keydown(LEFT));
          expect(this.firstRoot.element.getAttribute("aria-expanded")).toBe("false");
          this.firstRoot.element.dispatchEvent(keydown(RIGHT));
          expect(document.activeElement).toBe(this.firstRoot.element);
          expect(this.firstRoot.element.getAttribute("aria-expanded")).toBe("true");
          this.firstRoot.element.dispatchEvent(keydown(RIGHT));
          expect(this.firstRoot.element.getAttribute("aria-expanded")).toBe("true");
          expect(document.activeElement).toBe(this.funcSymbol.element);
        });
        
        it('home should activate the first visible node', function() {
          this.secondRoot.element.dispatchEvent(click());
          this.secondRoot.element.dispatchEvent(keydown(HOME));
          expect(document.activeElement).toBe(this.firstRoot.element);
          expect(this.blocks.cm.getScrollerElement().getAttribute('aria-activedescendent')).toBe(this.firstRoot.element.id);
        });
        
        it('end should activate the last visible node', function() {
          this.secondRoot.element.dispatchEvent(click());
          this.secondRoot.element.dispatchEvent(keydown(END));
          expect(document.activeElement).toBe(this.lastNode.element);
          expect(this.blocks.cm.getScrollerElement().getAttribute('aria-activedescendent')).toBe(this.lastNode.element.id);
          this.thirdRoot.args[1].element.dispatchEvent(click());
          this.thirdRoot.args[1].element.dispatchEvent(keydown(LEFT));
          this.secondRoot.element.dispatchEvent(click());
          this.secondRoot.element.dispatchEvent(keydown(END));
          expect(document.activeElement).toBe(this.thirdRoot.args[1].element);
          expect(this.blocks.cm.getScrollerElement().getAttribute('aria-activedescendent')).toBe(this.thirdRoot.args[1].element.id);
        });
      });
    });

    describe("when dealing with node selection, ", function() {

      beforeEach(function() {
        this.blocks.setValue('11 54 (+ 1 2)');
        this.state = this.blocks.getState();
        this.literal  = this.state.ast.rootNodes[0];
        this.literal2 = this.state.ast.rootNodes[1];
        this.expr     = this.state.ast.rootNodes[2];
        this.literal.element.dispatchEvent(click());
        this.literal.element.dispatchEvent(keydown(SPACE));
      });

      it('space key toggles selection on and off', function() {
        expect(this.literal.element.getAttribute("aria-selected")).toBe('true');
        const {selections} = this.blocks.getState();
        expect(selections.length).toBe(1);
        this.literal.element.dispatchEvent(keydown(SPACE));
        expect(this.literal.element.getAttribute("aria-selected")).toBe('false');
        expect(this.blocks.getState().selections.length).toBe(0);
      });

      it('arrow clears selection & changes active ', function() {
        this.literal.element.dispatchEvent(keydown(DOWN));
        expect(this.literal.element.getAttribute("aria-selected")).toBe('false');
        expect(this.literal2.element.getAttribute("aria-selected")).toBe('false');
        expect(document.activeElement).toBe(this.literal2.element);
        expect(this.blocks.getState().selections.length).toBe(0);
      });

      it('alt-arrow preserves selection & changes active ', function() {
        this.literal.element.dispatchEvent(PRESERVE_NEXT_KEYPRESS);
        expect(this.literal.element.getAttribute("aria-selected")).toBe('true');
        expect(this.literal2.element.getAttribute("aria-selected")).toBe('false');
        expect(document.activeElement).toBe(this.literal2.element);
        expect(this.blocks.getState().selections.length).toBe(1);
      });

      it('allow multiple, non-contiguous selection ', function() {
        this.literal.element.dispatchEvent(PRESERVE_NEXT_KEYPRESS);
        this.literal2.element.dispatchEvent(PRESERVE_NEXT_KEYPRESS); // skip literal2
        this.expr.element.dispatchEvent(TOGGLE_SELECTION_KEYPRESS); // toggle selection on expr
        expect(this.literal.element.getAttribute("aria-selected")).toBe('true');
        expect(this.expr.element.getAttribute("aria-selected")).toBe('true');
        expect(document.activeElement).toBe(this.expr.element);
        expect(this.blocks.getState().selections.length).toBe(2);
      });

      it('selecting a parent, then child should just select the parent ', function() {
        this.expr.element.dispatchEvent(click());
        this.expr.element.dispatchEvent(keydown(SPACE));
        this.expr.element.dispatchEvent(PRESERVE_NEXT_KEYPRESS);
        this.expr.func.element.dispatchEvent(TOGGLE_SELECTION_KEYPRESS);
        expect(this.expr.element.getAttribute("aria-selected")).toBe('true');
        expect(this.expr.func.element.getAttribute("aria-selected")).toBe('false');
        expect(document.activeElement).toBe(this.expr.func.element);
        expect(this.blocks.getState().selections.length).toBe(1);
      });

      it('selecting a child, then parent should just select the parent ', function() {
        this.expr.func.element.dispatchEvent(click());
        this.expr.func.element.dispatchEvent(keydown(SPACE));
        this.expr.func.element.dispatchEvent(PRESERVE_PREV_KEYPRESS);
        this.expr.element.dispatchEvent(keydown(SPACE));
        expect(this.expr.element.getAttribute("aria-selected")).toBe('true');
        expect(this.expr.func.element.getAttribute("aria-selected")).toBe('false');
        expect(document.activeElement).toBe(this.expr.element);
        expect(this.blocks.getState().selections.length).toBe(1);
      });
    });
    
    it('should begin editing a node on double click', async function() {
      this.literal.element.dispatchEvent(dblclick());
      await wait(DELAY);
      expect(document.activeElement.classList).toContain('blocks-editing');
      expect(document.activeElement.contentEditable).toBe('true');
    });
    
    it('should save a valid, edited node on blur', async function() {
      this.literal.element.dispatchEvent(dblclick());
      await wait(DELAY);
      let quarantine = this.trackQuarantine.calls.mostRecent().returnValue;
      let selection = window.getSelection();
      expect(selection.rangeCount).toEqual(1);
      let range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode('9'));
      expect(this.cm.getValue()).toEqual('11');
      quarantine.dispatchEvent(blur());
      await wait(DELAY);
      expect(this.trackSaveEdit).toHaveBeenCalledWith(quarantine);
      expect(this.cm.getValue()).toEqual('9');
      expect(this.blocks.hasInvalidEdit).toBe(false);
    });
    /*

    it('should return the node being edited on esc', async function() {
      this.literal.element.dispatchEvent(dblclick());
      await wait(DELAY);
      let quarantine = this.trackQuarantine.calls.mostRecent().returnValue;
      quarantine.dispatchEvent(keydown(ESC));
      expect(this.cm.getValue()).toEqual('11');
    });

    it('should blur the node being edited on enter', async function() {
      this.literal.element.dispatchEvent(dblclick());
      await wait(DELAY);
      let quarantine = this.trackQuarantine.calls.mostRecent().returnValue;
      spyOn(quarantine, 'blur');
      quarantine.dispatchEvent(keydown(ENTER));
      expect(quarantine.blur).toHaveBeenCalled();
    });

    it('should blur the node being edited on top-level click', async function() {
      this.literal.element.dispatchEvent(dblclick());
      await wait(DELAY);
      let quarantine = this.trackQuarantine.calls.mostRecent().returnValue;
      spyOn(quarantine, 'blur');
      this.blocks.wrapper.click();
      expect(quarantine.blur).toHaveBeenCalled();
    });

    describe('when "saving" bad inputs,', function() {
      beforeEach(async function() {
        this.literal.element.dispatchEvent(dblclick());
        await wait(DELAY);
        let quarantine = this.trackQuarantine.calls.mostRecent().returnValue;
        let selection = window.getSelection();
        expect(selection.rangeCount).toEqual(1);
        let range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode('"moo'));
        quarantine.dispatchEvent(blur());
      });

      it('should not save anything & set all error state', function() {
        let quarantine = this.trackQuarantine.calls.mostRecent().returnValue;
        expect(this.cm.replaceRange).not.toHaveBeenCalled();
        expect(quarantine.classList).toContain('blocks-error');
        expect(quarantine.title).toBe('Error: parse error');
        expect(this.blocks.hasInvalidEdit).toBe(quarantine);
      });
    });

    describe('when dealing with whitespace,', function() {
      beforeEach(function() {
        this.cm.setValue('(+ 1 2) (+)');
        this.firstRoot = this.blocks.ast.rootNodes[0];
        this.firstArg = this.blocks.ast.rootNodes[0].args[0];
        this.whiteSpaceEl = this.firstArg.element.nextElementSibling;
        this.blank = this.blocks.ast.rootNodes[1];
        this.blankWS = this.blank.element.querySelectorAll('.blocks-white-space')[0];
      });

      it('Ctrl-[ should jump to the left of a top-level node', function() {
        this.firstRoot.element.dispatchEvent(click());
        this.firstRoot.element.dispatchEvent(keydown(LEFTBRACKET, {ctrlKey: true}));
        let cursor = this.cm.getCursor();
        expect(cursor.line).toBe(0);
        expect(cursor.ch).toBe(0);
      });

      it('Ctrl-] should jump to the right of a top-level node', function() {
        this.firstRoot.element.dispatchEvent(click());
        this.firstRoot.element.dispatchEvent(keydown(RIGHTBRACKET, {ctrlKey: true}));
        let cursor = this.cm.getCursor();
        expect(cursor.line).toBe(0);
        expect(cursor.ch).toBe(7);
      });

      it('Ctrl-[ should activate a quarantine to the left', async function() {
        this.firstArg.element.dispatchEvent(click());
        this.firstArg.element.dispatchEvent(keydown(LEFTBRACKET, {ctrlKey: true}));
        await wait(DELAY);
        expect(this.blocks.makeQuarantineAt).toHaveBeenCalled();
      });

      it('Ctrl-] should activate a quarantine to the right', async function() {
        this.firstArg.element.dispatchEvent(click());
        this.firstArg.element.dispatchEvent(keydown(RIGHTBRACKET, {ctrlKey: true}));
        await wait(DELAY);
        expect(this.blocks.makeQuarantineAt).toHaveBeenCalled();
      });

      it('Ctrl-] should activate a quarantine in the first arg position', async function() {
        this.blank.func.element.dispatchEvent(click());
        this.blank.func.element.dispatchEvent(keydown(RIGHTBRACKET, {ctrlKey: true}));
        await wait(DELAY);
        expect(this.blocks.makeQuarantineAt).toHaveBeenCalled();
      });

      it('should activate a quarantine on dblclick', async function() {
        this.whiteSpaceEl.dispatchEvent(dblclick());
        await wait(DELAY);
        expect(this.blocks.makeQuarantineAt).toHaveBeenCalled();
      });

      describe('in corner-cases with no arguments,', function() {
        beforeEach(function() {
          this.cm.setValue('(f)');
          this.firstRoot = this.blocks.ast.rootNodes[0];
          this.func = this.blocks.ast.rootNodes[0].func;
          this.wsAfterFunc = this.func.element.nextElementSibling;
          this.argWS = this.firstRoot.element.getElementsByClassName('blocks-args')[0].firstChild;
        }); 

        it('should allow editing the argument whitespace', async function() {
          this.argWS.dispatchEvent(dblclick());
          await wait(DELAY);
          expect(this.blocks.makeQuarantineAt).toHaveBeenCalled();
        }); 

        it('should allow editing the whitespace after the function', async function() {
          this.wsAfterFunc.dispatchEvent(dblclick());
          await wait(DELAY);
          expect(this.blocks.makeQuarantineAt).toHaveBeenCalled();
        });

      });

      describe('and specifically when editing it,', function() {
        
        
        // fails nondeterministically - figure out how to avoid 
        // see https://github.com/bootstrapworld/codemirror-blocks/issues/123
        it('should save whiteSpace on blur', async function() {
          this.whiteSpaceEl.dispatchEvent(dblclick());
          await wait(DELAY);
          expect(this.trackQuarantine).toHaveBeenCalledWith("", this.whiteSpaceEl);
          let quarantine = this.trackQuarantine.calls.mostRecent().returnValue;
          let trackOnBlur = spyOn(quarantine, 'onblur').and.callThrough();
          quarantine.appendChild(document.createTextNode('4253'));
          quarantine.dispatchEvent(blur());
          await wait(DELAY);
          expect(trackOnBlur).toHaveBeenCalled();
          expect(this.trackSaveEdit).toHaveBeenCalledWith(quarantine);
          expect(quarantine.textContent).toBe('4253'); // confirms text=4253 inside saveEdit, blocks.js line 495
          expect(this.trackCommitChange).toHaveBeenCalled();
          expect(this.trackReplaceRange).toHaveBeenCalledWith(' 4253', Object({ ch: 4, line: 0 }), Object({ ch: 4, line: 0 }));
          expect(this.cm.getValue()).toBe('(+ 1 4253 2) (+)');
          expect(this.blocks.hasInvalidEdit).toBe(false);
        });
        
        
        it('should blur whitespace you are editing on enter', async function() {
          this.whiteSpaceEl.dispatchEvent(dblclick());
          let quarantine = this.trackQuarantine.calls.mostRecent().returnValue;
          await wait(DELAY);
          quarantine.dispatchEvent(keydown(ENTER));
          expect(this.trackHandleChange).toHaveBeenCalled();
        });

        describe('when "saving" bad whitepspace inputs,', function() {
          beforeEach(async function() {
            this.whiteSpaceEl.dispatchEvent(dblclick());
            await wait(DELAY);
            this.quarantine = this.trackQuarantine.calls.mostRecent().returnValue;
            this.quarantine.appendChild(document.createTextNode('"moo'));
            this.quarantine.dispatchEvent(blur());
          });

          
          // fails nondeterministically - figure out how to avoid
          // see https://github.com/bootstrapworld/codemirror-blocks/issues/123
          it('should not save anything & set all error state', async function() {
            expect(this.trackSaveEdit).toHaveBeenCalledWith(this.quarantine);
            expect(this.quarantine.textContent).toBe('"moo');
            expect(this.cm.replaceRange).not.toHaveBeenCalled();
            expect(this.quarantine.classList).toContain('blocks-error');
            expect(this.quarantine.title).toBe('Error: parse error');
            expect(this.blocks.hasInvalidEdit).toBe(true);
          });
          
        });
      });
    });

    describe('when dealing with dragging,', function() {
      beforeEach(function() {
        this.cm.setValue('(+ 1 2 3)');
        this.funcSymbol = this.blocks.ast.rootNodes[0].func;
        this.firstArg = this.blocks.ast.rootNodes[0].args[0];
        this.secondArg = this.blocks.ast.rootNodes[0].args[1];
        this.dropTargetEls = this.blocks.ast.rootNodes[0].element.querySelectorAll(
          '.blocks-drop-target'
        );
      });

      it('should set the right drag data on dragstart', function() {
        this.firstArg.element.dispatchEvent(dragstart());
        expect(this.firstArg.element.classList).toContain('blocks-dragging');
      });

      it('should set the right css class on dragenter', function() {
        this.dropTargetEls[3].dispatchEvent(dragenter());
        expect(this.dropTargetEls[3].classList).toContain('blocks-over-target');
      });

      it('should set the right css class on dragleave', function() {
        this.dropTargetEls[3].dispatchEvent(dragenter());
        this.dropTargetEls[3].dispatchEvent(dragleave());
        expect(this.dropTargetEls[3].classList).not.toContain('blocks-over-target');
      });

      it('should do nothing when dragging over a non-drop target', function() {
        this.blocks.ast.rootNodes[0].element.dispatchEvent(dragenter());
        expect(this.blocks.ast.rootNodes[0].element.classList).not.toContain('blocks-over-target');
      });

      it('should do nothing when dropping onto a non-drop target', function() {
        let dragEvent = dragstart();
        this.firstArg.element.dispatchEvent(dragEvent);
        var initialValue = this.cm.getValue();
        this.blocks.ast.rootNodes[0].element.dispatchEvent(drop(dragEvent.dataTransfer));
        expect(this.cm.getValue()).toBe(initialValue);
      });

      it('should update the text on drop to a later point in the file', function() {
        expect(this.dropTargetEls[4].classList).toContain('blocks-drop-target');
        // drag the first arg to the drop target
        let dragEvent = dragstart();
        this.firstArg.element.dispatchEvent(dragEvent);
        this.dropTargetEls[4].dispatchEvent(drop(dragEvent.dataTransfer));
        expect(this.cm.getValue().replace(/\s+/, ' ')).toBe('(+ 2 1 3)');
      });

      it('should update the text on drop to an earlier point in the file', function() {
        let dragEvent = dragstart();
        this.secondArg.element.dispatchEvent(dragEvent);
        this.dropTargetEls[1].dispatchEvent(drop(dragEvent.dataTransfer));
        expect(this.cm.getValue().replace('  ', ' ')).toBe('(+ 2 1 3)');
      });

      it('should call willInsertNode before text is dropped and didInsertNode afterwards',
        function() {
          let dragEvent = dragstart();
          spyOn(this.blocks, 'didInsertNode').and.callThrough();
          this.secondArg.element.dispatchEvent(dragEvent);
          this.dropTargetEls[1].dispatchEvent(drop(dragEvent.dataTransfer));
          expect(this.trackWillInsertNode).toHaveBeenCalled();
          expect(this.blocks.didInsertNode).toHaveBeenCalled();
        }
      );

      it('should move an item to the top level when dragged outside a node', function() {
        let dragEvent = dragstart();
        this.secondArg.element.dispatchEvent(dragEvent);
        let dropEvent = drop(dragEvent.dataTransfer);
        let nodeEl = this.blocks.ast.rootNodes[0].el;
        let wrapperEl = this.cm.getWrapperElement();
        dropEvent.pageX = wrapperEl.offsetLeft + wrapperEl.offsetWidth - 10;
        dropEvent.pageY = nodeEl.offsetTop + wrapperEl.offsetHeight - 10;
        nodeEl.parentElement.dispatchEvent(dropEvent);
        expect(this.cm.getValue().replace('  ', ' ')).toBe('(+ 1 3) 2');
      });

      it('should replace a literal that you drag onto', function() {
        let dragEvent = dragstart();
        this.firstArg.element.dispatchEvent(dragEvent);
        this.secondArg.element.dispatchEvent(drop(dragEvent.dataTransfer));
        expect(this.cm.getValue().replace(/\s+/, ' ')).toBe('(+ 1 3)');
      });

      it('should support dragging plain text to replace a literal', function() {
        let dragEvent = dragstart();
        dragEvent.dataTransfer.setData('text/plain', '5000');
        this.firstArg.element.dispatchEvent(drop(dragEvent.dataTransfer));
        expect(this.cm.getValue().replace(/\s+/, ' ')).toBe('(+ 5000 2 3)');
      });

      it('should support dragging plain text onto some whitespace', function() {
        let dragEvent = dragstart();
        dragEvent.dataTransfer.setData('text/plain', '5000');
        let dropEvent = drop(dragEvent.dataTransfer);
        let nodeEl = this.blocks.ast.rootNodes[0].el;
        let wrapperEl = this.cm.getWrapperElement();
        dropEvent.pageX = wrapperEl.offsetLeft + wrapperEl.offsetWidth - 10;
        dropEvent.pageY = nodeEl.offsetTop + wrapperEl.offsetHeight - 10;
        nodeEl.parentElement.dispatchEvent(dropEvent);
        expect(this.cm.getValue().replace('  ', ' ')).toBe('(+ 1 2 3)\n5000');
      });
    });*/
  });
});