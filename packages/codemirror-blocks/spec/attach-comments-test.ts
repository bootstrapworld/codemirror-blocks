import * as P from "pretty-fast-pretty-printer";
import { withComment } from "../src/ast";
import { Comment, Literal, Unknown } from "../src/nodes";
import { attachComments } from "../src/orphans";

const BLOCK = { open: "/*", close: "*/" };

const at = (line: number, ch = 0) => ({ line, ch });
const lit = (line: number, text: string) =>
  Literal(at(line), at(line, text.length), { value: text, dataType: "symbol" });

/** What a parser of this language would report: `// line` and `/* block *\/` */
const cStyle = (code: string) =>
  [...code.matchAll(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g)].map((m) => ({
    from: m.index!,
    to: m.index! + m[0].length,
  }));

/** `attachComments`, told by a parser of this language what it skipped */
const attach = (
  code: string,
  roots: Parameters<typeof attachComments>[1],
  opts: Partial<Parameters<typeof attachComments>[2]> = {}
) =>
  attachComments(code, roots, {
    blockComment: BLOCK,
    comments: cStyle(code),
    ...opts,
  });

describe("the comments a parser reports", () => {
  it("say what the source says, without the marks that start them", () => {
    const [a, block] = attach("a // one\n\n/* two\nlines */", [lit(0, "a")]);
    expect(a.options.comment?.fields.comment).toBe("one");
    expect(block.fields.comment).toBe("two lines");
  });

  it("are given as text by a parser that knows better", () => {
    const [a] = attach("a // one", [lit(0, "a")], {
      comments: [{ from: 2, to: 8, text: "mine" }],
    });
    expect(a.options.comment?.fields.comment).toBe("mine");
  });

  it("can be given as positions", () => {
    const [a] = attach("a // one", [lit(0, "a")], {
      comments: [{ from: at(0, 2), to: at(0, 8) }],
    });
    expect(a.options.comment?.fields.comment).toBe("one");
  });

  it("make one of the lines in a row", () => {
    const placed = attach("// a\n// b\n\n// c\nx", [lit(4, "x")]);
    expect(placed.map((n) => String(n.fields.comment ?? ""))).toEqual([
      "a b",
      "",
    ]);
  });
});

