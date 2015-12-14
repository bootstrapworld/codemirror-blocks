/* globals jasmine describe it expect beforeEach spyOn */
import {AST, Literal, Expression} from '../src/ast';
import CodeMirrorBlocks from '../src/blocks';
import CodeMirror from 'codemirror';
import ExampleParser from '../example/parser';
var render = require('../src/render');

function click() {
  return new MouseEvent('click', {bubbles: true});
}
function dblclick() {
  return new MouseEvent('dblclick', {bubbles: true});
}
function blur() {
  return new Event('blur', {bubbles: true});
}
function keydown(which) {
  let event = new CustomEvent('keydown', {bubbles: true});
  event.which = which;
  return event;
}
function dragstart() {
  let event = new CustomEvent('dragstart', {bubbles: true});
  event.dataTransfer = {
    data: {},
    setData(type, data) {
      this.data[type] = data;
    },
    getData(type) {
      return this.data[type];
    },
    setDragImage() {}
  };
  return event;
}
function dragenter() {
  return new CustomEvent('dragenter', {bubbles: true});
}
function dragleave() {
  return new CustomEvent('dragleave', {bubbles: true});
}
function drop(dataTransfer) {
  let event = new CustomEvent('drop', {bubbles: true});
  event.dataTransfer = dataTransfer;
  return event;
}

describe('The CodeMirrorBlocks Class', function() {
  beforeEach(function() {
    document.body.innerHTML = '<textarea id="code"></textarea>';
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
        didInsertNode: this.didInsertNode
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


  describe('renderer,', function() {

    it("should render itself when block mode is turned on", function() {
      spyOn(this.blocks, 'render').and.callThrough();
      this.blocks.toggleBlockMode();
      expect(this.blocks.blockMode).toBe(true);
      expect(this.blocks.ast).not.toBe(null);
      expect(this.blocks.ast.rootNodes).toEqual([]);
      expect(this.blocks.render).toHaveBeenCalled();
    });

    it("should do nothing if block mode does not change", function() {
      this.blocks.setBlockMode(true);
      spyOn(this.blocks, 'render');
      this.blocks.setBlockMode(true);
      expect(this.blocks.render).not.toHaveBeenCalled();
    });

    it("should automatically re-render when the content changes", function() {
      spyOn(render, 'default');
      this.blocks.toggleBlockMode();

      // change the document once...
      this.cm.setValue('11');
      expect(this.blocks.ast.rootNodes.length).toBe(1);
      expect(this.blocks.ast.rootNodes[0].type).toBe('literal');
      expect(this.blocks.ast.rootNodes[0].value).toBe(11);
      expect(render.default).toHaveBeenCalled();
      expect(render.default).toHaveBeenCalledWith(
        this.blocks.ast.rootNodes[0],
        this.cm
      );
      render.default.calls.reset();

      // change the document again
      this.cm.setValue('5432');

      expect(this.blocks.ast.rootNodes.length).toBe(1);
      expect(this.blocks.ast.rootNodes[0].type).toBe('literal');
      expect(this.blocks.ast.rootNodes[0].value).toBe(5432);
      expect(render.default).toHaveBeenCalled();
      expect(render.default).toHaveBeenCalledWith(
        this.blocks.ast.rootNodes[0],
        this.cm
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

    it('should toggle node selection on click', function() {
      this.literal.el.dispatchEvent(click());
      expect(this.blocks.selectedNodes.has(this.literal)).toBe(true);
      this.literal.el.dispatchEvent(click());
      expect(this.blocks.selectedNodes.has(this.literal)).toBe(false);
    });

    it('should delete selected nodes when the delete key is pressed', function() {
      expect(this.cm.getValue()).toBe('11');
      this.literal.el.dispatchEvent(click());
      expect(this.blocks.selectedNodes.has(this.literal)).toBe(true);
      this.cm.getWrapperElement().dispatchEvent(keydown(8));
      expect(this.cm.getValue()).toBe('');
    });


    it('should begin editing a node on double click', function() {
      this.literal.el.dispatchEvent(dblclick());
      expect(this.literal.el.classList).toContain('blocks-editing');
      expect(this.literal.el.contentEditable).toBe('true');
    });

    it('should save an edited node on blur', function() {
      this.literal.el.dispatchEvent(dblclick());
      let selection = window.getSelection();
      expect(selection.rangeCount).toEqual(1);
      let range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode('4253'));
      expect(this.cm.getValue()).toEqual('11');
      this.literal.el.dispatchEvent(blur());
      expect(this.cm.getValue()).toEqual('4253');
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

    });

  });
});
