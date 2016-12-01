import CodeMirror from 'codemirror';
import ExampleParser from 'codemirror-blocks/languages/example/ExampleParser';
import Renderer from 'codemirror-blocks/Renderer';
import {Comment} from 'codemirror-blocks/ast';

describe('The render module,', function() {
  beforeEach(function() {
    document.body.innerHTML = '<textarea id="code"></textarea>';
    this.cm = CodeMirror.fromTextArea(document.getElementById("code"));
    this.parser = new ExampleParser();
    this.renderer = new Renderer(this.cm);
  });

  describe('when rendering a literal,', function() {
    beforeEach(function() {
      this.literal = this.parser.parse('1').rootNodes[0];
      this.literal.options['aria-label'] = '1';
      this.fragment = this.renderer.render(this.literal);
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

  describe('when rendering an expression,', function() {
    beforeEach(function() {
      this.expression = this.parser.parse('(+ 1 2)').rootNodes[0];
      this.fragment = this.renderer.render(this.expression);
      this.expressionEls = this.fragment.querySelectorAll('span.blocks-expression');
    });

    it('should generate a span with the blocks-expression class', function() {
      expect(this.expressionEls.length).toBe(1);
    });

    it('should render the expression operator', function() {
      var operatorEls = this.expressionEls[0].querySelectorAll('span.blocks-operator');
      expect(operatorEls.length).toBe(1);
      expect(operatorEls[0].querySelectorAll('span.blocks-literal').length).toBe(1);
    });

    it('should render a list of args', function() {
      var argsEls = this.expressionEls[0].querySelectorAll('span.blocks-args');
      expect(argsEls.length).toBe(1);
      var argLiteralEls = argsEls[0].querySelectorAll('span.blocks-literal');
      expect(argLiteralEls.length).toBe(2);
    });
  });

  describe('when rendering a comment,', function() {
    beforeEach(function() {
      this.comment = new Comment(
        {line:0, ch:0}, {line:0, ch:18}, 'this is a comment');
      this.fragment = this.renderer.render(this.comment);
      this.commentEls = this.fragment.querySelectorAll('span.blocks-comment');
    });

    it('should generate a span with the blocks-comment class', function() {
      expect(this.commentEls.length).toBe(1);
    });

    it('should contain the comment itself within the span', function() {
      expect(this.commentEls[0].innerText).toBe('this is a comment');
    });
  });

  describe('when specifying the hideNodesOfType option,', function() {
    beforeEach(function() {
      this.literal = this.parser.parse('1').rootNodes[0];
      this.renderer = new Renderer(this.cm, {hideNodesOfType:['literal']});
      this.fragment = this.renderer.render(this.literal);
      this.literalEls = this.fragment.querySelectorAll('span.blocks-literal');
    });

    it('should add the blocks-hidden class, and remove role=treeitem', function() {
      expect(this.literalEls[0].classList.contains('blocks-hidden')).toBe(true);
      expect(this.literalEls[0].getAttribute("role")).toBe(null);
    });
  });


});
