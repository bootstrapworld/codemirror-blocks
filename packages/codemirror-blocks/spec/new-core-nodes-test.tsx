import * as P from "pretty-fast-pretty-printer";
import * as Nodes from "../src/nodes";

/**
 * The core nodes that are not Scheme-only: what they print as by default (an
 * s-expression), what they say, and that a language can write them its own way.
 */
const at = (ch: number) => ({ line: 0, ch });
const word = (name: string, ch = 0) =>
  Nodes.Literal(at(ch), at(ch + name.length), {
    value: name,
    dataType: "symbol",
  });

describe("Loop", () => {
  const loop = (kind: string, header: string[], body: string[]) =>
    Nodes.Loop(at(0), at(40), {
      kind,
      header: header.map((h) => word(h)),
      body: body.map((b) => word(b)),
    });

  it("prints as (kind header... body...)", () => {
    expect(loop("while", ["t"], ["a", "b"]).toString()).toBe("(while t a b)");
    expect(loop("for-each", ["x", "xs"], ["a"]).toString()).toBe(
      "(for-each x xs a)"
    );
    expect(loop("for", ["i", "c", "n"], ["a"]).toString()).toBe(
      "(for i c n a)"
    );
    expect(loop("repeat", ["4"], []).toString()).toBe("(repeat 4)");
  });

  it("names its kind to a screenreader, and counts its steps", () => {
    const node = loop("while", ["t"], ["a", "b", "c"]);
    expect(node.type).toBe("loop");
    expect(node.label).toBe("loop");
    expect(node.shortDescription()).toContain("while loop");
    expect(node.describe(0)).toBe("a while loop (literal) with 3 steps");
    expect(loop("repeat", ["4"], ["a"]).describe(0)).toBe(
      "a repeat loop (literal) with 1 step"
    );
  });

  it("is a core node: in CoreAST, and a language can write it its own way", () => {
    expect(Nodes.CoreAST.isNodeOfType(loop("while", [], []), "loop")).toBe(
      true
    );
    const mine = Nodes.forLanguage({
      Loop: {
        pretty: (node) =>
          P.horz(
            node.fields.kind,
            " ",
            P.sepBy(node.fields.header, ", ", ", "),
            ": ",
            P.vertArray(node.fields.body)
          ),
      },
    });
    const node = mine.Loop(at(0), at(1), {
      kind: "while",
      header: [word("t")],
      body: [word("a")],
    });
    expect(node.toString()).toBe("while t: a");
    expect(node.type).toBe("loop");
    expect(loop("while", ["t"], ["a"]).toString()).toBe("(while t a)");
  });
});
