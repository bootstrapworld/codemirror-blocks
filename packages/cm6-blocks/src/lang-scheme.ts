// EXPERIMENT: Scheme blocks from the Lezer grammar `cm6-lezer-scheme-common-lang`.
import { parser } from "cm6-lezer-scheme-common-lang";
import { lezerLanguage, BlockRow, BlockTable } from "./lezer";

const atom = (dataType: string): BlockRow => ({ kind: "literal", label: dataType, leaf: true, dataType });
const HEADS: Record<string, [number, string]> = { define: [3, "DefineForm"], lambda: [3, "LambdaForm"], if: [4, "IfForm"], cond: [0, "CondForm"] };

export const schemeTable: BlockTable = {
  nodes: {
    Symbol: atom("symbol"), Define: atom("symbol"), CatchHead: atom("symbol"), Number: atom("number"),
    String: atom("string"), Boolean: atom("boolean"), Char: atom("char"),
    QuoteForm: { kind: "quote", label: "quote", keyword: "\'", slots: [{ name: "datum", kind: "one", take: ["#0"] }] },
    QuasiquoteForm: { kind: "quote", label: "quasiquote", keyword: "`", slots: [{ name: "datum", kind: "one", take: ["#0"] }] },
    UnquoteForm: { kind: "quote", label: "unquote", keyword: ",", slots: [{ name: "datum", kind: "one", take: ["#0"] }] },
    Vector: { kind: "vector", label: "vector", keyword: "#", slots: [{ name: "elements", kind: "list", take: "*" }] },
    LineComment: { kind: "comment", label: "comment", leaf: true, topLevelOnly: true },
    BlockComment: { kind: "comment", label: "comment", leaf: true, topLevelOnly: true },
    ParenList: { kind: "call", label: "call", describe: "call to ${func} with ${args.length|argument|arguments}", brackets: true, slots: [{ name: "func", kind: "one", take: ["#0"] }, { name: "args", kind: "list", take: "*" }] },
    DefineForm: { kind: "define", label: "definition", describe: "definition of ${name} as ${value}", keyword: "define", brackets: true, slots: [{ name: "name", kind: "one", take: ["#1"] }, { name: "value", kind: "one", take: ["#2"] }] },
    LambdaForm: { kind: "lambda", label: "function", describe: "function of ${params} returning ${body}", keyword: "lambda", brackets: true, slots: [{ name: "params", kind: "one", take: ["#1"] }, { name: "body", kind: "one", take: ["#2"] }] },
    IfForm: { kind: "if", label: "if", describe: "if ${test}, then ${then}, else ${else}", keyword: "if", brackets: true, slots: [{ name: "test", kind: "one", take: ["#1"] }, { name: "then", kind: "one", take: ["#2"] }, { name: "else", kind: "one", take: ["#3"] }] },
    CondForm: { kind: "cond", label: "cond", describe: "cond with ${clauses.length|clause|clauses}", keyword: "cond", brackets: true, slots: [{ name: "clauses", kind: "list", take: ["ClauseForm"] }] },
    ClauseForm: { kind: "clause", label: "clause", describe: "clause when ${test}", brackets: true, slots: [{ name: "test", kind: "one", take: ["#0"] }, { name: "body", kind: "list", take: "*" }] },
  },
  blank: "...",
  separators: { roots: "\n" },
  templates: {
    variable: { text: "(define ${name} ${value})", kind: "define" },
    function: { text: "(define (${name} ${param}) ${body})", kind: "define" },
    lambda: { text: "(lambda (${param}) ${body})", kind: "lambda" },
    call: { text: "(${func} ${arg})", kind: "call" },
    "if-else": { text: "(if ${test} ${then} ${else})", kind: "if" },
    cond: { text: "(cond [${test} ${result}] [else ${result}])", kind: "cond" },
    number: { text: "0", kind: "literal" },
    string: { text: '"text"', kind: "literal" },
    boolean: { text: "#t", kind: "literal" },
    char: { text: "#\\a", kind: "literal" },
    symbol: { text: "x", kind: "literal" },
  },
  rules: [{
    name: "kind",
    // "a list whose first element is the symbol define is a definition", checked for the arity wescheme demands
    apply(n: import("@lezer/common").SyntaxNode, text: string) {
      if (n.name !== "ParenList" && n.name !== "BracketList") return undefined;
      const items = (l: import("@lezer/common").SyntaxNode) => { const c = l.getChild("ListContent"); return c ? c.getChildren("Datum") : []; };
      // the head first (one child), the rest only when it is define/lambda/if/cond
      const first = n.getChild("ListContent")?.getChild("Datum");
      const head = first && !first.getChild("List") ? text.slice(first.from, first.to) : "";
      const h = HEADS[head];
      const ds = h ? items(n) : [];
      if (h && (h[0] === 0 || h[0] === ds.length)) return h[1];
      // a clause: a bracketed or parenthesised list directly inside a cond
      const up = n.parent?.parent?.parent?.parent; // List > Datum > ListContent > ParenList
      if (up && (up.name === "ParenList" || up.name === "BracketList") && n.parent?.name === "List" && n.parent.parent?.name === "Datum") {
        const outer = items(up);
        if (outer[0] && text.slice(outer[0].from, outer[0].to) === "cond" && outer.slice(1).every((d) => d.getChild("List"))) return first ? "ClauseForm" : undefined;
      }
      return head && h ? "ParenList" : undefined;
    },
  }],
};
export { parser as schemeParser };
export const scheme = lezerLanguage(parser as never, schemeTable);
