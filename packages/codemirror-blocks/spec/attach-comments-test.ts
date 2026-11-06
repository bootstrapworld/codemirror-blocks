import { Literal, Unknown } from "../src/nodes";
import { attachComments, scanComments } from "../src/orphans";

/** A language that writes comments as C does: `// line` and `/* block *\/` */
const C = { line: "//", block: { open: "/*", close: "*/" } };
const BLOCK = { open: "/*", close: "*/" };

const at = (line: number, ch = 0) => ({ line, ch });
const lit = (line: number, text: string) =>
  Literal(at(line), at(line, text.length), { value: text, dataType: "symbol" });

describe("scanComments, for a language of its own", () => {
  it("finds the comments of the syntax it is given", () => {
    const found = scanComments("a // one\n/* two\nlines */ b", C);
    expect(found.map((c) => c.text)).toEqual(["one", "two lines"]);
  });

  it("leaves what is a comment in another language alone", () => {
    expect(scanComments("a ; not one\n#| nor this |#", C)).toEqual([]);
  });

  it("does not look for a comment in a text", () => {
    expect(scanComments('"a // b" c', C)).toEqual([]);
  });

  it("makes one of the lines in a row", () => {
    const [one, ...rest] = scanComments("// a\n// b\n\n// c", C);
    expect(rest).toHaveLength(1);
    expect(one.text).toBe("a b");
  });

  it("still reads Scheme's comments, and its symbols with bars, by default", () => {
    const found = scanComments("|a;b| ; yes", {
      line: ";",
      block: { open: "#|", close: "|#" },
      scheme: true,
    });
    expect(found.map((c) => c.text)).toEqual(["yes"]);
  });
});

describe("attachComments", () => {
  const options = { blockComment: BLOCK, syntax: C };

  it("gives a comment on the line above a node to that node", () => {
    const placed = attachComments(
      "// about a\na\nb",
      [lit(1, "a"), lit(2, "b")],
      options
    );
    expect(placed).toHaveLength(2);
    expect(placed[0].options.comment?.fields.comment).toBe("about a");
    expect(placed[1].options.comment).toBeUndefined();
  });

  it("makes a block of its own of a comment with a blank line below it", () => {
    const placed = attachComments(
      "a\n\n/* apart */\n\nb",
      [lit(0, "a"), lit(4, "b")],
      options
    );
    expect(placed.map((n) => n.type)).toEqual([
      "literal",
      "comment",
      "literal",
    ]);
    expect(placed[1].options.orphan).toBe(true);
    expect(placed[1].fields.comment).toBe("apart");
  });

  it("keeps the way the language writes a comment, to write it back", () => {
    const [a] = attachComments("// c\na", [lit(1, "a")], options);
    expect(a.options.comment?.options.blockComment).toEqual(BLOCK);
  });

  it("puts a comment after the last node at the end", () => {
    const placed = attachComments("a\n\n\n// end", [lit(0, "a")], options);
    expect(placed.map((n) => n.type)).toEqual(["literal", "comment"]);
  });

  it("reads Scheme's comments if no syntax is given", () => {
    const [a] = attachComments("; hi\na", [lit(1, "a")], {
      blockComment: { open: "#|", close: "|#" },
    });
    expect(a.options.comment?.fields.comment).toBe("hi");
  });

  it("looks at the nodes of the list the comment is in, and not at another's", () => {
    // (the nodes have no ids yet: they are told apart by being the same node)
    const a = lit(0, "a");
    const b = Literal(at(0, 6), at(0, 7), { value: "b", dataType: "symbol" });
    const inner = Unknown(at(0, 2), at(0, 10), { elts: [b] });
    const placed = attachComments("a (/* c */ b)", [a, inner], options);
    expect(placed).toHaveLength(2);
    expect(a.options.comment).toBeUndefined();
    expect(b.options.comment?.fields.comment).toBe("c");
  });

  it("gives a comment after code to the code in its list, though another node follows on the line", () => {
    const x = Literal(at(0, 3), at(0, 4), { value: "x", dataType: "symbol" });
    const y = Literal(at(0, 17), at(0, 18), { value: "y", dataType: "symbol" });
    const call = Unknown(at(0, 0), at(0, 19), { elts: [x, y] });
    attachComments("(f x /* c */ y)", [call], options);
    expect(x.options.comment?.fields.comment).toBe("c");
    expect(y.options.comment).toBeUndefined();
  });
});