describe("attachComments", () => {
  const options = {};

  it("gives a comment on the line above a node to that node", () => {
    const placed = attach(
      "// about a\na\nb",
      [lit(1, "a"), lit(2, "b")],
      options
    );
    expect(placed).toHaveLength(2);
    expect(placed[0].options.comment?.fields.comment).toBe("about a");
    expect(placed[1].options.comment).toBeUndefined();
  });

  it("makes a block of its own of a comment with a blank line below it", () => {
    const placed = attach(
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
    const [a] = attach("// c\na", [lit(1, "a")], options);
    expect(a.options.comment?.options.blockComment).toEqual(BLOCK);
  });

  it("puts a comment after the last node at the end", () => {
    const placed = attach("a\n\n\n// end", [lit(0, "a")], options);
    expect(placed.map((n) => n.type)).toEqual(["literal", "comment"]);
  });

  it("takes the marks of any language off a line comment", () => {
    const [a] = attach("; hi\na", [lit(1, "a")], {
      comments: [{ from: 0, to: 4 }],
    });
    expect(a.options.comment?.fields.comment).toBe("hi");
  });

  it("looks at the nodes of the list the comment is in, and not at another's", () => {
    // (the nodes have no ids yet: they are told apart by being the same node)
    const a = lit(0, "a");
    const b = Literal(at(0, 6), at(0, 7), { value: "b", dataType: "symbol" });
    const inner = Unknown(at(0, 2), at(0, 10), { elts: [b] });
    const placed = attach("a (/* c */ b)", [a, inner], options);
    expect(placed).toHaveLength(2);
    expect(a.options.comment).toBeUndefined();
    expect(b.options.comment?.fields.comment).toBe("c");
  });

  it("gives a comment after code to the code in its list, though another node follows on the line", () => {
    const x = Literal(at(0, 3), at(0, 4), { value: "x", dataType: "symbol" });
    const y = Literal(at(0, 17), at(0, 18), { value: "y", dataType: "symbol" });
    const call = Unknown(at(0, 0), at(0, 19), { elts: [x, y] });
    attach("(f x /* c */ y)", [call], options);
    expect(x.options.comment?.fields.comment).toBe("c");
    expect(y.options.comment).toBeUndefined();
  });
});

describe("the rules of attachComments", () => {
  const options = {};
  /** what each root is: `+` has a comment, `*` is a comment standing alone, `-` has none */
  const pattern = (placed: ReturnType<typeof attachComments>) =>
    placed
      .map((n) => (n.options.orphan ? "*" : n.options.comment ? "+" : "-"))
      .join("");
  const a = () => lit(0, "a");
  const b = (line: number) => lit(line, "b");

  describe("afterCode", () => {
    it('"previous" (the default) gives it to the code before it', () => {
      expect(pattern(attach("a // c\nb", [a(), b(1)], options))).toBe("+-");
    });
    it('"alone" makes it a block of its own', () => {
      const rules = { afterCode: "alone" as const };
      expect(
        pattern(attach("a // c\nb", [a(), b(1)], { ...options, rules }))
      ).toBe("-*-");
    });
    it('"next" gives it to the node after it on its line, and otherwise leaves it alone', () => {
      const rules = { afterCode: "next" as const };
      const next = Literal(at(0, 9), at(0, 10), {
        value: "b",
        dataType: "symbol",
      });
      expect(
        pattern(attach("a /* c */ b", [a(), next], { ...options, rules }))
      ).toBe("-+");
      expect(
        pattern(attach("a // c\nb", [a(), b(1)], { ...options, rules }))
      ).toBe("-*-");
    });
  });

  describe("above", () => {
    it('"next" (the default) gives it to the node below', () => {
      expect(pattern(attach("// c\nb", [b(1)], options))).toBe("+");
    });
    it('"alone" makes it a block of its own', () => {
      const rules = { above: "alone" as const };
      expect(pattern(attach("// c\nb", [b(1)], { ...options, rules }))).toBe(
        "*-"
      );
    });
  });

  describe("maxLinesAbove", () => {
    it("is 1 by default: a blank line between makes it stand alone", () => {
      expect(pattern(attach("// c\n\nb", [b(2)], options))).toBe("*-");
    });
    it("allows a blank line when it is 2", () => {
      const rules = { maxLinesAbove: 2 };
      expect(pattern(attach("// c\n\nb", [b(2)], { ...options, rules }))).toBe(
        "+"
      );
    });
    it("is the node's own line only when it is 0", () => {
      const rules = { maxLinesAbove: 0 };
      expect(pattern(attach("// c\nb", [b(1)], { ...options, rules }))).toBe(
        "*-"
      );
    });
  });

  describe("atEnd", () => {
    it('"last" (the default) gives it to the last node', () => {
      expect(pattern(attach("a\n// c", [a()], options))).toBe("+");
    });
    it('"alone" makes it a block of its own', () => {
      const rules = { atEnd: "alone" as const };
      expect(pattern(attach("a\n// c", [a()], { ...options, rules }))).toBe(
        "-*"
      );
    });
  });

  describe("printAfter, for a comment that goes with a node and comes after it", () => {
    const printed = (printAfter?: "beside" | "above") => {
      const node = Literal(at(0), at(0, 1), { value: "a", dataType: "symbol" });
      const comment = Comment(at(0, 2), at(0, 9), "c", { blockComment: BLOCK });
      return withComment(P.txt("a"), comment, node, printAfter)
        .display(80)
        .join("\n");
    };
    it("is beside it by default", () => {
      expect(printed()).toBe("a /* c */");
    });
    it('is above it when the rule says "above"', () => {
      expect(printed("above")).toBe("/* c */\na");
    });
    it("is above it for a comment that comes before it, whichever the rule", () => {
      const node = Literal(at(0, 9), at(0, 10), {
        value: "a",
        dataType: "symbol",
      });
      const comment = Comment(at(0), at(0, 7), "c", { blockComment: BLOCK });
      expect(
        withComment(P.txt("a"), comment, node, "beside").display(80).join("\n")
      ).toBe("/* c */\na");
    });
  });
});
