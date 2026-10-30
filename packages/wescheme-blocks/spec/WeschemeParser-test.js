import { parse } from "../src/WeschemeParser";

describe("The WeScheme Parser,", function () {
  it("should set the appropriate data type for literals", function () {
    expect(parse("#t")[0].fields.dataType).toBe("boolean");
    expect(parse("1")[0].fields.dataType).toBe("number");
    expect(parse('"hello"')[0].fields.dataType).toBe("string");
    expect(parse("#\\m")[0].fields.dataType).toBe("character");
    expect(parse("foo")[0].fields.dataType).toBe("symbol");
  });

  it("should label check-expect as a unit test of the function under test", function () {
    expect(parse("(check-expect (f 1) 2)")[0].options.ariaLabel).toBe(
      "Unit Test for f"
    );
    expect(parse("(check-expect 1 1)")[0].options.ariaLabel).toBe(
      "check-expect expression, 2 inputs"
    );
  });

  it("should treat vector literals like expressions", function () {
    let ast = parse("#(1 3)");
    expect(ast[0].type).toBe("functionApp");
    ast = parse("#9(#f)");
    expect(ast[0].type).toBe("functionApp");
  });

  it("should treat booleans expression like regular expressions", function () {
    let ast = parse("(or #t #f)");
    expect(ast[0].type).toBe("functionApp");
    ast = parse("(and #t #f)");
    expect(ast[0].type).toBe("functionApp");
  });

  describe("when parsing callExpressions,", function () {
    beforeEach(function () {
      this.ast = parse("(sum 1 2 3)");
    });

    it("should convert callExpresssions to expressions", function () {
      expect(this.ast[0].type).toBe("functionApp");
    });

    it("should convert the function symbol to a literal", function () {
      expect(this.ast[0].fields.func.type).toBe("literal");
      expect(this.ast[0].fields.func.fields.dataType).toBe("symbol");
    });

    it("should support empty expressions by generating a placeholder literal", function () {
      this.ast = parse("()");
      expect(this.ast[0].type).toBe("functionApp");
      expect(this.ast[0].fields.func.fields.value).toBe("...");
      expect(this.ast[0].fields.func.fields.dataType).toBe("blank");
    });
  });

  describe("when parsing andExpressions and orExpression,", function () {
    beforeEach(function () {
      this.ast = parse("(or true true) (and true true)");
    });

    it("should convert and/or expressions to expressions", function () {
      expect(this.ast[0].type).toBe("functionApp");
      expect(this.ast[1].type).toBe("functionApp");
    });

    it("should convert the function symbol to a literal", function () {
      expect(this.ast[0].fields.func.type).toBe("literal");
      expect(this.ast[1].fields.func.type).toBe("literal");
      expect(this.ast[0].fields.func.fields.dataType).toBe("symbol");
      expect(this.ast[1].fields.func.fields.dataType).toBe("symbol");
      expect(this.ast[0].fields.func.fields.value).toBe("or");
      expect(this.ast[1].fields.func.fields.value).toBe("and");
    });
  });

  describe("when parsing variable definitions,", function () {
    beforeEach(function () {
      this.ast = parse('(define foo "bar")');
    });

    it("should convert defVar expressions to variableDef", function () {
      expect(this.ast[0].type).toBe("variableDefinition");
      expect(this.ast[0].fields.name.fields.value).toBe("foo");
      expect(this.ast[0].fields.body.type).toBe("literal");
    });
  });

  describe("when parsing comments,", function () {
    beforeEach(function () {
      this.ast = parse(";this is a comment\n3");
    });

    it("should convert comments to codemirror-blocks comments", function () {
      expect(this.ast[0].type).toBe("literal");
      expect(this.ast[0].options.comment.type).toBe("comment");
    });

    it("should keep track of the text of the comment", function () {
      expect(this.ast[0].options.comment.fields.comment).toBe(
        "this is a comment"
      );
    });
  });

  describe("when parsing struct definitions,", function () {
    beforeEach(function () {
      this.ast = parse("(define-struct 3d-point (x y z))");
    });

    it("should convert defStruct to struct", function () {
      expect(this.ast[0].type).toBe("structDefinition");
    });

    it("should convert the struct name correctly", function () {
      expect(this.ast[0].fields.name.fields.value).toBe("3d-point");
    });

    it("should parse fields correctly", function () {
      expect(this.ast[0].fields.fields.fields.ids.length).toBe(3);
      expect(this.ast[0].fields.fields.fields.ids[0].fields.value).toBe("x");
      expect(this.ast[0].fields.fields.fields.ids[2].fields.value).toBe("z");
    });
  });

  describe("when parsing function definitions,", function () {
    beforeEach(function () {
      this.ast = parse("(define (add2 x) (+ x 2))");
    });

    it("should convert defFunc to functionDefinition", function () {
      expect(this.ast[0].type).toBe("functionDefinition");
    });

    it("should convert the function name correctly", function () {
      expect(this.ast[0].fields.name.fields.value).toBe("add2");
    });

    it("should convert the function argument correctly", function () {
      expect(this.ast[0].fields.params.fields.ids.length).toBe(1);
      expect(this.ast[0].fields.params.fields.ids[0].fields.value).toBe("x");
    });

    it("should convert the function body correctly", function () {
      expect(this.ast[0].fields.body.type).toBe("functionApp");
    });
  });

  describe("when parsing lambda expressions,", function () {
    beforeEach(function () {
      this.ast = parse(`(lambda (x y) (+ x y))`);
    });

    it("should convert lambdaExpr to lambdaExpression", function () {
      expect(this.ast[0].type).toBe("lambdaExpression");
    });

    it("should convert the arguments correctly", function () {
      expect(this.ast[0].fields.args.fields.ids.length).toBe(2);
      expect(this.ast[0].fields.args.fields.ids[0].fields.value).toBe("x");
      expect(this.ast[0].fields.args.fields.ids[1].fields.value).toBe("y");
    });

    it("should convert the body correctly", function () {
      expect(this.ast[0].fields.body.type).toBe("functionApp");
    });
  });

  describe("when parsing cond expressions,", function () {
    beforeEach(function () {
      this.ast = parse(
        `(cond
  [(positive? -5) (error "doesn't get here")]
  [(zero? -5) (error "doesn't get here, either")]
  [(positive? 5) #t])`
      );
    });

    it("should convert condExpr to condExpression", function () {
      expect(this.ast[0].type).toBe("condExpression");
    });

    it("should convert the clauses correctly", function () {
      const clauses = this.ast[0].fields.clauses;
      expect(clauses.length).toBe(3);
      expect(clauses[0].type).toBe("condClause");
    });

    it("should have a sane toString method", function () {
      expect(this.ast[0].toString()).toEqual(
        `(cond
  [(positive? -5) (error "doesn't get here")]
  [(zero? -5) (error "doesn't get here, either")]
  [(positive? 5) #t])`
      );
    });
  });

  describe("when parsing if definitions,", function () {
    beforeEach(function () {
      this.ast = parse("(if (> 0 1) x y)");
    });

    it("should convert ifExpr to ifExpression", function () {
      expect(this.ast[0].type).toBe("ifExpression");
    });

    it("should convert the test expression correctly", function () {
      expect(this.ast[0].fields.testExpr.type).toBe("functionApp");
    });

    it("should convert the then expression correctly", function () {
      expect(this.ast[0].fields.thenExpr.type).toBe("literal");
      expect(this.ast[0].fields.thenExpr.fields.dataType).toBe("symbol");
      expect(this.ast[0].fields.thenExpr.fields.value).toBe("x");
    });

    it("should convert the else expression correctly", function () {
      expect(this.ast[0].fields.elseExpr.type).toBe("literal");
      expect(this.ast[0].fields.elseExpr.fields.dataType).toBe("symbol");
      expect(this.ast[0].fields.elseExpr.fields.value).toBe("y");
    });
  });

  describe("when parsing sequences,", function () {
    beforeEach(function () {
      this.ast = parse('(begin (- (+ 1 2) 5) (print "hello"))');
    });

    it("should convert beginExpr to a sequence", function () {
      expect(this.ast[0].type).toBe("sequence");
    });

    it("should get the correct name of the sequence", function () {
      expect(this.ast[0].fields.name.fields.value).toBe("begin");
    });

    it("should convert the sequence's expressions correctly", function () {
      expect(this.ast[0].fields.exprs[0].type).toBe("functionApp");
      expect(this.ast[0].fields.exprs[1].type).toBe("functionApp");
    });

    it("should leave the expressions in the order that they appeared in the sequence", function () {
      expect(this.ast[0].fields.exprs[0].fields.func.fields.value).toBe("-");
      expect(this.ast[0].fields.exprs[1].fields.func.fields.value).toBe(
        "print"
      );
    });

    it("should preserve nested expressions in the sequence", function () {
      var firstExpression = this.ast[0].fields.exprs[0];
      expect(firstExpression.fields.func.fields.value).toBe("-");
      expect(firstExpression.fields.args[0].type).toBe("functionApp");
      expect(firstExpression.fields.args[1].type).toBe("literal");
    });
  });

  describe("when parsing let-like expressions,", function () {
    beforeEach(function () {
      this.ast = parse("(let* ((x 1) (y 2) (z (+ x y))) (* x y z))");
    });

    it("should convert letExpr to a letLikeExpr", function () {
      expect(this.ast[0].type).toBe("letLikeExpr");
    });

    it("should get the correct form of the letLikeExpr", function () {
      expect(this.ast[0].fields.form).toBe("let*");
    });

    it("should get the correct aria-label", function () {
      expect(this.ast[0].options.ariaLabel).toBe(
        "let-star expression with 3 bindings"
      );
    });

    it("should convert the bindings to a sequence, correctly", function () {
      expect(this.ast[0].fields.bindings.type).toBe("sequence");
      expect(this.ast[0].fields.bindings.fields.name.toString()).toBe(
        "bindings"
      );
      expect(this.ast[0].fields.bindings.fields.exprs.length).toBe(3);
      expect(this.ast[0].fields.bindings.fields.exprs[0].type).toBe(
        "variableDefinition"
      );
      expect(
        this.ast[0].fields.bindings.fields.exprs[0].fields.name.fields.value
      ).toBe("x");
      expect(this.ast[0].fields.bindings.fields.exprs[1].type).toBe(
        "variableDefinition"
      );
      expect(
        this.ast[0].fields.bindings.fields.exprs[1].fields.name.fields.value
      ).toBe("y");
      expect(this.ast[0].fields.bindings.fields.exprs[2].type).toBe(
        "variableDefinition"
      );
      expect(
        this.ast[0].fields.bindings.fields.exprs[2].fields.name.fields.value
      ).toBe("z");
    });

    it("should convert the let-body properly", function () {
      expect(this.ast[0].fields.expr.type).toBe("functionApp");
      expect(this.ast[0].fields.expr.fields.func.fields.value).toBe("*");
    });

    it("should pretty print", function () {
      expect(this.ast[0].pretty().display(80).join("\n")).toEqual(
        "(let* ((x 1) (y 2) (z (+ x y))) (* x y z))"
      );
    });
  });

  describe("when parsing whenUnless expressions,", function () {
    beforeEach(function () {
      this.ast = parse("(when (> a b) x y z)");
    });

    it("should convert WhenUnless to a WhenUnlessExpr node", function () {
      expect(this.ast[0].type).toBe("whenUnlessExpr");
    });

    it("should get the correct form of the WhenUnlessExpr", function () {
      expect(this.ast[0].fields.form).toBe("when");
    });

    it("should get the correct aria-label", function () {
      expect(this.ast[0].options.ariaLabel).toBe("when expression");
    });

    it("should convert the predicate properly", function () {
      expect(this.ast[0].fields.predicate.type).toBe("functionApp");
      expect(this.ast[0].fields.predicate.fields.func.fields.value).toBe(">");
    });

    it("should convert the exprs to a sequence, correctly", function () {
      expect(this.ast[0].fields.exprs.type).toBe("sequence");
      expect(this.ast[0].fields.exprs.fields.name.toString()).toBe("begin");
      expect(this.ast[0].fields.exprs.fields.exprs.length).toBe(3);
      expect(this.ast[0].fields.exprs.fields.exprs[0].type).toBe("literal");
      expect(this.ast[0].fields.exprs.fields.exprs[0].fields.value).toBe("x");
      expect(this.ast[0].fields.exprs.fields.exprs[1].type).toBe("literal");
      expect(this.ast[0].fields.exprs.fields.exprs[1].fields.value).toBe("y");
      expect(this.ast[0].fields.exprs.fields.exprs[2].type).toBe("literal");
      expect(this.ast[0].fields.exprs.fields.exprs[2].fields.value).toBe("z");
    });
  });

  describe("when parsing expressions that have no block of their own,", function () {
    // each is kept as a literal holding its source text, never dropped
    it.each([
      "(define-values (a b c) (1 2 3))",
      "(local [(define x 2)] x)",
      "'(+ 4 2)",
      "',(42 43 44)",
      "`(1 `,(+ 1 ,(+ 2 3)) 4)",
      "`42",
      "`(1 ```,,@,,@(list (+ 1 2)) 4)",
      "`#(1 ,@(list 1 '2) 4)",
      '(case 9 [(1) "a"])',
      "(provide nori)",
    ])("should keep %s as text", function (code) {
      const ast = parse(code);
      expect(ast.length).toBe(1);
      expect(ast[0].type).toBe("literal");
      expect(ast[0].fields.value).toBe(code);
      expect(ast[0].options.ariaLabel).toBe("unsupported expression");
    });
    it("should keep a multi-line form on one line", function () {
      const ast = parse("(local [(define x 2)]\n  x)");
      expect(ast[0].fields.value).toBe("(local [(define x 2)] x)");
    });
  });

  describe("when setting aria-labels", function () {
    it("should make symbols, and numbers be set to themselves", function () {
      expect(parse("1")[0].options.ariaLabel).toBe("1");
      expect(parse("symbol")[0].options.ariaLabel).toBe("symbol");
    });

    it("should make boolean values be set to 'true' or 'false'", function () {
      expect(parse("#t")[0].options.ariaLabel).toBe("true, a Boolean");
    });

    it("should make string values be set to 'string '+the contents of the string", function () {
      expect(parse('"hello"')[0].options.ariaLabel).toBe("hello, a String");
    });

    it("should make expression (print 'hello') into 'print expression, 1 input'", function () {
      expect(parse('(print "hello")')[0].options.ariaLabel).toBe(
        "print expression, 1 input"
      );
      expect(parse('(print "hello" "world")')[0].options.ariaLabel).toBe(
        "print expression, 2 inputs"
      );
    });

    it("should make and/or expressions just like regular expressions", function () {
      expect(parse("(and true true)")[0].options.ariaLabel).toBe(
        "and expression, 2 inputs"
      );
      expect(parse("(or false true)")[0].options.ariaLabel).toBe(
        "or expression, 2 inputs"
      );
    });

    it("should turn symbols into readable words", function () {
      expect(parse("(* 1 2)")[0].options.ariaLabel).toBe(
        "multiply expression, 2 inputs"
      );
      expect(parse("(/ 1 2)")[0].options.ariaLabel).toBe(
        "divide expression, 2 inputs"
      );
      expect(parse("(foo? 0)")[0].options.ariaLabel).toBe(
        "foo-huh expression, 1 input"
      );
      expect(parse("(set! x 2)")[0].options.ariaLabel).toBe(
        "set-bang expression, 2 inputs"
      );
      expect(parse("#(1 2)")[0].options.ariaLabel).toBe(
        "vector expression, 2 inputs"
      );
    });
  });

  describe("parsing malformed code,", function () {
    beforeEach(function () {
      this.ast = [];
    });

    it("parse malformed defVar (define a)", function () {
      this.ast = parse("(define a)");
      expect(this.ast[0].type).toBe("unknown");
      expect(this.ast[0].fields.elts[0].fields.value).toBe("define");
      expect(this.ast[0].fields.elts.length).toBe(2);
      expect(this.ast[0].fields.elts[1].fields.value).toBe("a");
    });

    it("parse malformed defVars (define-values a)", function () {
      this.ast = parse("(define-values a)");
      expect(this.ast[0].type).toBe("unknown");
      expect(this.ast[0].fields.elts[0].fields.value).toBe("define-values");
      expect(this.ast[0].fields.elts.length).toBe(2);
      expect(this.ast[0].fields.elts[1].fields.value).toBe("a");
    });

    it("parse malformed defFun (define (a)", function () {
      this.ast = parse("(define (a))");
      expect(this.ast[0].type).toBe("unknown");
      expect(this.ast[0].fields.elts[0].fields.value).toBe("define");
      expect(this.ast[0].fields.elts.length).toBe(2);
      expect(this.ast[0].fields.elts[1].type).toBe("functionApp");
      expect(this.ast[0].fields.elts[1].fields.func.fields.value).toBe("a");
    });

    it("parse malformed defStruct (define-struct a (a b c) d)", function () {
      this.ast = parse("(define-struct a (a b c) d)");
      expect(this.ast[0].type).toBe("unknown");
      expect(this.ast[0].fields.elts[0].fields.value).toBe("define-struct");
      expect(this.ast[0].fields.elts.length).toBe(4);
      expect(this.ast[0].fields.elts[1].type).toBe("literal");
      expect(this.ast[0].fields.elts[2].type).toBe("functionApp");
      expect(this.ast[0].fields.elts[3].fields.value).toBe("d");
    });

    it("parse malformed ifExpression (if)", function () {
      this.ast = parse("(if)");
      expect(this.ast[0].type).toBe("unknown");
      expect(this.ast[0].fields.elts[0].fields.value).toBe("if");
    });

    it("parse malformed ifExpression (if a)", function () {
      this.ast = parse("(if a)");
      expect(this.ast[0].type).toBe("unknown");
      expect(this.ast[0].fields.elts[0].type).toBe("literal");
      expect(this.ast[0].fields.elts[0].fields.value).toBe("if");
      expect(this.ast[0].fields.elts.length).toBe(2);
      expect(this.ast[0].fields.elts[1].fields.value).toBe("a");
    });

    it("parse malformed ifExpression (if a b)", function () {
      this.ast = parse("(if a b)");
      expect(this.ast[0].type).toBe("unknown");
      expect(this.ast[0].fields.elts[0].type).toBe("literal");
      expect(this.ast[0].fields.elts[0].fields.value).toBe("if");
      expect(this.ast[0].fields.elts.length).toBe(3);
      expect(this.ast[0].fields.elts[1].fields.value).toBe("a");
      expect(this.ast[0].fields.elts[2].fields.value).toBe("b");
    });

    it("parse malformed condExpression (cond)", function () {
      this.ast = parse("(cond)");
      expect(this.ast[0].type).toBe("unknown");
      expect(this.ast[0].fields.elts[0].type).toBe("literal");
      expect(this.ast[0].fields.elts[0].fields.value).toBe("cond");
    });

    it("parse malformed condExpression (cond (a))", function () {
      this.ast = parse("(cond (a))");
      expect(this.ast[0].type).toBe("unknown");
      expect(this.ast[0].fields.elts[0].type).toBe("literal");
      expect(this.ast[0].fields.elts[0].fields.value).toBe("cond");
      expect(this.ast[0].fields.elts[1].type).toBe("functionApp");
      expect(this.ast[0].fields.elts[1].fields.func.fields.value).toBe("a");
    });

    it("parse malformed andExpression (and)", function () {
      this.ast = parse("(and)");
      expect(this.ast[0].type).toBe("unknown");
      expect(this.ast[0].fields.elts[0].fields.value).toBe("and");
      expect(this.ast[0].fields.elts.length).toBe(1);
    });

    it("parse malformed orExpression (or a)", function () {
      this.ast = parse("(or a)");
      expect(this.ast[0].type).toBe("unknown");
      expect(this.ast[0].fields.elts[0].type).toBe("literal");
      expect(this.ast[0].fields.elts[0].fields.value).toBe("or");
      expect(this.ast[0].fields.elts.length).toBe(2);
      expect(this.ast[0].fields.elts[1].fields.value).toBe("a");
    });

    it("parse malformed lambdaExpression (lambda a b)", function () {
      this.ast = parse("(lambda a b)");
      expect(this.ast[0].type).toBe("unknown");
      expect(this.ast[0].fields.elts[0].type).toBe("literal");
      expect(this.ast[0].fields.elts[0].fields.value).toBe("lambda");
      expect(this.ast[0].fields.elts.length).toBe(3);
      expect(this.ast[0].fields.elts[1].fields.value).toBe("a");
      expect(this.ast[0].fields.elts[2].fields.value).toBe("b");
    });

    it("parse malformed localExpression (local a b)", function () {
      this.ast = parse("(local a b)");
      expect(this.ast[0].type).toBe("unknown");
      expect(this.ast[0].fields.elts[0].fields.value).toBe("local");
      expect(this.ast[0].fields.elts.length).toBe(3);
      expect(this.ast[0].fields.elts[1].fields.value).toBe("a");
      expect(this.ast[0].fields.elts[2].fields.value).toBe("b");
    });

    it("parse malformed letrecExpression (letrec a b)", function () {
      this.ast = parse("(letrec a b)");
      expect(this.ast[0].type).toBe("unknown");
      expect(this.ast[0].fields.elts[0].fields.value).toBe("letrec");
      expect(this.ast[0].fields.elts.length).toBe(3);
      expect(this.ast[0].fields.elts[1].fields.value).toBe("a");
      expect(this.ast[0].fields.elts[2].fields.value).toBe("b");
    });

    it("parse malformed letExpression (let a b)", function () {
      this.ast = parse("(let a b)");
      expect(this.ast[0].type).toBe("unknown");
      expect(this.ast[0].fields.elts[0].fields.value).toBe("let");
      expect(this.ast[0].fields.elts.length).toBe(3);
      expect(this.ast[0].fields.elts[1].fields.value).toBe("a");
      expect(this.ast[0].fields.elts[2].fields.value).toBe("b");
    });

    it("parse malformed letStarExpression (let* a b)", function () {
      this.ast = parse("(let* a b)");
      expect(this.ast[0].type).toBe("unknown");
      expect(this.ast[0].fields.elts[0].fields.value).toBe("let*");
      expect(this.ast[0].fields.elts.length).toBe(3);
      expect(this.ast[0].fields.elts[1].fields.value).toBe("a");
      expect(this.ast[0].fields.elts[2].fields.value).toBe("b");
    });

    it("parse malformed beginExpression (begin)", function () {
      this.ast = parse("(begin)");
      expect(this.ast[0].type).toBe("unknown");
      expect(this.ast[0].fields.elts[0].fields.value).toBe("begin");
      expect(this.ast[0].fields.elts.length).toBe(1);
    });

    it("parse malformed requireExpression (requre)", function () {
      this.ast = parse("(require)");
      expect(this.ast[0].type).toBe("unknown");
      expect(this.ast[0].fields.elts[0].fields.value).toBe("require");
      expect(this.ast[0].fields.elts.length).toBe(1);
    });

    it("parse malformed else (else)", function () {
      this.ast = parse("(else)");
      expect(this.ast[0].type).toBe("unknown");
      expect(this.ast[0].fields.elts[0].fields.value).toBe("else");
      expect(this.ast[0].fields.elts.length).toBe(1);
    });
  });

  describe("when printing parsed code back as text,", function () {
    // the editor prints a block's code each time it is edited, and again when
    // switching from blocks to text, so the text has to come back as it went in
    const print = (code) => parse(code).map((node) => node.toString());

    // A quoted list has no block of its own, so it is kept as its source text.
    it("keeps a quoted list", function () {
      expect(print("'(1 2)")).toEqual(["'(1 2)"]);
    });

    it("prints a lambda with its keyword", function () {
      expect(print("(lambda (x y) (+ x y))")).toEqual([
        "(lambda (x y) (+ x y))",
      ]);
    });

    it("prints when and unless without a begin the source did not have", function () {
      expect(print("(when (> 1 0) 2)")).toEqual(["(when (> 1 0) 2)"]);
      expect(print("(unless #f 1 2)")).toEqual(["(unless #f 1 2)"]);
      // ...so that printing and parsing again changes nothing
      const once = print("(when 1 2)")[0];
      expect(print(once)).toEqual([once]);
    });
  });

  describe("less common forms,", function () {
    // A form with a block of its own gets one. A form without keeps its source
    // text in a literal, so that switching to blocks and back loses no code.
    // Malformed forms stay as unknown blocks.
    // [source, the types of its blocks, how it prints]
    const forms = [
      ["(require x)", ["functionApp"], "(require x)"],
      // (these once crashed the parser: isString called itself)
      ['(require "f.rkt")', ["functionApp"], '(require "f.rkt")'],
      ['(require (lib "a" "b"))', ["functionApp"], '(require (lib "a" "b"))'],
      ["(require (lib))", ["unknown"], "(require (lib))"],
      ["(require (planet x))", ["unknown"], "(require (planet x))"],
      ["(require 5)", ["unknown"], "(require 5)"],
      ["(provide x)", ["literal"], "(provide x)"],
      ["(provide (struct-out p))", ["literal"], "(provide (struct-out p))"],
      ["(provide)", ["literal"], "(provide)"],
      ["(case x [(1) 2])", ["literal"], "(case x [(1) 2])"],
      [
        "(case x [(1 2) 'a] [else 'b])",
        ["unknown"],
        "(case x ((1 2) 'a) (else 'b))",
      ],
      ["(case x [1 2])", ["unknown"], "(case x (1 2))"],
      ["'x", ["literal"], "'x"],
      ["'(a b)", ["literal"], "'(a b)"],
      ["`(1 ,x)", ["literal"], "`(1 ,x)"],
      ["`(1 `(2 ,(3 ,x)))", ["literal"], "`(1 `(2 ,(3 ,x)))"],
      ["(local [(define a 1)] a)", ["literal"], "(local [(define a 1)] a)"],
      ["(define-values (a b) (f))", ["literal"], "(define-values (a b) (f))"],
      ["(quote a b)", ["unknown"], "(quote a b)"],
      ["(unquote x)", ["unknown"], "(unquote x)"],
      ["(let () 1)", ["letLikeExpr"], "(let () 1)"],
      ["(cond)", ["unknown"], "(cond)"],
    ];

    it.each(forms)("%s makes %j and prints as %s", (code, types, text) => {
      const nodes = parse(code);
      expect(nodes.map((n) => n.type)).toEqual(types);
      expect(nodes.map((n) => n.toString()).join("\n")).toBe(text);
      // and printing it again changes nothing
      expect(
        parse(text)
          .map((n) => n.toString())
          .join("\n")
      ).toBe(text);
    });
  });
});
