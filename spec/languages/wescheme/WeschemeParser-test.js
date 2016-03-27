import WeschemeParser from 'codemirror-blocks/languages/wescheme/WeschemeParser';

describe("The WeScheme Parser,", function() {
  beforeEach(function() {
    this.parser = new WeschemeParser();
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
      expect(this.ast.rootNodes[0].func.value).toBe('...');
      expect(this.ast.rootNodes[0].func.dataType).toBe('blank');
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

  describe("when parsing variable definitions,", function() {
    beforeEach(function() {
      this.ast = this.parser.parse('(define foo "bar")');
    });

    it("should convert defVar expressions to variableDef", function() {
      expect(this.ast.rootNodes[0].type).toBe('variableDef');
      expect(this.ast.rootNodes[0].name).toBe('foo');
      expect(this.ast.rootNodes[0].body.type).toBe('literal');
    });
  });

  /* 
   * The WeScheme parser ignores comments at the lexing stage.
   * This may change in a future release, but for now these
   * tests are commented out

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
  */

  describe("when parsing struct definitions,", function() {

    beforeEach(function() {
      this.ast = this.parser.parse('(define-struct 3d-point (x y z))');
    });

    it("should convert defStruct to struct", function() {
      expect(this.ast.rootNodes[0].type).toBe('struct');
    });

    it("should convert the struct name correctly", function() {
      expect(this.ast.rootNodes[0].name).toBe('3d-point');
    });

    it("should parse fields correctly", function() {
      expect(this.ast.rootNodes[0].fields.length).toBe(3);
      expect(this.ast.rootNodes[0].fields[0].value).toBe('x');
      expect(this.ast.rootNodes[0].fields[2].value).toBe('z');
    });
  });

  describe("when parsing function definitions,", function() {

    beforeEach(function() {
      this.ast = this.parser.parse('(define (add2 x) (+ x 2))');
    });

    it("should convert defFunc to functionDefinition", function() {
      expect(this.ast.rootNodes[0].type).toBe('functionDef');
    });

    it("should convert the function name correctly", function() {
      expect(this.ast.rootNodes[0].name).toBe('add2');
    });

    it("should convert the function argument correctly", function() {
      expect(this.ast.rootNodes[0].args.length).toBe(1);
      expect(this.ast.rootNodes[0].args[0]).toBe('x');
    });

    it("should convert the function body correctly", function() {
      expect(this.ast.rootNodes[0].body.type).toBe('expression');
    });
  });

  describe("when parsing expressions that are unsupported in the block language,", function() {

    it("should ignore defVars", function() {
      this.ast = this.parser.parse('(define-values (a b c) (1 2 3))');
      expect(this.ast.rootNodes.length).toBe(0);
    });
    it("should ignore lambdaExpr", function() {
      this.ast = this.parser.parse('(lambda (x) (x x))');
      expect(this.ast.rootNodes.length).toBe(0);
    });
    it("should ignore localExpr", function() {
      this.ast = this.parser.parse('(local [(define x 2)] x)');
      expect(this.ast.rootNodes.length).toBe(0);
    });
    it("should ignore letExpr", function() {
      this.ast = this.parser.parse('(let ((x 42)) x)');
      expect(this.ast.rootNodes.length).toBe(0);
    });
    it("should ignore letStar", function() {
      this.ast = this.parser.parse('(let* ((x 42)) x)');
      expect(this.ast.rootNodes.length).toBe(0);
    });
    it("should ignore letrectExpr", function() {
      this.ast = this.parser.parse('(letrec ((x 42)) x)');
      expect(this.ast.rootNodes.length).toBe(0);
    });
    it("should ignore ifExpr", function() {
      this.ast = this.parser.parse('(if (> 0 1) x y)');
      expect(this.ast.rootNodes.length).toBe(0);
    });
    it("should ignore letStar", function() {
      this.ast = this.parser.parse('(begin (+ 1 2) (+ 3 4) 5)');
      expect(this.ast.rootNodes.length).toBe(0);
    });
    it("should ignore whenExpr", function() {
      this.ast = this.parser.parse('(when (> 3 2) x)');
      expect(this.ast.rootNodes.length).toBe(0);
    });
    it("should ignore quotedExpr", function() {
      this.ast = this.parser.parse('\'(+ 4 2)');
      expect(this.ast.rootNodes.length).toBe(0);
    });
    it("should ignore unquotedExpr", function() {
      this.ast = this.parser.parse('\',42');
      console.log(this.ast.rootNodes[0]);
      expect(this.ast.rootNodes.length).toBe(0);
    });
    it("should ignore quasiquotedExpr", function() {
      this.ast = this.parser.parse('`42');
      console.log(this.ast.rootNodes[0]);
      expect(this.ast.rootNodes.length).toBe(0);
    });
    it("should ignore unquoteSplice", function() {
      this.ast = this.parser.parse('`#(1 ,@(list 1 2) 4)');
      expect(this.ast.rootNodes.length).toBe(0);
    });
    it("should ignore condExpr", function() {
      this.ast = this.parser.parse('(cond [true 1] [false 2])');
      expect(this.ast.rootNodes.length).toBe(0);
    });
    it("should ignore caseExpr", function() {
      this.ast = this.parser.parse('(case 9 [(1) "a"])');
      console.log(this.ast.rootNodes[0]);
      expect(this.ast.rootNodes.length).toBe(0);
    });
    it("should ignore require", function() {
      this.ast = this.parser.parse('(require 2htdp/image)');
      expect(this.ast.rootNodes.length).toBe(0);
    });
    it("should ignore provide", function() {
      this.ast = this.parser.parse('(provide nori)');
      expect(this.ast.rootNodes.length).toBe(0);
    });

  });

  describe("when setting aria-labels", function() {
    it("should make symbols, and numbers be set to themselves", function() {
      expect(this.parser.parse('1').rootNodes[0].options['aria-label']).toBe('1');
      expect(this.parser.parse('symbol').rootNodes[0].options['aria-label']).toBe('symbol');
    });

    it("should make boolean values be set to 'true' or 'false'", function() {
      expect(this.parser.parse('#t').rootNodes[0].options['aria-label']).toBe('true');
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

  describe("parsing malformed code,", function() {
    beforeEach(function() {
      this.ast = [];
    });

    it("parse malformed defVar (define a)", function() {
      this.ast = this.parser.parse("(define a)");
      expect(this.ast.rootNodes[0].type).toBe('unknown');
      expect(this.ast.rootNodes[0].elts[0].value).toBe('define');
      expect(this.ast.rootNodes[0].elts.length).toBe(2);
      expect(this.ast.rootNodes[0].elts[1].value).toBe('a');
    });

    it("parse malformed defFun (define (a)", function() {
      this.ast = this.parser.parse("(define (a))");
      expect(this.ast.rootNodes[0].type).toBe('unknown');
      expect(this.ast.rootNodes[0].elts[0].value).toBe('define');
      expect(this.ast.rootNodes[0].elts.length).toBe(2);
      expect(this.ast.rootNodes[0].elts[1].type).toBe('expression');
      expect(this.ast.rootNodes[0].elts[1].func.value).toBe('a');
    });

    it("parse malformed defStruct (define-struct a (a b c) d)", function() {
      this.ast = this.parser.parse("(define-struct a (a b c) d)");
      expect(this.ast.rootNodes[0].type).toBe('unknown');
      expect(this.ast.rootNodes[0].elts[0].value).toBe('define-struct');
      expect(this.ast.rootNodes[0].elts.length).toBe(4);
      expect(this.ast.rootNodes[0].elts[1].type).toBe('literal');
      expect(this.ast.rootNodes[0].elts[2].type).toBe('expression');
      expect(this.ast.rootNodes[0].elts[3].value).toBe('d');
    });

    it("parse malformed ifExpression (if)", function() {
      this.ast = this.parser.parse("(if)");
      expect(this.ast.rootNodes[0].type).toBe('unknown');
      expect(this.ast.rootNodes[0].elts[0].value).toBe('if');
    });

    it("parse malformed ifExpression (if a)", function() {
      this.ast = this.parser.parse("(if a)");
      expect(this.ast.rootNodes[0].type).toBe('unknown');
      expect(this.ast.rootNodes[0].elts[0].type).toBe('literal');
      expect(this.ast.rootNodes[0].elts[0].value).toBe('if');
      expect(this.ast.rootNodes[0].elts.length).toBe(2);
      expect(this.ast.rootNodes[0].elts[1].value).toBe('a');
    });

    it("parse malformed ifExpression (if a b)", function() {
      this.ast = this.parser.parse("(if a b)");
      expect(this.ast.rootNodes[0].type).toBe('unknown');
      expect(this.ast.rootNodes[0].elts[0].type).toBe('literal');
      expect(this.ast.rootNodes[0].elts[0].value).toBe('if');
      expect(this.ast.rootNodes[0].elts.length).toBe(3);
      expect(this.ast.rootNodes[0].elts[1].value).toBe('a');
      expect(this.ast.rootNodes[0].elts[2].value).toBe('b');
    });

    it("parse malformed condExpression (cond)", function() {
      this.ast = this.parser.parse("(cond)");
      expect(this.ast.rootNodes[0].type).toBe('unknown');
      expect(this.ast.rootNodes[0].elts[0].type).toBe('literal');
      expect(this.ast.rootNodes[0].elts[0].value).toBe('cond');
    });

    it("parse malformed condExpression (cond (a))", function() {
      this.ast = this.parser.parse("(cond (a))");
      expect(this.ast.rootNodes[0].type).toBe('unknown');
      expect(this.ast.rootNodes[0].elts[0].type).toBe('literal');
      expect(this.ast.rootNodes[0].elts[0].value).toBe('cond');
      expect(this.ast.rootNodes[0].elts[1].type).toBe('expression');
      expect(this.ast.rootNodes[0].elts[1].func.value).toBe('a');
    });

    it("parse malformed andExpression (and)", function() {
      this.ast = this.parser.parse("(and)");
      expect(this.ast.rootNodes[0].type).toBe('unknown');
      expect(this.ast.rootNodes[0].elts[0].value).toBe('and');
      expect(this.ast.rootNodes[0].elts.length).toBe(1);
    });

    it("parse malformed orExpression (or a)", function() {
      this.ast = this.parser.parse("(or a)");
      expect(this.ast.rootNodes[0].type).toBe('unknown');
      expect(this.ast.rootNodes[0].elts[0].type).toBe('literal');
      expect(this.ast.rootNodes[0].elts[0].value).toBe('or');
      expect(this.ast.rootNodes[0].elts.length).toBe(2);
      expect(this.ast.rootNodes[0].elts[1].value).toBe('a');
    });

    it("parse malformed lambdaExpression (lambda a b)", function() {
      this.ast = this.parser.parse("(lambda a b)");
      expect(this.ast.rootNodes[0].type).toBe('unknown');
      expect(this.ast.rootNodes[0].elts[0].type).toBe('literal');
      expect(this.ast.rootNodes[0].elts[0].value).toBe('lambda');
      expect(this.ast.rootNodes[0].elts.length).toBe(3);
      expect(this.ast.rootNodes[0].elts[1].value).toBe('a');
      expect(this.ast.rootNodes[0].elts[2].value).toBe('b');
    });

    it("parse malformed localExpression (local a b)", function() {
      this.ast = this.parser.parse("(local a b)");
      expect(this.ast.rootNodes[0].type).toBe('unknown');
      expect(this.ast.rootNodes[0].elts[0].value).toBe('local');
      expect(this.ast.rootNodes[0].elts.length).toBe(3);
      expect(this.ast.rootNodes[0].elts[1].value).toBe('a');
      expect(this.ast.rootNodes[0].elts[2].value).toBe('b');
    });

    it("parse malformed letrecExpression (letrec a b)", function() {
      this.ast = this.parser.parse("(letrec a b)");
      expect(this.ast.rootNodes[0].type).toBe('unknown');
      expect(this.ast.rootNodes[0].elts[0].value).toBe('letrec');
      expect(this.ast.rootNodes[0].elts.length).toBe(3);
      expect(this.ast.rootNodes[0].elts[1].value).toBe('a');
      expect(this.ast.rootNodes[0].elts[2].value).toBe('b');
    });

    it("parse malformed letExpression (let a b)", function() {
      this.ast = this.parser.parse("(let a b)");
      expect(this.ast.rootNodes[0].type).toBe('unknown');
      expect(this.ast.rootNodes[0].elts[0].value).toBe('let');
      expect(this.ast.rootNodes[0].elts.length).toBe(3);
      expect(this.ast.rootNodes[0].elts[1].value).toBe('a');
      expect(this.ast.rootNodes[0].elts[2].value).toBe('b');
    });

    it("parse malformed letStarExpression (let* a b)", function() {
      this.ast = this.parser.parse("(let* a b)");
      expect(this.ast.rootNodes[0].type).toBe('unknown');
      expect(this.ast.rootNodes[0].elts[0].value).toBe('let*');
      expect(this.ast.rootNodes[0].elts.length).toBe(3);
      expect(this.ast.rootNodes[0].elts[1].value).toBe('a');
      expect(this.ast.rootNodes[0].elts[2].value).toBe('b');
    });

    it("parse malformed beginExpression (begin)", function() {
      this.ast = this.parser.parse("(begin)");
      expect(this.ast.rootNodes[0].type).toBe('unknown');
      expect(this.ast.rootNodes[0].elts[0].value).toBe('begin');
      expect(this.ast.rootNodes[0].elts.length).toBe(1);
    });

  });
});
