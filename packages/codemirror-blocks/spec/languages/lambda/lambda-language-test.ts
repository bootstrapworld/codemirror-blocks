import lambda from "../../../src/languages/lambda";
import { mountCMB, teardown } from "../../../src/toolkit/test-utils";
import { parseToIntermediateAST } from "../../../src/languages/lambda/parser";

/** strip source locations so trees from different spacings can be compared */
function withoutLocations(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(withoutLocations);
  }
  if (node && typeof node === "object") {
    return Object.fromEntries(
      Object.entries(node)
        .filter(([key]) => key !== "from" && key !== "to")
        .map(([key, value]) => [key, withoutLocations(value)])
    );
  }
  return node;
}

describe("The lambda language", () => {
  it("is registered with an id and a name", () => {
    expect(lambda.id).toBe("lambda");
    expect(lambda.name).toBe("Lambda");
  });

  it("builds a single root program node", () => {
    const ast = lambda.buildAST("1 + 2");
    expect(ast.rootNodes.map((n) => n.type)).toEqual(["prog"]);
    expect([...ast.descendants()].map((n) => n.type)).toEqual([
      "prog",
      "binary",
      "literal",
      "literal",
    ]);
  });

  it("throws a readable error for text it cannot parse", () => {
    expect(() => lambda.buildAST("1 + ")).toThrow();
  });

  describe("round-trips through pretty-printing:", () => {
    const programs = [
      "1",
      "true",
      '"Hello \\"World\\""',
      "x",
      "1 + 2 * 3",
      "(1 + 2) * 3",
      "x = 1; y = x + 2",
      "f(1, 2)",
      "f(1)(2)",
      "lambda add(a, b) a + b",
      "lambda (a) a",
      "let (a = 1, b = 2) a + b",
      'if x then "a" else "b"',
      "if x then y",
      "!x",
      "!(a + b)",
      "{ a; b }; c",
    ];
    programs.forEach((source) => {
      it(source, () => {
        const text = lambda.buildAST(source).toString();
        // printing is stable...
        expect(lambda.buildAST(text).toString()).toBe(text);
        // ...and means the same thing as the original
        expect(withoutLocations(parseToIntermediateAST(text))).toEqual(
          withoutLocations(parseToIntermediateAST(source))
        );
      });
    });
  });

  describe("in block mode", () => {
    afterEach(teardown);

    it("renders a block for every node", () => {
      const { cmb } = mountCMB(lambda);
      cmb.setValue(
        'x = 1; f = lambda f(a, b) if a < b then !a else (b + 1); let (c = 2) f(c, "s")'
      );
      cmb.setBlockMode(true);
      const nodes = [...cmb.getAst().descendants()];
      expect(nodes.length).toBeGreaterThan(20);
      for (const node of nodes) {
        expect(node.element).not.toBeNull();
      }
      expect(cmb.getAst().toString()).toBe(
        lambda.buildAST(cmb.getValue()).toString()
      );
    });
  });
});
