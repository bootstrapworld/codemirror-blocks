import wescheme from "../../src/languages/wescheme";

/**
 * The less common WeScheme forms: require, provide, case, local, quote and
 * quasiquote. A form with a block of its own gets one; a form without keeps
 * its source text, in an "unsupported" literal block, so that switching to
 * blocks and back never loses code. Malformed forms stay as unknown blocks.
 */
const printed = (code: string) => wescheme.buildAST(code).toString();
const types = (code: string) =>
  wescheme.buildAST(code).rootNodes.map((n) => n.type);

// [source, the types of its blocks, how it prints]
const forms: [string, string[], string][] = [
  // require: a name, a file, or (lib "a" "b") are calls; other shapes are unknown
  ["(require x)", ["functionApp"], "(require x)"],
  ['(require "f.rkt")', ["functionApp"], '(require "f.rkt")'],
  ['(require (lib "a" "b"))', ["functionApp"], '(require (lib "a" "b"))'],
  ["(require (lib))", ["unknown"], "(require (lib))"],
  ["(require (lib 1 2))", ["unknown"], "(require (lib 1 2))"],
  ["(require (planet x))", ["unknown"], "(require (planet x))"],
  ["(require 5)", ["unknown"], "(require 5)"],
  ["(require)", ["unknown"], "(require)"],

  // provide: every shape is kept as text
  ["(provide x)", ["literal"], "(provide x)"],
  ["(provide x y)", ["literal"], "(provide x y)"],
  ["(provide (struct-out p))", ["literal"], "(provide (struct-out p))"],
  ["(provide 5)", ["literal"], "(provide 5)"],
  ["(provide (f x))", ["literal"], "(provide (f x))"],
  ["(provide)", ["literal"], "(provide)"],

  // case: kept as text when its clauses are well formed, else an unknown block
  ["(case x [(1) 2])", ["literal"], "(case x [(1) 2])"],
  [
    "(case x [(1 2) 'a] [else 'b])",
    ["unknown"],
    "(case x ((1 2) 'a) (else 'b))",
  ],
  ["(case x [else 1] [(2) 3])", ["unknown"], "(case x (else 1) ((2) 3))"],
  ["(case x [1 2])", ["unknown"], "(case x (1 2))"],
  ["(case x [(1)])", ["unknown"], "(case x ((1)))"],
  ["(case x)", ["unknown"], "(case x)"],

  // quote, quasiquote, local, define-values: kept as text
  ["'x", ["literal"], "'x"],
  ["'(a b)", ["literal"], "'(a b)"],
  ["`(1 ,x)", ["literal"], "`(1 ,x)"],
  ["`(1 ,@y)", ["literal"], "`(1 ,@y)"],
  ["`(1 `(2 ,(3 ,x)))", ["literal"], "`(1 `(2 ,(3 ,x)))"],
  ["(quasiquote x)", ["literal"], "(quasiquote x)"],
  [
    "(local [(define a 1) (define b 2)] (+ a b))",
    ["literal"],
    "(local [(define a 1) (define b 2)] (+ a b))",
  ],
  ["(local [] 1)", ["literal"], "(local [] 1)"],
  ["(define-values (a b) (f))", ["literal"], "(define-values (a b) (f))"],

  // a quote form with the wrong number of parts, and unquote outside a quasiquote
  ["(quote a b)", ["unknown"], "(quote a b)"],
  ["(unquote x)", ["unknown"], "(unquote x)"],
  // (the short form is printed in its long form, which means the same)
  [",x", ["unknown"], "(unquote x)"],
  [",@x", ["unknown"], "(unquote-splicing x)"],

  // let, let* and letrec, including no bindings
  ["(let () 1)", ["letLikeExpr"], "(let () 1)"],
  ["(let* ([a 1]) a)", ["letLikeExpr"], "(let* ((a 1)) a)"],
  [
    "(letrec ([f (lambda (n) n)]) (f 1))",
    ["letLikeExpr"],
    "(letrec ((f (lambda (n) n))) (f 1))",
  ],

  // cond with nothing to choose from
  ["(cond)", ["unknown"], "(cond)"],
  ["(cond [else])", ["unknown"], "(cond (else))"],
];

describe("less common forms", () => {
  it.each(forms)("%s makes %j", (code, expected) => {
    expect(types(code)).toEqual(expected);
  });

  it.each(forms)("%s prints as it should", (code, _types, text) => {
    expect(printed(code)).toBe(text);
  });

  it.each(forms)(
    "%s prints the same way the second time",
    (code, _types, text) => {
      expect(printed(text)).toBe(text);
    }
  );

  it("keeps a form between other code, in order", () => {
    const code = "(define x 1)\n'(1 2)\n(provide x)\n(f x)";
    expect(types(code)).toEqual([
      "variableDefinition",
      "literal",
      "literal",
      "functionApp",
    ]);
    expect(printed(code)).toBe("(define x 1)\n'(1 2)\n(provide x)\n(f x)");
  });
});
