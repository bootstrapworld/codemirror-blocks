import wescheme from "@bootstrapworld/wescheme";
import { Literal, Unknown } from "../src/nodes";
import { mountCMB, teardown } from "../src/toolkit/test-utils";

/**
 * What each kind of block says to a screenreader (the short description, the
 * aria-label, and the longer one used when a block is read from further up the
 * tree) and that each one draws.
 */
const squash = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const rootOf = (code: string) => wescheme.buildAST(code).rootNodes[0];

// [code, node type, short description, a piece of the long one]
const nodes: [string, string, string, RegExp][] = [
  ["(f x y)", "functionApp", "f expression, 2 inputs", /^f of x, y$/],
  ["(f x)", "functionApp", "f expression, 1 input", /^f of x$/],
  [
    "(f (g (h (i 1))))",
    "functionApp",
    "f expression, 1 input",
    /^f of applying the function g to 1 argument/,
  ],
  [
    "(define x 5)",
    "variableDefinition",
    "x: value definition",
    /^define x to be 5$/,
  ],
  [
    "(define x (f 1))",
    "variableDefinition",
    "x: value definition",
    /^define x to be the result of: /,
  ],
  [
    "(define (f a b) (+ a b))",
    "functionDefinition",
    "f: function definition with 2 arguments: a and b",
    /^define f to be a function of a and b, with body: /,
  ],
  [
    "(lambda (x y) (+ x y))",
    "lambdaExpression",
    "anonymous function with 2 arguments: x and y",
    /^an anonymous function of 2 arguments: x and y, with body: /,
  ],
  [
    "(cond [(> 1 2) 3] [else 4])",
    "conditional",
    "conditional expression with 2 clauses",
    /^a conditional expression with 1 condition: condition: if /,
  ],
  [
    "(if 1 2 3)",
    "ifExpression",
    "if-then-else expression",
    /^an if expression: if /,
  ],
  [
    "(begin 1 2)",
    "sequence",
    "sequence containing 2 expressions",
    /^a sequence containing 1 and 2$/,
  ],
  [
    "(when 1 2)",
    "whenUnlessExpr",
    "when expression",
    /^a when expression: when 1, a sequence containing 2$/,
  ],
  [
    "(unless 1 2)",
    "whenUnlessExpr",
    "unless expression",
    /^a unless expression: unless 1, /,
  ],
  [
    "(let ([a 1]) a)",
    "letLikeExpr",
    "let expression with 1 binding",
    /^a let expression with 1 binding/,
  ],
  [
    "(define-struct p (x y))",
    "structDefinition",
    "p: structure definition with 2 fields: x and y",
    /^define p to be a structure with x and y$/,
  ],
  ["...", "blank", "blank", /^blank$/],
  [
    "(lambda x x)",
    "unknown",
    "invalid expression",
    /^an unknown expression with 3 children 1: lambda, 2: x, 3: x$/,
  ],
  [
    "(else)",
    "unknown",
    "invalid expression",
    /^an unknown expression with 1 child else$/,
  ],
];

describe("what a block says", () => {
  it.each(nodes)("%s is a %s: %s", (code, type, short, long) => {
    const node = rootOf(code);
    expect(node.type).toBe(type);
    expect(squash(node.shortDescription())).toBe(short);
    expect(squash(node.describe(0))).toBe(short);
    expect(squash(node.describe(2))).toMatch(long);
  });

  it("describes a literal by its value, and a commented node as the node", () => {
    expect(squash(rootOf("42").describe(0))).toBe("42");
    expect(squash(rootOf(";; note\n(f x)").describe(0))).toBe(
      "f expression, 1 input"
    );
  });
});

describe("what a block looks like", () => {
  const forms = [...nodes.map(([code]) => code), "(f x)\n(g y)", "42", '"hi"'];

  it.each(forms)("%s is drawn, labelled with what it says", (code) => {
    const { cmb } = mountCMB(wescheme);
    cmb.setValue(code);
    const roots = cmb.getAst().rootNodes;
    expect(roots.length).toBeGreaterThan(0);
    for (const node of roots) {
      const element = document.getElementById(`block-node-${node.id}`);
      expect(element).toBeTruthy();
      expect(element?.getAttribute("aria-label")).toBe(
        `${node.shortDescription()},`
      );
    }
    teardown();
  });

  it("draws the parts of a block inside it", () => {
    const { cmb } = mountCMB(wescheme);
    cmb.setValue("(cond [(> 1 2) 3] [else 4])");
    const text = document.querySelector(".blocks-cond-table")?.textContent;
    expect(text).toContain(">");
    expect(text).toContain("else");
    expect(document.querySelectorAll(".blocks-cond-row")).toHaveLength(2);
    teardown();
  });
});

describe("an unrecognised expression with nothing in it", () => {
  // (random sequence, seed 11091) deleting its last part left no elements to
  // print, and the printer threw on the missing first one
  const pos = { line: 0, ch: 0 };
  it("prints as empty parentheses", () => {
    expect(Unknown(pos, pos, { elts: [] }).pretty().display(80)).toEqual([
      "()",
    ]);
  });
  it("keeps its other parts when it has some", () => {
    const [a, b] = wescheme.buildAST("a b").rootNodes;
    expect(
      Unknown(pos, pos, { elts: [a, b] })
        .pretty()
        .display(80)
    ).toEqual(["(a b)"]);
  });
});

describe("a string literal with a newline in it", () => {
  // (random sequence) the printer refuses text with a newline and threw
  const pos = { line: 0, ch: 0 };
  it("prints on one line, with the newline escaped", () => {
    const string = Literal(pos, pos, { value: '"a\nb"', dataType: "string" });
    expect(string.pretty().display(80)).toEqual(['"a\\nb"']);
  });
});
