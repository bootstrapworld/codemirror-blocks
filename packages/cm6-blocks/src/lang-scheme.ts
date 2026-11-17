// EXPERIMENT: Scheme blocks from the Lezer grammar `cm6-lezer-scheme-common-lang`.
import { parser } from "cm6-lezer-scheme-common-lang";
import { lezerLanguage, BlockRow, BlockTable } from "./lezer";

const atom = (dataType: string): BlockRow => ({
  kind: "literal",
  label: dataType,
  leaf: true,
  dataType,
});
const HEADS: Record<string, [number, string]> = {
  define: [3, "DefineForm"],
  lambda: [3, "LambdaForm"],
  if: [4, "IfForm"],
  cond: [0, "CondForm"],
};

type SN = import("@lezer/common").SyntaxNode;
/** a Datum that is one symbol */
const isSym = (d: SN): boolean => !!d.getChild("AtomLike")?.getChild("Symbol");
/** the parenthesised or bracketed list of a Datum, if it holds at least one thing and only symbols (the head of a function definition) */
const headerOf = (d: SN): SN | null => {
  const l = d.getChild("List");
  const h = l && (l.getChild("ParenList") ?? l.getChild("BracketList"));
  const c = h?.getChild("ListContent");
  const its = c ? c.getChildren("Datum") : [];
  return h && its.length > 0 && its.every(isSym) ? h : null;
};

