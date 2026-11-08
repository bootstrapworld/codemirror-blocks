import lambda from "@bootstrapworld/lambda";

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
    it("on their own line go with the expression after them", () => {
      expect(roundTrips("# a comment\nx = 1")).toBe("#| a comment |#\nx = 1");
      expect(roundTrips("#| a block |# x = 1")).toBe("#| a block |#\nx = 1");
      expect(roundTrips("#| two\nlines |#\nx = 1")).toBe(
        "#| two lines |#\nx = 1"
      );
      expect(roundTrips("a = 1;\n# own\nb = 2")).toBe(
        "a = 1;\n#| own |#\nb = 2"
      );
    });
    it("on the line where code ends go with that code", () => {
      expect(roundTrips("x = 1 # trailing")).toBe("x = 1 #| trailing |#");
      expect(roundTrips("a = 1; # next\nb = 2")).toBe(
        "a = 1 #| next |#;\nb = 2"
      );
    });
    it("in the middle of an expression go with the node before them", () => {
      expect(roundTrips("a + # mid\n b")).toBe("a #| mid |# + b");
      expect(roundTrips("f(1, # after one\n 2)")).toBe(
        "f(1 #| after one |#, 2)"
      );
      expect(roundTrips("let (a = 1, # about a\n b = 2) a")).toBe(
        "let (a = 1 #| about a |#, b = 2) a"
      );
      expect(roundTrips("lambda (x, # why\n y) x")).toBe(
        "lambda (x #| why |#, y) x"
      );
    });
    it("before a closing bracket go with what the bracket closes", () => {
      expect(roundTrips("f(1 # last\n) + 2")).toBe("f(1) #| last |# + 2");
    });
    it("at the end of the program go with the last thing in it", () => {
      expect(roundTrips("x = 1\n# own line at the end")).toBe(
        "x = 1 #| own line at the end |#"
      );
    });
    it("stay in a block", () => {
      expect(roundTrips("{ # inside\n a; b }")).toContain("#| inside |#");
    });
    it("are all kept (those on one node are joined into one)", () => {
      const out = roundTrips("# one\nf(# two\n 1, # three\n 2\n) # four");
      for (const word of ["one", "two", "three", "four"]) {
        expect(out).toContain(word);
      }
    });
    it("are refused when they never end", () => {
      expect(() => lambda.parse("#| never closed")).toThrow(
        /Unterminated comment/
      );
    });
  });
});

describe("lambda, more", () => {
  it("has negative numbers", () => {
    expect(roundTrips("-1")).toBe("-1");
    expect(roundTrips("x = -2.5")).toBe("x = -2.5");
    expect(roundTrips("1 - -1")).toBe("1 - -1");
    expect(roundTrips("f(-1, 2 * -3)")).toBe("f(-1, 2 * -3)");
  });
  it("still subtracts", () => {
    expect(roundTrips("a - 1")).toBe("a - 1");
    expect(roundTrips("a -1")).toBe("a - 1");
    expect(roundTrips("3 - 1")).toBe("3 - 1");
  });
  it("still refuses a minus in front of anything else", () => {
    expect(() => lambda.parse("-x")).toThrow(/followed by a number/);
  });
});

describe("lambda's ! and !=", () => {
  it("reads !! as two nots", () => {
    expect(roundTrips("!!a")).toBe("!(!a)");
  });
  it("still reads != as one operator", () => {
    expect(roundTrips("a != b")).toBe("a != b");
    expect(roundTrips("!(a != b)")).toBe("!(a != b)");
  });
});
