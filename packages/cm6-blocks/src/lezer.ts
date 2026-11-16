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
  /** what a screenreader says, with `${slot}` (its content), `${slot.length}`, `${slot.length|one|many}`, `${value}`; default: the label and counts */
  describe?: string;
  /**
   * The children that are slots, in text order. `take` picks Lezer children by
   * type name (a block, or a type looked through on the way to it), by overall
   * position "#n" among the block children, by "Type#n" (the n-th child that
   * has that type on its way), or "*" (whatever no other slot took).
   */
  slots?: { name: string; kind: "one" | "list"; take: string[] | "*"; /** text put before a node written into this slot when it was missing (`" = "`) */ before?: string }[];
  leaf?: boolean; // a value: its source text is its value
  /** only a block when it is a direct child of the tree's top (comments: not inside other blocks) */
  topLevelOnly?: boolean;
  dataType?: string;
  keyword?: string; // text drawn at its head
  /** bare tokens of the Lezer node that are drawn as modifier words before the keyword (`async`, `static`, `get`) */
  modifiers?: string[];
  brackets?: boolean; // read "()" or "[]" from its first character
  /**
   * Some of the node's blocks make groups, that go into list slot `slot` as nodes of table row `row`:
   *  - `tokens`: each bare token (`elif`, `else`, `except`) starts a group (its keyword is the token) of the
   *    blocks after it, up to the next token;
   *  - `sep`: groups of the blocks between bare `sep` tokens (the `,` of a dict: key and value).
   * Blocks before the first token go to the node's own slots as usual.
   */
  groups?: { slot: string; row: string; tokens?: string[]; sep?: string };
}

export interface BlockTable {
  nodes: Record<string, BlockRow>;
  /** types drawn as their own text ("unknown" leaf) */
  opaque?: string[];
  /**
   * Blocks that can be WRITTEN without having been parsed: name -> source text with holes
   * `${name}` (each hole becomes `blank`). `kind` is the kind of the block it makes (checked by
   * the tests); `stmt` marks a template that is a statement (it goes into a statement list).
   */
  templates?: Record<string, { text: string; kind: string; stmt?: boolean }>;
  /** names of the list slots that hold statements (none given: every list slot takes every template) */
  statementSlots?: string[];
  /** put after an expression written where a statement goes (`;` in JavaScript) */
  statementSuffix?: string;
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
  fromTree(
    tree: Tree,
    text: string,
    keep?: (from: number, to: number, key: string) => BNode | null,
    /**
     * Called for a top-level node that `keep` did not take, before it is built; with `inner` also given, `inner` may then
     * hand back an old node for a block INSIDE it (an "anchor": not built again, used as is), see lezer-view.ts.
     */
    enter?: (from: number, to: number, key: string) => void,
    inner?: (c: InnerCand) => BNode | null
  ): BNode[];
};

/** a block about to be built inside another one: where it is, its table row, and the window (from the start of the block before it to the end of the one after it) */
export interface InnerCand {
  from: number;
  to: number;
  key: string;
  win: [number, number];
  /** how deep it will be (a top-level block is level 1) */
  level: number;
}

