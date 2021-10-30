import { ASTNode, NodeSpec as Spec } from "../src/CodeMirrorBlocks";
import { Literal } from "../src/nodes";
import { list, nodeSpec, optional, required, value } from "../src/nodeSpec";

let literal: ASTNode;
beforeAll(() => {
  literal = Literal({ line: 0, ch: 0 }, { line: 0, ch: 1 }, "a");
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
  it("requires a the field be an ast node or null", () => {
    const spec = optional("someField");
    expect(() =>
      spec.validate({ type: "test-node", fields: {} })
    ).toThrowErrorMatchingInlineSnapshot(
      `"Expected the optional field 'someField' of 'test-node' to contain an ASTNode or null."`
    );
    expect(() =>
      spec.validate({
        type: "test-node",
        fields: { someField: "not-an-ast-node" },
      })
    ).toThrowErrorMatchingInlineSnapshot(
      `"Expected the optional field 'someField' of 'test-node' to contain an ASTNode or null."`
    );
    expect(() =>
      spec.validate({ type: "test-node", fields: { someField: null } })
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
