/* globals jasmine describe it expect beforeEach spyOn */

import {AST, Literal, Expression} from '../src/ast';
import CodeMirrorBlocks from '../src/blocks';
import CodeMirror from 'codemirror';
var render = require('../src/render');

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