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
    this.blocks.blocks.setBlockMode(true);

    console.log("BLOCKS:", this.blocks);
    console.log("AST:", this.blocks.blocks.getAst());

    this.trackSetQuarantine = spyOn(this.blocks.testing, 'setQuarantine').and.callThrough();
    // this.trackReplaceRange = spyOn(this.blocks,   'replaceRange').and.callThrough();
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

  describe('text marking api,', function() {
    /*
    beforeEach(async function() {
      this.blocks.cm.setValue('11 12 (+ 3 4 5)');
      await wait(DELAY);
      this.ast = this.blocks.blocks.getAst();
      this.state = this.blocks.getState();
      this.blocks.blocks.setBlockMode(true);
      this.literal1 = this.ast.rootNodes[0];
      this.literal2 = this.ast.rootNodes[1];
      this.expression = this.ast.rootNodes[2];
    });

    it("should allow you to mark nodes with the markText method", function() {
      this.blocks.cm.markText(this.literal1.from, this.literal1.to, {css:"color: red"});
      expect(this.literal1.element.style.color).toBe('red');
    });
    it("should return a BlockMarker object", function() {
      let mark = this.blocks.cm.markText(this.literal1.from, this.literal1.to, {css:"color: red"})[0];
      expect(mark).toEqual(jasmine.any(BlockMarker));
    });

    it("it should allow you to set a className value", function() {
      this.blocks.cm.markText(this.expression.from, this.expression.to, {className:"error"});
      expect(this.expression.element.className).toMatch(/error/);
    });

    it("it should allow you to set a className on a child node", function() {
      let child = this.expression.args[2];
      this.blocks.cm.markText(child.from, child.to, {className:"error"});
      expect(child.element.className).toMatch(/error/);
      expect(this.expression.element.className).not.toMatch(/error/);
    });

    it("it should allow you to set a title value", function() {
      this.blocks.cm.markText(this.expression.from, this.expression.to, {title:"woot"});
      expect(this.expression.element.title).toBe("woot");
    });

    describe("which provides some getters,", function() {
      beforeEach(function() {
        this.blocks.cm.markText(this.literal1.from, this.literal1.to, {css:"color: red"});
        this.blocks.cm.markText(this.expression.from, this.expression.to, {title:"woot"});
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
        this.mark = this.blocks.cm.markText(
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
      this.blocks.cm.setValue('11');
      this.blocks.blocks.setBlockMode(true);
      // this.ast = this.blocks.blocks.getAst();
      this.literal = this.blocks.blocks.getAst().rootNodes[0];
    });

    describe("when dealing with top-level input,", function() {

      beforeEach(function() {
        this.blocks.cm.setValue('42 11');
      });

      it('typing at the end of a line', function() {
        this.blocks.cm.setCursor({line: 0, ch: 5});
        // this.blocks.cm.getInputField().dispatchEvent(keydown(57));
        skeyDown("9", {}, this.blocks.cm.getInputField());
        sinsertText("9");
        expect(this.blocks.cm.getValue()).toEqual('42 119');
      });

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
    
    it('should begin editing a node on double click', async function() { /////
      // this.literal.element.dispatchEvent(dblclick());
      sdoubleClick(this.literal.element);
      await wait(DELAY);
      expect(document.activeElement.classList).toContain('blocks-editing');
      expect(document.activeElement.contentEditable).toBe('true');
    });
    
    it('should save a valid, edited node on blur', async function() {
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
    });
    
    it('should return the node being edited on esc', async function() {
      this.literal.element.dispatchEvent(dblclick());
      sdoubleClick(this.literal.element);
      await wait(DELAY);
      const quarantine = document.activeElement;
      quarantine.dispatchEvent(keydown(ESC));
      skeyDown("Escape", {}, quarantine);
      expect(this.blocks.cm.getValue()).toEqual('11');
    });
    
    it('should blur the node being edited on enter', async function() {
      this.literal.element.dispatchEvent(dblclick());
      sdoubleClick(this.literal.element);
      await wait(DELAY);
      let quarantine = document.activeElement;
      spyOn(quarantine, 'blur');
      quarantine.dispatchEvent(keydown(ENTER));
      skeyDown("Enter", {}, quarantine);
      expect(quarantine.blur).toHaveBeenCalled();
    });
    
    it('should blur the node being edited on top-level click', async function() {
      this.literal.element.dispatchEvent(dblclick());
      sdoubleClick(this.literal.element);
      await wait(DELAY);
      let quarantine = document.activeElement;
      spyOn(quarantine, 'blur');
      this.blocks.getWrapperElement().click();
      sclick(this.blocks.getWrapperElement());
      expect(quarantine.blur).toHaveBeenCalled();
    });

    describe('when "saving" bad inputs,', function() {
      beforeEach(async function() {
        spyOn(this.blocks.cm, 'replaceRange');
        this.literal.element.dispatchEvent(dblclick());
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

      it('should not save anything & set all error state', function() {
        let quarantine = document.activeElement;//this.trackSetQuarantine.calls.mostRecent().returnValue;
        expect(this.blocks.cm.replaceRange).not.toHaveBeenCalled();
        expect(quarantine.classList).toContain('blocks-error');
        expect(quarantine.title).toBe('Error: parse error');
        expect(this.blocks.hasInvalidEdit).toBe(quarantine);
      });
    });

    describe('when dealing with whitespace,', function() {
      beforeEach(function() {
        this.blocks.cm.setValue('(+ 1 2) (+)');
        this.ast = this.blocks.blocks.getAst();
        this.firstRoot = this.ast.rootNodes[0];
        this.firstArg = this.ast.rootNodes[0].args[0];
        this.whiteSpaceEl = this.firstArg.element.nextElementSibling;
        this.blank = this.ast.rootNodes[1];
        this.blankWS = this.blank.element.querySelectorAll('.blocks-white-space')[0];
      });

      it('Ctrl-[ should jump to the left of a top-level node', function() {
        // this.firstRoot.element.dispatchEvent(click());
        sclick(this.firstRoot.element);
        // this.firstRoot.element.dispatchEvent(keydown(LEFTBRACKET, {ctrlKey: true}));
        skeyDown("[", {ctrlKey: true}, this.firstRoot.element);
        let cursor = this.blocks.cm.getCursor();
        expect(cursor.line).toBe(0);
        expect(cursor.ch).toBe(0);
      });
      
      it('Ctrl-] should jump to the right of a top-level node', function() {
        // this.firstRoot.element.dispatchEvent(click());
        sclick(this.firstRoot.element);
        // this.firstRoot.element.dispatchEvent(keydown(RIGHTBRACKET, {ctrlKey: true}));
        skeyDown("]", {ctrlKey: true}, this.firstRoot.element);
        let cursor = this.blocks.cm.getCursor();
        expect(cursor.line).toBe(0);
        expect(cursor.ch).toBe(7);
      });
      
      it('Ctrl-[ should activate a quarantine to the left', async function() {
        this.firstArg.element.dispatchEvent(click());
        sclick(this.firstArg.element);
        this.firstArg.element.dispatchEvent(keydown(LEFTBRACKET, {ctrlKey: true}));
        skeyDown("[", {ctrlKey: true}, this.firstArg.element);
        await wait(DELAY);
        // expect(this.blocks.makeQuarantineAt).toHaveBeenCalled(); //old assertion
        expect(this.blocks.testing.setQuarantine).toHaveBeenCalled();
      });
      
      it('Ctrl-] should activate a quarantine to the right', async function() {
        this.firstArg.element.dispatchEvent(click());
        sclick(this.firstArg.element);
        this.firstArg.element.dispatchEvent(keydown(RIGHTBRACKET, {ctrlKey: true}));
        skeyDown("]", {ctrlKey: true}, this.firstArg.element);
        await wait(DELAY);
        // expect(this.blocks.makeQuarantineAt).toHaveBeenCalled();
        expect(this.blocks.testing.setQuarantine).toHaveBeenCalled();
      });
      
      it('Ctrl-] should activate a quarantine in the first arg position', async function() {
        this.blank.func.element.dispatchEvent(click());
        sclick(this.blank.func.element);
        this.blank.func.element.dispatchEvent(keydown(RIGHTBRACKET, {ctrlKey: true}));
        skeyDown("]", {ctrlKey: true}, this.blank.func.element);
        await wait(DELAY);
        // expect(this.blocks.makeQuarantineAt).toHaveBeenCalled();
        expect(this.blocks.testing.setQuarantine).toHaveBeenCalled();
      });
      
      it('should activate a quarantine on dblclick', async function() {
        this.whiteSpaceEl.dispatchEvent(dblclick());
        sdoubleClick(this.whiteSpaceEl);
        await wait(DELAY);
        // expect(this.blocks.makeQuarantineAt).toHaveBeenCalled();
        expect(this.blocks.testing.setQuarantine).toHaveBeenCalled();
      });
      
      describe('in corner-cases with no arguments,', function() {
        beforeEach(function() {
          this.blocks.cm.setValue('(f)');
          this.ast = this.blocks.blocks.getAst();
          this.firstRoot = this.ast.rootNodes[0];
          this.func = this.ast.rootNodes[0].func;
          this.wsAfterFunc = this.func.element.nextElementSibling;
          this.argWS = this.firstRoot.element.getElementsByClassName('blocks-args')[0].firstChild;
        }); 
        
        it('should allow editing the argument whitespace', async function() { /* left off here*/
          this.argWS.dispatchEvent(dblclick());
          sdoubleClick(this.argWS);
          await wait(DELAY);
          // expect(this.blocks.makeQuarantineAt).toHaveBeenCalled();
          expect(this.blocks.testing.setQuarantine).toHaveBeenCalled();
        }); 
        
        it('should allow editing the whitespace after the function', async function() {
          this.wsAfterFunc.dispatchEvent(dblclick());
          sdoubleClick(this.wsAfterFunc);
          await wait(DELAY);
          // expect(this.blocks.makeQuarantineAt).toHaveBeenCalled();
          expect(this.blocks.testing.setQuarantine).toHaveBeenCalled();
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

    describe('when dealing with dragging,', function() {
      beforeEach(function() {
        this.blocks.cm.setValue('(+ 1 2 3)');
        this.ast = this.blocks.blocks.getAst();
        this.funcSymbol = this.ast.rootNodes[0].func;
        this.firstArg = this.ast.rootNodes[0].args[0];
        this.secondArg = this.ast.rootNodes[0].args[1];
        this.dropTargetEls = this.ast.rootNodes[0].element.querySelectorAll(
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
        let ast = this.blocks.blocks.getAst();
        ast.rootNodes[0].element.dispatchEvent(dragenter());
        ast = this.blocks.blocks.getAst();
        expect(ast.rootNodes[0].element.classList).not.toContain('blocks-over-target');
      });

      it('should do nothing when dropping onto a non-drop target', function() {
        let dragEvent = dragstart();
        this.firstArg.element.dispatchEvent(dragEvent);
        const initialValue = this.blocks.cm.getValue();
        this.blocks.blocks.getAst().rootNodes[0].element.dispatchEvent(drop(dragEvent.dataTransfer));
        expect(this.blocks.cm.getValue()).toBe(initialValue);
      });

      it('should update the text on drop to a later point in the file', function() {
        expect(this.dropTargetEls[4].classList).toContain('blocks-drop-target');
        // drag the first arg to the drop target
        let dragEvent = dragstart();
        this.firstArg.element.dispatchEvent(dragEvent);
        this.dropTargetEls[4].dispatchEvent(drop(dragEvent.dataTransfer));
        expect(this.blocks.cm.getValue().replace(/\s+/, ' ')).toBe('(+ 2 1 3)');
      });

      it('should update the text on drop to an earlier point in the file', function() {
        let dragEvent = dragstart();
        this.secondArg.element.dispatchEvent(dragEvent);
        this.dropTargetEls[1].dispatchEvent(drop(dragEvent.dataTransfer));
        expect(this.blocks.cm.getValue().replace('  ', ' ')).toBe('(+ 2 1 3)');
      });

      // probably irrelevant
      // it('should call willInsertNode before text is dropped and didInsertNode afterwards',
      //   function() {
      //     let dragEvent = dragstart();
      //     spyOn(this.blocks, 'didInsertNode').and.callThrough();/////////
      //     this.secondArg.element.dispatchEvent(dragEvent);
      //     this.dropTargetEls[1].dispatchEvent(drop(dragEvent.dataTransfer));
      //     expect(this.trackWillInsertNode).toHaveBeenCalled();
      //     expect(this.blocks.didInsertNode).toHaveBeenCalled();
      //   }
      // );

      it('should move an item to the top level when dragged outside a node', function() {
        let dragEvent = dragstart();
        this.secondArg.element.dispatchEvent(dragEvent);
        let dropEvent = drop(dragEvent.dataTransfer);
        let nodeEl = this.blocks.blocks.getAst().rootNodes[0].element;
        let wrapperEl = this.blocks.cm.getWrapperElement();
        dropEvent.pageX = wrapperEl.offsetLeft + wrapperEl.offsetWidth - 10;
        dropEvent.pageY = nodeEl.offsetTop + wrapperEl.offsetHeight - 10;
        nodeEl.parentElement.dispatchEvent(dropEvent);
        expect(this.blocks.cm.getValue().replace('  ', ' ')).toBe('(+ 1 3) 2');
      });

      it('should replace a literal that you drag onto', function() {
        let dragEvent = dragstart();
        this.firstArg.element.dispatchEvent(dragEvent);
        this.secondArg.element.dispatchEvent(drop(dragEvent.dataTransfer));
        expect(this.blocks.cm.getValue().replace(/\s+/, ' ')).toBe('(+ 1 3)');
      });

      it('should support dragging plain text to replace a literal', function() {
        let dragEvent = dragstart();
        dragEvent.dataTransfer.setData('text/plain', '5000');
        this.firstArg.element.dispatchEvent(drop(dragEvent.dataTransfer));
        expect(this.blocks.cm.getValue().replace(/\s+/, ' ')).toBe('(+ 5000 2 3)');
      });

      it('should support dragging plain text onto some whitespace', function() {
        let dragEvent = dragstart();
        dragEvent.dataTransfer.setData('text/plain', '5000');
        let dropEvent = drop(dragEvent.dataTransfer);
        let nodeEl = this.blocks.blocks.getAst().rootNodes[0].element;
        let wrapperEl = this.blocks.cm.getWrapperElement();
        dropEvent.pageX = wrapperEl.offsetLeft + wrapperEl.offsetWidth - 10;
        dropEvent.pageY = nodeEl.offsetTop + wrapperEl.offsetHeight - 10;
        nodeEl.parentElement.dispatchEvent(dropEvent);
        expect(this.blocks.cm.getValue().replace('  ', ' ')).toBe('(+ 1 2 3)\n5000');
      });
    });
  });
});
