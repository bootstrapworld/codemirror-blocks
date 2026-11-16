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
    BinaryExpression: { kind: "binary", label: "operation", describe: "${left} ${rest}", slots: [one("left", ["#0"]), list("rest", "*")] },
    UnaryExpression: { kind: "unary", label: "unary operation", slots: [one("op", ["LogicOp", "ArithOp", "KwOp"]), one("value", ["#1"])] },
    AssignmentExpression: { kind: "assign", label: "assignment", describe: "set ${target} to ${value}", slots: [one("target", ["#0"]), { ...one("value", ["#1"]), before: " = " }] },
    UpdateAssign: { kind: "assign", label: "update", slots: [one("target", ["#0"]), one("op", ["UpdateOp"]), one("value", ["#2"])] },
    VariableDeclaration: { kind: "declare", label: "declaration", describe: "declare ${name} as ${value}", keyword: "$first", slots: [one("name", ["#0"]), { ...one("value", ["#1"]), before: " = " }, { ...list("rest", "*"), before: ", " }] },
    FunctionDeclaration: { kind: "function", label: "function", describe: "function ${name} with ${params.length|parameter|parameters}", keyword: "function", modifiers: ["async"], slots: [one("name", ["#0"]), list("params", ["ParamList"]), one("body", ["Block"])] },
    ReturnStatement: { kind: "return", label: "return", describe: "return ${value}", keyword: "return", slots: [one("value", ["#0"])] },
    IfStatement: { kind: "if", label: "if", describe: "if ${test}", keyword: "if", slots: [one("test", ["ParenthesizedExpression"]), one("then", ["#1"]), { ...list("else", ["#2"]), before: " else " }] },
    WhileStatement: { kind: "while", label: "while", describe: "while ${test}", keyword: "while", slots: [one("test", ["ParenthesizedExpression"]), { name: "body", kind: "one", take: "*" }] },
    ForOf: { kind: "for", label: "for-of loop", keyword: "for", slots: [one("var", ["#0"]), { ...one("iterable", ["#1"]), before: " of " }, { name: "body", kind: "one", take: "*" }] },
    ForStatement: { kind: "for", label: "for loop", keyword: "for", slots: [list("parts", ["ForSpec"]), { name: "body", kind: "one", take: "*" }] },
    ClassDeclaration: { kind: "class", label: "class", describe: "class ${name}", keyword: "class", slots: [one("name", ["VariableDefinition"]), { ...list("base", "*"), before: " extends " }, one("body", ["ClassBody"])] },
    ClassBody: stmts("classbody", "class body"),
    MethodDeclaration: { kind: "method", label: "method", modifiers: ["async", "static", "get", "set"], slots: [one("name", ["#0"]), list("params", ["ParamList"]), one("body", ["Block"])] },
    LineComment: { ...leaf("comment", "comment"), topLevelOnly: true },
    BlockComment: { ...leaf("comment", "comment"), topLevelOnly: true },
    ThrowStatement: { kind: "throw", label: "throw", keyword: "throw", slots: [one("value", ["#0"])] },
    SwitchStatement: { kind: "switch", label: "switch", keyword: "switch", slots: [one("test", ["ParenthesizedExpression"]), one("body", ["SwitchBody"])] },
    SwitchBody: stmts("switchbody", "cases"),
    CaseLabel: { kind: "case", label: "case", keyword: "case", slots: [one("test", ["#0"])] },
    DefaultLabel: { ...leaf("case", "default"), leaf: true },
    ArrowFunction: { kind: "arrow", label: "arrow function", modifiers: ["async"], slots: [list("params", ["ParamList", "VariableDefinition"]), { name: "body", kind: "one", take: "*", before: " => " }] },
    FunctionExpression: { kind: "function", label: "function expression", keyword: "function", modifiers: ["async"], slots: [list("name", ["@before:ParamList"]), list("params", ["ParamList"]), one("body", ["Block"])] },
    ConditionalExpression: { kind: "conditional", label: "conditional", slots: [one("test", ["#0"]), { ...one("then", ["#2"]), before: " ? " }, { ...one("else", ["#4"]), before: " : " }] },
    NewExpression: { kind: "new", label: "new", keyword: "new", slots: [one("func", ["#0"]), list("args", ["ArgList"])] },
    AwaitExpression: { kind: "await", label: "await", keyword: "await", slots: [one("value", ["#0"])] },
    SequenceExpression: { kind: "sequence", label: "sequence", slots: [list("items", "*")] },
    ObjectPattern: { kind: "pattern", label: "object pattern", slots: [list("items", "*")] },
    ArrayPattern: { kind: "pattern", label: "array pattern", slots: [list("items", "*")] },
    PatternProperty: { kind: "property", label: "pattern property", slots: [one("key", ["#0"]), { ...list("value", ["#1"]), before: ": " }] },
    TryStatement: { kind: "try", label: "try", keyword: "try", slots: [one("body", ["Block#0"]), list("handlers", "*")] },
    CatchClause: { kind: "catch", label: "catch", keyword: "catch", slots: [list("param", ["VariableDefinition"]), one("body", ["Block"])] },
    FinallyClause: { kind: "finally", label: "finally", keyword: "finally", slots: [one("body", ["Block"])] },
    DoStatement: { kind: "do", label: "do-while", keyword: "do", slots: [one("body", ["Block"]), { ...one("test", ["ParenthesizedExpression"]), before: " while " }] },
    ForIn: { kind: "for", label: "for-in loop", keyword: "for", slots: [one("var", ["#0"]), { ...one("object", ["#1"]), before: " in " }, { name: "body", kind: "one", take: "*" }] },
    RegExp: { ...leaf("literal", "regular expression"), dataType: "string" },
    LabeledStatement: { kind: "labeled", label: "labeled statement", slots: [one("label", ["Label"]), { name: "body", kind: "one", take: "*", before: ": " }] },
    Label: leaf("literal", "label"),
    BreakStatement: leaf("jump", "break"),
    ContinueStatement: leaf("jump", "continue"),
    ClassExpression: { kind: "class", label: "class expression", keyword: "class", slots: [list("name", ["VariableDefinition"]), { ...list("base", "*"), before: " extends " }, one("body", ["ClassBody"])] },
    PropertyDeclaration: { kind: "field", label: "field", modifiers: ["static"], slots: [one("name", ["PropertyDefinition"]), { ...list("value", ["#1"]), before: " = " }] },
    KwOp: leaf("operator", "operator"),
    PrivatePropertyName: leaf("literal", "private property"),
    YieldExpression: { kind: "yield", label: "yield", keyword: "yield", slots: [list("value", "*")] },
    PostfixExpression: { kind: "postfix", label: "postfix operation", slots: [one("value", ["#0"]), one("op", ["ArithOp"])] },
    ExportDeclaration: { kind: "export", label: "export", keyword: "export", slots: [list("items", "*")] },
    ExportDefault: { kind: "export", label: "default export", keyword: "export default", slots: [list("items", "*")] },
    ExportFrom: { kind: "export", label: "re-export", keyword: "export", slots: [list("items", ["Star", "ExportGroup"]), { ...list("source", ["String"]), before: "from" }] },
    ImportDeclaration: { kind: "import", label: "import", describe: "import from ${source}", keyword: "import", slots: [list("names", ["@before:ImportGroup"]), list("star", ["Star"]), { ...list("alias", ["@after:as"]), before: "as" }, list("group", ["ImportGroup"]), { ...list("source", ["String"]), before: "from" }] },
    ImportBare: { kind: "import", label: "import", describe: "import ${source}", keyword: "import", slots: [list("source", ["String"])] },
    ImportGroup: { ...leaf("literal", "imported names"), dataType: "other" },
    ExportGroup: { ...leaf("literal", "exported names"), dataType: "other" },
    Star: { ...leaf("literal", "star"), dataType: "symbol" },
    Block: stmts("block", "block"),
    ExpressionStatement: { kind: "statement", label: "statement", slots: [one("expr", ["#0"])] },
    CallExpression: { kind: "call", label: "call", describe: "call to ${func} with ${args.length|argument|arguments}", slots: [one("func", ["#0"]), list("args", ["ArgList"])] },
    MemberExpression: { kind: "member", label: "member", describe: "${property} of ${object}", slots: [one("object", ["#0"]), { ...one("property", ["PropertyName", "PrivatePropertyName"]), before: "." }] },
    Index: { kind: "index", label: "index", slots: [one("object", ["#0"]), one("index", ["#1"])] },
    TemplateString: { kind: "template", label: "template string", describe: "template string with ${parts.length|part|parts}", slots: [{ name: "parts", kind: "list", take: "*", pieces: true }] },
    ArrayExpression: { kind: "array", label: "array", describe: "array of ${elements.length|item|items}", slots: [list("elements", "*")] },
    ObjectExpression: { kind: "object", label: "object", slots: [list("properties", "*")] },
    Property: { kind: "property", label: "property", slots: [one("key", ["#0"]), one("value", ["#1"])] },
  },
  opaque: ["Hashbang"],
  blank: "undefined",
  separators: { args: ", ", elements: ", ", properties: ", ", roots: "\n", parts: "; " },
  rules: [
    {
      name: "kind",
      apply: (n: SyntaxNode) =>
        n.name === "ForStatement" && n.getChild("ForOfSpec") ? "ForOf"
        : n.name === "ForStatement" && n.getChild("ForInSpec") ? "ForIn"
        : n.name === "AssignmentExpression" && n.getChild("UpdateOp") ? "UpdateAssign"
        : n.name === "MemberExpression" && n.getChild("[") ? "Index"
        : n.name === "ExportDeclaration" && n.getChild("from") ? "ExportFrom"
        : n.name === "ExportDeclaration" && n.getChild("default") ? "ExportDefault"
        : n.name === "ImportDeclaration" && !n.getChild("from") ? "ImportBare"
        : n.name === "Property" && n.getChild("ParamList") ? "MethodDeclaration"
        : /^(typeof|void|delete|instanceof|in)$/.test(n.name) && /^(Unary|Binary)Expression$/.test(n.parent?.name ?? "") ? "KwOp"
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
