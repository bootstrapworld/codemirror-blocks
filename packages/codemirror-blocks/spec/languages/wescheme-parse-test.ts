import wescheme from "@bootstrapworld/cmb-wescheme";

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
    it("keeps well-formed definitions as text, which blocks don't support", () => {
      const [kept] = parse("(define-values (a b) (f 1))");
      expect(kept.type).toBe("literal");
      expect(kept.fields.value).toBe("(define-values (a b) (f 1))");
    });

    it("keeps malformed ones as unknown expressions", () => {
      const [unknown] = parse("(define-values a)");
      expect(unknown.type).toBe("unknown");
    });

    it("doesn't confuse them with ordinary definitions", () => {
      const nodes = parse("(define x 1)\n(define-values (a b) (f 1))");
      expect(nodes.map((n) => n.type)).toEqual([
        "variableDefinition",
        "literal",
      ]);
    });
  });
});

describe("a |symbol| that spans lines", () => {
  it("does not move the forms after it, or swallow a later comment", () => {
    const roots = parse("|a\nb|\n(f x)\nq #| note |#\n(h 1 2)");
    const ranges = roots.map((r) => {
      const { from, to } = r.srcRange();
      return `${from.line}:${from.ch}-${to.line}:${to.ch}`;
    });
    expect(ranges).toEqual([
      "0:0-0:2",
      "1:0-1:2",
      "2:0-2:5",
      "3:0-3:12",
      "4:0-4:7",
    ]);
  });

  it("does not swallow a later comment when it is on one line", () => {
    const roots = parse("|ab|\nq #| note |#");
    expect(roots.map((r) => r.toString())).toHaveLength(2);
  });
});
