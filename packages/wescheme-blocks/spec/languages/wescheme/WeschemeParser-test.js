import WeschemeParser from "../../../src/languages/wescheme/WeschemeParser";

describe("The WeScheme Parser,", function () {
  beforeEach(function () {
    this.parser = new WeschemeParser();
  });
  it("should set the appropriate data type for literals", function () {
    expect(this.parser.parse("#t")[0].fields.dataType).toBe("boolean");
    expect(this.parser.parse("1")[0].fields.dataType).toBe("number");
    expect(this.parser.parse('"hello"')[0].fields.dataType).toBe("string");
    expect(this.parser.parse("#\\m")[0].fields.dataType).toBe("character");
    expect(this.parser.parse("foo")[0].fields.dataType).toBe("symbol");
  });

  it("should treat vector literals like expressions", function () {
    let ast = this.parser.parse("#(1 3)");
    expect(ast[0].type).toBe("functionApp");
    ast = this.parser.parse("#9(#f)");
    expect(ast[0].type).toBe("functionApp");
  });

  it("should treat booleans expression like regular expressions", function () {
    let ast = this.parser.parse("(or #t #f)");
    expect(ast[0].type).toBe("functionApp");
    ast = this.parser.parse("(and #t #f)");
    expect(ast[0].type).toBe("functionApp");
  });

  describe("when parsing callExpressions,", function () {
    beforeEach(function () {
      this.ast = this.parser.parse("(sum 1 2 3)");
    });

    it("should convert callExpresssions to expressions", function () {
      expect(this.ast[0].type).toBe("functionApp");
    });

    it("should convert the function symbol to a literal", function () {
      expect(this.ast[0].fields.func.type).toBe("literal");
      expect(this.ast[0].fields.func.fields.dataType).toBe("symbol");
    });

    it("should support empty expressions by generating a placeholder literal", function () {
      this.ast = this.parser.parse("()");
      expect(this.ast[0].type).toBe("functionApp");
      expect(this.ast[0].fields.func.fields.value).toBe("...");
      expect(this.ast[0].fields.func.fields.dataType).toBe("blank");
    });
  });

  describe("when parsing andExpressions and orExpression,", function () {
    beforeEach(function () {
      this.ast = this.parser.parse("(or true true) (and true true)");
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
      this.ast = this.parser.parse('(define foo "bar")');
    });

    it("should convert defVar expressions to variableDef", function () {
      expect(this.ast[0].type).toBe("variableDefinition");
      expect(this.ast[0].fields.name.fields.value).toBe("foo");
      expect(this.ast[0].fields.body.type).toBe("literal");
    });
  });

  describe("when parsing comments,", function () {
    beforeEach(function () {
      this.ast = this.parser.parse(";this is a comment\n3");
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
      this.ast = this.parser.parse("(define-struct 3d-point (x y z))");
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
      this.ast = this.parser.parse("(define (add2 x) (+ x 2))");
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
      this.ast = this.parser.parse(`(lambda (x y) (+ x y))`);
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
      this.ast = this.parser.parse(
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
      this.ast = this.parser.parse("(if (> 0 1) x y)");
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
      this.ast = this.parser.parse('(begin (- (+ 1 2) 5) (print "hello"))');
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
      this.ast = this.parser.parse(
        "(let* ((x 1) (y 2) (z (+ x y))) (* x y z))"
      );
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
      expect(this.ast[0].fields.bindings.fields.name).toBe("bindings");
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
  });

  describe("when parsing whenUnless expressions,", function () {
    beforeEach(function () {
      this.ast = this.parser.parse("(when (> a b) x y z)");
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
      expect(this.ast[0].fields.exprs.fields.name).toBe("begin");
      expect(this.ast[0].fields.exprs.fields.exprs.length).toBe(3);
      expect(this.ast[0].fields.exprs.fields.exprs[0].type).toBe("literal");
      expect(this.ast[0].fields.exprs.fields.exprs[0].fields.value).toBe("x");
      expect(this.ast[0].fields.exprs.fields.exprs[1].type).toBe("literal");
      expect(this.ast[0].fields.exprs.fields.exprs[1].fields.value).toBe("y");
      expect(this.ast[0].fields.exprs.fields.exprs[2].type).toBe("literal");
      expect(this.ast[0].fields.exprs.fields.exprs[2].fields.value).toBe("z");
    });
  });

  describe("when parsing expressions that are unsupported in the block language,", function () {
    it("should ignore defVars", function () {
      this.ast = this.parser.parse("(define-values (a b c) (1 2 3))");
      expect(this.ast.length).toBe(0);
    });
    it("should ignore localExpr", function () {
      this.ast = this.parser.parse("(local [(define x 2)] x)");
      expect(this.ast.length).toBe(0);
    });
    it("should ignore quotedExpr", function () {
      this.ast = this.parser.parse("'(+ 4 2)");
      expect(this.ast.length).toBe(0);
    });
    it("should ignore unquotedExpr", function () {
      this.ast = this.parser.parse("',(42 43 44)");
      expect(this.ast.length).toBe(0);
      this.ast = this.parser.parse("`(1 `,(+ 1 ,(+ 2 3)) 4)");
      expect(this.ast.length).toBe(0);
    });
    it("should ignore quasiquotedExpr", function () {
      this.ast = this.parser.parse("`42");
      expect(this.ast.length).toBe(0);
      this.ast = this.parser.parse("`(1 ```,,@,,@(list (+ 1 2)) 4)");
      expect(this.ast.length).toBe(0);
    });
    it("should ignore unquoteSplice", function () {
      this.ast = this.parser.parse("`#(1 ,@(list 1 '2) 4)");
      expect(this.ast.length).toBe(0);
    });
    it("should ignore caseExpr", function () {
      this.ast = this.parser.parse('(case 9 [(1) "a"])');
      expect(this.ast.length).toBe(0);
    });
    it("should ignore provide", function () {
      this.ast = this.parser.parse("(provide nori)");
      expect(this.ast.length).toBe(0);
    });
  });

  describe("when setting aria-labels", function () {
    it("should make symbols, and numbers be set to themselves", function () {
      expect(this.parser.parse("1")[0].options.ariaLabel).toBe("1");
      expect(this.parser.parse("symbol")[0].options.ariaLabel).toBe("symbol");
    });

    it("should make boolean values be set to 'true' or 'false'", function () {
      expect(this.parser.parse("#t")[0].options.ariaLabel).toBe(
        "true, a Boolean"
      );
    });

    it("should make string values be set to 'string '+the contents of the string", function () {
      expect(this.parser.parse('"hello"')[0].options.ariaLabel).toBe(
        "hello, a String"
      );
    });

    it("should make expression (print 'hello') into 'print expression, 1 input'", function () {
      expect(this.parser.parse('(print "hello")')[0].options.ariaLabel).toBe(
        "print expression, 1 input"
      );
      expect(
        this.parser.parse('(print "hello" "world")')[0].options.ariaLabel
      ).toBe("print expression, 2 inputs");
    });

    it("should make and/or expressions just like regular expressions", function () {
      expect(this.parser.parse("(and true true)")[0].options.ariaLabel).toBe(
        "and expression, 2 inputs"
      );
      expect(this.parser.parse("(or false true)")[0].options.ariaLabel).toBe(
        "or expression, 2 inputs"
      );
    });

    it("should turn symbols into readable words", function () {
      expect(this.parser.parse("(* 1 2)")[0].options.ariaLabel).toBe(
        "multiply expression, 2 inputs"
      );
      expect(this.parser.parse("(/ 1 2)")[0].options.ariaLabel).toBe(
        "divide expression, 2 inputs"
      );
      expect(this.parser.parse("(foo? 0)")[0].options.ariaLabel).toBe(
        "foo-huh expression, 1 input"
      );
      expect(this.parser.parse("(set! x 2)")[0].options.ariaLabel).toBe(
        "set-bang expression, 2 inputs"
      );
      expect(this.parser.parse("#(1 2)")[0].options.ariaLabel).toBe(
        "vector expression, 2 inputs"
      );
    });
  });

  describe("parsing malformed code,", function () {
    beforeEach(function () {
      this.ast = [];
    });

    it("parse malformed defVar (define a)", function () {
      this.ast = this.parser.parse("(define a)");
      expect(this.ast[0].type).toBe("unknown");
      expect(this.ast[0].fields.elts[0].fields.value).toBe("define");
      expect(this.ast[0].fields.elts.length).toBe(2);
      expect(this.ast[0].fields.elts[1].fields.value).toBe("a");
    });

    it("parse malformed defVars (define-values a)", function () {
      this.ast = this.parser.parse("(define-values a)");
      expect(this.ast[0].type).toBe("unknown");
      expect(this.ast[0].fields.elts[0].fields.value).toBe("define-values");
      expect(this.ast[0].fields.elts.length).toBe(2);
      expect(this.ast[0].fields.elts[1].fields.value).toBe("a");
    });

    it("parse malformed defFun (define (a)", function () {
      this.ast = this.parser.parse("(define (a))");
      expect(this.ast[0].type).toBe("unknown");
      expect(this.ast[0].fields.elts[0].fields.value).toBe("define");
      expect(this.ast[0].fields.elts.length).toBe(2);
      expect(this.ast[0].fields.elts[1].type).toBe("functionApp");
      expect(this.ast[0].fields.elts[1].fields.func.fields.value).toBe("a");
    });

    it("parse malformed defStruct (define-struct a (a b c) d)", function () {
      this.ast = this.parser.parse("(define-struct a (a b c) d)");
      expect(this.ast[0].type).toBe("unknown");
      expect(this.ast[0].fields.elts[0].fields.value).toBe("define-struct");
      expect(this.ast[0].fields.elts.length).toBe(4);
      expect(this.ast[0].fields.elts[1].type).toBe("literal");
      expect(this.ast[0].fields.elts[2].type).toBe("functionApp");
      expect(this.ast[0].fields.elts[3].fields.value).toBe("d");
    });

    it("parse malformed ifExpression (if)", function () {
      this.ast = this.parser.parse("(if)");
      expect(this.ast[0].type).toBe("unknown");
      expect(this.ast[0].fields.elts[0].fields.value).toBe("if");
    });

    it("parse malformed ifExpression (if a)", function () {
      this.ast = this.parser.parse("(if a)");
      expect(this.ast[0].type).toBe("unknown");
      expect(this.ast[0].fields.elts[0].type).toBe("literal");
      expect(this.ast[0].fields.elts[0].fields.value).toBe("if");
      expect(this.ast[0].fields.elts.length).toBe(2);
      expect(this.ast[0].fields.elts[1].fields.value).toBe("a");
    });

    it("parse malformed ifExpression (if a b)", function () {
      this.ast = this.parser.parse("(if a b)");
      expect(this.ast[0].type).toBe("unknown");
      expect(this.ast[0].fields.elts[0].type).toBe("literal");
      expect(this.ast[0].fields.elts[0].fields.value).toBe("if");
      expect(this.ast[0].fields.elts.length).toBe(3);
      expect(this.ast[0].fields.elts[1].fields.value).toBe("a");
      expect(this.ast[0].fields.elts[2].fields.value).toBe("b");
    });

    it("parse malformed condExpression (cond)", function () {
      this.ast = this.parser.parse("(cond)");
      expect(this.ast[0].type).toBe("unknown");
      expect(this.ast[0].fields.elts[0].type).toBe("literal");
      expect(this.ast[0].fields.elts[0].fields.value).toBe("cond");
    });

    it("parse malformed condExpression (cond (a))", function () {
      this.ast = this.parser.parse("(cond (a))");
      expect(this.ast[0].type).toBe("unknown");
      expect(this.ast[0].fields.elts[0].type).toBe("literal");
      expect(this.ast[0].fields.elts[0].fields.value).toBe("cond");
      expect(this.ast[0].fields.elts[1].type).toBe("functionApp");
      expect(this.ast[0].fields.elts[1].fields.func.fields.value).toBe("a");
    });

    it("parse malformed andExpression (and)", function () {
      this.ast = this.parser.parse("(and)");
      expect(this.ast[0].type).toBe("unknown");
      expect(this.ast[0].fields.elts[0].fields.value).toBe("and");
      expect(this.ast[0].fields.elts.length).toBe(1);
    });

    it("parse malformed orExpression (or a)", function () {
      this.ast = this.parser.parse("(or a)");
      expect(this.ast[0].type).toBe("unknown");
      expect(this.ast[0].fields.elts[0].type).toBe("literal");
      expect(this.ast[0].fields.elts[0].fields.value).toBe("or");
      expect(this.ast[0].fields.elts.length).toBe(2);
      expect(this.ast[0].fields.elts[1].fields.value).toBe("a");
    });

    it("parse malformed lambdaExpression (lambda a b)", function () {
      this.ast = this.parser.parse("(lambda a b)");
      expect(this.ast[0].type).toBe("unknown");
      expect(this.ast[0].fields.elts[0].type).toBe("literal");
      expect(this.ast[0].fields.elts[0].fields.value).toBe("lambda");
      expect(this.ast[0].fields.elts.length).toBe(3);
      expect(this.ast[0].fields.elts[1].fields.value).toBe("a");
      expect(this.ast[0].fields.elts[2].fields.value).toBe("b");
    });

    it("parse malformed localExpression (local a b)", function () {
      this.ast = this.parser.parse("(local a b)");
      expect(this.ast[0].type).toBe("unknown");
      expect(this.ast[0].fields.elts[0].fields.value).toBe("local");
      expect(this.ast[0].fields.elts.length).toBe(3);
      expect(this.ast[0].fields.elts[1].fields.value).toBe("a");
      expect(this.ast[0].fields.elts[2].fields.value).toBe("b");
    });

    it("parse malformed letrecExpression (letrec a b)", function () {
      this.ast = this.parser.parse("(letrec a b)");
      expect(this.ast[0].type).toBe("unknown");
      expect(this.ast[0].fields.elts[0].fields.value).toBe("letrec");
      expect(this.ast[0].fields.elts.length).toBe(3);
      expect(this.ast[0].fields.elts[1].fields.value).toBe("a");
      expect(this.ast[0].fields.elts[2].fields.value).toBe("b");
    });

    it("parse malformed letExpression (let a b)", function () {
      this.ast = this.parser.parse("(let a b)");
      expect(this.ast[0].type).toBe("unknown");
      expect(this.ast[0].fields.elts[0].fields.value).toBe("let");
      expect(this.ast[0].fields.elts.length).toBe(3);
      expect(this.ast[0].fields.elts[1].fields.value).toBe("a");
      expect(this.ast[0].fields.elts[2].fields.value).toBe("b");
    });

    it("parse malformed letStarExpression (let* a b)", function () {
      this.ast = this.parser.parse("(let* a b)");
      expect(this.ast[0].type).toBe("unknown");
      expect(this.ast[0].fields.elts[0].fields.value).toBe("let*");
      expect(this.ast[0].fields.elts.length).toBe(3);
      expect(this.ast[0].fields.elts[1].fields.value).toBe("a");
      expect(this.ast[0].fields.elts[2].fields.value).toBe("b");
    });

    it("parse malformed beginExpression (begin)", function () {
      this.ast = this.parser.parse("(begin)");
      expect(this.ast[0].type).toBe("unknown");
      expect(this.ast[0].fields.elts[0].fields.value).toBe("begin");
      expect(this.ast[0].fields.elts.length).toBe(1);
    });

    it("parse malformed requireExpression (requre)", function () {
      this.ast = this.parser.parse("(require)");
      expect(this.ast[0].type).toBe("unknown");
      expect(this.ast[0].fields.elts[0].fields.value).toBe("require");
      expect(this.ast[0].fields.elts.length).toBe(1);
    });

    it("parse malformed else (else)", function () {
      this.ast = this.parser.parse("(else)");
      expect(this.ast[0].type).toBe("unknown");
      expect(this.ast[0].fields.elts[0].fields.value).toBe("else");
      expect(this.ast[0].fields.elts.length).toBe(1);
    });
  });
});
