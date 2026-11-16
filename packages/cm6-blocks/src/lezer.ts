/*
 * EXPERIMENT. ONE adapter from any Lezer parser to the block tree, driven by a
 * table (see doc/experiments/cm6-direct-tree.md, "Second idea"). Nothing here
 * knows a language. A Lezer node type that is in the table is a block; one that
 * is not is looked through (its children go to the parent's slots) unless it is
 * a leaf, which is punctuation or a keyword and is dropped (the table's
 * `keyword` says what is drawn at the head).
 */
import type { Parser, SyntaxNode, Tree } from "@lezer/common";
import { makeNode } from "./node";
import type { BNode, Language, Slot, TextChange } from "./types";

export interface BlockRow {
  kind: string; // BNode.kind
  label: string; // what it is called aloud
  /**
   * The children that are slots, in text order. `take` picks Lezer children by
   * type name (a block, or a type looked through on the way to it), by overall
   * position "#n" among the block children, by "Type#n" (the n-th child that
   * has that type on its way), or "*" (whatever no other slot took).
   */
  slots?: { name: string; kind: "one" | "list"; take: string[] | "*" }[];
  leaf?: boolean; // a value: its source text is its value
  dataType?: string;
  keyword?: string; // text drawn at its head
  brackets?: boolean; // read "()" or "[]" from its first character
}

