import { parse } from "../src/sexpParser";

/**
 * The edges of the parser: text that is not a program (which is refused), and
 * forms with the wrong parts (which are kept as a block that says it could not
 * be read, `unknown`, and not lost).
 */
const types = (code) => parse(code).map((n) => n.type);

describe("the WeScheme parser, on text that is not a program", () => {
  it.each([
    "|unterminated",
    "#\\",
    "#| open",
    "(",
    ")",
    "(1 . 2)",
    "(a . b)",
    '"str',
  ])("refuses %j", (code) => {
    expect(() => parse(code)).toThrow();
  });
});

describe("the WeScheme parser, on the odd ways to write an atom", () => {
  it.each([
    ["a symbol between bars, with a space in it", "|a b|", ["literal"]],
    [
      "bars that span lines are not one symbol",
      "|a\nb| c",
      ["literal", "literal", "literal"],
    ],
    ["two symbols between bars", "|a| |b|", ["literal", "literal"]],
    ["a character, then a symbol", "#\\a b", ["literal", "literal"]],
    ["a comment that ends the text", "x ; tail", ["literal"]],
    ["an empty quoted list", "'()", ["literal"]],
    ["a quoted list with an empty list in it", "'(a ())", ["literal"]],
    ["a quoted list with a list in it", "'(a (b c))", ["literal"]],
    ["a quasiquote", "`(a ,b)", ["literal"]],
    ["booleans", "#t #f", ["literal", "literal"]],
    ["a datum comment", "#;1 2", ["literal"]],
  ])("reads %s", (_what, code, expected) => {
    expect(types(code)).toEqual(expected);
  });
});

describe("the WeScheme parser, on forms with the wrong parts", () => {
  it.each([
    "(cond)",
    "(cond [else 1] [#t 2])",
    "(cond [#t 1] [else])",
    "(cond [else 1 2])",
    "(quote)",
    "(quote a b)",
    "(define)",
    "(define x)",
    "(define (f) )",
    "(define-struct)",
    "(define-values)",
    "(lambda)",
    "(lambda x 1)",
    "(lambda (x) )",
    "(if)",
    "(if 1 2)",
    "(if 1 2 3 4)",
    "(and)",
    "(or 1)",
    "(let)",
    "(let ([a]) a)",
    "(begin)",
    "(when)",
    "(case)",
    "(case x [(1) 2] [else 3])",
    "(local)",
    "(require)",
  ])("keeps %s as a block that could not be read", (code) => {
    expect(types(code)).toEqual(["unknown"]);
  });
});

describe("the WeScheme parser, on forms that are right", () => {
  it.each([
    ["a structure", "(define-struct p (x y))", "structDefinition"],
    ["a let", "(let ([a 1]) a)", "letLikeExpr"],
    ["a let*", "(let* ([a 1]) a)", "letLikeExpr"],
    ["a letrec", "(letrec ([a 1]) a)", "letLikeExpr"],
    ["an unless", "(unless 1 2)", "whenUnlessExpr"],
    ["a call with no function", "()", "functionApp"],
    ["a call in brackets", "[a b]", "functionApp"],
    ["a call in braces", "{a b}", "functionApp"],
  ])("reads %s", (_what, code, type) => {
    expect(types(code)).toEqual([type]);
  });
});
