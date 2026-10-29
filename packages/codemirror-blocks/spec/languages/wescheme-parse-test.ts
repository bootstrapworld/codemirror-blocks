import wescheme from "../../src/languages/wescheme";

const parse = (code: string) => wescheme.buildAST(code).rootNodes;

describe("The WeScheme parser,", () => {
  describe("when labelling check-expect for screenreaders,", () => {
    it("announces a unit test for the function under test", () => {
      const [test] = parse("(check-expect (f 1) 2)");
      expect(test.options.ariaLabel).toBe("Unit Test for f");
    });

    it("falls back to the usual label when the test isn't a call", () => {
      const [test] = parse("(check-expect 1 1)");
      expect(test.options.ariaLabel).toBe("check-expect expression, 2 inputs");
    });

    it("labels other calls as expressions", () => {
      const [call] = parse("(f 1)");
      expect(call.options.ariaLabel).toBe("f expression, 1 input");
    });
  });

  describe("when parsing define-values,", () => {
    it("ignores well-formed definitions, which blocks don't support", () => {
      expect(parse("(define-values (a b) (f 1))")).toHaveLength(0);
    });

    it("keeps malformed ones as unknown expressions", () => {
      const [unknown] = parse("(define-values a)");
      expect(unknown.type).toBe("unknown");
    });

    it("doesn't confuse them with ordinary definitions", () => {
      const nodes = parse("(define x 1)\n(define-values (a b) (f 1))");
      expect(nodes.map((n) => n.type)).toEqual(["variableDefinition"]);
    });
  });
});
