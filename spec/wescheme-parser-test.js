import CodeMirrorBlocks from 'codemirror-blocks/blocks';
import CodeMirror from 'codemirror';
import WeschemeParser from 'codemirror-blocks/languages/wescheme/WeschemeParser';

import { 
  click,
  dragstart,
  drop
} from './events';

const LEFT_KEY  = 37;
const RIGHT_KEY = 39;
const DOWN_KEY  = 40;

function keydown(keyCode, other={}) {
  let event = new CustomEvent('keydown', {bubbles: true});
  event.which = event.keyCode = keyCode;
  Object.assign(event, other);
  return event;
}

describe('The CodeMirrorBlocks Class', function() {
  beforeEach(function() {
    document.body.innerHTML = '<textarea id="code"></textarea>';
    this.cm = CodeMirror.fromTextArea(document.getElementById("code"));
    this.parser = new WeschemeParser();
    this.willInsertNode = (cm, sourceNodeText, sourceNode, destination) => {
      let line = cm.getLine(destination.line);
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

  describe('events,', function() {
    beforeEach(function() {
      this.cm.setValue('11');
      this.blocks.setBlockMode(true);
      this.literal = this.blocks.ast.rootNodes[0];
    });


    describe("when dealing with node selection,", function() {

      beforeEach(function() {
        this.cm.setValue('((f x y) 1 2)');
        this.exp = this.blocks.ast.rootNodes[0];
        this.funExp = this.exp.func;
      });

      it('should allow tabbing forward through expressions in the function position', function() {
        this.cm.getWrapperElement().dispatchEvent(keydown(DOWN_KEY));
        expect(this.blocks.getActiveNode()).toBe(this.exp);
        this.cm.getWrapperElement().dispatchEvent(keydown(DOWN_KEY));
        expect(this.blocks.getActiveNode()).toBe(this.funExp);
        this.cm.getWrapperElement().dispatchEvent(keydown(DOWN_KEY));
        expect(this.blocks.getActiveNode()).toBe(this.funExp.func);
        this.cm.getWrapperElement().dispatchEvent(keydown(DOWN_KEY));
        expect(this.blocks.getActiveNode()).toBe(this.funExp.args[0]);
        this.cm.getWrapperElement().dispatchEvent(keydown(DOWN_KEY));
        expect(this.blocks.getActiveNode()).toBe(this.funExp.args[1]);
        this.cm.getWrapperElement().dispatchEvent(keydown(DOWN_KEY));
        expect(this.blocks.getActiveNode()).toBe(this.exp.args[0]);
      });
    });

    describe('when dealing with dragging,', function() {
      beforeEach(function() {
        this.cm.setValue('(+ 1 2 3 4)');
        this.funcSymbol = this.blocks.ast.rootNodes[0].func;
        this.firstArg = this.blocks.ast.rootNodes[0].args[0];
        this.fourthArg = this.blocks.ast.rootNodes[0].args[3];
      });

      it('should be able to drop the function on top of the last arg', function() {
        let dragEvent = dragstart();
        this.funcSymbol.el.dispatchEvent(dragEvent);
        this.fourthArg.el.dispatchEvent(drop(dragEvent.dataTransfer));
        expect(this.cm.getValue().replace(/\s+/, ' ')).toBe('( 1 2 3 +)');
      });
    });
  });
  
  describe('when parsing code with sequences,', function() {
    beforeEach(function() {
      this.cm.setValue(`(begin (+ 1 2) (- 3 4))`);
      this.blocks.setBlockMode(true);
      this.sequence = this.blocks.ast.rootNodes[0];
    });

    it('sequence blocks should be collapsible', function() {
      this.sequence.el.dispatchEvent(click());
      this.sequence.el.dispatchEvent(keydown(LEFT_KEY));
      expect(this.sequence.el.getAttribute("aria-expanded")).toBe("false");
      this.sequence.el.dispatchEvent(keydown(RIGHT_KEY));
      expect(document.activeElement).toBe(this.sequence.el);
    });

    it('should allow moving through expressions in sequences', function() {
      this.sequence.el.dispatchEvent(click());
      this.sequence.el.dispatchEvent(keydown(DOWN_KEY));
      expect(document.activeElement).toBe(this.sequence.exprs[0].el);
    });
  });
/*
  describe('when parsing code with comments,', function() {
    beforeEach(function() {
      this.cm.setValue(`;top-line
        (+ ; plus

        ; multi
        ;lines
        1 (* 2 7) 3 4)`);
      this.blocks.setBlockMode(true);
      this.expr = this.blocks.ast.rootNodes[0];
      this.funcSymbol = this.blocks.ast.rootNodes[0].func;
      this.firstArg = this.blocks.ast.rootNodes[0].args[0];
      this.secondArg = this.blocks.ast.rootNodes[0].args[1];
    });

    it('code is described by a comment that sits directly to the right', function() {
      expect(this.funcSymbol.el.getAttribute('aria-describedby')).toBe(
        'block-node-'+this.funcSymbol.options.comment.id);
    });
    it('contiguous line comments are merged', function() {
      expect(this.firstArg.el.getAttribute('aria-describedby')).toBe(
        'block-node-'+this.firstArg.options.comment.id);
    });
    it('expressions are described by themselves if there are no available comments', function() {
      expect(this.secondArg.el.getAttribute('aria-describedby')).toBe(null);
    });

  });
  */
});