interface Cand {
  node: SyntaxNode;
  key: string;
  path: string[];
  /** set while an `inner` keeper is given: the block before's start to the block after's end (or the owner's own ends) */
  win?: [number, number];
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

/** `old` takes over what the adapter remembers of `nw` (its source text and error flag); both were built from the same table row */
export function adoptMeta(old: BNode, nw: BNode): void {
  const s = sources.get(nw);
  if (s === undefined) sources.delete(old);
  else sources.set(old, s);
  if (dirty.has(nw)) dirty.add(old);
  else dirty.delete(old);
}

export function lezerLanguage(parser: Parser, table: BlockTable): LezerLanguage {
  let innerKeep: ((c: InnerCand) => BNode | null) | null = null;
  /** the level of the block being built (a top-level block is 1); only kept while an `inner` keeper is given */
  let level = 0;
  /** a child block: an anchor the editor takes from the old tree, else built */
  const childOf = (cd: Cand, text: string, offset: number): BNode =>
    (cd.win && innerKeep?.({ from: cd.node.from, to: cd.node.to, key: cd.key, win: cd.win, level: level + 1 })) || build(cd, text, offset);
  const rule = (name: string) => table.rules?.filter((r) => r.name === name) ?? [];
  const keyOf = (n: SyntaxNode, text: string): string => {
    for (const r of rule("kind")) {
      const k = r.apply(n, text);
      if (k) return k;
    }
    return n.name;
  };

  function collect(n: SyntaxNode, path: string[], out: Cand[], text: string, top = false): void {
    for (let c = n.firstChild; c; c = c.nextSibling) {
      if (c.type.isError) {
        out.push({ node: c, key: "@error", path });
        continue;
      }
      const key = keyOf(c, text);
      const row = table.nodes[key];
      if (row && (!row.topLevelOnly || top)) out.push({ node: c, key, path: [...path, c.name, key] });
      else if (row) {
        // a comment inside a block: a candidate that no slot numbers or takes; build1 files it into a list
        if (row.kind === "comment") out.push({ node: c, key, path: [...path, c.name, key] });
        continue;
      }
      else if (table.opaque?.includes(c.name)) out.push({ node: c, key: "@opaque", path });
      else if (c.firstChild) collect(c, [...path, c.name], out, text);
    }
  }

  function leaf(kind: string, c: SyntaxNode, text: string, offset: number, extra: Partial<BNode> = {}): BNode {
    const src = text.slice(c.from, c.to);
    const b = makeNode(kind, [], { from: c.from + offset, to: c.to + offset, value: src.trim(), ...extra });
    sources.set(b, src);
    return b;
  }

  function build(c: Cand, text: string, offset: number): BNode {
    level++;
    let b: BNode;
    try {
      b = build1(c, text, offset);
    } finally {
      level--;
    }
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
      // "$first": the node's own first word (`const`, `let`, `var`)
      const kw = row.keyword === "$first" ? (/^\w+/.exec(text.slice(n.from, n.to)) ?? [row.keyword])[0] : row.keyword;
      extra.keyword = kw;
      const at = text.indexOf(kw, n.from);
      extra.keywordTo = (at >= 0 ? at + kw.length : n.from) + offset;
    }
    if (row.modifiers) {
      const ms: string[] = [];
      for (let c = n.firstChild; c; c = c.nextSibling) if (row.modifiers.includes(c.name)) ms.push(text.slice(c.from, c.to));
      if (ms.length) extra.modifier = ms.join(" ");
    }
    if (row.brackets) extra.brackets = text[n.from] === "[" ? "[]" : "()";
    const b = makeNode(row.kind, (row.slots ?? []).map((s) => [s.name, s.kind]), extra);
    (row.slots ?? []).forEach((sp, i) => {
      if (sp.before?.trim()) b.slots[i].glue = sp.before.trim();
    });
    sources.set(b, text.slice(n.from, n.to));
    const all: Cand[] = [];
    collect(n, [], all, text);
    if (innerKeep) all.forEach((cd, i) => (cd.win = [all[i - 1]?.node.from ?? n.from, all[i + 1]?.node.to ?? n.to]));
    const isComment = (cd: Cand): boolean => table.nodes[cd.key]?.kind === "comment";
    const cands = all.filter((cd) => !isComment(cd));
    // groups (clauses, entries): the blocks that belong to one are taken out of the node's own slots
    let rest = cands;
    const groups: { tok?: SyntaxNode; members: Cand[] }[] = [];
    const g = row.groups;
    if (g) {
      rest = [];
      const toks: SyntaxNode[] = [];
      for (let c = n.firstChild; c; c = c.nextSibling) if (g.tokens ? g.tokens.includes(c.name) : c.name === g.sep) toks.push(c);
      if (g.tokens) for (const t of toks) groups.push({ tok: t, members: [] });
      else groups.push({ members: [] });
      for (const cd of cands) {
        if (g.tokens?.includes(cd.node.name)) continue; // the token itself (a keyword block by the table's kind rule)
        const before = toks.filter((t) => t.from <= cd.node.from).length;
        if (g.tokens) {
          if (before) groups[before - 1].members.push(cd);
          else rest.push(cd);
        } else {
          while (groups.length <= before) groups.push({ members: [] });
          groups[before].members.push(cd);
        }
      }
    }
    fill(b, row, rest, n, text, offset);
    if (g) {
      const gs = b.slots.find((q) => q.name === g.slot) as Slot;
      const grow = table.nodes[g.row];
      for (const gr of groups) {
        if (!g.tokens && !gr.members.length) continue;
        const first = gr.tok ? gr.tok.from : gr.members[0].node.from;
        const last = gr.members.length ? gr.members[gr.members.length - 1].node.to : (gr.tok as SyntaxNode).to;
        const gb = makeNode(grow.kind, (grow.slots ?? []).map((q) => [q.name, q.kind] as [string, "one" | "list"]), { from: first + offset, to: last + offset });
        if (gr.tok) {
          gb.keyword = text.slice(gr.tok.from, gr.tok.to);
          gb.keywordTo = gr.tok.to + offset;
        }
        (grow.slots ?? []).forEach((sp, i) => {
          if (sp.before?.trim()) gb.slots[i].glue = sp.before.trim();
        });
        sources.set(gb, text.slice(first, last));
        keys.set(gb, g.row);
        level++; // (a group is a block of its own between the node and its members)
        fill(gb, grow, gr.members, n, text, offset);
        level--;
        blanks(gb, grow);
        if (gb.slots.some((q) => q.nodes.some((k) => dirty.has(k)))) dirty.add(gb);
        gb.parent = b;
        gb.slot = gs;
        gs.nodes.push(gb);
      }
    }
    // comments inside the block: into the list slot they are in or next to (not one with a glue word)
    for (const cd of all.filter(isComment)) {
      let target: Slot | null = null;
      let best = Infinity;
      for (const s of b.slots) {
        if (s.kind !== "list" || s.glue) continue;
        const d = s.nodes.length ? Math.max(s.nodes[0].from - (cd.node.to + offset), cd.node.from + offset - s.nodes[s.nodes.length - 1].to, 0) : table.statementSlots?.includes(s.name) ? 1e9 : Infinity;
        if (d < best) {
          best = d;
          target = s;
        }
      }
      if (!target) continue;
      const child = childOf(cd, text, offset);
      child.parent = b;
      child.slot = target;
      const at = target.nodes.findIndex((k) => k.from > child.from);
      target.nodes.splice(at < 0 ? target.nodes.length : at, 0, child);
    }
    blanks(b, row);
    return b;
  }