export interface BlockTable {
  nodes: Record<string, BlockRow>;
  /** types drawn as their own text ("unknown" leaf) */
  opaque?: string[];
  /** text put where a node that has to be there (a "one" slot) is deleted; default "..." */
  blank?: string;
  /** how elements of a list are separated, by list-slot name or node kind */
  separators?: Record<string, string>;
  /**
   * The handful of rules. Names the adapter knows:
   *   "kind":      apply(node: SyntaxNode, text: string) => table key | undefined
   *   "separator": apply(slot: Slot, text: string) => string | undefined
   */
  rules?: { name: string; apply: (...args: any[]) => any }[]; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export type LezerLanguage = Language & {
  table: BlockTable;
  /**
   * Blocks for the top-level nodes of an already parsed `tree` of `text`.
   * `keep(from, to)` may hand back an existing node for a top-level Lezer node
   * with that range; it is used as is (and not read again).
   */
  fromTree(tree: Tree, text: string, keep?: (from: number, to: number, key: string) => BNode | null): BNode[];
};

interface Cand {
  node: SyntaxNode;
  key: string;
  path: string[];
}

/** the exact source of every node this adapter built (to print it again) */
const sources = new WeakMap<BNode, string>();
/** the source text a node was built from (undefined if this adapter did not build it) */
export const sourceOf = (n: BNode): string | undefined => sources.get(n);
/** the table key (or "@error" / "@opaque") a node was built from */
const keys = new WeakMap<BNode, string>();
export const keyOfNode = (n: BNode): string | undefined => keys.get(n);
/** nodes that are, or contain, a Lezer error node: their shape depends on the error recovery, which depends on the text around them */
const dirty = new WeakSet<BNode>();
export const hasError = (n: BNode): boolean => dirty.has(n);

export function lezerLanguage(parser: Parser, table: BlockTable): LezerLanguage {
  const rule = (name: string) => table.rules?.filter((r) => r.name === name) ?? [];
  const keyOf = (n: SyntaxNode, text: string): string => {
    for (const r of rule("kind")) {
      const k = r.apply(n, text);
      if (k) return k;
    }
    return n.name;
  };

  function collect(n: SyntaxNode, path: string[], out: Cand[], text: string): void {
    for (let c = n.firstChild; c; c = c.nextSibling) {
      if (c.type.isError) {
        out.push({ node: c, key: "@error", path });
        continue;
      }
      const key = keyOf(c, text);
      if (table.nodes[key]) out.push({ node: c, key, path: [...path, c.name, key] });
      else if (c.firstChild) collect(c, [...path, c.name], out, text);
      else if (table.opaque?.includes(c.name)) out.push({ node: c, key: "@opaque", path });
    }
  }

  function leaf(kind: string, c: SyntaxNode, text: string, offset: number, extra: Partial<BNode> = {}): BNode {
    const src = text.slice(c.from, c.to);
    const b = makeNode(kind, [], { from: c.from + offset, to: c.to + offset, value: src.trim(), ...extra });
    sources.set(b, src);
    return b;
  }

  function build(c: Cand, text: string, offset: number): BNode {
    const b = build1(c, text, offset);
    keys.set(b, c.key);
    if (b.kind === "error" || b.slots.some((s) => s.nodes.some((k) => dirty.has(k)))) dirty.add(b);
    return b;
  }
  function build1(c: Cand, text: string, offset: number): BNode {
    if (c.key === "@error") return leaf("error", c.node, text, offset);
    if (c.key === "@opaque") return leaf("unknown", c.node, text, offset);
    const row = table.nodes[c.key];
    const n = c.node;
    if (row.leaf) return leaf(row.kind, n, text, offset, row.dataType ? { dataType: row.dataType } : {});
    const extra: Partial<BNode> = { from: n.from + offset, to: n.to + offset };
    if (row.keyword) {
      extra.keyword = row.keyword;
      const at = text.indexOf(row.keyword, n.from);
      extra.keywordTo = (at >= 0 ? at + row.keyword.length : n.from) + offset;
    }
    if (row.brackets) extra.brackets = text[n.from] === "[" ? "[]" : "()";
    const b = makeNode(row.kind, (row.slots ?? []).map((s) => [s.name, s.kind]), extra);
    sources.set(b, text.slice(n.from, n.to));
    const cands: Cand[] = [];
    collect(n, [], cands, text);
    const seen: Record<string, number> = {};
    const taken: [Cand, number][] = cands.map((cd, i) => {
      const slotIx = pick(row, cd, i, seen);
      return [cd, slotIx];
    });
    taken.forEach(([cd, si]) => {
      if (si < 0) return;
      const slot = b.slots[si];
      if (slot.kind === "one" && slot.nodes.length) return; // a second one: left out
      const child = build(cd, text, offset);
      child.parent = b;
      child.slot = slot;
      slot.nodes.push(child);
    });
    b.slots.forEach((s) => {
      if (s.kind === "one" && !s.nodes.length) {
        const blank = makeNode("blank", [], { value: "...", from: b.to, to: b.to });
        blank.parent = b;
        blank.slot = s;
        s.nodes.push(blank);
      }
    });
    return b;
  }

  /** index of the slot taking candidate `cd` (the i-th), or -1 */
  function pick(row: BlockRow, cd: Cand, i: number, seen: Record<string, number>): number {
    const slots = row.slots ?? [];
    const occ: Record<string, number> = {};
    for (const p of new Set(cd.path)) occ[p] = seen[p] = (seen[p] ?? -1) + 1;
    let star = -1;
    for (let s = 0; s < slots.length; s++) {
      const take = slots[s].take;
      if (take === "*") {
        star = s;
        continue;
      }
      for (const t of take) {
        const [ty, nth] = t.split("#");
        if (nth === undefined ? cd.path.includes(ty) : ty === "" ? i === +nth : occ[ty] === +nth) return s;
      }
    }
    return star;
  }

  const lang: LezerLanguage = {
    table,
    parse(text, offset = 0) {
      const top = parser.parse(text).topNode;
      const out: Cand[] = [];
      collect(top, [], out, text);
      return out.map((c) => build(c, text, offset));
    },
    fromTree(tree, text, keep) {
      const out: Cand[] = [];
      collect(tree.topNode, [], out, text);
      return out.map((c) => keep?.(c.node.from, c.node.to, c.key) ?? build(c, text, 0));
    },
    print(node) {
      const s = sources.get(node);
      if (s !== undefined) return s;
      if (node.value !== undefined) return node.value;
      throw new Error("print of a node that was never parsed needs a template (not in the table)");
    },
    blank: () => makeNode("blank", [], { value: "..." }),
    describe(node) {
      const row = Object.values(table.nodes).find((r) => r.kind === node.kind);
      const label = row?.label ?? node.kind;
      if (node.slots.length === 0) return node.value ? `${label} ${node.value}` : label;
      return `${label} with ${node.slots.map((s) => `${s.nodes.length} ${s.name}`).join(", ")}`;
    },
  };
  return lang;
}

/* ---------------------------------------------------------------- writing */

function separatorFor(table: BlockTable, text: string, slot: Slot): string {
  for (const r of table.rules ?? []) {
    if (r.name !== "separator") continue;
    const s = r.apply(slot, text);
    if (s !== undefined) return s;
  }
  return table.separators?.[slot.name] ?? table.separators?.[slot.owner.kind] ?? " ";
}

/** The text change that inserts `snippet` at `index` of a non-empty list slot (positions of the text it was parsed from). */
export function insertChange(table: BlockTable, text: string, slot: Slot, index: number, snippet: string): TextChange {
  const sep = separatorFor(table, text, slot);
  const ns = slot.nodes;
  if (!ns.length) throw new Error("insert into an empty list: where it goes needs a rule per language");
  if (index >= ns.length) return { from: ns[ns.length - 1].to, to: ns[ns.length - 1].to, insert: sep + snippet };
  return { from: ns[index].from, to: ns[index].from, insert: snippet + sep };
}

/** The text change that removes a list element and one separator. */
export function removeChange(node: BNode): TextChange {
  const ns = node.slot!.nodes;
  const i = ns.indexOf(node);
  if (i + 1 < ns.length) return { from: node.from, to: ns[i + 1].from, insert: "" };
  if (i > 0) return { from: ns[i - 1].to, to: node.to, insert: "" };
  return { from: node.from, to: node.to, insert: "" };
}
