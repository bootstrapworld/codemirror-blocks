import { ASTNode, NodeSpec as Spec } from "../src/CodeMirrorBlocks";
import { Literal } from "../src/nodes";
import * as P from "pretty-fast-pretty-printer";
import { list, nodeSpec, optional, required, value } from "../src/nodeSpec";

let literal: ASTNode;
beforeAll(() => {
  literal = Literal(
    { line: 0, ch: 0 },
    { line: 0, ch: 1 },
    { value: "a", dataType: "unknown" }
  );
});

describe("nodeSpec()", () => {
  let spec!: Spec.NodeSpec;
  beforeEach(() => {
    spec = nodeSpec([
      required("aRequiredField"),
      optional("anOptionalField"),
      list("aListField"),
      value("aValueField"),
    ]);
  });
  describe("NodeSpec.validate()", () => {
    it("produces error messages NodeSpec object", () => {
      expect(() =>
        spec.validate({ type: "my-node", fields: {} })
      ).toThrowErrorMatchingInlineSnapshot(
        `"Expected the required field 'aRequiredField' of 'my-node' to contain an ASTNode."`
      );
    });
  });
});

describe("required()", () => {
  it("requires an astnode to be provided", () => {
    const spec = required("someField");
    expect(() =>
      spec.validate({ type: "test-node", fields: {} })
    ).toThrowErrorMatchingInlineSnapshot(
      `"Expected the required field 'someField' of 'test-node' to contain an ASTNode."`
    );

    expect(() =>
      spec.validate({
        type: "test-node",
        fields: { someField: "a non ASTNode value" },
      })
    ).toThrowErrorMatchingInlineSnapshot(
      `"Expected the required field 'someField' of 'test-node' to contain an ASTNode."`
    );

    expect(() =>
      spec.validate({
        type: "test-node",
        fields: {
          someField: literal,
        },
      })
    ).not.toThrow();
  });
});

describe("optional()", () => {
  it("requires a the field be an ast node, null or undefined", () => {
    const spec = optional("someField");
    expect(() =>
      spec.validate({
        type: "test-node",
        fields: { someField: "not-an-ast-node" },
      })
    ).toThrowErrorMatchingInlineSnapshot(
      `"Expected the optional field 'someField' of 'test-node' to contain an ASTNode, null or undefined."`
    );
    expect(() =>
      spec.validate({ type: "test-node", fields: { someField: null } })
    ).not.toThrow();
    // (a field that is left out, or set to undefined, is as empty as null)
    expect(() =>
      spec.validate({ type: "test-node", fields: {} })
    ).not.toThrow();
    expect(() =>
      spec.validate({ type: "test-node", fields: { someField: undefined } })
    ).not.toThrow();
    expect(() =>
      spec.validate({ type: "test-node", fields: { someField: literal } })
    ).not.toThrow();
  });
});

describe("list()", () => {
  it("requires a list of ast nodes to be provideds", () => {
    const spec = list("someField");
    expect(() =>
      spec.validate({ type: "test-node", fields: {} })
    ).toThrowErrorMatchingInlineSnapshot(
      `"Expected the listy field 'someField' of 'test-node' to contain an array of ASTNodes."`
    );

    expect(() =>
      spec.validate({
        type: "test-node",
        fields: { someField: ["not an ast-node"] },
      })
    ).toThrowErrorMatchingInlineSnapshot(
      `"Expected the listy field 'someField' of 'test-node' to contain an array of ASTNodes."`
    );
    expect(() =>
      spec.validate({
        type: "test-node",
        fields: { someField: ["not an ast-node", literal] },
      })
    ).toThrowErrorMatchingInlineSnapshot(
      `"Expected the listy field 'someField' of 'test-node' to contain an array of ASTNodes."`
    );
    expect(() =>
      spec.validate({
        type: "test-node",
        fields: { someField: [literal, literal] },
      })
    ).not.toThrow();
  });
});

describe("value()", () => {
  it("requires anything that is not an ASTNode or list of ASTNodes", () => {
    const spec = value("someField");

    expect(() =>
      spec.validate({ type: "test-node", fields: { someField: literal } })
    ).toThrowErrorMatchingInlineSnapshot(
      `"Expected value field 'someField' of 'test-node' to be something other than an ASTNode, Did you mean to use required() or optional() instead?"`
    );

    expect(() =>
      spec.validate({
        type: "test-node",
        fields: { someField: ["not-a-node", literal] },
      })
    ).toThrowErrorMatchingInlineSnapshot(
      `"Expected listy field 'someField' of 'test-node' to contain things other than ASTNodes. Did you mean to use list() instead?"`
    );

    expect(() =>
      spec.validate({
        type: "test-node",
        fields: { someField: ["not-a-node", "also-not-a-node"] },
      })
    ).not.toThrow();

    expect(() =>
      spec.validate({
        type: "test-node",
        fields: {},
      })
    ).not.toThrow();

    expect(() =>
      spec.validate({
        type: "test-node",
        fields: { someField: 123 },
      })
    ).not.toThrow();
  });
});

describe("a node with an optional field left empty", () => {
  // (a language's `let x;` has no initializer; its fields may also carry
  // data the spec does not name)
  const make = (fields: Record<string, unknown>) =>
    new ASTNode({
      from: { line: 0, ch: 0 },
      to: { line: 0, ch: 6 },
      type: "let",
      fields,
      options: {},
      spec: nodeSpec([required("symbol"), optional("init"), value("note")]),
      pretty: () => P.txt("let x;"),
      render: () => null,
    } as never);

  it("is built whether the field is null, undefined or left out", () => {
    for (const fields of [
      { symbol: literal, init: null },
      { symbol: literal, init: undefined },
      { symbol: literal },
    ]) {
      const node = make(fields);
      expect([...node.children()]).toEqual([literal]);
    }
  });

  it("hashes the same however the field is empty", () => {
    const hashes = [
      make({ symbol: literal, init: null }).hash,
      make({ symbol: literal, init: undefined }).hash,
      make({ symbol: literal }).hash,
    ];
    expect(new Set(hashes).size).toBe(1);
  });

  it("is built with properties the spec does not name", () => {
    const node = make({ symbol: literal, init: null, scope: ["x", "y"] });
    expect(node.fields.scope).toEqual(["x", "y"]);
  });
});
