/*
 * The WeScheme language for the experiment: text -> BNode (with the vendored
 * reader's lexer, which is plain JS and does not touch React), BNode -> one
 * line of text, and a few words for a screenreader.
 *
 * The lexer's locations: `location.startChar` is a 0-based offset in the string
 * and `location.span` its length in characters (tabs and newlines count as one;
 * lines and columns are not needed). A list's location covers its brackets, an
 * atom's its own text, a string's its quotes. A quote mark (' ` , ,@) gives a
 * two-element array [mark, form] whose location starts at the mark; the mark's
 * own location is the mark's characters. Comments are not in the result (the
 * second thing `lexWithComments` returns lists them; we do not need it).
 */
import { lexWithComments } from "../../wescheme/src/reader/lex";
import { symbolExpr, literal } from "../../wescheme/src/reader/structures";
import { BNode, Language, ParseError, Slot } from "./types";

import { nextId, makeNode } from "./node";
export { nextId, makeNode };

function slotOf(node: BNode, name: string): Slot {
  return node.slots.find((s) => s.name === name) as Slot;
}

function put(node: BNode, slotName: string, child: BNode): void {
  const slot = slotOf(node, slotName);
  child.parent = node;
  child.slot = slot;
  slot.nodes.push(child);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Sexp = any;

function isList(s: Sexp): boolean {
  return Array.isArray(s);
}

function lexMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  const raw = String(e);
  try {
    const parts: string[] = [];
    const walk = (x: unknown) => {
      if (typeof x === "string") parts.push(x);
      else if (Array.isArray(x)) x.forEach(walk);
    };
    const obj = JSON.parse(raw);
    walk(obj["dom-message"]);
    const text = parts
      .filter(
        (p) => p !== "span" && p !== "class" && p !== "Error" && p !== "Message"
      )
      .join("");
    if (text) return text;
  } catch {
    /* not JSON: fall through */
  }
  return raw.length > 200 ? raw.slice(0, 200) + "..." : raw;
}

function parseText(text: string, offset: number): BNode[] {
  let sexps: Sexp[];
  try {
    sexps = lexWithComments(text).sexps as Sexp[];
  } catch (e) {
    throw new ParseError(lexMessage(e));
  }
  return sexps.map((s) => convert(s, text, offset));
}

function opaque(src: string, from: number): BNode {
  return makeNode("unknown", [], { value: src, from, to: from + src.length });
}

