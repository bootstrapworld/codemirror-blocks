import PyretParser from 'codemirror-blocks/languages/pyret/PyretParser';

describe("The Pyret Parser,", function() {
  beforeEach(function() {
    this.parser = new PyretParser();
  });

  it("should set the appropriate data type for literals", function() {
    let test = (str, dt) => {
      expect(this.parser.parse(str).rootNodes[0].dataType).toBe(dt);
    }
    test('true', 'boolean');
    test('1', 'number');
    test('"true"', 'string');
    test('x', 'symbol');
  });

  it("should have some label for literals", function () {
    let test = (str) => expect(this.parser.parse(str).rootNodes[0].options["aria-label"]).not.toBe(undefined);
    test('true');
    test('1');
    test('"hello"');
    test('x');
  });

  it("should have some label for Bootstrap constructs", function() {
    let test = (str) => expect(this.parser.parse(str).rootNodes[0].options["aria-label"]).not.toBe(undefined);
    /**
     * From Justin and Emmanuel
     * import
     * load-spreadhseet
	   * load-table
	   * simple let bindings -> improve stylings and rendering
	   * funciton definition -> works
	   * func app -> similar as simple let (s-app NYI)
	   * method invocation -> same
	   * binop -> works
	   * check-expects -> hash error
	   * is -> not recognized as an operator
	   * tuples -> NYI
	   * constructor ([list: 1, 2, 3]) -> all except styling
	   * dot accessor
	   * if would be nice to have
     */
    // test('include gdrive-sheets');
//     test('presidents-sheet = load-spreadsheet("14er5Mh443Lb5SIFxXZHdAnLCuQZaA8O6qtgGlibQuEg")');
//     test(`presidents = load-table: nth, name, home-state, year-started, year-ended, party
//   source: presidents-sheet.sheet-by-name("presidents", true)
// end`);
    test(`x = 3`);
    test(`3 + 5`);
    test(`fun f(x): x + 3 end`);
    test('f(5)');
    test(`x.len()`);
    test(`3 + 4 is 7`);
    test(`check: 3 + 5 is 8 end`);
    test('{1;2}');
    test('[list: 1, 2, 3]');
    test('row["field"]');
  });

  /* it("should treat vector literals like expressions", function() {
    let ast = this.parser.parse('#(1 3)');
    expect(ast.rootNodes[0].type).toBe('functionApp');
    ast = this.parser.parse('#9(#f)');
    expect(ast.rootNodes[0].type).toBe('functionApp');
  });

  it("should treat booleans expression like regular expressions", function() {
    let ast = this.parser.parse('(or #t #f)');
    expect(ast.rootNodes[0].type).toBe('functionApp');
    ast = this.parser.parse('(and #t #f)');
    expect(ast.rootNodes[0].type).toBe('functionApp');
  });

  describe("when parsing callExpressions,", function() {

    beforeEach(function() {
      this.ast = this.parser.parse('(sum 1 2 3)');
    });

    it("should convert callExpresssions to expressions", function() {
      expect(this.ast.rootNodes[0].type).toBe('functionApp');
    });

    it("should convert the function symbol to a literal", function() {
      expect(this.ast.rootNodes[0].func.type).toBe('literal');
      expect(this.ast.rootNodes[0].func.dataType).toBe('symbol');
    });

    it("should support empty expressions by generating a placeholder literal", function() {
      this.ast = this.parser.parse('()');
      expect(this.ast.rootNodes[0].type).toBe('functionApp');
      expect(this.ast.rootNodes[0].func.value).toBe('...');
      expect(this.ast.rootNodes[0].func.dataType).toBe('blank');
    });
  });

  describe("when parsing andExpressions and orExpression,", function() {
    beforeEach(function() {
      this.ast = this.parser.parse('(or true true) (and true true)');
    });

    it("should convert and/or expressions to expressions", function() {
      expect(this.ast.rootNodes[0].type).toBe('functionApp');
      expect(this.ast.rootNodes[1].type).toBe('functionApp');
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
      expect(this.ast.rootNodes[0].type).toBe('variableDefinition');
      expect(this.ast.rootNodes[0].name.value).toBe('foo');
      expect(this.ast.rootNodes[0].body.type).toBe('literal');
    });
  });

  describe("when parsing comments,", function() {
    beforeEach(function() {
      this.ast = this.parser.parse(';this is a comment\n3');
    });

    it("should convert comments to codemirror-blocks comments", function() {
      expect(this.ast.rootNodes[0].type).toBe('literal');
      expect(this.ast.rootNodes[0].options.comment.type).toBe('comment');
    });

    it("should keep track of the text of the comment", function() {
      expect(this.ast.rootNodes[0].options.comment.comment).toBe('this is a comment');
    });
  });


  describe("when parsing struct definitions,", function() {

    beforeEach(function() {
      this.ast = this.parser.parse('(define-struct 3d-point (x y z))');
    });

    it("should convert defStruct to struct", function() {
      expect(this.ast.rootNodes[0].type).toBe('structDefinition');
    });

    it("should convert the struct name correctly", function() {
      expect(this.ast.rootNodes[0].name.value).toBe('3d-point');
    });

    it("should parse fields correctly", function() {
      expect(this.ast.rootNodes[0].fields.ids.length).toBe(3);
      expect(this.ast.rootNodes[0].fields.ids[0].value).toBe('x');
      expect(this.ast.rootNodes[0].fields.ids[2].value).toBe('z');
    });
  });

  describe("when parsing function definitions,", function() {

    beforeEach(function() {
      this.ast = this.parser.parse('(define (add2 x) (+ x 2))');
    });

    it("should convert defFunc to functionDefinition", function() {
      expect(this.ast.rootNodes[0].type).toBe('functionDefinition');
    });

    it("should convert the function name correctly", function() {
      expect(this.ast.rootNodes[0].name.value).toBe('add2');
    });

    it("should convert the function argument correctly", function() {
      expect(this.ast.rootNodes[0].params.ids.length).toBe(1);
      expect(this.ast.rootNodes[0].params.ids[0].value).toBe('x');
    });

    it("should convert the function body correctly", function() {
      expect(this.ast.rootNodes[0].body.type).toBe('functionApp');
    });
  });

  describe("when parsing lambda expressions,", function() {
    beforeEach(function() {
      this.ast = this.parser.parse(`(lambda (x y) (+ x y))`);
    });

    it("should convert lambdaExpr to lambdaExpression", function() {
      expect(this.ast.rootNodes[0].type).toBe('lambdaExpression');
    });

    it("should convert the arguments correctly", function() {
      expect(this.ast.rootNodes[0].args.ids.length).toBe(2);
      expect(this.ast.rootNodes[0].args.ids[0].value).toBe('x');
      expect(this.ast.rootNodes[0].args.ids[1].value).toBe('y');
    });

    it("should convert the body correctly", function() {
      expect(this.ast.rootNodes[0].body.type).toBe('functionApp');
    });
  });

  describe("when parsing cond expressions,", function() {
    beforeEach(function() {
      this.ast = this.parser.parse(
`(cond
  [(positive? -5) (error "doesn't get here")]
  [(zero? -5) (error "doesn't get here, either")]
  [(positive? 5) #t])`
      );
    });

    it("should convert condExpr to condExpression", function() {
      expect(this.ast.rootNodes[0].type).toBe('condExpression');
    });

    it("should convert the clauses correctly", function() {
      const clauses = this.ast.rootNodes[0].clauses;
      expect(clauses.length).toBe(3);
      expect(clauses[0].type).toBe('condClause');
    });

    it("should have a sane toString method", function() {
      expect(this.ast.rootNodes[0].toString()).toEqual(
`(cond
  [(positive? -5) (error "doesn't get here")]
  [(zero? -5) (error "doesn't get here, either")]
  [(positive? 5) #t])`
      );
    });
  });

  describe("when parsing if definitions,", function() {
    beforeEach(function() {
      this.ast = this.parser.parse('(if (> 0 1) x y)');
    });

    it("should convert ifExpr to ifExpression", function() {
      expect(this.ast.rootNodes[0].type).toBe('ifExpression');
    });

    it("should convert the test expression correctly", function() {
      expect(this.ast.rootNodes[0].testExpr.type).toBe('functionApp');
    });

    it("should convert the then expression correctly", function() {
      expect(this.ast.rootNodes[0].thenExpr.type).toBe('literal');
      expect(this.ast.rootNodes[0].thenExpr.dataType).toBe('symbol');
      expect(this.ast.rootNodes[0].thenExpr.value).toBe('x');
    });

    it("should convert the else expression correctly", function() {
      expect(this.ast.rootNodes[0].elseExpr.type).toBe('literal');
      expect(this.ast.rootNodes[0].elseExpr.dataType).toBe('symbol');
      expect(this.ast.rootNodes[0].elseExpr.value).toBe('y');
    });
  });

  describe("when parsing sequences,", function() {
    beforeEach(function() {
      this.ast = this.parser.parse('(begin (- (+ 1 2) 5) (print "hello"))');
    });

    it("should convert beginExpr to a sequence", function() {
      expect(this.ast.rootNodes[0].type).toBe('sequence');
    });

    it("should get the correct name of the sequence", function() {
      expect(this.ast.rootNodes[0].name).toBe('begin');
    });

    it("should convert the sequence's expressions correctly", function() {
      expect(this.ast.rootNodes[0].exprs[0].type).toBe('functionApp');
      expect(this.ast.rootNodes[0].exprs[1].type).toBe('functionApp');
    });

    it("should leave the expressions in the order that they appeared in the sequence", function() {
      expect(this.ast.rootNodes[0].exprs[0].func.value).toBe('-');
      expect(this.ast.rootNodes[0].exprs[1].func.value).toBe('print');
    });

    it("should preserve nested expressions in the sequence", function() {
      var firstExpression = this.ast.rootNodes[0].exprs[0];
      expect(firstExpression.func.value).toBe('-');
      expect(firstExpression.args[0].type).toBe('functionApp');
      expect(firstExpression.args[1].type).toBe('literal');
    });
  });

  describe("when parsing let-like expressions,", function() {
    beforeEach(function() {
      this.ast = this.parser.parse('(let* ((x 1) (y 2) (z (+ x y))) (* x y z))');
    });

    it("should convert letExpr to a letLikeExpr", function() {
      expect(this.ast.rootNodes[0].type).toBe('letLikeExpr');
    });

    it("should get the correct form of the letLikeExpr", function() {
      expect(this.ast.rootNodes[0].form).toBe('let*');
    });

    it("should get the correct aria-label", function() {
      expect(this.ast.rootNodes[0].options['aria-label']).toBe('let-star expression with 3 bindings');
    });

    it("should convert the bindings to a sequence, correctly", function() {
      expect(this.ast.rootNodes[0].bindings.type).toBe('sequence');
      expect(this.ast.rootNodes[0].bindings.name).toBe('bindings');
      expect(this.ast.rootNodes[0].bindings.exprs.length).toBe(3);
      expect(this.ast.rootNodes[0].bindings.exprs[0].type).toBe('variableDefinition');
      expect(this.ast.rootNodes[0].bindings.exprs[0].name.value).toBe('x');
      expect(this.ast.rootNodes[0].bindings.exprs[1].type).toBe('variableDefinition');
      expect(this.ast.rootNodes[0].bindings.exprs[1].name.value).toBe('y');
      expect(this.ast.rootNodes[0].bindings.exprs[2].type).toBe('variableDefinition');
      expect(this.ast.rootNodes[0].bindings.exprs[2].name.value).toBe('z');
    });

    it("should convert the let-body properly", function() {
      expect(this.ast.rootNodes[0].expr.type).toBe('functionApp');
      expect(this.ast.rootNodes[0].expr.func.value).toBe('*');
    });
  });

  describe("when parsing whenUnless expressions,", function() {
    beforeEach(function() {
      this.ast = this.parser.parse('(when (> a b) x y z)');
    });

    it("should convert WhenUnless to a WhenUnlessExpr node", function() {
      expect(this.ast.rootNodes[0].type).toBe('whenUnlessExpr');
    });

    it("should get the correct form of the WhenUnlessExpr", function() {
      expect(this.ast.rootNodes[0].form).toBe('when');
    });

    it("should get the correct aria-label", function() {
      expect(this.ast.rootNodes[0].options['aria-label']).toBe('when expression');
    });

    it("should convert the predicate properly", function() {
      expect(this.ast.rootNodes[0].predicate.type).toBe('functionApp');
      expect(this.ast.rootNodes[0].predicate.func.value).toBe('>');
    });

    it("should convert the exprs to a sequence, correctly", function() {
      expect(this.ast.rootNodes[0].exprs.type).toBe('sequence');
      expect(this.ast.rootNodes[0].exprs.name).toBe('begin');
      expect(this.ast.rootNodes[0].exprs.exprs.length).toBe(3);
      expect(this.ast.rootNodes[0].exprs.exprs[0].type).toBe('literal');
      expect(this.ast.rootNodes[0].exprs.exprs[0].value).toBe('x');
      expect(this.ast.rootNodes[0].exprs.exprs[1].type).toBe('literal');
      expect(this.ast.rootNodes[0].exprs.exprs[1].value).toBe('y');
      expect(this.ast.rootNodes[0].exprs.exprs[2].type).toBe('literal');
      expect(this.ast.rootNodes[0].exprs.exprs[2].value).toBe('z');
    });
  });

  describe("when parsing expressions that are unsupported in the block language,", function() {

    it("should ignore defVars", function() {
      this.ast = this.parser.parse('(define-values (a b c) (1 2 3))');
      expect(this.ast.rootNodes.length).toBe(0);
    });
    it("should ignore localExpr", function() {
      this.ast = this.parser.parse('(local [(define x 2)] x)');
      expect(this.ast.rootNodes.length).toBe(0);
    });
    it("should ignore quotedExpr", function() {
      this.ast = this.parser.parse('\'(+ 4 2)');
      expect(this.ast.rootNodes.length).toBe(0);
    });
    it("should ignore unquotedExpr", function() {
      this.ast = this.parser.parse('\',(42 43 44)');
      expect(this.ast.rootNodes.length).toBe(0);
      this.ast = this.parser.parse('`(1 `,(+ 1 ,(+ 2 3)) 4)');
      expect(this.ast.rootNodes.length).toBe(0);
    });
    it("should ignore quasiquotedExpr", function() {
      this.ast = this.parser.parse('`42');
      expect(this.ast.rootNodes.length).toBe(0);
      this.ast = this.parser.parse('`(1 ```,,@,,@(list (+ 1 2)) 4)');
      expect(this.ast.rootNodes.length).toBe(0);
    });
    it("should ignore unquoteSplice", function() {
      this.ast = this.parser.parse('`#(1 ,@(list 1 \'2) 4)');
      expect(this.ast.rootNodes.length).toBe(0);
    });
    it("should ignore caseExpr", function() {
      this.ast = this.parser.parse('(case 9 [(1) "a"])');
      console.log(this.ast.rootNodes[0]);
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
      expect(this.parser.parse('#t').rootNodes[0].options['aria-label']).toBe('true, a Boolean');
    });

    it("should make string values be set to 'string '+the contents of the string", function() {
      expect(this.parser.parse('"hello"').rootNodes[0].options['aria-label'])
        .toBe('hello, a String');
    });

    it("should make expression (print 'hello') into 'print expression, 1 input'", function() {
      expect(this.parser.parse('(print "hello")').rootNodes[0].options['aria-label'])
        .toBe('print expression, 1 input');
      expect(this.parser.parse('(print "hello" "world")').rootNodes[0].options['aria-label'])
        .toBe('print expression, 2 inputs');
    });

    it("should make and/or expressions just like regular expressions", function() {
      expect(this.parser.parse('(and true true)').rootNodes[0].options['aria-label'])
        .toBe('and expression, 2 inputs');
      expect(this.parser.parse('(or false true)').rootNodes[0].options['aria-label'])
        .toBe('or expression, 2 inputs');
    });

    it("should turn symbols into readable words", function() {
      expect(this.parser.parse('(* 1 2)').rootNodes[0].options['aria-label'])
        .toBe('multiply expression, 2 inputs');
      expect(this.parser.parse('(/ 1 2)').rootNodes[0].options['aria-label'])
        .toBe('divide expression, 2 inputs');
      expect(this.parser.parse('(foo? 0)').rootNodes[0].options['aria-label'])
        .toBe('foo-huh expression, 1 input');
      expect(this.parser.parse('(set! x 2)').rootNodes[0].options['aria-label'])
        .toBe('set-bang expression, 2 inputs');                 
      expect(this.parser.parse('#(1 2)').rootNodes[0].options['aria-label'])
        .toBe('vector expression, 2 inputs');                 
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

    it("parse malformed defVars (define-values a)", function() {
      this.ast = this.parser.parse("(define-values a)");
      expect(this.ast.rootNodes[0].type).toBe('unknown');
      expect(this.ast.rootNodes[0].elts[0].value).toBe('define-values');
      expect(this.ast.rootNodes[0].elts.length).toBe(2);
      expect(this.ast.rootNodes[0].elts[1].value).toBe('a');
    });

    it("parse malformed defFun (define (a)", function() {
      this.ast = this.parser.parse("(define (a))");
      expect(this.ast.rootNodes[0].type).toBe('unknown');
      expect(this.ast.rootNodes[0].elts[0].value).toBe('define');
      expect(this.ast.rootNodes[0].elts.length).toBe(2);
      expect(this.ast.rootNodes[0].elts[1].type).toBe('functionApp');
      expect(this.ast.rootNodes[0].elts[1].func.value).toBe('a');
    });

    it("parse malformed defStruct (define-struct a (a b c) d)", function() {
      this.ast = this.parser.parse("(define-struct a (a b c) d)");
      expect(this.ast.rootNodes[0].type).toBe('unknown');
      expect(this.ast.rootNodes[0].elts[0].value).toBe('define-struct');
      expect(this.ast.rootNodes[0].elts.length).toBe(4);
      expect(this.ast.rootNodes[0].elts[1].type).toBe('literal');
      expect(this.ast.rootNodes[0].elts[2].type).toBe('functionApp');
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
      expect(this.ast.rootNodes[0].elts[1].type).toBe('functionApp');
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

    it("parse malformed requireExpression (requre)", function() {
      this.ast = this.parser.parse("(require)");
      expect(this.ast.rootNodes[0].type).toBe('unknown');
      expect(this.ast.rootNodes[0].elts[0].value).toBe('require');
      expect(this.ast.rootNodes[0].elts.length).toBe(1);
    });

    it("parse malformed else (else)", function() {
      this.ast = this.parser.parse("(else)");
      expect(this.ast.rootNodes[0].type).toBe('unknown');
      expect(this.ast.rootNodes[0].elts[0].value).toBe('else');
      expect(this.ast.rootNodes[0].elts.length).toBe(1);
    });
  }); */

});
