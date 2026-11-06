import * as P from "pretty-fast-pretty-printer";
import React from "react";
import type { ASTNode } from "../src/ast";
import { defineNode, field } from "../src/defineNode";
import Node from "../src/components/Node";
import { Comment, Literal } from "../src/nodes";
import { List } from "../src/nodeSpec";

const at = (line: number, ch = 0) => ({ line, ch });
const lit = (text: string, ch = 0) =>
  Literal(at(0, ch), at(0, ch + text.length), text, "symbol");

const Let = defineNode({
  type: "let",
  label: "definition",
  fields: {
    name: field.required(),
    start: field.optional(),
    note: field.value<string>(),
  },
  pretty: (node) =>
    P.standardSexpr("let", [
      node.fields.name,
      ...(node.fields.start ? [node.fields.start] : []),
    ]),
  render: (props) => <Node {...props}>let</Node>,
});

const Block = defineNode({
  type: "block",
  label: "block of steps",
  pluralLabel: "blocks of steps",
  fields: { steps: field.list({ orphans: true }), tag: field.value<number>() },
  pretty: () => "{ }",
  ariaLabel: (node) => `${node.label} tagged ${node.fields.tag}`,
  render: (props) => <Node {...props}>block</Node>,
});

describe("defineNode", () => {
  it("makes a spec from the fields, in the order they are given", () => {
    expect(Let.spec.fieldNames()).toEqual(["name", "start", "note"]);
    expect(Let.type).toBe("let");
    const steps = Block.spec.childSpecs[0];
    expect(steps).toBeInstanceOf(List);
    expect((steps as List).orphans).toBe(true);
  });

  it("makes a node from where it is, its fields and its options", () => {
    const name = lit("x", 5);
    const node = Let(at(0), at(0, 8), { name, start: null, note: "n" });
    expect(node.type).toBe("let");
    expect(node.fields.name).toBe(name);
    expect(node.fields.note).toBe("n");
    expect([...node.children()]).toEqual([name]);
    expect(node.from).toEqual(at(0));
  });

  it("says what its kind of node is called, and the plural", () => {
    const node = Let(at(0), at(0, 8), {
      name: lit("x"),
      start: null,
      note: "",
    });
    expect(node.label).toBe("definition");
    expect(node.pluralLabel).toBe("definitions");
    const block = Block(at(0), at(0, 3), { steps: [], tag: 1 });
    expect(block.pluralLabel).toBe("blocks of steps");
  });

  describe("the fields", () => {
    const make = (fields: object) => () =>
      Let(at(0), at(0, 8), fields as never);

    it("must have a node for a required field", () => {
      expect(make({ start: null, note: "" })).toThrow(/required field 'name'/);
      expect(make({ name: "x", start: null, note: "" })).toThrow(
        /required field 'name'/
      );
    });

    it("may leave an optional field out, or give null or undefined", () => {
      const name = lit("x");
      expect(make({ name, note: "" })).not.toThrow();
      expect(make({ name, start: null, note: "" })).not.toThrow();
      expect(make({ name, start: undefined, note: "" })).not.toThrow();
      expect(make({ name, start: lit("1", 3), note: "" })).not.toThrow();
      expect(make({ name, start: "1", note: "" })).toThrow(/optional field/);
    });

    it("must have nodes in a list", () => {
      expect(() =>
        Block(at(0), at(0, 3), { steps: ["a"] as never, tag: 1 })
      ).toThrow(/array of ASTNodes/);
    });

    it("keeps the types of the fields", () => {
      const block = Block(at(0), at(0, 3), { steps: [lit("a")], tag: 1 });
      const steps: ASTNode[] = block.fields.steps;
      const tag: number = block.fields.tag;
      expect([steps.length, tag]).toEqual([1, 1]);
      // @ts-expect-error (a value of the wrong type)
      Block(at(0), at(0, 3), { steps: [], tag: "one" });
      // @ts-expect-error (a field that is not there)
      Block(at(0), at(0, 3), { steps: [], tag: 1, other: 2 });
      // @ts-expect-error (a field that is left out)
      Block(at(0), at(0, 3), { steps: [] });
    });
  });

  describe("the comment of a node", () => {
    const comment = Comment(at(0), at(0, 9), " note ");

    it("is printed above a node that prints a doc", () => {
      const node = Let(
        at(1),
        at(1, 8),
        { name: lit("x"), start: null, note: "" },
        { comment }
      );
      expect(node.toString()).toBe("#| note |#\n(let x)");
    });

    it("is printed above a node that prints text", () => {
      const node = Block(at(1), at(1, 3), { steps: [], tag: 1 }, { comment });
      expect(node.toString()).toBe("#| note |#\n{ }");
    });
  });

  describe("what a node reads as", () => {
    it("is made from the node by the kind, and so from its label", () => {
      const block = Block(at(0), at(0, 3), { steps: [], tag: 7 });
      expect(block.shortDescription()).toBe("block of steps tagged 7");
    });

    it("is its label if the kind says nothing", () => {
      const node = Let(at(0), at(0, 8), {
        name: lit("x"),
        start: null,
        note: "",
      });
      expect(node.shortDescription()).toBe("definition");
    });

    it("is the node's own ariaLabel if it has one", () => {
      const block = Block(
        at(0),
        at(0, 3),
        { steps: [], tag: 7 },
        { ariaLabel: "mine" }
      );
      expect(block.shortDescription()).toBe("mine");
    });
  });
});
