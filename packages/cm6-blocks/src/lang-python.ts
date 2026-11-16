// EXPERIMENT: Python blocks from @lezer/python. Raw trees: spec/lezer.test.ts "raw trees".
import { parser } from "@lezer/python";
import type { SyntaxNode } from "@lezer/common";
import { lezerLanguage, BlockRow, BlockTable, lineSeparator } from "./lezer";

const leaf = (kind: string, label: string): BlockRow => ({ kind, label, leaf: true });
const list = (name: string, take: string[] | "*") => ({ name, kind: "list" as const, take });
const one = (name: string, take: string[]) => ({ name, kind: "one" as const, take });

export const pythonTable: BlockTable = {
  nodes: {
    Number: { ...leaf("literal", "number"), dataType: "number" },
    String: { ...leaf("literal", "string"), dataType: "string" },
    VariableName: { ...leaf("literal", "name"), dataType: "symbol" },
    PropertyName: leaf("literal", "property"),
    Ellipsis: { ...leaf("literal", "hole"), dataType: "symbol" },
    Boolean: { ...leaf("literal", "boolean"), dataType: "boolean" },
    None: { ...leaf("literal", "none"), dataType: "other" },
    ArithOp: leaf("operator", "operator"),
    CompareOp: leaf("operator", "operator"),
    UpdateOp: leaf("operator", "operator"),
    KwOp: leaf("operator", "operator"),
    BinaryExpression: { kind: "binary", label: "operation", describe: "${left} ${rest}", slots: [one("left", ["#0"]), list("rest", "*")] },
    UnaryExpression: { kind: "unary", label: "unary operation", slots: [one("op", ["KwOp", "ArithOp"]), one("value", ["#1"])] },
    AssignStatement: { kind: "assign", label: "assignment", describe: "set ${target} to ${value}", slots: [list("target", ["@before:AssignOp"]), { ...list("value", ["@after:AssignOp"]), before: " = " }] },
    UpdateStatement: { kind: "assign", label: "update", slots: [one("target", ["#0"]), one("op", ["UpdateOp"]), one("value", ["#2"])] },
    PassStatement: leaf("statement", "pass"),
    BreakStatement: leaf("statement", "break"),
    ContinueStatement: leaf("statement", "continue"),
    Comment: { ...leaf("comment", "comment"), topLevelOnly: true },
    ClassDefinition: { kind: "class", label: "class", describe: "class ${name}", keyword: "class", slots: [one("name", ["#0"]), list("bases", ["ArgList"]), one("body", ["Body"])] },
    LambdaExpression: { kind: "lambda", label: "lambda", keyword: "lambda", slots: [list("params", ["ParamList"]), one("body", "*" as never)] },
    MemberExpression: { kind: "member", label: "member", describe: "${property} of ${object}", slots: [one("object", ["#0"]), { ...one("property", ["PropertyName"]), before: "." }] },
    Index: { kind: "index", label: "index", slots: [one("object", ["#0"]), one("index", ["#1"])] },
    ReturnStatement: { kind: "return", label: "return", describe: "return ${value}", keyword: "return", slots: [one("value", ["#0"])] },
    FunctionDefinition: { kind: "function", label: "function", describe: "function ${name} with ${params.length|parameter|parameters}", keyword: "def", slots: [one("name", ["#0"]), list("params", ["ParamList"]), one("body", ["Body"])] },
    IfStatement: { kind: "if", label: "if", describe: "if ${test}", keyword: "if", slots: [one("test", ["#0"]), one("then", ["Body#0"]), list("rest", "*")] },
    WhileStatement: { kind: "while", label: "while", describe: "while ${test}", keyword: "while", slots: [one("test", ["#0"]), one("body", ["Body"])] },
    ForStatement: { kind: "for", label: "for-in loop", keyword: "for", slots: [list("var", ["@before:in"]), { ...one("iterable", ["@after:in"]), before: " in " }, one("body", ["Body"])] },
    TryStatement: { kind: "try", label: "try", keyword: "try", slots: [one("body", ["Body#0"]), list("rest", "*")] },
    RaiseStatement: { kind: "raise", label: "raise", keyword: "raise", slots: [list("value", "*")] },
    WithStatement: { kind: "with", label: "with", keyword: "with", slots: [list("items", "*"), one("body", ["Body"])] },
    DecoratedStatement: { kind: "decorated", label: "decorated definition", slots: [list("decorators", ["Decorator"]), { name: "definition", kind: "one", take: "*" }] },
    Decorator: { kind: "decorator", label: "decorator", keyword: "@", slots: [list("value", "*")] },
    Kw: leaf("keyword", "keyword"),
    AssertStatement: { kind: "assert", label: "assert", keyword: "assert", slots: [list("value", "*")] },
    DeleteStatement: { kind: "delete", label: "delete", keyword: "del", slots: [list("targets", "*")] },
    ScopeStatement: { kind: "scope", label: "scope declaration", keyword: "$first", slots: [list("names", "*")] },
    ContinuedString: { ...leaf("literal", "string"), dataType: "string" },
    DictionaryExpression: { kind: "dict", label: "dictionary", slots: [list("items", "*")] },
    TupleExpression: { kind: "tuple", label: "tuple", slots: [list("items", "*")] },
    ArrayComprehensionExpression: { kind: "comprehension", label: "list comprehension", slots: [list("parts", "*")] },
    ConditionalExpression: { kind: "conditional", label: "conditional", slots: [list("parts", "*")] },
    YieldStatement: { kind: "yield", label: "yield", keyword: "yield", slots: [list("value", "*")] },
    Body: { kind: "body", label: "body", slots: [list("body", "*")] },
    ExpressionStatement: { kind: "statement", label: "statement", slots: [one("expr", ["#0"])] },
    CallExpression: { kind: "call", label: "call", describe: "call to ${func} with ${args.length|argument|arguments}", slots: [one("func", ["#0"]), list("args", ["ArgList"])] },
    ArrayExpression: { kind: "array", label: "list", describe: "list of ${elements.length|item|items}", slots: [list("elements", "*")] },
  },
  blank: "...",
  separators: { args: ", ", elements: ", ", roots: "\n" },
  opaque: ["ImportStatement", "FormatString", "AwaitExpression"],
  rules: [
    {
      name: "kind",
      apply: (n: SyntaxNode) =>
        /^(and|or|in|is|not)$/.test(n.name) && /^(Binary|Unary)Expression$/.test(n.parent?.name ?? "") ? "KwOp"
        : /^(else|elif|except|finally|as)$/.test(n.name) || (n.name === "if" && n.parent?.name === "ConditionalExpression") ? "Kw"
        : n.name === "MemberExpression" && n.getChild("[") ? "Index"
        : undefined,
    },
    lineSeparator(),
  ],
  statementSlots: ["body", "roots"],
  templates: {
    variable: { text: "${name|x} = ${value}", kind: "assign", stmt: true },
    function: { text: "def ${name|func}(${param|x}):\n    ${body}", kind: "function", stmt: true },
    call: { text: "${func}(${arg})", kind: "call" },
    "if-else": { text: "if ${test}:\n    ${then}\nelse:\n    ${else}", kind: "if", stmt: true },
    while: { text: "while ${test}:\n    ${body}", kind: "while", stmt: true },
    for: { text: "for ${item|x} in ${items}:\n    ${body}", kind: "for", stmt: true },
    return: { text: "return ${value}", kind: "return", stmt: true },
    number: { text: "0", kind: "literal" },
    string: { text: '"text"', kind: "literal" },
    list: { text: "[${a}, ${b}]", kind: "array" },
  },
};
export { parser as pythonParser };
export const python = lezerLanguage(parser as never, pythonTable);