function dataTypeOf(src: string, val: unknown): string {
  if (src.startsWith('"')) return "string";
  if (src.startsWith("#\\")) return "char";
  if (/^#(t|f|true|false)$/i.test(src) || typeof val === "boolean")
    return "boolean";
  return "number";
}

const OPEN = /^[(\[]/;

function convert(s: Sexp, text: string, offset: number): BNode {
  const loc = s.location;
  const start: number = loc.startChar;
  const src = text.slice(start, start + loc.span);
  const from = start + offset;
  const to = from + src.length;

  if (!isList(s)) {
    if (s instanceof symbolExpr || s instanceof literal) {
      if (src === "...") {
        return makeNode("blank", [], { value: src, from, to });
      }
      // a vector (#(1 2), #3(1 2)) is a literal to the lexer, but not one of ours
      if (s instanceof literal && /^#\d*[(\[{]/.test(src)) {
        return opaque(src, from);
      }
      const dataType =
        s instanceof symbolExpr
          ? "symbol"
          : dataTypeOf(src, (s as Sexp).val?.val ?? (s as Sexp).val);
      return makeNode("literal", [], { value: src, dataType, from, to });
    }
    // keywords (#:x), hash tables, structs...: what the lexer calls unsupported
    return opaque(src, from);
  }

  // a quote form ('x `x ,x ,@x), a box (&x), or { }: written without our brackets
  if (!OPEN.test(src)) {
    return opaque(src, from);
  }
  const brackets: "()" | "[]" = src[0] === "(" ? "()" : "[]";
  const n: number = s.length;

  if (n === 0) {
    return makeNode("unknown", [["elts", "list"]], {
      from,
      to,
      brackets,
    });
  }

  const head: Sexp = s[0];
  const hloc: { startChar: number; span: number } = head.location;
  const headText: string | null =
    !isList(head) && head instanceof symbolExpr
      ? text.slice(hloc.startChar, hloc.startChar + hloc.span)
      : null;
  const headTo =
    headText === null ? 0 : hloc.startChar + headText.length + offset;
  const conv = (x: Sexp) => convert(x, text, offset);
  const keyworded = (kind: string, slots: [string, "one" | "list"][]): BNode =>
    makeNode(kind, slots, {
      from,
      to,
      brackets,
      keyword: headText as string,
      keywordTo: headTo,
    });

  if (headText === "define" && n === 3) {
    const node = keyworded("define", [
      ["name", "one"],
      ["value", "one"],
    ]);
    put(node, "name", conv(s[1]));
    put(node, "value", conv(s[2]));
    return node;
  }
  if (headText === "lambda" && n === 3) {
    const node = keyworded("lambda", [
      ["params", "one"],
      ["body", "one"],
    ]);
    put(node, "params", conv(s[1]));
    put(node, "body", conv(s[2]));
    return node;
  }
  if (headText === "if" && n === 4) {
    const node = keyworded("if", [
      ["test", "one"],
      ["then", "one"],
      ["else", "one"],
    ]);
    put(node, "test", conv(s[1]));
    put(node, "then", conv(s[2]));
    put(node, "else", conv(s[3]));
    return node;
  }
  if (headText === "cond") {
    const clausesOk = s
      .slice(1)
      .every(
        (c: Sexp) =>
          isList(c) &&
          c.length >= 1 &&
          OPEN.test(text.charAt(c.location.startChar))
      );
    if (clausesOk) {
      const node = keyworded("cond", [["clauses", "list"]]);
      for (const c of s.slice(1)) {
        const cstart: number = c.location.startChar;
        const clause = makeNode(
          "clause",
          [
            ["test", "one"],
            ["body", "list"],
          ],
          {
            from: cstart + offset,
            to: cstart + c.location.span + offset,
            brackets: text[cstart] === "(" ? "()" : "[]",
          }
        );
        put(clause, "test", conv(c[0]));
        for (const b of c.slice(1)) put(clause, "body", conv(b));
        put(node, "clauses", clause);
      }
      return node;
    }
  }
  const isSpecial =
    headText === "define" ||
    headText === "lambda" ||
    headText === "if" ||
    headText === "cond";
  if (isSpecial) {
    // a special form of the wrong shape: a list of whatever its parts are
    const node = makeNode("unknown", [["elts", "list"]], {
      from,
      to,
      brackets,
    });
    for (const x of s) put(node, "elts", conv(x));
    return node;
  }
  const node = makeNode(
    "call",
    [
      ["func", "one"],
      ["args", "list"],
    ],
    { from, to, brackets }
  );
  put(node, "func", conv(head));
  for (const x of s.slice(1)) put(node, "args", conv(x));
  return node;
}

function print(node: BNode): string {
  if (node.kind === "program") {
    return node.slots[0].nodes.map(print).join("\n");
  }
  if (node.slots.length === 0) return node.value ?? "";
  const parts: string[] = [];
  if (node.keyword !== undefined) parts.push(node.keyword);
  for (const slot of node.slots) {
    for (const child of slot.nodes) parts.push(print(child));
  }
  const b = node.brackets ?? "()";
  return b[0] + parts.join(" ") + b[1];
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function describe(node: BNode): string {
  const one = (name: string): BNode | undefined =>
    node.slots.find((s) => s.name === name)?.nodes[0];
  const d = (n: BNode | undefined) => (n ? describe(n) : "nothing");
  switch (node.kind) {
    case "literal":
      return node.value ?? "";
    case "blank":
      return "blank";
    case "call": {
      const args = node.slots.find((s) => s.name === "args")?.nodes.length ?? 0;
      return `call of ${d(one("func"))} with ${plural(args, "argument")}`;
    }
    case "define":
      return `definition of ${d(one("name"))}`;
    case "lambda":
      return `function of ${d(one("params"))}`;
    case "if":
      return `if ${d(one("test"))}`;
    case "cond": {
      const n = node.slots[0].nodes.length;
      return `cond with ${plural(n, "clause")}`;
    }
    case "clause":
      return `clause for ${d(one("test"))}`;
    case "program":
      return "program";
    default:
      if (node.slots.length === 0) return node.value ?? "unknown";
      return `list of ${plural(node.slots[0].nodes.length, "element")}`;
  }
}

export const wescheme: Language = {
  parse: (text: string, offset = 0) => parseText(text, offset),
  print,
  parseAs(kind, text, offset) {
    if (kind !== "clause") return null;
    // a clause is only a clause inside a cond
    const wrap = "(cond ";
    const [cond] = parseText(wrap + text + ")", offset - wrap.length);
    if (!cond || cond.kind !== "cond") return null;
    const clauses = cond.slots[0].nodes;
    return clauses.length === 1 ? clauses[0] : null;
  },
  blank: () => makeNode("blank", [], { value: "..." }),
  describe,
};
