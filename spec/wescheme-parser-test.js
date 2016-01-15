import CodeMirrorBlocks, {BlockMarker} from '../src/blocks';
import CodeMirror from 'codemirror';
import ExampleParser from '../src/parsers/wescheme.js';
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
function keydown(keyCode, other={}) {
  let event = new CustomEvent('keydown', {bubbles: true});
  event.which = event.keyCode = keyCode;
  Object.assign(event, other);
  return event;
}
function keypress(keyCode, other={}) {
  let event = new CustomEvent('keypress', {bubbles: true});
  event.which = event.keyCode = keyCode;
  Object.assign(event, other);
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
function cut() {
  return new CustomEvent('cut', {bubbles: true});
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
        this.cm.getWrapperElement().dispatchEvent(keydown(9));
        expect(this.blocks.getSelectedNode()).toBe(this.exp);
        this.cm.getWrapperElement().dispatchEvent(keydown(9));
        expect(this.blocks.getSelectedNode()).toBe(this.funExp);
        this.cm.getWrapperElement().dispatchEvent(keydown(9));
        expect(this.blocks.getSelectedNode()).toBe(this.funExp.func);
        this.cm.getWrapperElement().dispatchEvent(keydown(9));
        expect(this.blocks.getSelectedNode()).toBe(this.funExp.args[0]);
        this.cm.getWrapperElement().dispatchEvent(keydown(9));
        expect(this.blocks.getSelectedNode()).toBe(this.funExp.args[1]);
        this.cm.getWrapperElement().dispatchEvent(keydown(9));
        expect(this.blocks.getSelectedNode()).toBe(this.exp.args[0]);
      });

    });


  });
});
