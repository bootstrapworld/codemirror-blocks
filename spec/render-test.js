/* globals jasmine describe it expect beforeEach spyOn */
import {AST, Literal, Expression} from '../src/ast';
import CodeMirrorBlocks from '../src/blocks';
import CodeMirror from 'codemirror';
import ExampleParser from '../example/parser';
import render from '../src/render';

describe('The render module,', function() {
  beforeEach(function() {
    document.body.innerHTML = '<textarea id="code"></textarea>';
    this.cm = CodeMirror.fromTextArea(document.getElementById("code"));
    this.parser = new ExampleParser();
  });

  describe('when rendering a literal,', function() {
    beforeEach(function() {
      this.literal = this.parser.parse('1').rootNodes[0];
      this.literal.options['aria-label'] = '1';
      this.fragment = render(this.literal, this.cm, function(){});
      this.literalEls = this.fragment.querySelectorAll('span.blocks-literal');
    });

    it('should generate a span with the blocks-literal class', function() {
      expect(this.literalEls.length).toBe(1);
    });

    it('should have the node id as it\'s id', function() {
      expect(this.literalEls[0].id).toBe(`block-node-${this.literal.id}`);
    });

    it('should render an aria label if specified in the options', function() {
      expect(this.literalEls[0].getAttribute('aria-label')).toBe('1');
    });
  });
});
