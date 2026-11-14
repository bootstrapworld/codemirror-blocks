import * as P from "pretty-fast-pretty-printer";
import * as Nodes from "../src/nodes";

/**
 * A language says its own syntax for a core node through a table, and the node
 * stays what it is: its type, its fields and its spec.
 */
const at = (ch: number) => ({ line: 0, ch });
const sym = (maker: typeof Nodes, name: string, ch: number) =>
  maker.Literal(at(ch), at(ch + name.length), {
    value: name,
    dataType: "symbol",
  });
const call = (maker: typeof Nodes, args: string[]) =>
  maker.FunctionApp(at(0), at(20), {
    func: sym(maker, "f", 1),
    args: args.map((a, i) => sym(maker, a, 3 + i * 2)),
  });

// a table for a language that writes calls as f(a, b)
const parens = Nodes.forLanguage({
  FunctionApp: {
    pretty: (node) =>
      P.horz(node.fields.func, "(", P.sepBy(node.fields.args, ", ", ", "), ")"),
  },
});
// and another that writes them with a keyword
const keyword = Nodes.forLanguage({
  FunctionApp: {
    pretty: (node) => P.horz("call ", node.fields.func),
    label: "call",
  },
});

describe("Nodes.forLanguage", () => {
  it("prints a node as the table says, with the arguments typed", () => {
    expect(call(parens as typeof Nodes, ["a", "b"]).toString()).toBe("f(a, b)");
  });

  it("keeps the core default for everything the table does not say", () => {
    const core = call(Nodes, ["a"]);
    const mine = call(parens as typeof Nodes, ["a"]);
    // (printed another way, but described and named as the core node is)
    expect(core.toString()).toBe("(f a)");
    expect(mine.label).toBe(core.label);
    expect(mine.describe(1)).toBe(core.describe(1));
    expect(mine.render).toBe(core.render);
  });

  it("leaves the type, the fields and the spec of the kind as they are", () => {
    expect(parens.FunctionApp.type).toBe("functionApp");
    expect(parens.FunctionApp.type).toBe(Nodes.FunctionApp.type);
    const mine = call(parens as typeof Nodes, ["a"]);
    expect(mine.type).toBe("functionApp");
    expect(Nodes.CoreAST.isNodeOfType(mine, "functionApp")).toBe(true);
    expect(parens.FunctionApp.spec.childSpecs).toEqual(
      Nodes.FunctionApp.spec.childSpecs
    );
  });

  it("says its own label, when the table does", () => {
    expect(call(keyword as typeof Nodes, []).label).toBe("call");
    expect(call(Nodes, []).label).toBe("function application");
  });

  it("is the core maker itself for a node the table says nothing about", () => {
    expect(parens.IfExpression).toBe(Nodes.IfExpression);
    expect(parens.Literal).toBe(Nodes.Literal);
  });

  it("does not change the core makers, nor another language's", () => {
    const a = call(parens as typeof Nodes, ["a"]).toString();
    const b = call(keyword as typeof Nodes, ["a"]).toString();
    expect(a).toBe("f(a)");
    expect(b).toBe("call f");
    expect(call(Nodes, ["a"]).toString()).toBe("(f a)");
    expect(call(parens as typeof Nodes, ["a"]).toString()).toBe("f(a)");
  });

  it("can be made again from an overriding maker", () => {
    const shouting = parens.FunctionApp.with({
      pretty: (node) => P.horz("CALL ", node.fields.func),
    });
    expect(
      shouting(at(0), at(1), { func: sym(Nodes, "g", 0), args: [] }).toString()
    ).toBe("CALL g");
    expect(shouting.type).toBe("functionApp");
  });
});
