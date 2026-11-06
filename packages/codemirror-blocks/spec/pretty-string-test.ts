import * as P from "pretty-fast-pretty-printer";
import { ASTNode } from "../src/ast";
import { Comment, Unknown } from "../src/nodes";
import { nodeSpec } from "../src/nodeSpec";

/**
 * A language that has a printer of its own can give back the text of a node
 * (see ASTNodeProps.pretty) instead of a doc of the pretty-printer.
 */
const at = (line: number, ch = 0) => ({ line, ch });

/** a node of a language whose printer gives back `text` */
const printed = (text: string, options = {}, line = 0) =>
  new ASTNode({
    from: at(line),
    to: at(line, text.length),
    type: "printed",
    fields: {},
    options,
    spec: nodeSpec([]),
    pretty: () => text,
    render: () => null,
  } as never);

describe("a pretty() that gives back text", () => {
  it("is printed as it is", () => {
    expect(printed("let x = 1;").toString()).toBe("let x = 1;");
  });

  it("keeps its own line breaks, however narrow or wide", () => {
    const text = "{\n  a;\n  b;\n}";
    expect(printed(text).toString()).toBe(text);
    expect(printed(text).pretty().display(1000).join("\n")).toBe(text);
  });

  it("is embedded in the doc of the node around it", () => {
    const inner = printed("x = 1;");
    const outer = Unknown(at(0), at(0, 10), {
      elts: [inner, printed("y = 2;")],
    });
    expect(outer.toString()).toBe("(x = 1; y = 2;)");
  });

  it("has its comment above it", () => {
    const comment = Comment(at(0), at(0, 9), " note ");
    const node = printed("let x;", { comment }, 1);
    expect(node.toString()).toBe("#| note |#\nlet x;");
  });

  it("keeps a comment that was beside it beside it", () => {
    const comment = Comment(at(0, 7), at(0, 16), " note ");
    const node = printed("let x;", { comment }, 0);
    expect(node.toString()).toBe("let x; #| note |#");
  });
});

describe("a pretty() that gives back a doc", () => {
  it("is as before", () => {
    const node = new ASTNode({
      from: at(0),
      to: at(0, 3),
      type: "doc",
      fields: {},
      options: {},
      spec: nodeSpec([]),
      pretty: () => P.txt("abc"),
      render: () => null,
    } as never);
    expect(node.toString()).toBe("abc");
  });
});
