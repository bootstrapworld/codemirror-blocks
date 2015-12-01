/* globals jasmine describe it expect beforeEach spyOn */
import {AST, Literal, Expression} from '../src/ast';
import CodeMirrorBlocks from '../src/blocks';
import CodeMirror from 'codemirror';
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

describe('The CodeMirrorBlocks Class', function() {
  beforeEach(function() {
    document.body.innerHTML = '<textarea id="code"></textarea>';
    this.cm = CodeMirror.fromTextArea(document.getElementById("code"));
    this.dumbParser = {
      parse: function(code) {
        var nodes = [];
        if (code) {
          nodes.push(new Literal({line: 0, ch: 0}, {line: 0, ch: code.length}, parseInt(code)));
        }
        var ast = new AST(nodes);
        return ast;
      }
    };
    this.blocks = new CodeMirrorBlocks(this.cm, this.dumbParser);
  });

  describe('constructor', function() {

    it("should take a codemirror instance and a parser class in it's constructor", function() {
      expect(this.blocks.cm).toBe(this.cm);
      expect(this.blocks.parser).toBe(this.dumbParser);
      expect(this.blocks.ast).toBe(null);
      expect(this.blocks.blockMode).toBe(false);
    });

    it("should initially start with block mode disabled", function() {
      expect(this.blocks.blockMode).toBe(false);
    });
  });


  describe('rendering', function() {

    it("should render itself when block mode is turned on", function() {
      spyOn(this.blocks, 'render').and.callThrough();
      this.blocks.toggleBlockMode();
      expect(this.blocks.blockMode).toBe(true);
      expect(this.blocks.ast).not.toBe(null);
      expect(this.blocks.ast.rootNodes).toEqual([]);
      expect(this.blocks.render).toHaveBeenCalled();
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
        this.cm,
        jasmine.any(Function)
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
        this.cm,
        jasmine.any(Function)
      );
    });
  });

  describe('events', function() {
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


  });
});
