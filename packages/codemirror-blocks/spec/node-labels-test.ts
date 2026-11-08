import { CoreAST } from "../src/nodes";
import { LambdaAST } from "@bootstrapworld/cmb-lambda";
import wescheme from "@bootstrapworld/cmb-wescheme";
import { WeSchemeAST } from "@bootstrapworld/cmb-wescheme";
import { nodeSpec } from "../src/nodeSpec";
import { ASTNode } from "../src/ast";
import { joinWithAnd, labelFromType, pluralize, pluralOf } from "../src/naming";

type SpecTable = { config: Record<string, ReturnType<typeof nodeSpec>> };

describe("node labels", () => {
  // every kind of node a bundled language can make says what it is called
  const tables: [string, SpecTable][] = [
    ["core", CoreAST as unknown as SpecTable],
    ["lambda", LambdaAST as unknown as SpecTable],
    ["wescheme", WeSchemeAST as unknown as SpecTable],
  ];
  tables.forEach(([name, table]) => {
    it(`${name}: every type declares a label`, () => {
      const missing = Object.entries(table.config)
        .filter(([, spec]) => !spec.naming?.label)
        .map(([type]) => type);
      expect(missing).toEqual([]);
    });
  });

  const make = (spec: ReturnType<typeof nodeSpec>, options = {}) =>
    new ASTNode({
      from: { line: 0, ch: 0 },
      to: { line: 0, ch: 1 },
      type: "someKindOfThing",
      fields: {},
      options,
      pretty: () => {
        throw new Error("unused");
      },
      render: () => undefined,
      spec,
    } as unknown as ConstructorParameters<typeof ASTNode>[0]);

  it("is what a node reads as when it has no aria label of its own", () => {
    const node = make(nodeSpec([], { label: "gizmo" }));
    expect(node.shortDescription()).toBe("gizmo");
    expect(node.label).toBe("gizmo");
    expect(node.pluralLabel).toBe("gizmos");
  });

  it("gives way to the node's own aria label, and to a declared plural", () => {
    const node = make(
      nodeSpec([], { label: "child", pluralLabel: "children" }),
      {
        ariaLabel: "the little one",
      }
    );
    expect(node.shortDescription()).toBe("the little one");
    expect(node.pluralLabel).toBe("children");
  });

  it("can be made from the node, so it can use the node's own label", () => {
    const node = make(nodeSpec([], { label: "gizmo" }), {
      ariaLabel: (n: ASTNode) => `big ${n.label} with 3 knobs`,
    });
    expect(node.shortDescription()).toBe("big gizmo with 3 knobs");
  });

  it("is made from the type for a spec that declares none", () => {
    const node = make(nodeSpec([]));
    expect(node.label).toBe("some kind of thing");
    expect(node.shortDescription()).toBe("some kind of thing");
  });
});

describe("a language's own names", () => {
  const parse = (code: string) => wescheme.parse(code) as ASTNode[];
  it("WeScheme says what it always has, now from the labels", () => {
    expect(parse("(define x 1)")[0].shortDescription()).toBe(
      "x: value definition"
    );
    expect(parse("(define (f a b) a)")[0].shortDescription()).toBe(
      "f: function definition with 2 arguments: a and b"
    );
    expect(parse("(lambda (a) a)")[0].shortDescription()).toBe(
      "anonymous function with 1 argument: a"
    );
    expect(parse("(cond [a b])")[0].shortDescription()).toBe(
      "conditional expression with 1 clause"
    );
    expect(parse("(if a b c)")[0].shortDescription()).toBe(
      "if-then-else expression"
    );
  });
  it("keeps the core's name for a kind it does not rename", () => {
    expect(CoreAST.config.variableDefinition.naming?.label).toBe(
      "variable definition"
    );
  });
});

describe("naming", () => {
  it("splits camelCase into words", () => {
    expect(labelFromType("functionApp")).toBe("function app");
  });
  it("counts and pluralizes a noun, from a number or from the things", () => {
    expect(pluralize("argument", 0)).toBe("0 arguments");
    expect(pluralize("argument", 1)).toBe("1 argument");
    expect(pluralize("argument", [1, 2, 3])).toBe("3 arguments");
    // (a noun that takes more than an s)
    expect(pluralize("category", 2)).toBe("2 categories");
    expect(pluralize("box", [1, 2])).toBe("2 boxes");
  });
  it("joins what is said as it is spoken, with the comma before the last and", () => {
    expect(joinWithAnd([])).toBe("");
    expect(joinWithAnd(["a"])).toBe("a");
    expect(joinWithAnd(["a", "b"])).toBe("a and b");
    expect(joinWithAnd(["a", "b", "c"])).toBe("a, b, and c");
  });
  it("pluralizes", () => {
    expect(pluralOf("category")).toBe("categories");
    expect(pluralOf("day")).toBe("days");
    expect(pluralOf("box")).toBe("boxes");
    expect(pluralOf("literal")).toBe("literals");
  });
});
