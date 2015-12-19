/* globals describe it expect beforeEach */

import Parser from '../../src/parsers/wescheme';

describe("The WeScheme Parser,", function() {
  beforeEach(function() {
    this.parser = new Parser();
  });

  it("should set the appropriate data type for literals", function() {
    expect(this.parser.parse('#t').rootNodes[0].dataType).toBe('boolean');
    expect(this.parser.parse('1').rootNodes[0].dataType).toBe('number');
    expect(this.parser.parse('"hello"').rootNodes[0].dataType).toBe('string');
    expect(this.parser.parse('#\\m').rootNodes[0].dataType).toBe('char');
    expect(this.parser.parse('foo').rootNodes[0].dataType).toBe('symbol');
  });

  it("should treat booleans expression like regular expressions", function() {
    let ast = this.parser.parse('(or #t #f)');
    expect(ast.rootNodes[0].type).toBe('expression');
    ast = this.parser.parse('(and #t #f)');
    expect(ast.rootNodes[0].type).toBe('expression');
  });

  describe("when parsing callExpressions,", function() {

    beforeEach(function() {
      this.ast = this.parser.parse('(sum 1 2 3)');
    });

    it("should convert callExpresssions to expressions", function() {
      expect(this.ast.rootNodes[0].type).toBe('expression');
    });

    it("should convert the function symbol to a literal", function() {
      expect(this.ast.rootNodes[0].func.type).toBe('literal');
      expect(this.ast.rootNodes[0].func.dataType).toBe('symbol');
    });

    it("should support empty expressions by generating a placeholder literal", function() {
      this.ast = this.parser.parse('()');
      expect(this.ast.rootNodes[0].type).toBe('expression');
      expect(this.ast.rootNodes[0].func.value).toBe(' ');
      expect(this.ast.rootNodes[0].func.dataType).toBe('placeholder');
    });

  });

  describe("when parsing andExpressions and orExpression,", function() {
    beforeEach(function() {
      this.ast = this.parser.parse('(or true true) (and true true)');
    });

    it("should convert and/or expressions to expressions", function() {
      expect(this.ast.rootNodes[0].type).toBe('expression');
      expect(this.ast.rootNodes[1].type).toBe('expression');
    });

    it("should convert the function symbol to a literal", function() {
      expect(this.ast.rootNodes[0].func.type).toBe('literal');
      expect(this.ast.rootNodes[1].func.type).toBe('literal');
      expect(this.ast.rootNodes[0].func.dataType).toBe('symbol');
      expect(this.ast.rootNodes[1].func.dataType).toBe('symbol');
      expect(this.ast.rootNodes[0].func.value).toBe('or');
      expect(this.ast.rootNodes[1].func.value).toBe('and');
    });
  });

  describe("when parsing defVar expressions,", function() {
    beforeEach(function() {
      this.ast = this.parser.parse('(define foo "bar")');
    });

    it("should convert defVar expressions to variableDef", function() {
      expect(this.ast.rootNodes[0].type).toBe('variableDef');
      expect(this.ast.rootNodes[0].name).toBe('foo');
      expect(this.ast.rootNodes[0].body.type).toBe('literal');
    });
  });

  describe("when parsing comments,", function() {
    beforeEach(function() {
      this.ast = this.parser.parse(';this is a comment');
    });

    it("should convert comments to codemirror-blocks comments", function() {
      expect(this.ast.rootNodes[0].type).toBe('comment');
    });

    it("should keep track of the text of the comment", function() {
      expect(this.ast.rootNodes[0].comment).toBe('this is a comment');
    });
  });

  describe("when setting aria-labels", function() {
    it("should make symbols, numbers, and booleans be set to themselves", function() {
      expect(this.parser.parse('1').rootNodes[0].options['aria-label']).toBe('1');
      expect(this.parser.parse('symbol').rootNodes[0].options['aria-label']).toBe('symbol');
      expect(this.parser.parse('#t').rootNodes[0].options['aria-label']).toBe('#t');
    });

    it("should make string values be set to 'string '+the contents of the string", function() {
      expect(this.parser.parse('"hello"').rootNodes[0].options['aria-label'])
                 .toBe('string hello');
    });

    it("should make expression (print 'hello') into 'print expression, 1 argument'", function() {
      expect(this.parser.parse('(print "hello")').rootNodes[0].options['aria-label'])
                 .toBe('print expression, 1 argument');
      expect(this.parser.parse('(print "hello" "world")').rootNodes[0].options['aria-label'])
                 .toBe('print expression, 2 arguments');
    });

    it("should make and/or expressions just like regular expressions", function() {
      expect(this.parser.parse('(and true true)').rootNodes[0].options['aria-label'])
                 .toBe('and expression, 2 arguments');
      expect(this.parser.parse('(or false true)').rootNodes[0].options['aria-label'])
                 .toBe('or expression, 2 arguments');
    });
  });
});
