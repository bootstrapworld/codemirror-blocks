import CodeMirrorBlocks from '../src/CodeMirrorBlocks';
import wescheme from '../src/languages/wescheme';
import {store} from '../src/store';
import 'codemirror/addon/search/searchcursor.js';
/* eslint-disable */ //temporary
import { keydown } from './support/events';

import {
  click as sclick,
  doubleClick as sdoubleClick,
  blur as sblur,
  keyDown as skeyDown,
  keyPress as skeyPress,
  insertText as sinsertText,
} from './support/simulate';

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

import {wait, cleanupAfterTest} from './support/test-utils';

// ms delay to let the DOM catch up before testing
const DELAY = 500;
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
    this.blocks.blocks.setBlockMode(true);

    console.log("BLOCKS:", this.blocks);
    console.log("AST:", this.blocks.blocks.getAst());
  });

  afterEach(function() {
    cleanupAfterTest('root', store);
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
      tempBlocks.blocks.setBlockMode(true);
      const ast = tempBlocks.blocks.getAst();
      expect(tempBlocks.blocks.getBlockMode()).toBe(true); //broken
      expect(ast.rootNodes.length).toBe(0);
      // expect(state.collapsedList.length).toBe(0);
      // expect(state.cur).toBe(null);
      // expect(state.errorId).toBe("");
      // expect(state.focusId).toBe(-1);
      // expect(state.quarantine).toBe(null);
      // expect(state.selections.length).toBe(0);

      document.body.removeChild(document.getElementById('temp'));
    });

    it("should set block mode to false", function() {
      this.blocks.blocks.setBlockMode(false);
      expect(this.blocks.blocks.getBlockMode()).toBe(false);
    });
  });

  // Should we make the language prop accessible externally so we can run this?
  // it('should optionally take a language object', function() {
  //   const b = new CodeMirrorBlocks(document.getElementById('root'), example, "");
  //   expect(b.language.id).toBe('example');
  // });

  describe('events,', function() {
    beforeEach(async function() {
      this.blocks.cm.setValue('11');
      await wait(DELAY);
      this.blocks.blocks.setBlockMode(true);
      // this.ast = this.blocks.blocks.getAst();
      this.literal = this.blocks.blocks.getAst().rootNodes[0];
    });

    describe("when dealing with top-level input,", function() {

      beforeEach(async function() {
        this.blocks.cm.setValue('42 11');
        await wait(DELAY);
      });

      /*it('typing at the end of a line', function() {
        this.blocks.cm.setCursor({line: 0, ch: 5});
        // this.blocks.cm.getInputField().dispatchEvent(keydown(57));
        skeyDown("9", {}, this.blocks.cm.getInputField());
        sinsertText("9");
        expect(this.blocks.cm.getValue()).toEqual('42 119');
      });*/

      it('typing at the beginning of a line', function() {
        this.blocks.cm.setCursor({line: 0, ch: 0});
        this.blocks.cm.getInputField().dispatchEvent(keydown(57));
        skeyDown("9", {}, this.blocks.cm.getInputField());
        sinsertText("9");
        expect(this.blocks.cm.getValue()).toEqual('942 11');
      });

      it('typing between two blocks on a line', function() {
        this.blocks.cm.setCursor({line: 0, ch: 3});
        this.blocks.cm.getInputField().dispatchEvent(keydown(57));
        skeyDown("9", {}, this.blocks.cm.getInputField());
        sinsertText("9");
        expect(this.blocks.cm.getValue()).toEqual('42 911');
      });

      // TODO: figure out how to fire a paste event
    });
    
    /*it('should begin editing a node on double click', async function() { /////
      // this.literal.element.dispatchEvent(dblclick());
      sdoubleClick(this.literal.element);
      await wait(DELAY);
      expect(document.activeElement.classList).toContain('blocks-editing');
      expect(document.activeElement.contentEditable).toBe('true');
    });*/
    
    /*it('should save a valid, edited node on blur', async function() {
      this.literal.element.dispatchEvent(dblclick());
      sdoubleClick(this.literal.element);
      await wait(DELAY);
      let quarantine = document.activeElement;//this.trackSetQuarantine.calls.mostRecent().returnValue;
      let selection = window.getSelection();
      expect(selection.rangeCount).toEqual(1);
      let range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode('9'));
      expect(this.blocks.cm.getValue()).toEqual('11');
      quarantine.dispatchEvent(blur());
      await wait(DELAY);
      // not sure of the updated React way to do this
      // expect(this.trackSaveEdit).toHaveBeenCalledWith(quarantine);
      expect(this.blocks.cm.getValue()).toEqual('9');
      // expect(this.blocks.hasInvalidEdit).toBe(false);
    });*/
    
    it('should return the node being edited on esc', async function() {
      sdoubleClick(this.literal.element);
      await wait(DELAY);
      const quarantine = document.activeElement;
      quarantine.dispatchEvent(keydown(ESC));
      skeyDown("Escape", {}, quarantine);
      expect(this.blocks.cm.getValue()).toEqual('11');
    });
    
    /*it('should blur the node being edited on enter', async function() {
      this.literal.element.dispatchEvent(dblclick());
      sdoubleClick(this.literal.element);
      await wait(DELAY);
      let quarantine = document.activeElement;
      spyOn(quarantine, 'blur');
      quarantine.dispatchEvent(keydown(ENTER));
      skeyDown("Enter", {}, quarantine);
      expect(quarantine.blur).toHaveBeenCalled();
    });*/
    
    /*it('should blur the node being edited on top-level click', async function() {
      this.literal.element.dispatchEvent(dblclick());
      sdoubleClick(this.literal.element);
      await wait(DELAY);
      let quarantine = document.activeElement;
      spyOn(quarantine, 'blur');
      this.blocks.cm.getScrollerElement().click();
      //sclick(this.blocks.getWrapperElement());
      expect(quarantine.blur).toHaveBeenCalled();
    })*/;

    describe('when "saving" bad inputs,', function() {
      beforeEach(async function() {
        spyOn(this.blocks.cm, 'replaceRange');
        sdoubleClick(this.literal.element);
        await wait(DELAY);
        let quarantine = document.activeElement;
        let selection = window.getSelection();
        expect(selection.rangeCount).toEqual(1);
        let range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode('"moo'));
        quarantine.dispatchEvent(blur());
        sblur(quarantine);
      });

      /*it('should not save anything & set all error state', function() {
        let quarantine = document.activeElement;//this.trackSetQuarantine.calls.mostRecent().returnValue;
        expect(this.blocks.cm.replaceRange).not.toHaveBeenCalled();
        expect(quarantine.classList).toContain('blocks-error');
        expect(quarantine.title).toBe('Error: parse error');
        expect(this.blocks.hasInvalidEdit).toBe(quarantine);
      });*/
    });

    describe('when dealing with whitespace,', function() {
      beforeEach(async function() {
        this.blocks.cm.setValue('(+ 1 2) (+)');
        await wait(DELAY)
        this.ast = this.blocks.blocks.getAst();
        this.firstRoot = this.ast.rootNodes[0];
        this.firstArg = this.ast.rootNodes[0].args[0];
        this.whiteSpaceEl = this.firstArg.element.nextElementSibling;
        this.blank = this.ast.rootNodes[1];
        this.blankWS = this.blank.element.querySelectorAll('.blocks-white-space')[0];
      });

      it('Ctrl-[ should jump to the left of a top-level node', function() {
        sclick(this.firstRoot.element);
        skeyDown("[", {ctrlKey: true}, this.firstRoot.element);
        let cursor = this.blocks.cm.getCursor();
        expect(cursor.line).toBe(0);
        expect(cursor.ch).toBe(0);
      });
      
      it('Ctrl-] should jump to the right of a top-level node', function() {
        sclick(this.firstRoot.element);
        skeyDown("]", {ctrlKey: true}, this.firstRoot.element);
        let cursor = this.blocks.cm.getCursor();
        expect(cursor.line).toBe(0);
        expect(cursor.ch).toBe(7);
      });
      
      it('Ctrl-[ should activate a quarantine to the left', async function() {
        sclick(this.firstArg.element);
        skeyDown("[", {ctrlKey: true}, this.firstArg.element);
        await wait(DELAY);
        // expect(this.blocks.makeQuarantineAt).toHaveBeenCalled(); //old assertion
        //expect(this.blocks.testing.setQuarantine).toHaveBeenCalled();
      });
      
      it('Ctrl-] should activate a quarantine to the right', async function() {
        sclick(this.firstArg.element);
        skeyDown("]", {ctrlKey: true}, this.firstArg.element);
        await wait(DELAY);
        // expect(this.blocks.makeQuarantineAt).toHaveBeenCalled();
        //expect(this.blocks.testing.setQuarantine).toHaveBeenCalled();
      });
      
      it('Ctrl-] should activate a quarantine in the first arg position', async function() {
        sclick(this.blank.func.element);
        skeyDown("]", {ctrlKey: true}, this.blank.func.element);
        await wait(DELAY);
        // expect(this.blocks.makeQuarantineAt).toHaveBeenCalled();
        //expect(this.blocks.testing.setQuarantine).toHaveBeenCalled();
      });
      
      it('should activate a quarantine on dblclick', async function() {
        sdoubleClick(this.whiteSpaceEl);
        await wait(DELAY);
        // expect(this.blocks.makeQuarantineAt).toHaveBeenCalled();
        //expect(this.blocks.testing.setQuarantine).toHaveBeenCalled();
      });
      
      describe('in corner-cases with no arguments,', function() {
        beforeEach(async function() {
          this.blocks.cm.setValue('(f)');
          await wait(DELAY);
          this.ast = this.blocks.blocks.getAst();
          this.firstRoot = this.ast.rootNodes[0];
          this.func = this.ast.rootNodes[0].func;
          this.wsAfterFunc = this.func.element.nextElementSibling;
          this.argWS = this.firstRoot.element.getElementsByClassName('blocks-args')[0].firstChild;
        }); 
        
        it('should allow editing the argument whitespace', async function() { /* left off here*/
          sdoubleClick(this.argWS);
          await wait(DELAY);
          // expect(this.blocks.makeQuarantineAt).toHaveBeenCalled();
          //expect(this.blocks.testing.setQuarantine).toHaveBeenCalled();
        }); 
        
        it('should allow editing the whitespace after the function', async function() {
          sdoubleClick(this.wsAfterFunc);
          await wait(DELAY);
          // expect(this.blocks.makeQuarantineAt).toHaveBeenCalled();
          //expect(this.blocks.testing.setQuarantine).toHaveBeenCalled();
        });
        
      });

      describe('and specifically when editing it,', function() {
        
        // fails nondeterministically - figure out how to avoid 
        // see https://github.com/bootstrapworld/codemirror-blocks/issues/123
        // it('should save whiteSpace on blur', async function() {
        //   this.whiteSpaceEl.dispatchEvent(dblclick());
        //   await wait(DELAY);
        //   expect(this.trackSetQuarantine).toHaveBeenCalledWith("", this.whiteSpaceEl);
        //   let quarantine = this.trackSetQuarantine.calls.mostRecent().returnValue;
        //   let trackOnBlur = spyOn(quarantine, 'onblur').and.callThrough();
        //   quarantine.appendChild(document.createTextNode('4253'));
        //   quarantine.dispatchEvent(blur());
        //   await wait(DELAY);
        //   expect(trackOnBlur).toHaveBeenCalled();
        //   expect(this.trackSaveEdit).toHaveBeenCalledWith(quarantine);
        //   expect(quarantine.textContent).toBe('4253'); // confirms text=4253 inside saveEdit, blocks.js line 495
        //   expect(this.trackCommitChange).toHaveBeenCalled();
        //   expect(this.trackReplaceRange).toHaveBeenCalledWith(' 4253', Object({ ch: 4, line: 0 }), Object({ ch: 4, line: 0 }));
        //   expect(this.blocks.cm.getValue()).toBe('(+ 1 4253 2) (+)');
        //   expect(this.blocks.hasInvalidEdit).toBe(false);
        // });

        // not sure how to handle trackChange
        // it('should blur whitespace you are editing on enter', async function() {
        //   this.whiteSpaceEl.dispatchEvent(dblclick());
        //   let quarantine = this.trackSetQuarantine.calls.mostRecent().returnValue;
        //   await wait(DELAY);
        //   quarantine.dispatchEvent(keydown(ENTER));
        //   expect(this.trackHandleChange).toHaveBeenCalled();
        // });

        describe('when "saving" bad whitepspace inputs,', function() {
          beforeEach(async function() {
            // this.whiteSpaceEl.dispatchEvent(dblclick());
            // await wait(DELAY);
            // this.quarantine = this.trackSetQuarantine.calls.mostRecent().returnValue;
            // this.quarantine.appendChild(document.createTextNode('"moo'));
            // this.quarantine.dispatchEvent(blur());
          });

          
          // fails nondeterministically - figure out how to avoid
          // see https://github.com/bootstrapworld/codemirror-blocks/issues/123
          // it('should not save anything & set all error state', async function() {
          //   expect(this.trackSaveEdit).toHaveBeenCalledWith(this.quarantine);
          //   expect(this.quarantine.textContent).toBe('"moo');
          //   expect(this.blocks.replaceRange).not.toHaveBeenCalled();
          //   expect(this.quarantine.classList).toContain('blocks-error');
          //   expect(this.quarantine.title).toBe('Error: parse error');
          //   expect(this.blocks.hasInvalidEdit).toBe(true);
          // });
          
        });
      });
    });
  });
});
