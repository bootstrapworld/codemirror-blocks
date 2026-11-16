// EXPERIMENT: JavaScript blocks from @lezer/javascript. Raw trees: spec/lezer.test.ts "raw trees".
import { parser } from "@lezer/javascript";
import type { SyntaxNode } from "@lezer/common";
import { lezerLanguage, BlockRow, BlockTable, lineSeparator } from "./lezer";

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
    BooleanLiteral: { ...leaf("literal", "boolean"), dataType: "boolean" },
    this: { ...leaf("literal", "this"), dataType: "symbol" },
    null: leaf("literal", "null"),
    ArithOp: leaf("operator", "operator"),
    CompareOp: leaf("operator", "operator"),
    LogicOp: leaf("operator", "operator"),
    UpdateOp: leaf("operator", "operator"),
    BinaryExpression: { kind: "binary", label: "operation", slots: [one("left", ["#0"]), one("op", ["ArithOp", "CompareOp", "LogicOp"]), one("right", ["#2"])] },
    UnaryExpression: { kind: "unary", label: "unary operation", slots: [one("op", ["LogicOp", "ArithOp"]), one("value", ["#1"])] },
    AssignmentExpression: { kind: "assign", label: "assignment", slots: [one("target", ["#0"]), { ...one("value", ["#1"]), before: " = " }] },
    UpdateAssign: { kind: "assign", label: "update", slots: [one("target", ["#0"]), one("op", ["UpdateOp"]), one("value", ["#2"])] },
    VariableDeclaration: { kind: "declare", label: "declaration", keyword: "$first", slots: [one("name", ["VariableDefinition"]), { ...one("value", ["#1"]), before: " = " }] },
    FunctionDeclaration: { kind: "function", label: "function", keyword: "function", slots: [one("name", ["#0"]), list("params", ["ParamList"]), one("body", ["Block"])] },
    ReturnStatement: { kind: "return", label: "return", keyword: "return", slots: [one("value", ["#0"])] },
    IfStatement: { kind: "if", label: "if", keyword: "if", slots: [one("test", ["ParenthesizedExpression"]), one("then", ["Block#0"]), list("else", ["Block#1"])] },
    WhileStatement: { kind: "while", label: "while", keyword: "while", slots: [one("test", ["ParenthesizedExpression"]), one("body", ["Block"])] },
    ForOf: { kind: "for", label: "for-of loop", keyword: "for", slots: [one("var", ["VariableDefinition"]), { ...one("iterable", ["#1"]), before: " of " }, one("body", ["Block"])] },
    ForStatement: { kind: "for", label: "for loop", keyword: "for", slots: [list("parts", ["ForSpec"]), one("body", ["Block"])] },
    ClassDeclaration: { kind: "class", label: "class", keyword: "class", slots: [one("name", ["VariableDefinition"]), one("body", ["ClassBody"])] },
    ClassBody: stmts("classbody", "class body"),
    MethodDeclaration: { kind: "method", label: "method", slots: [one("name", ["#0"]), list("params", ["ParamList"]), one("body", ["Block"])] },
    LineComment: { ...leaf("comment", "comment"), topLevelOnly: true },
    BlockComment: { ...leaf("comment", "comment"), topLevelOnly: true },
    Block: stmts("block", "block"),
    ExpressionStatement: { kind: "statement", label: "statement", slots: [one("expr", ["#0"])] },
    CallExpression: { kind: "call", label: "call", slots: [one("func", ["#0"]), list("args", ["ArgList"])] },
    MemberExpression: { kind: "member", label: "member", slots: [one("object", ["#0"]), { ...one("property", ["PropertyName"]), before: "." }] },
    Index: { kind: "index", label: "index", slots: [one("object", ["#0"]), one("index", ["#1"])] },
    ArrayExpression: { kind: "array", label: "array", slots: [list("elements", "*")] },
    ObjectExpression: { kind: "object", label: "object", slots: [list("properties", "*")] },
    Property: { kind: "property", label: "property", slots: [one("key", ["PropertyDefinition"]), one("value", ["#1"])] },
  },
  opaque: ["ArrowFunction", "FunctionExpression", "TemplateString", "ConditionalExpression", "ImportDeclaration", "ExportDeclaration", "NewExpression", "AwaitExpression", "PostfixExpression"],
  blank: "undefined",
  separators: { args: ", ", elements: ", ", properties: ", ", roots: "\n", parts: "; " },
  rules: [
    {
      name: "kind",
      apply: (n: SyntaxNode) =>
        n.name === "ForStatement" && n.getChild("ForOfSpec") ? "ForOf"
        : n.name === "AssignmentExpression" && n.getChild("UpdateOp") ? "UpdateAssign"
        : n.name === "MemberExpression" && n.getChild("[") ? "Index"
        : undefined,
    },
    lineSeparator(" "),
  ],
  statementSlots: ["body", "roots"],
  statementSuffix: ";",
  templates: {
    variable: { text: "let ${name} = ${value};", kind: "declare", stmt: true },
    function: { text: "function ${name}(${param}) {\n  ${body}\n}", kind: "function", stmt: true },
    call: { text: "${func}(${arg})", kind: "call" },
    "if-else": { text: "if (${test}) {\n  ${then}\n} else {\n  ${else}\n}", kind: "if", stmt: true },
    while: { text: "while (${test}) {\n  ${body}\n}", kind: "while", stmt: true },
    for: { text: "for (const ${item} of ${items}) {\n  ${body}\n}", kind: "for", stmt: true },
    return: { text: "return ${value};", kind: "return", stmt: true },
    number: { text: "0", kind: "literal" },
    string: { text: '"text"', kind: "literal" },
    array: { text: "[${a}, ${b}]", kind: "array" },
  },
};
export { parser as javascriptParser };
export const javascript = lezerLanguage(parser as never, javascriptTable);