  /** the candidates go into the slots of `b` (a block of `row`) that take them */
  function fill(b: BNode, row: BlockRow, cands: Cand[], n: SyntaxNode, text: string, offset: number): void {
    const seen: Record<string, number> = {};
    const taken: [Cand, number][] = cands.map((cd, i) => {
      const slotIx = pick(row, cd, i, seen, n);
      return [cd, slotIx];
    });
    taken.forEach(([cd, si]) => {
      if (si < 0) return;
      const slot = b.slots[si];
      if (slot.kind === "one" && slot.nodes.length) return; // a second one: left out
      const child = childOf(cd, text, offset);
      child.parent = b;
      child.slot = slot;
      slot.nodes.push(child);
    });
  }

  /** a "one" slot that nothing filled gets a zero-width blank where the missing node would go */
  function blanks(b: BNode, row: BlockRow): void {
    b.slots.forEach((s, si) => {
      if (s.kind === "one" && !s.nodes.length) {
        // where the missing node would go: after what the earlier slots hold, else after the keyword or the opening bracket
        let at = b.keywordTo ?? b.from + (row.brackets ? 1 : 0);
        for (let k = 0; k < si; k++) for (const c of b.slots[k].nodes) if (c.kind !== "blank") at = Math.max(at, c.to);
        const blank = makeNode("blank", [], { value: "...", from: at, to: at });
        blank.parent = b;
        blank.slot = s;
        s.nodes.push(blank);
      }
    });
  }

