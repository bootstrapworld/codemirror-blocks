import * as P from "pretty-fast-pretty-printer";
import { ASTNode, AST, enumerateList, pluralize } from "../src/ast";
import wescheme from "../src/languages/wescheme";
import { Literal } from "../src/nodes";

const pos = (line: number, ch: number) => ({ line, ch });
const lit = (text: string) => Literal(pos(0, 0), pos(0, text.length), text);

describe("describing lists and counts for a screenreader", () => {
  it("enumerateList joins descriptions with commas and 'and'", () => {
    expect(enumerateList([lit("a")], 0)).toBe(lit("a").describe(0));
    expect(enumerateList([lit("a"), lit("b")], 0)).toBe(
      `${lit("a").describe(0)} and ${lit("b").describe(0)}`
    );
    expect(enumerateList([lit("a"), lit("b"), lit("c")], 0)).toBe(
      `${lit("a").describe(0)}, ${lit("b").describe(0)} and ${lit("c").describe(0)}`
    );
  });

  it("pluralize counts things, and puts an s on the noun unless there is one", () => {
    expect(pluralize("argument", [])).toBe("0 arguments");
    expect(pluralize("argument", [1])).toBe("1 argument");
    expect(pluralize("argument", [1, 2, 3])).toBe("3 arguments");
  });
});

describe("making a node", () => {
  const sample = lit("x");
  const valid = () => ({
    type: "thing",
    from: pos(0, 0),
    to: pos(0, 1),
    options: {},
    fields: sample.fields,
    spec: sample.spec,
    pretty: () => P.txt("x"),
    render: () => null,
  });
  const make = (props: object) => new ASTNode(props as any);

  it("accepts a node with everything it needs", () => {
    expect(make(valid()).type).toBe("thing");
  });

  it.each([
    ["a type that is not a string", { type: 7 }, /fixed 'type'/],
    [
      "options that are not an object",
      { options: "no" },
      /options.*must be an object/,
    ],
    ["no start position", { from: undefined }, /from and \.to are required/],
    [
      "a start position without numbers",
      { from: { line: "0", ch: 0 } },
      /from and \.to are required/,
    ],
    ["no end position", { to: undefined }, /from and \.to are required/],
    ["no pretty()", { pretty: undefined }, /needs to have a pretty\(\) method/],
    ["no render()", { render: undefined }, /needs to have a render\(\) method/],
    ["no spec", { spec: undefined }, /needs to have a static 'spec'/],
  ])("refuses %s", (_what, wrong, message) => {
    expect(() => make({ ...valid(), ...wrong })).toThrow(message);
  });

  it("names the type in the message", () => {
    expect(() => make({ ...valid(), pretty: undefined })).toThrow(/thing/);
  });
});

describe("finding nodes in an AST", () => {
  const ast = wescheme.buildAST("(f (g x))\n(h)");
  const [first, second] = ast.rootNodes;

  it("looks a node up by id or number, and says when there is none", () => {
    expect(ast.getNodeByIdOrThrow(first.id)).toBe(first);
    expect(ast.getNodeByNIdOrThrow(first.nid)).toBe(first);
    expect(() => ast.getNodeByIdOrThrow("no-such-id")).toThrow(
      "Node with id no-such-id not found"
    );
    expect(() => ast.getNodeByNIdOrThrow(9999)).toThrow(
      "Node with nid 9999 not found"
    );
  });

  it("getNextMatchingNode keeps searching until the test says stop", () => {
    const next = (n: ASTNode) => ast.getNodeAfter(n) ?? undefined;
    const isCall = (n: ASTNode) => n.type === "functionApp";
    // from the first call: skip calls until the first thing that is not one
    const firstNonCall = ast.getNextMatchingNode(next, isCall, first);
    expect(firstNonCall?.toString()).toBe("f");
    // inclusive: the start itself is tested too, so a non-call start is returned
    const f = ast.getNodeByNIdOrThrow(first.nid + 1);
    expect(ast.getNextMatchingNode(next, isCall, f, true)).toBe(f);
    expect(ast.getNextMatchingNode(next, isCall, first, true)?.toString()).toBe(
      "f"
    );
    // nothing left to find
    expect(
      ast.getNextMatchingNode(
        () => undefined,
        () => true,
        second
      )
    ).toBeUndefined();
  });
});

describe("positions next to comments", () => {
  // the comment is on the line above (f x); g has a comment on its own line
  const ast = wescheme.buildAST(";; about f\n(f x)\n(g y)");

  it("followsComment is true to the right of a comment, or of a commented node, on its line", () => {
    const [f] = ast.rootNodes;
    const comment = f.options.comment!;
    expect(ast.followsComment(pos(comment.to.line, comment.to.ch))).toBe(true);
    expect(ast.followsComment(pos(comment.to.line, comment.to.ch + 5))).toBe(
      true
    );
    // after the commented node itself, on its line
    expect(ast.followsComment(pos(f.to.line, f.to.ch))).toBe(true);
    // a line with no comment on it, or left of the comment
    expect(ast.followsComment(pos(2, 5))).toBe(false);
    expect(ast.followsComment(pos(comment.to.line, 0))).toBe(false);
  });

  it("precedesComment is true to the left of a comment, or of a commented node, on its line", () => {
    const [f] = ast.rootNodes;
    const comment = f.options.comment!;
    expect(ast.precedesComment(pos(comment.from.line, 0))).toBe(true);
    expect(ast.precedesComment(pos(comment.from.line, comment.from.ch))).toBe(
      true
    );
    expect(ast.precedesComment(pos(f.from.line, f.from.ch))).toBe(true);
    expect(ast.precedesComment(pos(2, 0))).toBe(false);
    expect(
      ast.precedesComment(pos(comment.from.line, comment.from.ch + 1))
    ).toBe(false);
  });

  it("neither is true in code with no comments", () => {
    const plain = wescheme.buildAST("(f x)");
    expect(plain.followsComment(pos(0, 3))).toBe(false);
    expect(plain.precedesComment(pos(0, 3))).toBe(false);
  });
});

describe("an AST with nothing in it", () => {
  it("has no nodes, and prints as nothing", () => {
    const empty = wescheme.buildAST("");
    expect(empty).toBeInstanceOf(AST);
    expect(empty.rootNodes).toEqual([]);
    expect(empty.toString()).toBe("");
  });
});
