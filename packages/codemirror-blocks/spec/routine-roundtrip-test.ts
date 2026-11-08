import routine from "@bootstrapworld/cmb-routine";

/** The text a program is shown as in blocks, and what that reads back as */
const printed = (code: string) => routine.buildAST(code).toString();
const roundTrips = (code: string) => {
  const once = printed(code);
  expect(printed(once)).toBe(once);
  return once;
};

describe("routine, from text to blocks and back", () => {
  it("prints each kind of form", () => {
    expect(roundTrips("(let minutes 10)")).toBe("(let minutes 10)");
    expect(roundTrips("(let spare)")).toBe("(let spare)");
    expect(roundTrips('(show "Good morning")')).toBe('(show "Good morning")');
    expect(roundTrips("(+ 1 2)")).toBe("(+ 1 2)");
    expect(roundTrips("(if (> a 1) (show 1))")).toBe("(if (> a 1) (show 1))");
    expect(roundTrips("(if (> a 1) (show 1) (show 2))")).toBe(
      "(if (> a 1) (show 1) (show 2))"
    );
  });

  it("puts the steps of a repeat on lines of their own", () => {
    expect(roundTrips('(repeat 3 (show "a") (show "b"))')).toBe(
      '(repeat 3\n  (show "a")\n  (show "b"))'
    );
    expect(roundTrips("(repeat 3)")).toBe("(repeat 3)");
  });

  it("keeps the escapes of a text", () => {
    expect(roundTrips('(show "say \\"hi\\"\\n")')).toBe(
      '(show "say \\"hi\\"\\n")'
    );
  });

  it("keeps the comments, above a node and on their own", () => {
    expect(roundTrips("; wake up\n(show 1)")).toBe("#| wake up |#\n(show 1)");
    const apart = roundTrips("(show 1)\n\n#| apart |#\n\n(show 2)");
    expect(apart).toContain("#| apart |#");
    expect(roundTrips(apart)).toBe(apart);
    expect(
      roundTrips("(repeat 2\n  ; inside\n  (show 1)\n  (show 2))")
    ).toContain("#| inside |#");
  });

  it("says what is wrong", () => {
    const wrong = (code: string) => {
      try {
        routine.buildAST(code);
      } catch (e) {
        return routine.getExceptionMessage(e);
      }
      return "no error";
    };
    expect(wrong("(show")).toMatch(/not closed/);
    expect(wrong(")")).toMatch(/no \( before/);
    expect(wrong("()")).toMatch(/empty parentheses/);
    expect(wrong("(let 3)")).toMatch(/must name something/);
    expect(wrong("(if 1)")).toMatch(/needs a test/);
    expect(wrong('(show "a')).toMatch(/not closed/);
  });
});