  /**
   * index of the slot taking candidate `cd` (the i-th), or -1. Takes that name a TYPE are tried before
   * positional ones (`#n`, `@before:Tok`, `@after:Tok`), so that `Body` is not mistaken for "whatever follows `in`".
   */
  function pick(row: BlockRow, cd: Cand, i: number, seen: Record<string, number>, n: SyntaxNode): number {
    const slots = row.slots ?? [];
    const occ: Record<string, number> = {};
    for (const p of new Set(cd.path)) occ[p] = seen[p] = (seen[p] ?? -1) + 1;
    const matches = (t: string): boolean => {
      if (t.startsWith("@")) {
        const [kind, tok] = t.slice(1).split(":");
        const at = n.getChild(tok);
        return !!at && (kind === "before" ? cd.node.to <= at.from : cd.node.from >= at.to);
      }
      const [ty, nth] = t.split("#");
      return nth === undefined ? cd.path.includes(ty) : ty === "" ? i === +nth : occ[ty] === +nth;
    };
    let star = -1;
    for (const pass of [0, 1]) {
      for (let s = 0; s < slots.length; s++) {
        const take = slots[s].take;
        if (take === "*") {
          star = s;
          continue;
        }
        for (const t of take) {
          const typed = !t.startsWith("@") && !t.startsWith("#") && !/^[^#]+#/.test(t) ? true : false;
          if ((pass === 0) === typed && matches(t)) return s;
        }
      }
    }
    return star;
  }

  const lang: LezerLanguage = {
    table,
    parse(text, offset = 0) {
      const top = parser.parse(text).topNode;
      const out: Cand[] = [];
      collect(top, [], out, text, true);
      return out.map((c) => build(c, text, offset));
    },
    fromTree(tree, text, keep, enter, inner) {
      const out: Cand[] = [];
      collect(tree.topNode, [], out, text, true);
      try {
        level = 0;
        return out.map((c) => {
          const kept = keep?.(c.node.from, c.node.to, c.key);
          if (kept) return kept;
          enter?.(c.node.from, c.node.to, c.key);
          innerKeep = inner ?? null;
          return build(c, text, 0);
        });
      } finally {
        innerKeep = null;
      }
    },
    print(node) {
      const s = sources.get(node);
      if (s !== undefined) return s;
      if (node.value !== undefined) return node.value;
      throw new Error("print of a node that was never parsed needs a template (not in the table)");
    },
    blank: () => makeNode("blank", [], { value: "..." }),
    describe(node) {
      const key = keys.get(node);
      const row = key ? table.nodes[key] : undefined;
      const label = row?.label ?? (node.kind === "error" ? "unparsed text" : node.kind);
      const short = (c: BNode): string => {
        const t = (c.value ?? sources.get(c) ?? c.kind).replace(/\s+/g, " ").trim();
        return t.length > 28 ? t.slice(0, 27) + "..." : t;
      };
      if (row?.describe) {
        return row.describe.replace(/\$\{(\w+)(\.length)?(?:\|([^|}]*)\|([^}]*))?\}/g, (_m, name: string, len?: string, one?: string, many?: string) => {
          const sl = node.slots.find((q) => q.name === name);
          if (!sl) return name === "value" ? node.value ?? "" : name === "keyword" ? node.keyword ?? "" : "";
          const nodes = sl.nodes.filter((q) => q.kind !== "comment");
          if (len) return nodes.length + (one !== undefined ? " " + (nodes.length === 1 ? one : many) : "");
          return nodes.map(short).join(", ");
        });
      }
      if (node.slots.length === 0) return node.value ? `${label} ${node.value}` : label;
      return `${label} with ${node.slots.map((s) => `${s.nodes.length} ${s.name}`).join(", ")}`;
    },
  };
  return lang;
}

/* ---------------------------------------------------------------- writing */

