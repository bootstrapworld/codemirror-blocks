import * as P from "pretty-fast-pretty-printer";
import { displayLines, formSexpr, sexpr } from "../src/printing";

const show = (doc: P.Doc, width = 80) => displayLines(doc, width).join("\n");

describe("sexpr", () => {
  it("prints a form, as standardSexpr does", () => {
    expect(show(sexpr("let", ["x", "1"]))).toBe("(let x 1)");
    expect(show(sexpr("f", []))).toBe("(f)");
  });

  it("leaves out the parts that are not there, with no space where they were", () => {
    expect(show(sexpr("let", ["x", null]))).toBe("(let x)");
    expect(show(sexpr("let", ["x", undefined]))).toBe("(let x)");
    expect(show(sexpr("if", ["a", false, "c"]))).toBe("(if a c)");
    expect(show(sexpr("f", [null, null]))).toBe("(f)");
  });

  it("keeps a part that is empty text, as it is a part", () => {
    expect(show(sexpr("f", ["a", ""]))).toBe("(f a )");
  });

  it("breaks to fit the width, as standardSexpr does", () => {
    expect(show(sexpr("function", ["aaaa", "bbbb", "cccc"]), 14)).toBe(
      "(function\n aaaa\n bbbb\n cccc)"
    );
  });
});

describe("formSexpr", () => {
  it("puts the bodies on lines of their own, with the bracket after the last", () => {
    expect(show(formSexpr("repeat", "3", ["(show 1)", "(show 2)"]))).toBe(
      "(repeat 3\n  (show 1)\n  (show 2))"
    );
  });

  it("is one line with no bodies", () => {
    expect(show(formSexpr("repeat", "3", []))).toBe("(repeat 3)");
  });

  it("can have no header", () => {
    expect(show(formSexpr("begin", null, ["a", "b"]))).toBe(
      "(begin\n  a\n  b)"
    );
    expect(show(formSexpr("begin", undefined, []))).toBe("(begin)");
  });

  it("takes bodies that are docs, however many lines they have", () => {
    const body = P.vert("(a", " b)");
    expect(show(formSexpr("f", "x", [body, "c"]))).toBe(
      "(f x\n  (a\n   b)\n  c)"
    );
  });
});

describe("displayLines", () => {
  it("has nothing on a line that has nothing else, though it is indented", () => {
    // (an empty line in something indented keeps the indentation)
    const doc = P.horz("  ", P.vert("a", "", "b"));
    expect(doc.display(80)).toContain("  ");
    expect(displayLines(doc, 80)).toEqual(["  a", "", "  b"]);
  });

  it("leaves the other lines as they are", () => {
    expect(displayLines(P.vert("a ", " b"), 80)).toEqual(["a ", " b"]);
  });
});
