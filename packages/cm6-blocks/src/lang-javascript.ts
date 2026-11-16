// EXPERIMENT: JavaScript blocks from @lezer/javascript. Raw trees: spec/lezer.test.ts "raw trees".
import { parser } from "@lezer/javascript";
import { lezerLanguage, BlockRow, BlockTable } from "./lezer";

const leaf = (kind: string, label: string): BlockRow => ({ kind, label, leaf: true });
const list = (name: string, take: string[] | "*") => ({ name, kind: "list" as const, take });
const one = (name: string, take: string[]) => ({ name, kind: "one" as const, take });
const stmts = (kind: string, label: string): BlockRow => ({ kind, label, slots: [list("body", "*")] });

export const javascriptTable: BlockTable = {
  nodes: {
    Number: { ...leaf("literal", "number"), dataType: "number" },
    String: { ...leaf("literal", "string"), dataType: "string" },
    VariableName: { ...leaf("literal", "name"), dataType: "symbol" },
    VariableDefinition: { ...leaf("literal", "name"), dataType: "symbol" },
    PropertyName: leaf("literal", "property"),
    PropertyDefinition: leaf("literal", "property"),
    ArithOp: leaf("operator", "operator"),
    CompareOp: leaf("operator", "operator"),
    BinaryExpression: { kind: "binary", label: "operation", slots: [one("left", ["#0"]), one("op", ["ArithOp", "CompareOp"]), one("right", ["#2"])] },
    AssignmentExpression: { kind: "assign", label: "assignment", slots: [one("target", ["#0"]), one("value", ["#1"])] },
    VariableDeclaration: { kind: "declare", label: "declaration", keyword: "let", slots: [one("name", ["VariableDefinition"]), one("value", ["#1"])] },
    FunctionDeclaration: { kind: "function", label: "function", keyword: "function", slots: [one("name", ["#0"]), list("params", ["ParamList"]), one("body", ["Block"])] },
    ReturnStatement: { kind: "return", label: "return", keyword: "return", slots: [one("value", ["#0"])] },
    IfStatement: { kind: "if", label: "if", keyword: "if", slots: [one("test", ["ParenthesizedExpression"]), one("then", ["Block#0"]), list("else", ["Block#1"])] },
    WhileStatement: { kind: "while", label: "while", keyword: "while", slots: [one("test", ["ParenthesizedExpression"]), one("body", ["Block"])] },
    ForStatement: { kind: "for", label: "for-of loop", keyword: "for", slots: [one("var", ["VariableDefinition"]), one("iterable", ["VariableName#0"]), one("body", ["Block"])] },
    Block: stmts("block", "block"),
    ExpressionStatement: { kind: "statement", label: "statement", slots: [one("expr", ["#0"])] },
    CallExpression: { kind: "call", label: "call", slots: [one("func", ["#0"]), list("args", ["ArgList"])] },
    MemberExpression: { kind: "member", label: "member", slots: [one("object", ["#0"]), one("property", ["PropertyName"])] },
    ArrayExpression: { kind: "array", label: "array", slots: [list("elements", "*")] },
    ObjectExpression: { kind: "object", label: "object", slots: [list("properties", "*")] },
    Property: { kind: "property", label: "property", slots: [one("key", ["PropertyDefinition"]), one("value", ["#1"])] },
  },
  blank: "undefined",
  separators: { args: ", ", elements: ", ", properties: ", ", body: " ", roots: "\n" },
};
export { parser as javascriptParser };
export const javascript = lezerLanguage(parser as never, javascriptTable);
