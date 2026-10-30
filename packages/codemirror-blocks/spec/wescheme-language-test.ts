import wescheme from "../src/languages/wescheme";

/**
 * The example WeScheme language (the same node types the WeScheme editor uses):
 * which node each form becomes, what it prints back as, and what happens to
 * malformed forms.
 */
const parsed = (code: string) => wescheme.buildAST(code);
const typesOf = (code: string) => parsed(code).rootNodes.map((n) => n.type);
const printed = (code: string) => parsed(code).toString();

describe("forms that become blocks", () => {
  // [source, node type, how it prints]
  const forms: [string, string, string][] = [
    ["(lambda (x y) (+ x y))", "lambdaExpression", "(lambda (x y) (+ x y))"],
    ["(let ([a 1]) a)", "letLikeExpr", "(let ((a 1)) a)"],
    ["(let* ([a 1] [b a]) b)", "letLikeExpr", "(let* ((a 1) (b a)) b)"],
    ["(letrec ([a 1]) a)", "letLikeExpr", "(letrec ((a 1)) a)"],
    [
      "(cond [(> 1 2) 3] [else 4])",
      "condExpression",
      "(cond\n  [(> 1 2) 3]\n  [else 4])",
    ],
    ["(cond [else 4])", "condExpression", "(cond\n  [else 4])"],
    ["(if 1 2 3)", "ifExpression", "(if 1 2 3)"],
    ["(when 1 2)", "whenUnlessExpr", "(when 1 2)"],
    ["(unless 1 2)", "whenUnlessExpr", "(unless 1 2)"],
    ["(when 1 2 3)", "whenUnlessExpr", "(when 1 2 3)"],
    ["(begin 1 2)", "sequence", "(begin 1 2)"],
    ["(define x 1)", "variableDefinition", "(define x 1)"],
    ["(define (f x) x)", "functionDefinition", "(define (f x) x)"],
    ["(define-struct p (x y))", "structDefinition", "(define-struct p (x y))"],
    ["(and 1 2)", "functionApp", "(and 1 2)"],
    ["(set! x 1)", "functionApp", "(set! x 1)"],
    ["(require x)", "functionApp", "(require x)"],
    ["(check-expect 1 1)", "functionApp", "(check-expect 1 1)"],
    ["(check-within 1 1 0.1)", "functionApp", "(check-within 1 1 1/10)"],
    ['(check-error (f) "m")', "functionApp", '(check-error (f) "m")'],
    ["(f x)", "functionApp", "(f x)"],
    ["[a b]", "functionApp", "(a b)"],
    ["()", "functionApp", "(...)"],
    ["#(1 2 3)", "functionApp", "(vector 1 2 3)"],
    ['"str"', "literal", '"str"'],
    ["#\\a", "literal", "#\\a"],
    ["1/2", "literal", "1/2"],
    ["#t", "literal", "#t"],
    ["#| block comment |# 5", "literal", "5"],
  ];

  it.each(forms)("%s is a %s", (code, type) => {
    expect(typesOf(code)).toEqual([type]);
  });

  it.each(forms)("%s prints as it should", (code, _type, text) => {
    expect(printed(code)).toBe(text);
  });

  it.each(forms)(
    "%s keeps its meaning through printing and parsing again",
    (code, type, text) => {
      // printing is stable, or switching between text and blocks would keep
      // changing the program
      expect(printed(text)).toBe(text);
      expect(typesOf(text)).toEqual(
        // (a vector and a `()` come back as the calls they print as)
        [type]
      );
    }
  );

  it("moves a comment on the line before a form into a block comment", () => {
    expect(printed(";; comment\n(f x)")).toBe("#| comment |#\n(f x)");
  });
});

describe("malformed forms are kept, as unknown blocks", () => {
  const malformed = [
    "(lambda x x)",
    "(lambda (x 1) x)",
    "(lambda (x))",
    "(letrec ([a]) a)",
    "(letrec a a)",
    "(let ([a]) a)",
    "(cond [1])",
    "(cond)",
    "(if 1 2)",
    "(or)",
    "(when 1)",
    "(begin)",
    "(quote)",
    "(quasiquote)",
    "(define)",
    "(define 1 2)",
    "(define (f) )",
    "(define-struct p)",
    "(define-struct 1 (x))",
    "(else 1)",
  ];

  it.each(malformed)("%s", (code) => {
    expect(typesOf(code)).toEqual(["unknown"]);
    // nothing is lost: it still prints with every word it had
    const words = (s: string) => s.match(/[^\s()[\]]+/g) ?? [];
    expect(words(printed(code))).toEqual(words(code));
  });
});

describe("forms with no block of their own are kept as text", () => {
  // These have no block of their own yet, so each becomes an opaque literal
  // holding its source text. Nothing may be lost or changed.
  const words = (s: string) => s.match(/[^\s()[\]]+/g) ?? [];

  it.each([
    "'(1 2)",
    "`(1 ,x ,@y)",
    "(local [(define a 1)] a)",
    "(provide x)",
    "(define-values (a b) (f))",
    "(case x [(1 2) 'a] [else 'b])",
  ])("%s is kept", (code) => {
    expect(words(printed(code))).toEqual(words(code));
    expect(printed(code)).not.toContain("\n");
  });

  it("keeps a multi-line form on one line, with its strings and comments", () => {
    const code = '\'(a ; note\n   "x\ny"\n   b)';
    expect(printed(code)).toBe('\'(a #| note |# "x\\ny" b)');
    expect(printed(printed(code))).toBe(printed(code));
  });

  it("keeps an unsupported form nested inside a supported one", () => {
    expect(printed("(define x '(1 2))")).toBe("(define x '(1 2))");
    expect(printed("(f (provide x) 1)")).toBe("(f (provide x) 1)");
  });
});

describe("text that is not a program", () => {
  it.each(["(f", ")", "(f . x)"])("%s is refused", (code) => {
    expect(() => parsed(code)).toThrow();
  });
});
