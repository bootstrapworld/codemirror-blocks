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
      if (destination.ch > 0 && line[destination.ch - 1].match(/[\w\d]/)) {
        // previous character is a letter or number, so prefix a space
        sourceNodeText = ' ' + sourceNodeText;
      }

      if (destination.ch < line.length && line[destination.ch].match(/[\w\d]/)) {
        // next character is a letter or a number, so append a space
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
        spyOn(this.blocks, 'insertionQuarantine');
        this.cm.setCursor({line: 0, ch: 5});
        this.cm.getInputField().dispatchEvent(keypress(100));
        expect(this.blocks.insertionQuarantine).toHaveBeenCalled();
        // TODO: access the bookmark itself, and make sure it was added to CM with the right contents
      });

      it('typing at the beginning of a line', function() {
        spyOn(this.blocks, 'insertionQuarantine');
        this.cm.setCursor({line: 0, ch: 0});
        this.cm.getInputField().dispatchEvent(keypress(100));
        expect(this.blocks.insertionQuarantine).toHaveBeenCalled();
        // TODO: access the bookmark itself, and make sure it was added to CM with the right contents
      });

      it('typing between two blocks on a line', function() {
        spyOn(this.blocks, 'insertionQuarantine');
        this.cm.setCursor({line: 0, ch: 3});
        this.cm.getInputField().dispatchEvent(keypress(100));
        expect(this.blocks.insertionQuarantine).toHaveBeenCalled();
        // TODO: access the bookmark itself, and make sure it was added to CM with the right contents
      });

      // TODO: figure out how to fire a paste event
    });


    describe("when dealing with node selection,", function() {

      beforeEach(function() {
        this.cm.setValue('11 54');
        this.literal = this.blocks.ast.rootNodes[0];
        this.literal2 = this.blocks.ast.rootNodes[1];
      });

      it('should only allow one node to be selected at a time', function() {
        this.literal.el.dispatchEvent(click());
        this.literal2.el.dispatchEvent(click());
        expect(this.blocks.getSelectedNode()).not.toBe(this.literal);
        expect(this.blocks.getSelectedNode()).toBe(this.literal2);
      });

      it('should put focus on the selected node', function() {
        this.literal.el.dispatchEvent(click());
        expect(document.activeElement).toBe(this.literal.el);
      });

      it('should delete selected nodes when the delete key is pressed', function() {
        expect(this.cm.getValue()).toBe('11 54');
        this.literal.el.dispatchEvent(click());
        expect(this.blocks.getSelectedNode()).toBe(this.literal);
        this.cm.getWrapperElement().dispatchEvent(keydown(8));
        expect(this.cm.getValue()).toBe(' 54');
      });

      it('should select the first node when tab is pressed', function() {
        this.cm.getWrapperElement().dispatchEvent(keydown(9));
        expect(this.blocks.getSelectedNode()).toBe(this.literal);
      });

      it('should select the next node when tab is pressed', function() {
        this.cm.getWrapperElement().dispatchEvent(keydown(9));
        this.cm.getWrapperElement().dispatchEvent(keydown(9));
        expect(this.blocks.getSelectedNode()).not.toBe(this.literal);
        expect(this.blocks.getSelectedNode()).toBe(this.literal2);
      });

      it('should select the node after the cursor when tab is pressed', function() {
        this.cm.setCursor({line: 0, ch: 2});
        this.cm.getWrapperElement().dispatchEvent(keydown(9));
        expect(this.blocks.getSelectedNode()).not.toBe(this.literal);
        expect(this.blocks.getSelectedNode()).toBe(this.literal2);
      });

      it('should select the node before the cursor when tab is pressed', function() {
        this.cm.setCursor({line: 0, ch: 2});
        this.cm.getWrapperElement().dispatchEvent(keydown(9, {shiftKey: true}));
        expect(this.blocks.getSelectedNode()).not.toBe(this.literal2);
        expect(this.blocks.getSelectedNode()).toBe(this.literal);
      });

      it('should select the last node when shift-tab is pressed', function() {
        this.cm.getWrapperElement().dispatchEvent(keydown(9, {shiftKey:true}));
        expect(this.blocks.getSelectedNode()).toBe(this.literal2);
      });

      it('should select the previous node when shift-tab is pressed', function() {
        this.cm.getWrapperElement().dispatchEvent(keydown(9, {shiftKey:true}));
        this.cm.getWrapperElement().dispatchEvent(keydown(9, {shiftKey:true}));
        expect(this.blocks.getSelectedNode()).not.toBe(this.literal2);
        expect(this.blocks.getSelectedNode()).toBe(this.literal);
      });

      it('should toggle the editability of selected node when Enter is pressed', function() {
        this.cm.getWrapperElement().dispatchEvent(keydown(9));
        expect(this.blocks.getSelectedNode()).toBe(this.literal);
        this.literal.el.dispatchEvent(keydown(13));
        expect(this.literal.el.contentEditable).toBe('true');
      });

      it('should cancel the editability of selected node when Esc is pressed', function() {
        this.cm.getWrapperElement().dispatchEvent(keydown(9));
        expect(this.blocks.getSelectedNode()).toBe(this.literal);
        this.literal.el.dispatchEvent(keydown(13));
        expect(this.literal.el.contentEditable).toBe('true');
        this.literal.el.dispatchEvent(keydown(68));
        this.literal.el.dispatchEvent(keydown(27));
        expect(this.cm.getValue()).toBe('11 54');
      });

      it('should proxy keydown events on the selected node to codemirror', function() {
        spyOn(this.cm, 'execCommand');
        this.literal.el.dispatchEvent(click());
        let event = keydown(90, {ctrlKey: true}); // Ctrl-z: undo
        CodeMirror.keyMap['default']["Ctrl-Z"] = "undo";
        expect(CodeMirror.keyMap['default'][CodeMirror.keyName(event)]).toBe('undo');
        this.literal.el.dispatchEvent(event);
        expect(this.cm.execCommand).toHaveBeenCalledWith('undo');
      });

      describe('cut/copy', function() {
        beforeEach(function() {
          this.literal.el.dispatchEvent(click());
          spyOn(document, 'execCommand');
        });

        it('should remove selected nodes on cut', function() {
          document.dispatchEvent(cut());
          expect(this.cm.getValue()).toBe(' 54');
          expect(document.execCommand).toHaveBeenCalledWith('cut');
        });

        xit('should create an activeElement with the text to be copied', function() {
          // TODO: figure out how to test this.
        });
      });
    });

    it('should begin editing a node on double click', function() {
      this.literal.el.dispatchEvent(dblclick());
      expect(this.literal.el.classList).toContain('blocks-editing');
      expect(this.literal.el.contentEditable).toBe('true');
    });

    it('should save a valid, edited node on blur', function() {
      this.literal.el.dispatchEvent(dblclick());
      let selection = window.getSelection();
      expect(selection.rangeCount).toEqual(1);
      let range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode('4253'));
      expect(this.cm.getValue()).toEqual('11');
      this.literal.el.dispatchEvent(blur());
      expect(this.cm.getValue()).toEqual('4253');
      expect(this.blocks.hasInvalidEdit).toBe(false);
    });

    it('should blur the node being edited on tab', function() {
      this.literal.el.dispatchEvent(dblclick());
      spyOn(this.literal.el, 'blur');
      this.literal.el.dispatchEvent(keydown(9));
      expect(this.literal.el.blur).toHaveBeenCalled();
    });

    it('should blur the node being edited on enter', function() {
      this.literal.el.dispatchEvent(dblclick());
      spyOn(this.literal.el, 'blur');
      this.literal.el.dispatchEvent(keydown(13));
      expect(this.literal.el.blur).toHaveBeenCalled();
    });

    describe('when "saving" bad inputs,', function() {
      beforeEach(function() {
        spyOn(this.parser, 'parse').and.throwError("bad input");
        spyOn(this.cm, 'replaceRange');
        this.literal.el.dispatchEvent(dblclick());
        this.literal.el.dispatchEvent(blur());
      });

      it('should not save anything', function() {
        expect(this.cm.replaceRange).not.toHaveBeenCalled();
      });

      it('should add a blocks-error class to the node being edited', function() {
        expect(this.literal.el.classList).toContain('blocks-error');
      });

      it('should add the parse error as the title of the literal', function() {
        expect(this.literal.el.title).toBe('Error: bad input');
      });

      it('should set hasInvalidEdit to true', function() {
        expect(this.blocks.hasInvalidEdit).toBe(true);
      });
    });

    describe('when dealing with whitespace,', function() {
      beforeEach(function() {
        this.cm.setValue('(+ 1 2)');
        let firstArg = this.blocks.ast.rootNodes[0].args[0];
        this.whiteSpaceEl = firstArg.el.nextElementSibling;
      });

      it('should edit whitespace on dblclick', function() {
        expect(this.whiteSpaceEl.classList).toContain('blocks-white-space');
        expect(this.whiteSpaceEl.classList).not.toContain('blocks-editing');
        this.whiteSpaceEl.dispatchEvent(dblclick());
        expect(this.whiteSpaceEl.classList).toContain('blocks-editing');
        expect(this.whiteSpaceEl.contentEditable).toBe('true');
      });

      describe('and specifically when editing it,', function() {
        beforeEach(function() {
          this.whiteSpaceEl.dispatchEvent(dblclick());

          let selection = window.getSelection();
          expect(selection.rangeCount).toEqual(1);
          let range = selection.getRangeAt(0);
          range.deleteContents();
          range.insertNode(document.createTextNode('4253'));
        });

        it('should save whiteSpace on blur', function() {
          this.whiteSpaceEl.dispatchEvent(blur());
          expect(this.cm.getValue()).toBe('(+ 1 4253 2)');
        });

        it('should blur whitespace you are editing on enter', function() {
          spyOn(this.whiteSpaceEl, 'blur');
          this.whiteSpaceEl.dispatchEvent(keydown(13));
          expect(this.whiteSpaceEl.blur).toHaveBeenCalled();
        });

        it('should blur whitespace you are editing on tab', function() {
          spyOn(this.whiteSpaceEl, 'blur');
          this.whiteSpaceEl.dispatchEvent(keydown(9));
          expect(this.whiteSpaceEl.blur).toHaveBeenCalled();
        });

        describe('when "saving" bad whitepsace inputs,', function() {
          beforeEach(function() {
            spyOn(this.parser, 'parse').and.throwError("bad input");
            spyOn(this.cm, 'replaceRange');
            this.whiteSpaceEl.dispatchEvent(blur());
          });

          it('should not save anything', function() {
            expect(this.cm.replaceRange).not.toHaveBeenCalled();
          });

          it('should add a blocks-error class to the whitespace el', function() {
            expect(this.whiteSpaceEl.classList).toContain('blocks-error');
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
        this.dropTargetEls[2].dispatchEvent(dragenter());
        expect(this.dropTargetEls[2].classList).toContain('blocks-over-target');
      });

      it('should set the right css class on dragleave', function() {
        this.dropTargetEls[2].dispatchEvent(dragenter());
        this.dropTargetEls[2].dispatchEvent(dragleave());
        expect(this.dropTargetEls[2].classList).not.toContain('blocks-over-target');
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
        expect(this.dropTargetEls[2].classList).toContain('blocks-drop-target');
        // drag the first arg to the drop target
        let dragEvent = dragstart();
        this.firstArg.el.dispatchEvent(dragEvent);
        this.dropTargetEls[2].dispatchEvent(drop(dragEvent.dataTransfer));
        expect(this.cm.getValue().replace(/\s+/, ' ')).toBe('(+ 2 1 3)');
      });

      it('should update the text on drop to an earlier point in the file', function() {
        let dragEvent = dragstart();
        this.secondArg.el.dispatchEvent(dragEvent);
        this.dropTargetEls[0].dispatchEvent(drop(dragEvent.dataTransfer));
        expect(this.cm.getValue().replace('  ', ' ')).toBe('(+ 2 1 3)');
      });

      it('should call willInsertNode before text is dropped and didInsertNode afterwards',
        function() {
          let dragEvent = dragstart();
          spyOn(this.blocks, 'willInsertNode').and.callThrough();
          spyOn(this.blocks, 'didInsertNode').and.callThrough();
          this.secondArg.el.dispatchEvent(dragEvent);
          this.dropTargetEls[0].dispatchEvent(drop(dragEvent.dataTransfer));
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
        expect(this.cm.getValue().replace('  ', ' ')).toBe('(+ 1 3)\n2');
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
