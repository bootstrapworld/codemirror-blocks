import CodeMirrorBlocks from '../src/CodeMirrorBlocks';
import wescheme from '../src/languages/wescheme';

/*eslint no-unused-vars: "off"*/
import {
  mac, cmd_ctrl, DELAY, wait, removeEventListeners, teardown, activationSetup,
  click, mouseDown, mouseenter, mouseover, mouseleave, doubleClick, blur, 
  paste, cut, copy, dragstart, dragover, drop, dragenter, dragenterSeq, 
  dragend, dragleave, keyDown, keyPress, insertText
} from '../spec/support/test-utils';

// be sure to call with `apply` or `call`
let setup = function () { activationSetup.call(this, wescheme); };

describe('The CodeMirrorBlocks Class', function() {
  beforeEach(function() {
    setup.call(this);
    this.cmb.setBlockMode(true);
  });

  afterEach(function () { teardown(); });

  describe('constructor,', function() {

    it("should create an empty editor", function() {
      const fixture = `
        <div id="temp">
          <div id="cmb-editor-temp" class="editor-container"/>
        </div>
      `;
      document.body.insertAdjacentHTML('afterbegin', fixture);
      const container = document.getElementById('cmb-editor-temp');
      const tempBlocks = new CodeMirrorBlocks(
        container, 
        {value: "", incrementalRendering: false }, 
        wescheme);
      tempBlocks.setBlockMode(true);
      const ast = tempBlocks.getAst();
      expect(tempBlocks.getBlockMode()).toBe(true); //broken
      expect(ast.rootNodes.length).toBe(0);
      document.body.removeChild(document.getElementById('temp'));
    });

    it("should set block mode to false", function() {
      this.cmb.setBlockMode(false);
      expect(this.cmb.getBlockMode()).toBe(false);
    });
  });
  /*
  // Should we make the language prop accessible externally so we can run this?
  it('should optionally take a language object', function() {
     const b = new CodeMirrorBlocks(
      document.getElementById('root'), 
      {value: "", incrementalRendering: false }, 
      example);
     expect(b.language.id).toBe('example');
  });
  */

  describe("when dealing with top-level input,", function() {

    beforeEach(async function() {
      this.cmb.setValue('42 11');
      this.cmb.setBlockMode(true);
      await wait(DELAY);
    });

    it('typing at the end of a line', async function() {
      this.cmb.setQuarantine(
        {line: 0, ch: 2, sticky: "before", xRel: 400}, 
        {line: 0, ch: 2, sticky: "before", xRel: 400}, 
        "9");
      await wait(DELAY);
      keyDown("Enter");
      await wait(DELAY);
      expect(this.cmb.getValue()).toEqual('42\n9\n11');
    });
/*
    it('typing at the beginning of a line', async function() {
      this.cmb.setQuarantine({line: 0, ch: 0, xRel: 0}, {line: 0, ch: 0, xRel: 0}, "9");
      await wait(DELAY);
      keyDown("Enter");
      await wait(DELAY);
      expect(this.cmb.getValue()).toEqual('9\n42\n11');
    });

    it('typing between two blocks on a line', async function() {
      this.cmb.setCursor({line: 0, ch: 3});
      keyDown("9", {}, this.cmb.getInputField());
      insertText("9");
      await wait(DELAY);
      expect(this.cmb.getValue()).toEqual('429\n11');
    });
*/
    // TODO: figure out how to fire a paste event
  });

  describe('events,', function() {
    beforeEach(async function() {
      this.cmb.setValue('11');
      await wait(DELAY);
      this.cmb.setBlockMode(true);
      this.literal = this.cmb.getAst().rootNodes[0];
    });
    
    /*it('should begin editing a node on  click', async function() { /////
      // this.literal.element.dispatchEvent(dblclick());
      click(this.literal.element);
      await wait(DELAY);
      expect(document.activeElement.classList).toContain('blocks-editing');
      expect(document.activeElement.contentEditable).toBe('true');
    });*/
    
    /*it('should save a valid, edited node on blur', async function() {
      this.literal.element.dispatchEvent(dblclick());
      click(this.literal.element);
      await wait(DELAY);
      let quarantine = document.activeElement;//this.trackSetQuarantine.calls.mostRecent().returnValue;
      let selection = window.getSelection();
      expect(selection.rangeCount).toEqual(1);
      let range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode('9'));
      expect(this.cmb.getValue()).toEqual('11');
      quarantine.dispatchEvent(blur());
      await wait(DELAY);
      // not sure of the updated React way to do this
      // expect(this.trackSaveEdit).toHaveBeenCalledWith(quarantine);
      expect(this.cmb.getValue()).toEqual('9');
      // expect(this.cmb.hasInvalidEdit).toBe(false);
    });*/
  
    it('should not allow required blanks to be deleted', async function() {
      this.cmb.setValue('()');
      await wait(DELAY);
      this.cmb.getValue('(...)'); // blank should be inserted by parser, as '...'
      const blank = this.cmb.getAst().rootNodes[0].func;
      click(blank.element);
      await wait(DELAY);
      expect(blank.isEditable()).toBe(true);
      keyDown("Delete");
      await wait(DELAY);
      this.cmb.getValue('(...)'); // deleting the blank should be a no-op
    });

    it('should return the node being edited on ESC', async function() {
      click(this.literal);
      await wait(DELAY);
      const quarantine = document.activeElement;
      keyDown("Escape", {}, quarantine);
      expect(this.cmb.getValue()).toEqual('11');
    });
    
    /*
    NOTE(Emmanuel): we still don't know how to get the DOM elt of a 
    NodeEditable - these two tests rely on that
    it('should blur the node being edited on enter', async function() {
      click(this.literal.element);
      await wait(DELAY);
      let quarantine = document.activeElement;
      spyOn(quarantine, 'blur');
      keyDown("Enter", {}, this.literal);
      await wait(DELAY);
      expect(quarantine.blur).toHaveBeenCalled();
    });
    
    it('should blur the node being edited on top-level click', async function() {
      click(this.literal.element);
      await wait(DELAY);
      let quarantine = document.activeElement;
      spyOn(quarantine, 'blur');
      click(this.cmb.getWrapperElement());
      expect(quarantine.blur).toHaveBeenCalled();
    });
  */
    describe('when "saving" bad inputs,', function() {
      beforeEach(async function() {
        spyOn(this.cmb, 'replaceRange');
        click(this.literal.element);
        await wait(DELAY);
        let quarantine = document.activeElement;
        let selection = window.getSelection();
        expect(selection.rangeCount).toEqual(1);
        let range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode('"moo'));
        quarantine.dispatchEvent(blur());
        blur(quarantine);
      });

      /*it('should not save anything & set all error state', function() {
        let quarantine = document.activeElement;//this.trackSetQuarantine.calls.mostRecent().returnValue;
        expect(this.cmb.replaceRange).not.toHaveBeenCalled();
        expect(quarantine.classList).toContain('blocks-error');
        expect(quarantine.title).toBe('Error: parse error');
        expect(this.cmb.hasInvalidEdit).toBe(quarantine);
      });*/
    });

    describe('when dealing with whitespace,', function() {
      beforeEach(async function() {
        this.cmb.setValue('(+ 1 2) (+)');
        await wait(DELAY);
        this.ast = this.cmb.getAst();
        this.firstRoot = this.ast.rootNodes[0];
        this.firstArg = this.ast.rootNodes[0].args[0];
        this.whiteSpaceEl = this.firstArg.element.nextElementSibling;
        this.blank = this.ast.rootNodes[1];
        this.blankWS = this.blank.element.querySelectorAll('.blocks-white-space')[0];
      });

      it('Ctrl-[ should jump to the left of a top-level node', function() {
        mouseDown(this.firstRoot.element);
        keyDown("[", {ctrlKey: true}, this.firstRoot.element);
        let cursor = this.cmb.getCursor();
        expect(cursor.line).toBe(0);
        expect(cursor.ch).toBe(0);
      });
      
      it('Ctrl-] should jump to the right of a top-level node', function() {
        mouseDown(this.firstRoot.element);
        keyDown("]", {ctrlKey: true}, this.firstRoot.element);
        let cursor = this.cmb.getCursor();
        expect(cursor.line).toBe(0);
        expect(cursor.ch).toBe(7);
      });
      
      it('Ctrl-[ should activate a quarantine to the left', async function() {
        mouseDown(this.firstArg.element);
        keyDown("[", {ctrlKey: true});
        await wait(DELAY);
        //expect(this.cmb.setQuarantine).toHaveBeenCalled();
      });
      
      it('Ctrl-] should activate a quarantine to the right', async function() {
        mouseDown(this.firstArg.element);
        keyDown("]", {ctrlKey: true}, this.firstArg.element);
        await wait(DELAY);
        //expect(this.cmb.setQuarantine).toHaveBeenCalled();
      });
      
      it('Ctrl-] should activate a quarantine in the first arg position', async function() {
        mouseDown(this.blank.func.element);
        keyDown("]", {ctrlKey: true}, this.blank.func.element);
        await wait(DELAY);
        //expect(this.cmb.setQuarantine).toHaveBeenCalled();
      });
      
      it('should activate a quarantine on dblclick', async function() {
        click(this.whiteSpaceEl);
        await wait(DELAY);
        //expect(this.cmb.setQuarantine).toHaveBeenCalled();
      });
      
      describe('in corner-cases with no arguments,', function() {
        beforeEach(async function() {
          this.cmb.setValue('(f)');
          await wait(DELAY);
          this.ast = this.cmb.getAst();
          this.firstRoot = this.ast.rootNodes[0];
          this.func = this.ast.rootNodes[0].func;
          this.argWS = this.firstRoot.element.getElementsByClassName('blocks-args')[0].firstChild;
        }); 
        
        it('should allow editing the argument whitespace', async function() { /* left off here*/
          click(this.argWS);
          await wait(DELAY);
          //expect(this.cmb.setQuarantine).toHaveBeenCalled();
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
        //   expect(this.cmb.getValue()).toBe('(+ 1 4253 2) (+)');
        //   expect(this.cmb.hasInvalidEdit).toBe(false);
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
          //   expect(this.cmb.replaceRange).not.toHaveBeenCalled();
          //   expect(this.quarantine.classList).toContain('blocks-error');
          //   expect(this.quarantine.title).toBe('Error: parse error');
          //   expect(this.cmb.hasInvalidEdit).toBe(true);
          // });
          
        });
      });
    });
  });
});