export const schemeTable: BlockTable = {
  lang: "scheme",
  nodes: {
    Blank: { kind: "blank", label: "blank", leaf: true },
    Symbol: atom("symbol"),
    Define: atom("symbol"),
    CatchHead: atom("symbol"),
    Number: atom("number"),
    String: atom("string"),
    Boolean: atom("boolean"),
    Char: atom("char"),
    QuoteForm: {
      kind: "quote",
      label: "quote",
      keyword: "'",
      slots: [{ name: "datum", kind: "one", take: ["#0"] }],
    },
    QuasiquoteForm: {
      kind: "quote",
      label: "quasiquote",
      keyword: "`",
      slots: [{ name: "datum", kind: "one", take: ["#0"] }],
    },
    UnquoteForm: {
      kind: "quote",
      label: "unquote",
      keyword: ",",
      slots: [{ name: "datum", kind: "one", take: ["#0"] }],
    },
    Vector: {
      kind: "vector",
      label: "vector",
      keyword: "#",
      slots: [{ name: "elements", kind: "list", take: "*" }],
    },
    LineComment: {
      kind: "comment",
      label: "comment",
      leaf: true,
      topLevelOnly: true,
    },
    BlockComment: {
      kind: "comment",
      label: "comment",
      leaf: true,
      topLevelOnly: true,
    },
    ParenList: {
      kind: "call",
      label: "call",
      describe: "call to ${func} with ${args.length|argument|arguments}",
      brackets: true,
      slots: [
        { name: "func", kind: "one", take: ["#0"] },
        { name: "args", kind: "list", take: "*" },
      ],
    },
    TaggedParenList: {
      kind: "call",
      label: "call",
      describe: "call to ${func} with ${args.length|argument|arguments}",
      brackets: true,
      slots: [
        { name: "func", kind: "one", take: ["#0"] },
        { name: "args", kind: "list", take: "*" },
      ],
    },
    BracketList: {
      kind: "call",
      label: "call",
      describe: "call to ${func} with ${args.length|argument|arguments}",
      brackets: true,
      slots: [
        { name: "func", kind: "one", take: ["#0"] },
        { name: "args", kind: "list", take: "*" },
      ],
    },
    // `(define x 5)`: the old editor's VariableDefinition (name, value)
    DefineForm: {
      kind: "define",
      label: "value definition",
      describe: "${name}: value definition",
      keyword: "define",
      brackets: true,
      slots: [
        { name: "name", kind: "one", take: ["#1"] },
        { name: "value", kind: "one", take: ["#2"] },
      ],
    },
    // `(define (f a b) body)`: the old editor's FunctionDefinition (name, params, body); the header `(f a b)` is not a block (DefineHeader splits it)
    DefineFunctionForm: {
      kind: "define",
      label: "function definition",
      describe: "${name}: function definition with ${params.describe}",
      keyword: "define",
      brackets: true,
      slots: [
        { name: "name", kind: "one", take: ["SplitHead"] },
        { name: "params", kind: "one", take: ["SplitRest"] },
        { name: "body", kind: "one", take: ["#3"] },
      ],
    },
    DefineHeader: {
      kind: "header",
      label: "header",
      split: { rest: "DefineParams" },
    },
    // the old IdentifierList: its place in the text is from the first parameter to the last (no brackets of its own: they hold the name too)
    DefineParams: {
      kind: "params",
      label: "arguments",
      describe: "${items.length|argument|arguments}: ${items.and}",
      openList: true,
      slots: [{ name: "items", kind: "list", take: "*" }],
    },
    LambdaForm: {
      kind: "lambda",
      label: "function",
      describe: "function of ${params} returning ${body}",
      keyword: "lambda",
      brackets: true,
      slots: [
        { name: "params", kind: "one", take: ["#1"] },
        { name: "body", kind: "one", take: ["#2"] },
      ],
    },
    IfForm: {
      kind: "if",
      label: "if",
      describe: "if ${test}, then ${then}, else ${else}",
      keyword: "if",
      brackets: true,
      slots: [
        { name: "test", kind: "one", take: ["#1"] },
        { name: "then", kind: "one", take: ["#2"] },
        { name: "else", kind: "one", take: ["#3"] },
      ],
    },
    CondForm: {
      kind: "cond",
      label: "cond",
      describe: "cond with ${clauses.length|clause|clauses}",
      keyword: "cond",
      brackets: true,
      slots: [{ name: "clauses", kind: "list", take: ["ClauseForm"] }],
    },
    ClauseForm: {
      kind: "clause",
      label: "clause",
      describe: "clause when ${test}",
      brackets: true,
      slots: [
        { name: "test", kind: "one", take: ["#0"] },
        { name: "body", kind: "list", take: "*" },
      ],
    },
  },
  blank: "...",
  lineComment: ";",
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
  rules: [
    {
      name: "kind",
      // "a list whose first element is the symbol define is a definition", checked for the arity wescheme demands
      apply(n: import("@lezer/common").SyntaxNode, text: string) {
        if (n.name === "Symbol" && text.slice(n.from, n.to) === "...")
          return "Blank"; // the placeholder of the exercises: a blank
        if (n.name !== "ParenList" && n.name !== "BracketList")
          return undefined;
        const items = (l: import("@lezer/common").SyntaxNode) => {
          const c = l.getChild("ListContent");
          return c ? c.getChildren("Datum") : [];
        };
        // the head first (one child), the rest only when it is define/lambda/if/cond
        const first = n.getChild("ListContent")?.getChild("Datum");
        const head =
          first && !first.getChild("List")
            ? text.slice(first.from, first.to)
            : "";
        const h = HEADS[head];
        const ds = h ? items(n) : [];
        // define: `(define x 5)` is a value definition, `(define (f a b) body)` a function definition (the header holds only symbols, and at
        // least the name); any other shape, and the wrong arity, is a call to `define`, as the old editor's parser refuses them
        if (head === "define" && ds.length === 3)
          return isSym(ds[1])
            ? "DefineForm"
            : headerOf(ds[1])
              ? "DefineFunctionForm"
              : "ParenList";
        // the header of a function definition: not a block, split into the name and the parameters
        if (
          n.parent?.name === "List" &&
          n.parent.parent?.name === "Datum" &&
          n.parent.parent.parent?.name === "ListContent"
        ) {
          const outer = n.parent.parent.parent.parent;
          if (
            outer &&
            (outer.name === "ParenList" || outer.name === "BracketList")
          ) {
            const os = items(outer);
            if (
              os.length === 3 &&
              text.slice(os[0].from, os[0].to) === "define" &&
              os[1].from === n.parent.parent.from &&
              headerOf(os[1])
            )
              return "DefineHeader";
          }
        }
        if (h && (h[0] === 0 || h[0] === ds.length)) return h[1];
        // a clause: a bracketed or parenthesised list directly inside a cond
        const up = n.parent?.parent?.parent?.parent; // List > Datum > ListContent > ParenList
        if (
          up &&
          (up.name === "ParenList" || up.name === "BracketList") &&
          n.parent?.name === "List" &&
          n.parent.parent?.name === "Datum"
        ) {
          const outer = items(up);
          if (
            outer[0] &&
            text.slice(outer[0].from, outer[0].to) === "cond" &&
            outer.slice(1).every((d) => d.getChild("List"))
          )
            return first ? "ClauseForm" : undefined;
        }
        return head && h ? "ParenList" : undefined;
      },
    },
  ],
};
export { parser as schemeParser };
export const scheme = lezerLanguage(parser as never, schemeTable);
