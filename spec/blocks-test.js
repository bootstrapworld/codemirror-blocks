import CodeMirrorBlocks, {BlockMarker} from 'codemirror-blocks/blocks';
import CodeMirror from 'codemirror';
import ExampleParser from 'codemirror-blocks/languages/example/ExampleParser';
import {addLanguage} from 'codemirror-blocks/languages';

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
} from './events';

// keycodes
const LEFT_KEY  = 37;
const UP_KEY    = 38;
const RIGHT_KEY = 39;
const DOWN_KEY  = 40;
const DELETE_KEY=  8;
const ENTER_KEY = 13;
const SPACE_KEY = 32;
const HOME_KEY  = 36;
const END_KEY   = 35;
const ESC_KEY   = 27;
const LEFTBRACE = 219;
const RIGHTBRACE= 221;

// ms delay to let the DOM catch up before testing
const DELAY = 750;

describe('The CodeMirrorBlocks Class', function() {
  beforeEach(function() {
    document.body.innerHTML = `
      <textarea id="code"></textarea>
      <div id="toolbar"></div>
    `;
    this.cm = CodeMirror.fromTextArea(document.getElementById("code"));
    this.parser = new ExampleParser();
    this.willInsertNode = (sourceNodeText, sourceNode, destination) => {
      let line = this.cm.getLine(destination.line);
      let prev = line[destination.ch - 1] || '\n';
      let next = line[destination.ch] || '\n';
      sourceNodeText = sourceNodeText.trim();
      if (!/\s|[\(\[\{]/.test(prev)) {
        sourceNodeText = ' ' + sourceNodeText;
      }
      if (!/\s|[\)\]\}]/.test(next)) {
        sourceNodeText += ' ';
      }
      return sourceNodeText;
    };

    this.didInsertNode = function() {};
    this.blocks = new CodeMirrorBlocks(
      this.cm,
      this.parser,
      {
        willInsertNode: this.willInsertNode,
        didInsertNode: this.didInsertNode,
        toolbar: document.getElementById('toolbar')
      }
    );
    spyOn(this.blocks, 'insertionQuarantine').and.callThrough();
    spyOn(this.blocks, 'handleChange').and.callThrough();
    spyOn(this.cm,     'replaceRange').and.callThrough();
  });
  
  describe('constructor,', function() {

    it("should take a codemirror instance and a parser instance", function() {
      expect(this.blocks.cm).toBe(this.cm);
      expect(this.blocks.parser).toBe(this.parser);
      expect(this.blocks.ast).toBe(null);
      expect(this.blocks.blockMode).toBe(false);
    });

    it("should set block mode to be disabled", function() {
      expect(this.blocks.blockMode).toBe(false);
    });
  });

  describe('constructor,', function() {
    it('should optionally take a string identifier for a built in language', function() {
      expect(() => new CodeMirrorBlocks(this.cm, 'foo')).toThrowError(
        'Could not create CodeMirrorBlocks instance. Unknown language: "foo"'
      );
      addLanguage(
        {
          id: 'foo',
          name: 'Foo',
          getParser: () => {
            return this.parser;
          }
        }
      );
      var blocks = new CodeMirrorBlocks(this.cm, 'foo');
      expect(blocks.language.name).toBe('Foo');
      expect(blocks.parser).toBe(this.parser);
    });
  });

  describe('text marking api,', function() {
    beforeEach(function() {
      this.cm.setValue('11 12 (+ 3 4 5)');
      this.blocks.toggleBlockMode();
      this.literal1 = this.blocks.ast.rootNodes[0];
      this.literal2 = this.blocks.ast.rootNodes[1];
      this.expression = this.blocks.ast.rootNodes[2];
    });

    it("should allow you to mark nodes with the markText method", function() {
      this.blocks.markText(this.literal1.from, this.literal1.to, {css:"color: red"});
      expect(this.literal1.el.style.color).toBe('red');
    });

    it("should return a BlockMarker object", function() {
      let mark = this.blocks.markText(this.literal1.from, this.literal1.to, {css:"color: red"});
      expect(mark).toEqual(jasmine.any(BlockMarker));
    });

    it("it should allow you to set a className value", function() {
      this.blocks.markText(this.expression.from, this.expression.to, {className:"error"});
      expect(this.expression.el.className).toMatch(/error/);
    });

    it("it should allow you to set a className on a child node", function() {
      let child = this.expression.args[2];
      this.blocks.markText(child.from, child.to, {className:"error"});
      expect(child.el.className).toMatch(/error/);
      expect(this.expression.el.className).not.toMatch(/error/);
    });

    it("it should allow you to set a title value", function() {
      this.blocks.markText(this.expression.from, this.expression.to, {title:"woot"});
      expect(this.expression.el.title).toBe("woot");
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
        );
      });

      it("should expose a clear function to remove the mark", function() {
        this.mark.clear();
        expect(this.literal1.el.style.color).toBeFalsy();
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

  describe('renderer,', function() {

    it("should render itself when block mode is turned on", function() {
      spyOn(this.blocks.renderer, 'animateTransition').and.callThrough();
      this.blocks.toggleBlockMode();
      expect(this.blocks.blockMode).toBe(true);
      expect(this.blocks.ast).not.toBe(null);
      expect(this.blocks.ast.rootNodes).toEqual([]);
      expect(this.blocks.renderer.animateTransition).toHaveBeenCalled();
    });

    it("should do nothing if block mode does not change", function() {
      this.blocks.setBlockMode(true);
      spyOn(this.blocks, 'render');
      this.blocks.setBlockMode(true);
      expect(this.blocks.render).not.toHaveBeenCalled();
    });

    it("should automatically re-render when the content changes", function() {
      spyOn(this.blocks.renderer, 'render');
      this.blocks.toggleBlockMode();

      // change the document once...
      this.cm.setValue('11');
      expect(this.blocks.ast.rootNodes.length).toBe(1);
      expect(this.blocks.ast.rootNodes[0].type).toBe('literal');
      expect(this.blocks.ast.rootNodes[0].value).toBe(11);
      expect(this.blocks.renderer.render).toHaveBeenCalled();
      expect(this.blocks.renderer.render).toHaveBeenCalledWith(
        this.blocks.ast.rootNodes[0]
      );
      this.blocks.renderer.render.calls.reset();

      // change the document again
      this.cm.setValue('5432');

      expect(this.blocks.ast.rootNodes.length).toBe(1);
      expect(this.blocks.ast.rootNodes[0].type).toBe('literal');
      expect(this.blocks.ast.rootNodes[0].value).toBe(5432);
      expect(this.blocks.renderer.render).toHaveBeenCalled();
      expect(this.blocks.renderer.render).toHaveBeenCalledWith(
        this.blocks.ast.rootNodes[0]
      );
    });

    it('should unrender itself when block mode is turned off', function() {
      this.blocks.setBlockMode(true);
      this.cm.setValue('1');
      expect(this.cm.getAllMarks().length).toBe(1);
      this.blocks.setBlockMode(false);
      expect(this.cm.getAllMarks().length).toBe(0);
    });
  });
  
  describe('events,', function() {
    beforeEach(function() {
      this.cm.setValue('11');
      this.blocks.setBlockMode(true);
      this.literal = this.blocks.ast.rootNodes[0];
    });

    describe("when dealing with top-level input,", function() {

      beforeEach(function() {
        this.cm.setValue('42 11');
      });

      it('typing at the end of a line', function() {
        this.cm.setCursor({line: 0, ch: 5});
        this.cm.getInputField().dispatchEvent(keypress(100));
        expect(this.blocks.insertionQuarantine).toHaveBeenCalled();
      });

      it('typing at the beginning of a line', function() {
        this.cm.setCursor({line: 0, ch: 0});
        this.cm.getInputField().dispatchEvent(keypress(100));
        expect(this.blocks.insertionQuarantine).toHaveBeenCalled();
      });

      it('typing between two blocks on a line', function() {
        this.cm.setCursor({line: 0, ch: 3});
        this.cm.getInputField().dispatchEvent(keypress(100));
        expect(this.blocks.insertionQuarantine).toHaveBeenCalled();
      });

      // TODO: figure out how to fire a paste event
    });

    describe("when dealing with node activation,", function() {

      beforeEach(function() {
        this.cm.setValue('11 54');
        this.literal = this.blocks.ast.rootNodes[0];
        this.literal2 = this.blocks.ast.rootNodes[1];
      });

      it('should only allow one node to be active at a time', function() {
        this.literal.el.dispatchEvent(click());
        this.literal2.el.dispatchEvent(click());
        expect(this.blocks.getActiveNode()).not.toBe(this.literal);
        expect(this.blocks.getActiveNode()).toBe(this.literal2);
      });

      it('should put focus on the active node', function() {
        this.literal.el.dispatchEvent(click());
        expect(document.activeElement).toBe(this.literal.el);
        expect(this.blocks.scroller.getAttribute('aria-activedescendent')).toBe(this.literal.el.id);
      });

      it('should not delete active nodes when the delete key is pressed', function(done) {
        expect(this.cm.getValue()).toBe('11 54');
        this.literal.el.dispatchEvent(click());
        expect(this.blocks.getActiveNode()).toBe(this.literal);
        this.cm.getWrapperElement().dispatchEvent(keydown(DELETE_KEY));
        setTimeout(() => {
          expect(this.cm.getValue()).toBe('11 54');
          done();  
        }, DELAY);
        
      });

      it('should activate the first node when down is pressed', function() {
        this.cm.getWrapperElement().dispatchEvent(keydown(DOWN_KEY));
        expect(this.blocks.getActiveNode()).toBe(this.literal);
        expect(this.blocks.scroller.getAttribute('aria-activedescendent')).toBe(this.literal.el.id);
      });

      it('should activate the next node when down is pressed', function() {
        this.cm.getWrapperElement().dispatchEvent(keydown(DOWN_KEY));
        this.cm.getWrapperElement().dispatchEvent(keydown(DOWN_KEY));
        expect(this.blocks.getActiveNode()).not.toBe(this.literal);
        expect(this.blocks.getActiveNode()).toBe(this.literal2);
        expect(this.blocks.scroller.getAttribute('aria-activedescendent')).toBe(this.literal2.el.id);
      });

      it('should activate the node after the cursor when down is pressed', function() {
        this.cm.setCursor({line: 0, ch: 2});
        this.cm.getWrapperElement().dispatchEvent(keydown(DOWN_KEY));
        expect(this.blocks.getActiveNode()).not.toBe(this.literal);
        expect(this.blocks.getActiveNode()).toBe(this.literal2);
        expect(this.blocks.scroller.getAttribute('aria-activedescendent')).toBe(this.literal2.el.id);
      });
      
      it('should activate the node before the cursor when up is pressed', function() {
        this.cm.setCursor({line: 0, ch: 2});
        this.cm.getWrapperElement().dispatchEvent(keydown(UP_KEY));
        expect(this.blocks.getActiveNode()).not.toBe(this.literal2);
        expect(this.blocks.getActiveNode()).toBe(this.literal);
        expect(this.blocks.scroller.getAttribute('aria-activedescendent')).toBe(this.literal.el.id);
      });
      
      it('should toggle the editability of activated node when Enter is pressed', function(done) {
        this.literal.el.dispatchEvent(click());
        expect(this.blocks.getActiveNode()).toBe(this.literal);
        this.literal.el.dispatchEvent(keydown(ENTER_KEY));
        setTimeout(() => {
          expect(this.blocks.insertionQuarantine).toHaveBeenCalled();
          done();  
        }, DELAY);
        
      });

      it('should cancel the editability of activated node when Esc is pressed', function(done) {
        this.literal.el.dispatchEvent(click());
        expect(this.blocks.getActiveNode()).toBe(this.literal);
        this.literal.el.dispatchEvent(keydown(ENTER_KEY));
        setTimeout(() => {
          expect(this.blocks.insertionQuarantine).toHaveBeenCalled();
          done();  
        }, DELAY);
        this.literal.el.dispatchEvent(keydown(68));
        this.literal.el.dispatchEvent(keydown(ESC_KEY));
        expect(this.cm.getValue()).toBe('11 54');
      });

      it('should proxy keydown events on the active node to codemirror', function() {
        spyOn(this.cm, 'execCommand');
        this.literal.el.dispatchEvent(click());
        let event = keydown(90, {ctrlKey: true}); // Ctrl-z: undo
        CodeMirror.keyMap['default']["Ctrl-Z"] = "undo";
        expect(CodeMirror.keyMap['default'][CodeMirror.keyName(event)]).toBe('undo');
        this.literal.el.dispatchEvent(event);
        expect(this.cm.execCommand).toHaveBeenCalledWith('undo');
      });


      describe('cut/copy/paste', function() {
        beforeEach(function() {
          this.literal.el.dispatchEvent(click());            // activate the node,
          this.literal.el.dispatchEvent(keydown(SPACE_KEY)); // then select it
          spyOn(document, 'execCommand');
        });

        it('should remove selected nodes on cut', function(done) {
          document.dispatchEvent(cut());
          setTimeout(() => {
            expect(this.cm.getValue()).toBe(' 54');
            expect(document.execCommand).toHaveBeenCalledWith('cut');
            expect(this.blocks.getActiveNode()).toBe(this.blocks.ast.rootNodes[0]); // focus should shift
            done();
          }, DELAY);
        });

        it('should remove multiple selected nodes on cut', function(done) {
          this.literal.el.dispatchEvent(click());            // activate the node,
          this.literal.el.dispatchEvent(keydown(SPACE_KEY)); // then select it
          this.literal.el.dispatchEvent(keydown(DOWN_KEY, {altKey: true}));
          this.literal2.el.dispatchEvent(keydown(SPACE_KEY, {altKey: true}));
          expect(this.blocks.selectedNodes.size).toBe(2);
          document.dispatchEvent(cut());
          setTimeout(() => {
            expect(this.blocks.selectedNodes.size).toBe(0);
            expect(this.cm.getValue()).toBe(' ');
            expect(document.execCommand).toHaveBeenCalledWith('cut');
            done();
          }, DELAY);
        });

        xit('should create an activeElement with the text to be copied', function() {
          // TODO: figure out how to test this.
        });
      });

      describe('tree navigation', function() {
        beforeEach(function() {
          this.cm.setValue('(+ 1 2 3) 99 (* 7 8)');
          this.firstRoot  = this.blocks.ast.rootNodes[0];
          this.secondRoot = this.blocks.ast.rootNodes[1];
          this.thirdRoot  = this.blocks.ast.rootNodes[2];
          this.funcSymbol = this.blocks.ast.rootNodes[0].func;
          this.firstArg   = this.blocks.ast.rootNodes[0].args[0];
          this.secondArg  = this.blocks.ast.rootNodes[0].args[1];
          this.thirdArg   = this.blocks.ast.rootNodes[0].args[2];
          this.firstRoot.el.dispatchEvent(click());
          this.firstRoot.el.dispatchEvent(keydown(LEFT_KEY));
        });

        it('up-arrow should navigate to the previous visible node, but not beyond it', function() {
          this.secondRoot.el.dispatchEvent(click());
          expect(document.activeElement).toBe(this.secondRoot.el);
          expect(this.blocks.scroller.getAttribute('aria-activedescendent')).toBe(this.secondRoot.el.id);
          this.firstRoot.el.dispatchEvent(keydown(UP_KEY));
          expect(document.activeElement).toBe(this.firstRoot.el);
          expect(this.blocks.scroller.getAttribute('aria-activedescendent')).toBe(this.firstRoot.el.id);
          this.secondRoot.el.dispatchEvent(keydown(UP_KEY));
          expect(document.activeElement).toBe(this.firstRoot.el);
          expect(this.blocks.scroller.getAttribute('aria-activedescendent')).toBe(this.firstRoot.el.id);
        });

        it('down-arrow should navigate to the next sibling, but not beyond it', function() {
          this.thirdRoot.args[0].el.dispatchEvent(click());
          expect(document.activeElement).toBe(this.thirdRoot.args[0].el);
          this.thirdRoot.args[0].el.dispatchEvent(keydown(DOWN_KEY));
          expect(document.activeElement).toBe(this.thirdRoot.args[1].el);
          expect(this.blocks.scroller.getAttribute('aria-activedescendent')).toBe(this.thirdRoot.args[1].el.id);
          this.thirdRoot.args[1].el.dispatchEvent(keydown(DOWN_KEY));
          expect(document.activeElement).toBe(this.thirdRoot.args[1].el);
          expect(this.blocks.scroller.getAttribute('aria-activedescendent')).toBe(this.thirdRoot.args[1].el.id);
        });

        it('left-arrow should collapse a block, if it can be', function() {
          this.firstRoot.el.dispatchEvent(click());
          this.firstRoot.el.dispatchEvent(keydown(LEFT_KEY));
          expect(this.firstRoot.el.getAttribute("aria-expanded")).toBe("false");
          this.secondRoot.el.dispatchEvent(click());
          this.secondRoot.el.dispatchEvent(keydown(LEFT_KEY));
          expect(this.secondRoot.el.getAttribute("aria-expanded")).toBe(null);
        });

        it('left-arrow should collapse a block & activate parent', function() {
          this.secondArg.el.dispatchEvent(click());
          this.secondArg.el.dispatchEvent(keydown(LEFT_KEY));
          expect(this.firstRoot.el.getAttribute("aria-expanded")).toBe("false");
          expect(document.activeElement).toBe(this.firstRoot.el);
        });

        it('right-arrow should expand a block, or shift focus to 1st child', function() {
          this.firstRoot.el.dispatchEvent(click());
          this.firstRoot.el.dispatchEvent(keydown(LEFT_KEY));
          expect(this.firstRoot.el.getAttribute("aria-expanded")).toBe("false");
          this.firstRoot.el.dispatchEvent(keydown(RIGHT_KEY));
          expect(document.activeElement).toBe(this.firstRoot.el);
          expect(this.firstRoot.el.getAttribute("aria-expanded")).toBe("true");
          this.firstRoot.el.dispatchEvent(keydown(RIGHT_KEY));
          expect(this.firstRoot.el.getAttribute("aria-expanded")).toBe("true");
          expect(document.activeElement).toBe(this.funcSymbol.el);
        });

        it('home should activate the first visible node', function() {
          this.secondRoot.el.dispatchEvent(click());
          this.secondRoot.el.dispatchEvent(keydown(HOME_KEY));
          expect(document.activeElement).toBe(this.firstRoot.el);
          expect(this.blocks.scroller.getAttribute('aria-activedescendent')).toBe(this.firstRoot.el.id);
        });

        it('end should activate the last visible node', function() {
          this.secondRoot.el.dispatchEvent(click());
          this.secondRoot.el.dispatchEvent(keydown(END_KEY));
          expect(document.activeElement).toBe(this.thirdRoot.args[1].el);
          expect(this.blocks.scroller.getAttribute('aria-activedescendent')).toBe(this.thirdRoot.args[1].el.id);
        });
      });
    });

    describe("when dealing with node selection, ", function() {

      beforeEach(function() {
        this.cm.setValue('11 54 (+ 1 2)');
        this.literal  = this.blocks.ast.rootNodes[0];
        this.literal2 = this.blocks.ast.rootNodes[1];
        this.expr     = this.blocks.ast.rootNodes[2];
        this.literal.el.dispatchEvent(click());
        this.literal.el.dispatchEvent(keydown(SPACE_KEY));
      });

      it('space key toggles selection on and off', function() {
        expect(this.literal.el.getAttribute("aria-selected")).toBe('true');
        expect(this.blocks.selectedNodes.size).toBe(1);
        this.literal.el.dispatchEvent(keydown(SPACE_KEY));
        expect(this.literal.el.getAttribute("aria-selected")).toBe('false');
        expect(this.blocks.selectedNodes.size).toBe(0);
      });

      it('arrow clears selection & changes active ', function() {
        this.literal.el.dispatchEvent(keydown(DOWN_KEY));
        expect(this.literal.el.getAttribute("aria-selected")).toBe('false');
        expect(this.literal2.el.getAttribute("aria-selected")).toBe('false');
        expect(document.activeElement).toBe(this.literal2.el);
        expect(this.blocks.selectedNodes.size).toBe(0);
      });

      it('alt-arrow preserves selection & changes active ', function() {
        this.literal.el.dispatchEvent(keydown(DOWN_KEY, {altKey: true}));
        expect(this.literal.el.getAttribute("aria-selected")).toBe('true');
        expect(this.literal2.el.getAttribute("aria-selected")).toBe('false');
        expect(document.activeElement).toBe(this.literal2.el);
        expect(this.blocks.selectedNodes.size).toBe(1);
      });

      it('allow multiple, non-contiguous selection ', function() {
        this.literal.el.dispatchEvent(keydown(DOWN_KEY, {altKey: true}));
        this.literal2.el.dispatchEvent(keydown(DOWN_KEY, {altKey: true})); // skip literal2
        this.expr.el.dispatchEvent(keydown(SPACE_KEY, {altKey: true})); // toggle selection on expr
        expect(this.literal.el.getAttribute("aria-selected")).toBe('true');
        expect(this.expr.el.getAttribute("aria-selected")).toBe('true');
        expect(document.activeElement).toBe(this.expr.el);
        expect(this.blocks.selectedNodes.size).toBe(2);
      });

      it('selecting a parent, then child should just select the parent ', function() {
        this.expr.el.dispatchEvent(click());
        this.expr.el.dispatchEvent(keydown(SPACE_KEY));
        this.expr.el.dispatchEvent(keydown(DOWN_KEY, {altKey: true}));
        this.expr.func.el.dispatchEvent(keydown(SPACE_KEY, {altKey: true}));
        expect(this.expr.el.getAttribute("aria-selected")).toBe('true');
        expect(this.expr.func.el.getAttribute("aria-selected")).toBe('false');
        expect(document.activeElement).toBe(this.expr.func.el);
        expect(this.blocks.selectedNodes.size).toBe(1);
      });

      it('selecting a child, then parent should just select the parent ', function() {
        this.expr.func.el.dispatchEvent(click());
        this.expr.func.el.dispatchEvent(keydown(SPACE_KEY));
        this.expr.func.el.dispatchEvent(keydown(UP_KEY, {altKey: true}));
        this.expr.el.dispatchEvent(keydown(SPACE_KEY));
        expect(this.expr.el.getAttribute("aria-selected")).toBe('true');
        expect(this.expr.func.el.getAttribute("aria-selected")).toBe('false');
        expect(document.activeElement).toBe(this.expr.el);
        expect(this.blocks.selectedNodes.size).toBe(1);
      });
    });
    
    it('should begin editing a node on double click', function(done) {
      this.literal.el.dispatchEvent(dblclick());
      setTimeout(() => {
        expect(document.activeElement.classList).toContain('blocks-editing');
        expect(document.activeElement.contentEditable).toBe('true');
        done();
      }, DELAY);
    });
    
    it('should save a valid, edited node on blur', function(done) {
      this.literal.el.dispatchEvent(dblclick());
      setTimeout(() => {
        let selection = window.getSelection();
        expect(selection.rangeCount).toEqual(1);
        let range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode('9'));
        expect(this.cm.getValue()).toEqual('11');
        document.activeElement.dispatchEvent(blur());
        expect(this.cm.getValue()).toEqual('9');
        expect(this.blocks.hasInvalidEdit).toBe(false);
        done();
      }, DELAY);
    });
  
    it('should return the node being edited on esc', function(done) {
      this.literal.el.dispatchEvent(dblclick());
      setTimeout(() => {
        let quarantine = document.activeElement;
        quarantine.dispatchEvent(keydown(ESC_KEY));
        expect(this.cm.getValue()).toEqual('11');
        done();
      }, DELAY);
    });
    
    it('should blur the node being edited on enter', function(done) {
      this.literal.el.dispatchEvent(dblclick());
      setTimeout(() => {
        let quarantine = document.activeElement;
        spyOn(quarantine, 'blur');
        quarantine.dispatchEvent(keydown(ENTER_KEY));
        expect(quarantine.blur).toHaveBeenCalled();
        done();
      }, DELAY);
    });
    
    describe('when "saving" bad inputs,', function() {
      beforeEach(function(done) {
        this.literal.el.dispatchEvent(dblclick());
        setTimeout(() => {
          let selection = window.getSelection();
          expect(selection.rangeCount).toEqual(1);
          let range = selection.getRangeAt(0);
          range.deleteContents();
          range.insertNode(document.createTextNode('"moo'));
          document.activeElement.dispatchEvent(blur());
          done();
        }, DELAY);
      });

      it('should not save anything & set all error state', function() {
        expect(this.cm.replaceRange).not.toHaveBeenCalled();
        expect(document.activeElement.classList).toContain('blocks-error');
        expect(document.activeElement.title).toBe('Error: parse error.\n\nTo cancel this edit, type Shift-Escape');
        expect(this.blocks.hasInvalidEdit).toBe(true);
      });
    });

    describe('when dealing with whitespace,', function() {
      beforeEach(function() {
        this.cm.setValue('(+ 1 2) (+)');
        this.firstRoot = this.blocks.ast.rootNodes[0];
        this.firstArg = this.blocks.ast.rootNodes[0].args[0];
        this.whiteSpaceEl = this.firstArg.el.nextElementSibling;
        this.blank = this.blocks.ast.rootNodes[1];
        this.blankWS = this.blank.el.querySelectorAll('.blocks-white-space')[0];
      });

      it('Ctrl-[ should jump to the left of a top-level node', function() {
        this.firstRoot.el.dispatchEvent(click());
        this.firstRoot.el.dispatchEvent(keydown(LEFTBRACE, {ctrlKey: true}));
        let cursor = this.cm.getCursor();
        expect(cursor.line).toBe(0);
        expect(cursor.ch).toBe(0);
      });
      
      it('Ctrl-] should jump to the right of a top-level node', function() {
        this.firstRoot.el.dispatchEvent(click());
        this.firstRoot.el.dispatchEvent(keydown(RIGHTBRACE, {ctrlKey: true}));
        let cursor = this.cm.getCursor();
        expect(cursor.line).toBe(0);
        expect(cursor.ch).toBe(7);
      });
      
      it('Ctrl-[ should activate a quarantine to the left', function(done) {
        this.firstArg.el.dispatchEvent(click());
        this.firstArg.el.dispatchEvent(keydown(LEFTBRACE, {ctrlKey: true}));
        setTimeout(() => {
          expect(this.blocks.insertionQuarantine).toHaveBeenCalled();
          done();
        }, DELAY);
      });

      it('Ctrl-] should activate a quarantine to the right', function(done) {
        this.firstArg.el.dispatchEvent(click());
        this.firstArg.el.dispatchEvent(keydown(RIGHTBRACE, {ctrlKey: true}));
        setTimeout(() => {
          expect(this.blocks.insertionQuarantine).toHaveBeenCalled();
          done();
        }, DELAY);
      });

      it('Ctrl-] should activate a quarantine in the first arg position', function(done) {
        this.blank.func.el.dispatchEvent(click());
        this.blank.func.el.dispatchEvent(keydown(RIGHTBRACE, {ctrlKey: true}));
        setTimeout(() => {
          expect(this.blocks.insertionQuarantine).toHaveBeenCalled();
          done();
        }, DELAY);
      });
      
      it('should activate a quarantine on dblclick', function(done) {
        this.whiteSpaceEl.dispatchEvent(dblclick());
        setTimeout(() => {
          expect(this.blocks.insertionQuarantine).toHaveBeenCalled();
          done();
        }, DELAY);
      });

      describe('and specifically when editing it,', function() {
        it('should save whiteSpace on blur', function(done) {
          this.whiteSpaceEl.dispatchEvent(dblclick());
          setTimeout(() => {
            let quarantine = document.querySelectorAll('.blocks-editing')[0];
            let selection = window.getSelection();
            expect(selection.rangeCount).toEqual(1);
            let range = selection.getRangeAt(0);
            range.deleteContents();
            range.insertNode(document.createTextNode('4253'));
            quarantine.dispatchEvent(blur());
            expect(this.cm.getValue()).toBe('(+ 1 4253 2) (+)');
            expect(this.blocks.hasInvalidEdit).toBe(false);
            done();
          }, DELAY);
        });
        
        it('should blur whitespace you are editing on enter', function(done) {
          this.whiteSpaceEl.dispatchEvent(dblclick());
          setTimeout(() => {
            document.activeElement.dispatchEvent(keydown(ENTER_KEY));
            expect(this.blocks.handleChange).toHaveBeenCalled();
            done();
          }, DELAY);
        });
        
        describe('when "saving" bad whitepsace inputs,', function() {
          beforeEach(function(done) {
            this.whiteSpaceEl.dispatchEvent(dblclick());
            setTimeout(() => {
              let quarantine = document.querySelectorAll('.blocks-editing')[0];
              let selection = window.getSelection();
              expect(selection.rangeCount).toEqual(1);
              let range = selection.getRangeAt(0);
              range.deleteContents();
              range.insertNode(document.createTextNode('"moo'));
              quarantine.dispatchEvent(blur());
              done();
            }, DELAY);
          });

          it('should not save anything & set all error state', function() {
            let quarantine = document.querySelectorAll('.blocks-editing')[0];
            expect(this.cm.replaceRange).not.toHaveBeenCalled();
            expect(quarantine.classList).toContain('blocks-error');
            expect(quarantine.title).toBe('Error: parse error.\n\nTo cancel this edit, type Shift-Escape');
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
        this.dropTargetEls = this.blocks.ast.rootNodes[0].el.querySelectorAll(
          '.blocks-drop-target'
        );
      });

      it('should set the right drag data on dragstart', function() {
        this.firstArg.el.dispatchEvent(dragstart());
        expect(this.firstArg.el.classList).toContain('blocks-dragging');
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
        this.blocks.ast.rootNodes[0].el.dispatchEvent(dragenter());
        expect(this.blocks.ast.rootNodes[0].el.classList).not.toContain('blocks-over-target');
      });

      it('should do nothing when dropping onto a non-drop target', function() {
        let dragEvent = dragstart();
        this.firstArg.el.dispatchEvent(dragEvent);
        var initialValue = this.cm.getValue();
        this.blocks.ast.rootNodes[0].el.dispatchEvent(drop(dragEvent.dataTransfer));
        expect(this.cm.getValue()).toBe(initialValue);
      });
        
      it('should update the text on drop to a later point in the file', function() {
        expect(this.dropTargetEls[4].classList).toContain('blocks-drop-target');
        // drag the first arg to the drop target
        let dragEvent = dragstart();
        this.firstArg.el.dispatchEvent(dragEvent);
        this.dropTargetEls[4].dispatchEvent(drop(dragEvent.dataTransfer));
        expect(this.cm.getValue().replace(/\s+/, ' ')).toBe('(+ 2 1 3)');
      });

      it('should update the text on drop to an earlier point in the file', function() {
        let dragEvent = dragstart();
        this.secondArg.el.dispatchEvent(dragEvent);
        this.dropTargetEls[1].dispatchEvent(drop(dragEvent.dataTransfer));
        expect(this.cm.getValue().replace('  ', ' ')).toBe('(+ 2 1 3)');
      });

      it('should call willInsertNode before text is dropped and didInsertNode afterwards',
        function() {
          let dragEvent = dragstart();
          spyOn(this.blocks, 'willInsertNode').and.callThrough();
          spyOn(this.blocks, 'didInsertNode').and.callThrough();
          this.secondArg.el.dispatchEvent(dragEvent);
          this.dropTargetEls[1].dispatchEvent(drop(dragEvent.dataTransfer));
          expect(this.blocks.willInsertNode).toHaveBeenCalled();
          expect(this.blocks.didInsertNode).toHaveBeenCalled();
        }
      );

      it('should move an item to the top level when dragged outside a node', function() {
        let dragEvent = dragstart();
        this.secondArg.el.dispatchEvent(dragEvent);
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
        this.firstArg.el.dispatchEvent(dragEvent);
        this.secondArg.el.dispatchEvent(drop(dragEvent.dataTransfer));
        expect(this.cm.getValue().replace(/\s+/, ' ')).toBe('(+ 1 3)');
      });

      it('should support dragging plain text to replace a literal', function() {
        let dragEvent = dragstart();
        dragEvent.dataTransfer.setData('text/plain', '5000');
        this.firstArg.el.dispatchEvent(drop(dragEvent.dataTransfer));
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
    
    });
    
  });
});
