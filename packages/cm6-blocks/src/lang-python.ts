// EXPERIMENT: Python blocks from @lezer/python. Raw trees: spec/lezer.test.ts "raw trees".
import { parser } from "@lezer/python";
import { lezerLanguage, BlockRow, BlockTable } from "./lezer";
import type { Slot } from "./types";

const leaf = (kind: string, label: string): BlockRow => ({ kind, label, leaf: true });
const list = (name: string, take: string[] | "*") => ({ name, kind: "list" as const, take });
const one = (name: string, take: string[]) => ({ name, kind: "one" as const, take });

export const pythonTable: BlockTable = {
  nodes: {
    Number: { ...leaf("literal", "number"), dataType: "number" },
    String: { ...leaf("literal", "string"), dataType: "string" },
    VariableName: { ...leaf("literal", "name"), dataType: "symbol" },
    ArithOp: leaf("operator", "operator"),
    CompareOp: leaf("operator", "operator"),
    BinaryExpression: { kind: "binary", label: "operation", slots: [one("left", ["#0"]), one("op", ["ArithOp", "CompareOp"]), one("right", ["#2"])] },
    AssignStatement: { kind: "assign", label: "assignment", slots: [one("target", ["#0"]), one("value", ["#1"])] },
    ReturnStatement: { kind: "return", label: "return", keyword: "return", slots: [one("value", ["#0"])] },
    FunctionDefinition: { kind: "function", label: "function", keyword: "def", slots: [one("name", ["#0"]), list("params", ["ParamList"]), one("body", ["Body"])] },
    IfStatement: { kind: "if", label: "if", keyword: "if", slots: [one("test", ["#0"]), one("then", ["Body#0"]), list("rest", "*")] },
    WhileStatement: { kind: "while", label: "while", keyword: "while", slots: [one("test", ["#0"]), one("body", ["Body"])] },
    ForStatement: { kind: "for", label: "for-in loop", keyword: "for", slots: [one("var", ["#0"]), one("iterable", ["#1"]), one("body", ["Body"])] },
    Body: { kind: "body", label: "body", slots: [list("body", "*")] },
    ExpressionStatement: { kind: "statement", label: "statement", slots: [one("expr", ["#0"])] },
    CallExpression: { kind: "call", label: "call", slots: [one("func", ["#0"]), list("args", ["ArgList"])] },
    ArrayExpression: { kind: "array", label: "list", slots: [list("elements", "*")] },
  },
  separators: { args: ", ", elements: ", ", roots: "\n" },
  rules: [{
    // statements of a body are one per line, at the indentation of their neighbour
    name: "separator",
    apply(slot: Slot, text: string) {
      if (slot.name !== "body" || !slot.nodes.length) return undefined;
      const at = slot.nodes[0].from;
      return "\n" + text.slice(text.lastIndexOf("\n", at - 1) + 1, at);
    },
  }],
};
export { parser as pythonParser };
export const python = lezerLanguage(parser as never, pythonTable);
