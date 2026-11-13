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

describe("BinaryOperation and UnaryOperation", () => {
  const binary = (operator: string) =>
    Nodes.BinaryOperation(at(0), at(9), {
      operator,
      left: word("a"),
      right: word("b"),
    });
  const unary = (operator: string) =>
    Nodes.UnaryOperation(at(0), at(9), { operator, operand: word("a") });

  it("print as (operator operands...)", () => {
    expect(binary("+").toString()).toBe("(+ a b)");
    expect(binary("and").toString()).toBe("(and a b)");
    expect(unary("not").toString()).toBe("(not a)");
  });

  it("say what they are", () => {
    expect(binary("+").type).toBe("binaryOperation");
    expect(binary("+").label).toBe("binary operation");
    expect(binary("+").describe(0)).toBe("+ of literal and literal");
    expect(unary("-").type).toBe("unaryOperation");
    expect(unary("-").describe(0)).toBe("- of literal");
  });

  it("can be written between the operands by a language, which brackets as it needs", () => {
    const mine = Nodes.forLanguage({
      BinaryOperation: {
        pretty: (node) =>
          P.horz(
            node.fields.left,
            ` ${node.fields.operator} `,
            node.fields.right
          ),
      },
      UnaryOperation: {
        pretty: (node) => P.horz(node.fields.operator, node.fields.operand),
      },
    });
    const sum = mine.BinaryOperation(at(0), at(1), {
      operator: "+",
      left: word("a"),
      right: word("b"),
    });
    expect(sum.toString()).toBe("a + b");
    expect(
      mine
        .UnaryOperation(at(0), at(1), { operator: "!", operand: word("a") })
        .toString()
    ).toBe("!a");
    expect(binary("+").toString()).toBe("(+ a b)");
    expect(Nodes.CoreAST.isNodeOfType(sum, "binaryOperation")).toBe(true);
  });
});

describe("Assignment", () => {
  const assign = (operator: string) =>
    Nodes.Assignment(at(0), at(9), {
      operator,
      target: word("x"),
      value: word("1"),
    });

  it("prints (set! target value) for =, and (operator target value) otherwise", () => {
    expect(assign("=").toString()).toBe("(set! x 1)");
    expect(assign("+=").toString()).toBe("(+= x 1)");
  });

  it("says what it is", () => {
    expect(assign("=").type).toBe("assignment");
    expect(assign("=").label).toBe("assignment");
    expect(assign("=").describe(0)).toBe("set literal to literal");
    expect(assign("+=").describe(0)).toBe("+= literal to literal");
  });

  it("can be written as target = value by a language", () => {
    const mine = Nodes.forLanguage({
      Assignment: {
        pretty: (node) =>
          P.horz(
            node.fields.target,
            ` ${node.fields.operator} `,
            node.fields.value
          ),
      },
    });
    const node = mine.Assignment(at(0), at(1), {
      operator: "=",
      target: word("x"),
      value: word("1"),
    });
    expect(node.toString()).toBe("x = 1");
    expect(assign("=").toString()).toBe("(set! x 1)");
  });
});