export function separatorFor(table: BlockTable, text: string, slot: Slot): string {
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
  if (index >= ns.length) {
    // after the last block that is not a comment (text after a line comment would be part of it)
    let last = ns.length - 1;
    while (last > 0 && ns[last].kind === "comment") last--;
    if (ns[last].kind === "comment") return { from: ns[last].to, to: ns[last].to, insert: "\n" + snippet };
    // the last block already ends with its newline (a Python statement): no second one
    const end = ns[last].to;
    return { from: end, to: end, insert: (sep.startsWith("\n") && text[end - 1] === "\n" ? sep.slice(1) : sep) + snippet };
  }
  return { from: ns[index].from, to: ns[index].from, insert: snippet + sep };
}

/** The text change that removes a list element and one separator. */
export function removeChange(node: BNode, text?: string): TextChange {
  const ns = node.slot!.nodes;
  const i = ns.indexOf(node);
  if (i + 1 < ns.length) return { from: node.from, to: ns[i + 1].from, insert: "" };
  if (i > 0) {
    // the last of a list whose previous element ends with its own newline (a statement): take the node's newline too
    const prevEnd = ns[i - 1].to;
    const lastLine = !!text && text[node.to] === "\n" && (prevEnd === 0 || text[prevEnd - 1] === "\n");
    return { from: prevEnd, to: node.to + (lastLine ? 1 : 0), insert: "" };
  }
  // the only element: also the blanks before it on the same line (`(h 4)` -> `(h)`)
  let from = node.from;
  if (text) {
    let a = from;
    while (a > 0 && (text[a - 1] === " " || text[a - 1] === "\t")) a--;
    if (a > 0 && text[a - 1] !== "\n") from = a;
  }
  return { from, to: node.to, insert: "" };
}

/**
 * The text change that inserts `snippet` into an EMPTY list slot: before the closing
 * bracket of its owner (`f()`, `(f)`, `{}`, `[]`). One generic rule, no per-language
 * lines. An owner with no closing bracket (a Python body) cannot be done.
 */
export function insertEmptyChange(text: string, slot: Slot, snippet: string): TextChange {
  const o = slot.owner;
  const close = text[o.to - 1];
  if (!close || !")]}".includes(close)) throw new Error(`insert into an empty ${slot.name}: ${o.kind} has no closing bracket to go before`);
  const prev = text[o.to - 2] ?? "";
  const pad = prev === "" || /[\s([{]/.test(prev) ? "" : " ";
  const at = o.to - 1;
  return { from: at, to: at, insert: pad + snippet };
}

/**
 * The generic separator rule for statement lists: a newline and the indentation of the first
 * statement; or `inline` when that statement is not first on its line (`{ a(); b(); }`), if given.
 */
export const lineSeparator = (inline?: string) => ({
  name: "separator",
  apply(slot: Slot, text: string): string | undefined {
    if (slot.name !== "body" || !slot.nodes.length) return undefined;
    const at = slot.nodes[0].from;
    const before = text.slice(text.lastIndexOf("\n", at - 1) + 1, at);
    return inline !== undefined && /\S/.test(before) ? inline : "\n" + before.replace(/\S.*$/, "");
  },
});

/** the source of template `name`: holes become the table's blank; also the offset of the first hole (-1: none) */
export function fillTemplate(table: BlockTable, name: string, indent = ""): { text: string; hole: number; kind: string; stmt: boolean } {
  const t = table.templates?.[name];
  if (!t) throw new Error(`no template ${name}`);
  const blank = table.blank ?? "...";
  let hole = -1;
  let text = "";
  let last = 0;
  for (const m of t.text.matchAll(/\$\{[^}]*\}/g)) {
    text += t.text.slice(last, m.index);
    if (hole < 0) hole = text.length;
    // `${label|text}`: a hole that cannot be the blank (a Python name) shows `text` instead
    text += m[0].includes("|") ? m[0].slice(m[0].indexOf("|") + 1, -1) : blank;
    last = (m.index as number) + m[0].length;
  }
  text += t.text.slice(last);
  if (indent) {
    // the indentation applies to every line after the first: move the hole offset with it
    const before = text.slice(0, hole < 0 ? 0 : hole);
    const extra = (before.match(/\n/g) ?? []).length * indent.length;
    text = text.replace(/\n/g, "\n" + indent);
    if (hole >= 0) hole += extra;
  }
  return { text, hole, kind: t.kind, stmt: !!t.stmt };
}
