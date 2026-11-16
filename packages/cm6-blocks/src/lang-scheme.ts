// EXPERIMENT: Scheme blocks from the Lezer grammar `cm6-lezer-scheme-common-lang`.
import { parser } from "cm6-lezer-scheme-common-lang";
import { lezerLanguage, BlockRow, BlockTable } from "./lezer";

const atom = (dataType: string): BlockRow => ({ kind: "literal", label: dataType, leaf: true, dataType });
const HEADS: Record<string, [number, string]> = { define: [3, "DefineForm"], lambda: [3, "LambdaForm"], if: [4, "IfForm"], cond: [0, "CondForm"] };

export const schemeTable: BlockTable = {
  nodes: {
    Symbol: atom("symbol"), Define: atom("symbol"), CatchHead: atom("symbol"), Number: atom("number"),
    String: atom("string"), Boolean: atom("boolean"), Char: atom("char"),
    ParenList: { kind: "call", label: "call", brackets: true, slots: [{ name: "func", kind: "one", take: ["#0"] }, { name: "args", kind: "list", take: "*" }] },
    DefineForm: { kind: "define", label: "definition", keyword: "define", brackets: true, slots: [{ name: "name", kind: "one", take: ["#1"] }, { name: "value", kind: "one", take: ["#2"] }] },
    LambdaForm: { kind: "lambda", label: "function", keyword: "lambda", brackets: true, slots: [{ name: "params", kind: "one", take: ["#1"] }, { name: "body", kind: "one", take: ["#2"] }] },
    IfForm: { kind: "if", label: "if", keyword: "if", brackets: true, slots: [{ name: "test", kind: "one", take: ["#1"] }, { name: "then", kind: "one", take: ["#2"] }, { name: "else", kind: "one", take: ["#3"] }] },
    CondForm: { kind: "cond", label: "cond", keyword: "cond", brackets: true, slots: [{ name: "clauses", kind: "list", take: ["ClauseForm"] }] },
    ClauseForm: { kind: "clause", label: "clause", brackets: true, slots: [{ name: "test", kind: "one", take: ["#0"] }, { name: "body", kind: "list", take: "*" }] },
  },
  separators: { roots: "\n" },
  rules: [{
    name: "kind",
    // "a list whose first element is the symbol define is a definition", checked for the arity wescheme demands
    apply(n: import("@lezer/common").SyntaxNode, text: string) {
      if (n.name !== "ParenList" && n.name !== "BracketList") return undefined;
      const items = (l: import("@lezer/common").SyntaxNode) => { const c = l.getChild("ListContent"); return c ? c.getChildren("Datum") : []; };
      const ds = items(n);
      const head = ds[0] && !ds[0].getChild("List") ? text.slice(ds[0].from, ds[0].to) : "";
      const h = HEADS[head];
      if (h && (h[0] === 0 || h[0] === ds.length)) return h[1];
      // a clause: a bracketed or parenthesised list directly inside a cond
      const up = n.parent?.parent?.parent?.parent; // List > Datum > ListContent > ParenList
      if (up && n.parent?.name === "List" && n.parent.parent?.name === "Datum") {
        const outer = items(up);
        if (outer[0] && text.slice(outer[0].from, outer[0].to) === "cond" && outer.slice(1).every((d) => d.getChild("List"))) return ds.length ? "ClauseForm" : undefined;
      }
      return head && h ? "ParenList" : undefined;
    },
  }],
};
export { parser as schemeParser };
export const scheme = lezerLanguage(parser as never, schemeTable);
