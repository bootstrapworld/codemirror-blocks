import example from "../../src/languages/example";
import type { Pos } from "../../src/ast";
import ExampleParser from "../../src/languages/example/ExampleParser";
import { mountCMB, teardown } from "../../src/toolkit/test-utils";

/**
 * The example language: `(name arg ...)` calls of numbers and other calls,
 * which doc/language.md offers as the model for writing a new language.
 */
// (the fields of a node depend on its type, so look at them loosely)
type Loose = { type: string; from: Pos; to: Pos; fields: any };
const parse = (code: string) =>
  new ExampleParser().parse(code) as unknown as Loose[];
const pos = (line: number, ch: number) => ({ line, ch });

describe("parsing", () => {
  it("makes no blocks from no code, or from blank space", () => {
    expect(parse("")).toEqual([]);
    expect(parse("   \n  \n")).toEqual([]);
  });

  it("makes a literal from a number", () => {
    const [node] = parse("42");
    expect(node.type).toBe("literal");
    expect(node.fields.value).toBe("42");
    expect(node.fields.dataType).toBe("number");
    expect(node.from).toEqual(pos(0, 0));
    expect(node.to).toEqual(pos(0, 2));
  });

  it("makes a function application from a call", () => {
    const [call] = parse("(+ 1 22)");
    expect(call.type).toBe("functionApp");
    expect(call.fields.func.fields.value).toBe("+");
    expect(call.fields.func.fields.dataType).toBe("symbol");
    expect(
      call.fields.args.map((a: { fields: { value: string } }) => a.fields.value)
    ).toEqual(["1", "22"]);
    expect(call.from).toEqual(pos(0, 0));
    expect(call.to).toEqual(pos(0, 8));
  });

  it("allows a call with no arguments", () => {
    const [call] = parse("(f)");
    expect(call.fields.args).toEqual([]);
  });

  it("nests calls", () => {
    const [outer] = parse("(+ 1 (* 2 3))");
    const inner = outer.fields.args[1];
    expect(inner.type).toBe("functionApp");
    expect(inner.fields.func.fields.value).toBe("*");
    expect(inner.from).toEqual(pos(0, 5));
    expect(inner.to).toEqual(pos(0, 12));
  });

  it("accepts the symbols that start with letters and use - + / * and digits", () => {
    for (const name of [
      "f",
      "add-one",
      "a1",
      "+",
      "-",
      "*",
      "/",
      "x_y",
      "do/it*",
    ]) {
      expect(parse(`(${name} 1)`)[0].fields.func.fields.value).toBe(name);
    }
  });

  it("reads several top-level forms, over several lines, with their positions", () => {
    const nodes = parse("(f 1)\n\n  (g\n 22 3)\n7");
    expect(nodes.map((n) => n.type)).toEqual([
      "functionApp",
      "functionApp",
      "literal",
    ]);
    expect(nodes[0].from).toEqual(pos(0, 0));
    expect(nodes[0].to).toEqual(pos(0, 5));
    expect(nodes[1].from).toEqual(pos(2, 2));
    expect(nodes[1].to).toEqual(pos(3, 6));
    expect(nodes[1].fields.args[0].from).toEqual(pos(3, 1));
    expect(nodes[2].from).toEqual(pos(4, 0));
  });

  it("can be used again for other code", () => {
    const parser = new ExampleParser();
    expect(parser.parse("(f 1)")).toHaveLength(1);
    expect(parser.parse("7 8")).toHaveLength(2);
    expect(parser.lex("(g)")).toHaveLength(1); // lex is parse
  });
});

describe("code it refuses", () => {
  it.each([
    [
      "a bare identifier",
      "foo",
      "Expected either a number or another expression",
    ],
    ["a call with no name", "(1 2)", "Expected an identifier"],
    ["an empty call", "()", "Expected an identifier"],
    [
      "a call that is never closed",
      "(f 1",
      "Expected either a number or another expression",
    ],
    [
      "a stray close paren",
      ")",
      "Expected either a number or another expression",
    ],
    ["a character it does not know", "(f 1.5)", "parse error"],
    ["a tab", "(f\t1)", "parse error"],
  ])("%s", (_what, code, message) => {
    expect(() => parse(code)).toThrow(message);
  });

  it("describes an error as its message, or as 'Parser error' if it has none", () => {
    const parser = new ExampleParser();
    expect(parser.getExceptionMessage(new Error("oops"))).toBe("Error: oops");
    expect(parser.getExceptionMessage("")).toBe("Parser error");
  });
});

describe("as a registered language", () => {
  it("is named and described, and builds an AST", () => {
    expect(example.id).toBe("example");
    expect(example.name).toBe("Example");
    expect(example.description).toMatch(/example language/);
    const ast = example.buildAST("(+ 1 (* 2 3))\n4");
    expect(ast.rootNodes.map(String)).toEqual(["(+ 1 (* 2 3))", "4"]);
    expect(ast.toString()).toBe("(+ 1 (* 2 3))\n4");
  });

  it("reports an error the way the parser does", () => {
    expect(() => example.buildAST("(f")).toThrow();
    expect(example.getExceptionMessage(new Error("oops"))).toBe("Error: oops");
  });

  it("works in an editor: blocks, edits and undo", () => {
    const { cmb } = mountCMB(example);
    cmb.setValue("(+ 1 (* 2 3))");
    expect(cmb.getAst().rootNodes).toHaveLength(1);
    expect(cmb.getValue()).toBe("(+ 1 (* 2 3))");
    teardown();
  });
});
