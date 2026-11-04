import { CoreAST } from "../src/nodes";
import { LambdaAST } from "../src/languages/lambda/ast";
import { WeSchemeAST } from "../src/languages/wescheme/ast";
import { nodeSpec } from "../src/nodeSpec";
import { ASTNode } from "../src/ast";
import { labelFromType, pluralOf } from "../src/naming";

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

  it("is made from the type for a spec that declares none", () => {
    const node = make(nodeSpec([]));
    expect(node.label).toBe("some kind of thing");
    expect(node.shortDescription()).toBe("some kind of thing");
  });
});

describe("naming", () => {
  it("splits camelCase into words", () => {
    expect(labelFromType("functionApp")).toBe("function app");
  });
  it("pluralizes", () => {
    expect(pluralOf("category")).toBe("categories");
    expect(pluralOf("day")).toBe("days");
    expect(pluralOf("box")).toBe("boxes");
    expect(pluralOf("literal")).toBe("literals");
  });
});
