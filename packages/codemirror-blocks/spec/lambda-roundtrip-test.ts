import lambda from "../src/languages/lambda";

/** The text a program is shown as in blocks, and what that reads back as */
const printed = (code: string) => lambda.buildAST(code).toString();
const roundTrips = (code: string) => {
  const once = printed(code);
  expect(printed(once)).toBe(once);
  return once;
};

describe("lambda, from text to blocks and back", () => {
  describe("let with a name", () => {
    it("keeps its name and the values of its variables", () => {
      expect(roundTrips("let foo (a = 1, b) foo(a)")).toBe(
        "let foo (a = 1, b) foo(a)"
      );
      expect(roundTrips("let loop () 1")).toBe("let loop () 1");
    });
    it("is still a plain let without one", () => {
      expect(roundTrips("let (a = 1, b = 2) a + b")).toBe(
        "let (a = 1, b = 2) a + b"
      );
    });
  });

  describe("strings", () => {
    it("keep the escapes they were written with", () => {
      expect(roundTrips('"a\\tb"')).toBe('"a\\tb"');
      expect(roundTrips('"line\\nbreak"')).toBe('"line\\nbreak"');
      expect(roundTrips('"say \\"hi\\" \\\\ ok"')).toBe(
        '"say \\"hi\\" \\\\ ok"'
      );
    });
    it("hold a newline that is really in them", () => {
      const nodes = lambda.parse('"line\nbreak"');
      expect(roundTrips('"line\nbreak"')).toBe('"line\\nbreak"');
      expect(nodes).toHaveLength(1);
    });
  });

  describe("comments", () => {
    it("go with the expression after them, written as block comments", () => {
      expect(roundTrips("# a comment\nx = 1")).toBe("#| a comment |#\nx = 1");
      expect(roundTrips("#| a block |# x = 1")).toBe("#| a block |#\nx = 1");
      expect(roundTrips("#| two\nlines |#\nx = 1")).toBe(
        "#| two lines |#\nx = 1"
      );
    });
    it("stay with the statement they come before", () => {
      expect(roundTrips("a = 1; # next\nb = 2")).toBe(
        "a = 1;\n#| next |#\nb = 2"
      );
    });
    it("stay where they are in a call, a let and a block", () => {
      expect(roundTrips("f(# first\n 1, # second\n 2)")).toContain(
        "#| second |#"
      );
      expect(roundTrips("let (a = 1, # b\n b = 2) a")).toContain("#| b |#");
      expect(roundTrips("{ # inside\n a; b }")).toContain("#| inside |#");
    });
    it("are refused when they never end", () => {
      expect(() => lambda.parse("#| never closed")).toThrow(
        /Unterminated comment/
      );
    });
  });
});
