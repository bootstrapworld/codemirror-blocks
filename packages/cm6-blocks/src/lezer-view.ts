/*
 * EXPERIMENT. The editor with Lezer as the source of the tree (compare view.ts,
 * which keeps its own tree with hand-made operations).
 *
 * One StateField holds the Lezer tree (reparsed incrementally with
 * `TreeFragment.applyChanges`), the block roots, and the decorations of the
 * roots. After EVERY transaction that changes the document the field:
 *   1. reparses incrementally;
 *   2. builds blocks only for the top-level Lezer nodes that are new or changed;
 *      an old root keeps its BNode (and so its element) when its range, mapped
 *      through the change, equals a new top-level node's range and its source
 *      text is unchanged (Lezer gives no identity to statements: they live in
 *      buffers). A changed root is rebuilt whole;
 *   3. fixes the positions of the kept roots (absolute offsets: a walk of the
 *      roots after the change), maps the decorations and adds/drops only the
 *      ones that changed.
 * Every edit made through the editor (insertText, removeNode, replaceText) is a
 * plain text change computed from node ranges and the table's separators,
 * dispatched as an ordinary transaction. There is no separate path for them.
 *
 * Caveat: the field mutates BNodes in place (positions of kept roots), so a
 * state computed by `state.update` and then dropped has already changed them.
 */
import { Compartment, EditorState, Extension, StateField, Transaction } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, keymap } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, isolateHistory } from "@codemirror/commands";
import { Tree, TreeFragment } from "@lezer/common";
import type { Parser } from "@lezer/common";
import { walk } from "./doc";
import { BlockTable, fillTemplate, insertChange, insertEmptyChange, LezerLanguage, lezerLanguage, removeChange, keyOfNode, hasError } from "./lezer";
import { Renderer } from "./render";
import { RootWidget } from "./view";
import { attachInteraction } from "./interact";
import { makeNode } from "./node";
import { compatible, reconcile, ReconcileEnv } from "./reconcile";
import type { BNode, Doc, Slot, TextChange } from "./types";

export interface LezerOptions {
  parser: Parser;
  table: BlockTable;
  /** lay a touched root over its old nodes (reconcile.ts); false rebuilds it whole, as before the fourth round (for measuring) */
  reconcile?: boolean;
}

export interface LezerStats {
  edits: number;
  reparses: number;
  widgetsBuilt: number;
  focusRestores: number;
  rootsKept: number;
  rootsRebuilt: number;
  /** touched roots whose old nodes were kept and changed in place (node-level reuse) */
  rootsReconciled: number;
  /** nodes that are new in the tree: built for a rebuilt root, or inserted / replaced inside a reconciled one */
  nodesRebuilt: number;
  /** nodes of reconciled roots compared with their old counterparts */
  nodesCompared: number;
  /** nodes in the largest root rebuilt so far */
  maxRootNodes: number;
  /** time spent in the field update, in ms: reparse; and the rest (matching, building, positions, decorations) */
  parseMs: number;
  restMs: number;
}

export interface LezerBlockEditor {
  readonly view: EditorView;
  readonly doc: Doc;
  readonly language: LezerLanguage;
  readonly renderer: Renderer;
  readonly options: LezerOptions;
  /** the message of the last edit the keyboard or mouse could not make (e.g. insert into an empty list) */
  lastError: string | null;
  roots(): BNode[];
  /** the templates of the language (the table's), in the order written */
  templates(): { name: string; kind: string; stmt: boolean }[];
  /**
   * Write template `name` after `anchor` (or the nearest ancestor that sits in a list that takes it),
   * else at the end of the program. Holes are the language's blank. Returns the first hole (or the
   * new block), also focused with its edit box open.
   */
  insertTemplate(name: string, anchor?: BNode | null): BNode | null;
  /** edit a leaf in place (its box); `typed` starts the text with that key */
  edit(node: BNode, typed?: string): void;
  /** the block that had focus last (it may have lost it to a toolbar), if it is still in the tree */
  lastFocused(): BNode | null;
  /** insert source text `snippet` as element `index` of a list slot (a text change, one undo step) */
  insertText(slot: Slot, index: number, snippet: string): void;
  /** remove a node: out of a list with one separator, or (a "one" slot) put the table's blank there */
  removeNode(node: BNode): void;
  /** replace the text of a node */
  replaceText(node: BNode, snippet: string): void;
  /** the source text of a block, its later lines moved left by the indentation of its first line (what the clipboard holds) */
  copyText(node: BNode): string;
  /**
   * Write source text `text` after `anchor` (in the nearest list that holds it; replacing `anchor` if it is a blank; at
   * the end of the program when there is no anchor). The new block is focused. Returns it, if found.
   */
  pasteText(anchor: BNode | null, text: string): BNode | null;
  /** Move a block to a gap (`slot`, `index`) or onto a blank: ONE text change (cut and paste), one undo step. Throws if the target is inside the block. */
  moveNode(node: BNode, target: { slot: Slot; index: number } | { blank: BNode }): void;
  /** is this block a hole (a blank): what a drop or a paste replaces */
  isBlank(node: BNode): boolean;
  /** apply one text change as one undo step */
  change(c: TextChange): void;
  focusNode(node: BNode): void;
  focusedNode(): BNode | null;
  setBlockMode(on: boolean): void;
  stats(): LezerStats;
  destroy(): void;
}

interface LState {
  tree: Tree;
  fragments: readonly TreeFragment[];
  roots: BNode[];
  decos: DecorationSet;
}

const drawn = (n: BNode): boolean => n.kind !== "error";
const widgetNode = (d: Decoration): BNode => (d.spec.widget as RootWidget).node;
const count = (n: BNode): number => {
  let c = 0;
  walk(n, () => c++);
  return c;
};
function shiftTree(n: BNode, d: number): void {
  walk(n, (m) => {
    m.from += d;
    m.to += d;
    if (m.keywordTo !== undefined) m.keywordTo += d;
  });
}

export function createLezerBlockEditor(parent: HTMLElement, text: string, options: LezerOptions): LezerBlockEditor {
  const { parser, table } = options;
  const language = lezerLanguage(parser, table);
  const renderer = new Renderer(language);
  const stats: LezerStats = {
    edits: 0, reparses: 0, widgetsBuilt: 0, focusRestores: 0,
    rootsKept: 0, rootsRebuilt: 0, rootsReconciled: 0, nodesRebuilt: 0, nodesCompared: 0, maxRootNodes: 0, parseMs: 0, restMs: 0,
  };
  const counters = stats as unknown as { ops: number; reparses: number; widgetsBuilt: number; focusRestores: number };
  const program = makeNode("program", [["roots", "list"]], { from: 0, to: text.length });
  const doc: Doc = { language, program, byId: new Map([[program.id, program]]) };
  const rootsSlot = program.slots[0];
  const decoFor = (n: BNode): Decoration => Decoration.replace({ widget: new RootWidget(n, renderer, counters) });

  function install(roots: BNode[], len: number): void {
    rootsSlot.nodes = roots;
    for (const r of roots) {
      r.parent = program;
      r.slot = rootsSlot;
    }
    program.to = len;
  }

  const field = StateField.define<LState>({
    create(state) {
      const s = state.doc.toString();
      const tree = parser.parse(s);
      const roots = language.fromTree(tree, s);
      install(roots, s.length);
      for (const r of roots) walk(r, (n) => doc.byId.set(n.id, n));
      return {
        tree,
        fragments: TreeFragment.addTree(tree),
        roots,
        decos: Decoration.set(roots.filter(drawn).map((r) => decoFor(r).range(r.from, r.to)), true),
      };
    },
    update(v, tr) {
      if (!tr.docChanged) return v;
      stats.reparses++;
      const s = tr.newDoc.toString();
      const cr: { fromA: number; toA: number; fromB: number; toB: number }[] = [];
      tr.changes.iterChangedRanges((fromA, toA, fromB, toB) => cr.push({ fromA, toA, fromB, toB }));
      const frags = TreeFragment.applyChanges(v.fragments, cr);
      const tp = performance.now();
      const tree = parser.parse(s, frags);
      const tq = performance.now();
      stats.parseMs += tq - tp;

      // Old roots, where they now are. A root is only kept if no change is in it or in its
      // neighbours: error recovery and the layout rules (Python's indentation, JS's automatic
      // semicolons) let text after a root, or before it, change what is inside it.
      const rs = v.roots;
      const affected = new Set<number>();
      for (const c of cr) {
        let lo = 0;
        let hi = rs.length;
        while (lo < hi) {
          const m = (lo + hi) >> 1;
          if (rs[m].to >= c.fromA) hi = m;
          else lo = m + 1;
        }
        const first = lo;
        lo = 0;
        hi = rs.length;
        while (lo < hi) {
          const m = (lo + hi) >> 1;
          if (rs[m].from > c.toA) hi = m;
          else lo = m + 1;
        }
        const last = lo - 1;
        for (let k = Math.max(0, first - 1); k <= Math.min(rs.length - 1, last + 1); k++) affected.add(k);
      }
      const old = new Map<number, { node: BNode; to: number; touched: boolean; from0: number; to0: number }>();
      rs.forEach((r, k) => {
        const from = tr.changes.mapPos(r.from, 1);
        const to = tr.changes.mapPos(r.to, -1);
        if (to > from) old.set(from, { node: r, to, touched: affected.has(k), from0: r.from, to0: r.to });
      });
      // Context: a change can alter how UNCHANGED text after it reads without touching it (an unclosed
      // bracket makes the newlines after it mean nothing; a dedent moves a line out of a body). That always
      // leaves an error node somewhere after the change, so no root between the first change and the last
      // error node is kept without being compared (found by the fuzzer on a larger program).
      let firstChange = s.length;
      for (const c of cr) firstChange = Math.min(firstChange, c.fromB);
      let lastError = -1;
      tree.iterate({ from: firstChange, enter: (n) => { if (n.type.isError) lastError = Math.max(lastError, n.to); } });
      const kept = new Set<BNode>();
      const roots = language.fromTree(tree, s, (from, to, key) => {
        const o = old.get(from);
        if (!o || o.touched || (lastError >= 0 && to >= firstChange && from <= lastError) || o.to !== to || keyOfNode(o.node) !== key || hasError(o.node)) return null;
        kept.add(o.node);
        return o.node;
      });
      // touched roots: the old nodes are kept as far as they are the same (reconcile.ts)
      const env: ReconcileEnv = {
        apply: (c) => renderer.apply(c),
        refresh: (n) => renderer.refresh(n),
        added: (n) => walk(n, (m) => { doc.byId.set(m.id, m); stats.nodesRebuilt++; }),
        removed: (n) => walk(n, (m) => doc.byId.delete(m.id)),
      };
      const reconciled = new Map<BNode, { from0: number; to0: number }>();
      for (let i = 0; i < roots.length; i++) {
        const r = roots[i];
        if (kept.has(r)) continue;
        const o = old.get(r.from);
        if (options.reconcile === false || !o || reconciled.has(o.node) || o.node.kind === "error" || r.kind === "error" || !compatible(o.node, r)) continue;
        stats.nodesCompared += count(r);
        reconcile(o.node, r, env);
        reconciled.set(o.node, { from0: o.from0, to0: o.to0 });
        roots[i] = o.node;
        stats.rootsReconciled++;
      }
      const dropped = v.roots.filter((r) => !kept.has(r) && !reconciled.has(r));
      for (const r of dropped) {
        renderer.forget(r);
        walk(r, (n) => doc.byId.delete(n.id));
      }
      const fresh: BNode[] = [];
      for (const r of roots) {
        if (kept.has(r)) {
          const d = tr.changes.mapPos(r.from, 1) - r.from;
          if (d !== 0) shiftTree(r, d);
          stats.rootsKept++;
        } else if (!reconciled.has(r)) {
          fresh.push(r);
          const c = count(r);
          stats.rootsRebuilt++;
          stats.nodesRebuilt += c;
          if (c > stats.maxRootNodes) stats.maxRootNodes = c;
          walk(r, (n) => doc.byId.set(n.id, n));
        }
      }
      install(roots, s.length);
      if (dropped.length || fresh.length) renderer.renumberSlot(rootsSlot);

      let decos = v.decos.map(tr.changes);
      const drop = new Set(dropped.filter(drawn));
      const add = fresh.filter(drawn).map((r) => decoFor(r).range(r.from, r.to));
      let lo = Infinity;
      let hi = -Infinity;
      for (const r of drop) {
        lo = Math.min(lo, tr.changes.mapPos(r.from, -1));
        hi = Math.max(hi, tr.changes.mapPos(r.to, 1));
      }
      // a reconciled root keeps its widget, unless its range is no longer what the mapped decoration has
      for (const [r, p] of reconciled) {
        if (!drawn(r) || (tr.changes.mapPos(p.from0, 1) === r.from && tr.changes.mapPos(p.to0, -1) === r.to)) continue;
        drop.add(r);
        add.push(decoFor(r).range(r.from, r.to));
        lo = Math.min(lo, tr.changes.mapPos(p.from0, -1));
        hi = Math.max(hi, tr.changes.mapPos(p.to0, 1), r.to);
      }
      if (drop.size || add.length) {
        decos = decos.update({
          add,
          sort: true,
          filter: drop.size ? (_f, _t, d) => !drop.has(widgetNode(d)) : undefined,
          filterFrom: drop.size ? lo : undefined,
          filterTo: drop.size ? hi : undefined,
        });
      }
      stats.restMs += performance.now() - tq;
      return { tree, fragments: TreeFragment.addTree(tree, frags), roots, decos };
    },
  });

  const compartment = new Compartment();
  const blockExtension: Extension = [
    EditorView.decorations.from(field, (v) => v.decos),
    EditorView.atomicRanges.of((v) => v.state.field(field).decos),
    EditorView.contentAttributes.of({ role: "tree", "aria-label": "program" }),
  ];
  let blockMode = true;
  let gone = false;
  // eslint-disable-next-line prefer-const -- read by closures made before the view exists
  let view: EditorView;

  /* ---- focus */

  interface Snap {
    node: BNode;
    pos: number;
  }
  const isDrawn = (n: BNode): boolean => drawn(n) && n.kind !== "program" && renderer.has(n) && renderer.element(n).isConnected;

  function takeSnapshot(): Snap | null {
    if (!view) return null;
    const active = view.dom.ownerDocument.activeElement;
    if (!active || !view.contentDOM.contains(active)) return null;
    const node = renderer.nodeOf(active);
    return node && doc.byId.get(node.id) === node ? { node, pos: node.from } : null;
  }

  /** the deepest node containing `pos`, else the nearest root before it */
  function deepestAt(pos: number): BNode | null {
    let owner: BNode = program;
    let best: BNode | null = null;
    for (;;) {
      const kids = owner.slots.flatMap((s) => s.nodes);
      const hit = kids.find((k) => k.from <= pos && pos < k.to) ?? (owner === program ? [...kids].reverse().find((k) => k.to <= pos) ?? kids[0] : undefined);
      if (!hit) return best;
      best = hit;
      if (!(hit.from <= pos && pos < hit.to)) return best;
      owner = hit;
    }
  }

  function restoreFocus(s: Snap | null, trs: readonly Transaction[]): void {
    if (!s || gone) return;
    const active = view.dom.ownerDocument.activeElement;
    if (active && view.contentDOM.contains(active) && renderer.nodeOf(active)) return;
    let target: BNode | null;
    if (doc.byId.get(s.node.id) === s.node) target = s.node;
    else {
      let pos = s.pos;
      for (const t of trs) pos = t.changes.mapPos(pos, 1);
      target = deepestAt(pos);
    }
    while (target && !isDrawn(target)) target = target.parent;
    if (!target || target.kind === "program") return;
    stats.focusRestores++;
    renderer.element(target).focus();
  }

  /* ---- edits: all plain text changes */

  function dispatch(c: TextChange): void {
    stats.edits++;
    view.dispatch({ changes: c, annotations: [isolateHistory.of("full")], userEvent: "input.block" });
  }
  const currentText = () => view.state.doc.toString();
  let lastNode: BNode | null = null;
  /** the text change that writes `snippet` as element `index` of a list slot (an empty list too) */
  function changeFor(slot: Slot, index: number, snippet: string): TextChange {
    if (slot.nodes.length === 0) {
      if (slot.owner === program) return { from: 0, to: 0, insert: snippet + (view.state.doc.length ? "\n" : "") };
      return insertEmptyChange(currentText(), slot, snippet);
    }
    return insertChange(table, currentText(), slot, index, snippet);
  }
  /** Nodes are only good until the next change that rebuilds their root: refuse a stale one (throws). */
  const live = (n: BNode): void => {
    if (doc.byId.get(n.id) !== n) throw new Error(`node ${n.id} (${n.kind}) is no longer in the tree: look it up again after an edit`);
  };

  /** a hole: a block that is not there (zero width) or is the table's blank text */
  const isBlank = (n: BNode): boolean => n.kind === "blank" || (n.slots.length === 0 && n.value === (table.blank ?? "..."));
  const indentAt = (pos: number): string => {
    const t = currentText();
    return (t.slice(t.lastIndexOf("\n", pos - 1) + 1, pos).match(/^[ \t]*/) as RegExpMatchArray)[0];
  };
  const dedent = (s: string, indent: string): string => (indent ? s.split("\n").map((l, i) => (i > 0 && l.startsWith(indent) ? l.slice(indent.length) : l)).join("\n") : s);
  /** the change that writes `snippet` in place of a node (a missing one, zero-width, also gets its connector and spaces) */
  function replaceChange(node: BNode, snippet: string): TextChange {
    if (node.from !== node.to) return { from: node.from, to: node.to, insert: snippet };
    const t = currentText();
    const row = node.parent && table.nodes[keyOfNode(node.parent) ?? ""];
    const before = row?.slots?.find((q) => q.name === node.slot?.name)?.before;
    const prev = t[node.from - 1] ?? "";
    const next = t[node.to] ?? "";
    const left = before ?? (prev === "" || /[\s([{]/.test(prev) ? "" : " ");
    const right = next === "" || /[\s)\]};,]/.test(next) ? "" : " ";
    return { from: node.from, to: node.to, insert: left + snippet + right };
  }
  /** the drawn block that starts at `pos` and is longest (the one written there) */
  function blockAt(pos: number, len: number): BNode | null {
    let best: BNode | null = null;
    for (const r of rootsSlot.nodes) {
      if (r.to < pos || r.from > pos + len) continue;
      walk(r, (n) => {
        if (n.from === pos && drawn(n) && n.to > n.from && (!best || n.to > best.to)) best = n;
      });
    }
    return best;
  }

  const ed: LezerBlockEditor = {
    get view() {
      return view;
    },
    doc,
    language,
    renderer,
    options,
    lastError: null,
    roots: () => rootsSlot.nodes,
    insertText(slot, index, snippet) {
      live(slot.owner);
      dispatch(changeFor(slot, index, snippet));
    },
    templates: () => Object.entries(table.templates ?? {}).map(([name, t]) => ({ name, kind: t.kind, stmt: !!t.stmt })),
    insertTemplate(name, anchor) {
      const t = table.templates?.[name];
      if (!t) throw new Error(`no template ${name}`);
      if (anchor) live(anchor);
      const takes = (sl: Slot) => sl.kind === "list" && (!t.stmt || !table.statementSlots || table.statementSlots.includes(sl.name));
      let slot = rootsSlot;
      let ref: BNode | null = rootsSlot.nodes[rootsSlot.nodes.length - 1] ?? null;
      let index = rootsSlot.nodes.length;
      for (let n: BNode | null = anchor ?? null; n; n = n.parent) {
        if (n.slot && takes(n.slot)) {
          slot = n.slot;
          ref = n;
          index = n.slot.nodes.indexOf(n) + 1;
          break;
        }
      }
      const text = currentText();
      const indent = ref ? (text.slice(text.lastIndexOf("\n", ref.from - 1) + 1, ref.from).match(/^[ \t]*/) as RegExpMatchArray)[0] : "";
      const f = fillTemplate(table, name, indent);
      const asStatement = !t.stmt && !!table.statementSlots?.includes(slot.name);
      const snippet = f.text + (asStatement ? table.statementSuffix ?? "" : "");
      const change = changeFor(slot, index, snippet);
      dispatch(change);
      const start = change.from + change.insert.indexOf(snippet);
      const pos = start + Math.max(f.hole, 0);
      let found: BNode | null = null;
      for (const r of rootsSlot.nodes) {
        walk(r, (n) => {
          if (n.slots.length === 0 && n.from === pos && n.to > n.from && (!found || n.from >= found.from) && !found) found = n;
        });
      }
      if (found) ed.edit(found);
      return found;
    },
    edit: (node, typed) => interaction.edit(node, typed),
    lastFocused: () => (lastNode && doc.byId.get(lastNode.id) === lastNode ? lastNode : null),
    removeNode(node) {
      live(node);
      if (!node.slot) throw new Error("not removable");
      // where focus should go afterwards, if it is on the node (or inside it): the node now at its place
      const f = ed.focusedNode();
      let inside = false;
      for (let c: BNode | null = f; c; c = c.parent) if (c === node) inside = true;
      const owner = node.parent as BNode;
      const where = { from: owner.from, kind: owner.kind, slot: node.slot.name, index: node.slot.nodes.indexOf(node) };
      if (node.slot.kind === "one") dispatch({ from: node.from, to: node.to, insert: table.blank ?? "..." });
      else dispatch(removeChange(node, currentText()));
      if (!inside) return;
      let target: BNode | null = null;
      let o: BNode | null = null;
      if (owner === program) o = program;
      else
        for (const r of rootsSlot.nodes) {
          walk(r, (n) => {
            if (!o && n.from === where.from && n.kind === where.kind) o = n;
          });
        }
      const sl = (o as BNode | null)?.slots.find((q) => q.name === where.slot);
      if (sl) target = sl.nodes[where.index] ?? sl.nodes[where.index - 1] ?? (o === program ? null : o);
      while (target && !isDrawn(target)) target = target.parent;
      if (target && target.kind !== "program") ed.focusNode(target);
    },
    replaceText(node, snippet) {
      live(node);
      dispatch(replaceChange(node, snippet));
    },
    isBlank,
    copyText(node) {
      live(node);
      return dedent(view.state.doc.sliceString(node.from, node.to), indentAt(node.from)).replace(/\s+$/, "");
    },
    pasteText(anchor, text) {
      if (anchor) live(anchor);
      if (anchor && isBlank(anchor)) {
        const c = replaceChange(anchor, text.replace(/\n/g, "\n" + indentAt(anchor.from)));
        dispatch(c);
        const at = c.from + c.insert.indexOf(text.split("\n")[0]);
        const found = blockAt(at, c.insert.length);
        if (found) ed.focusNode(found);
        return found;
      }
      let slot = rootsSlot;
      let ref: BNode | null = rootsSlot.nodes[rootsSlot.nodes.length - 1] ?? null;
      let index = rootsSlot.nodes.length;
      for (let n: BNode | null = anchor; n; n = n.parent) {
        if (n.slot && n.slot.kind === "list") {
          slot = n.slot;
          ref = n;
          index = n.slot.nodes.indexOf(n) + 1;
          break;
        }
      }
      const indent = ref ? indentAt(ref.from) : "";
      const snippet = text.replace(/\n/g, "\n" + indent);
      const change = changeFor(slot, index, snippet);
      dispatch(change);
      const found = blockAt(change.from + change.insert.indexOf(snippet), snippet.length);
      if (found) ed.focusNode(found);
      return found;
    },
    moveNode(node, target) {
      live(node);
      if (!node.slot) throw new Error("not movable");
      const dest = "blank" in target ? target.blank : target.slot.owner;
      live(dest);
      for (let n: BNode | null = dest; n; n = n.parent) if (n === node) throw new Error("a block cannot go inside itself");
      const i = node.slot.nodes.indexOf(node);
      if ("slot" in target && target.slot === node.slot && (target.index === i || target.index === i + 1)) return; // where it is
      if ("blank" in target && target.blank === node) return;
      const t = currentText();
      const snippet = dedent(t.slice(node.from, node.to), indentAt(node.from)).replace(/\s+$/, "");
      const gone: TextChange = node.slot.kind === "one" ? { from: node.from, to: node.to, insert: table.blank ?? "..." } : removeChange(node, t);
      let put: TextChange;
      if ("blank" in target) put = replaceChange(target.blank, snippet.replace(/\n/g, "\n" + indentAt(target.blank.from)));
      else {
        const sl = target.slot;
        const ref = sl.nodes[Math.min(target.index, sl.nodes.length - 1)] ?? null;
        put = changeFor(sl, target.index, snippet.replace(/\n/g, "\n" + (ref ? indentAt(ref.from) : "")));
      }
      const both = [gone, put].sort((a, b) => a.from - b.from || a.to - b.to);
      if (both[0].to > both[1].from) throw new Error("cannot move a block there");
      stats.edits++;
      view.dispatch({ changes: both, annotations: [isolateHistory.of("full")], userEvent: "input.block" });
      // where the block is now: its text starts where the inserted text does, shifted by what was cut before it
      const shift = gone.from < put.from ? gone.insert.length - (gone.to - gone.from) : 0;
      const at = put.from + shift + put.insert.indexOf(snippet.split("\n")[0]);
      const found = blockAt(at, snippet.length);
      if (found) ed.focusNode(found);
    },
    change: dispatch,
    focusNode(node) {
      if (!isDrawn(node)) return;
      const el = renderer.element(node);
      el.focus();
      if (typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "nearest", inline: "nearest" });
    },
    focusedNode() {
      const active = view.dom.ownerDocument.activeElement;
      if (!active || !view.contentDOM.contains(active)) return null;
      return renderer.nodeOf(active);
    },
    setBlockMode(on) {
      if (blockMode === on) return;
      blockMode = on;
      view.dispatch({ effects: compartment.reconfigure(on ? blockExtension : []) });
    },
    stats: () => ({ ...stats }),
    destroy() {
      gone = true;
      interaction.detach();
      view.destroy();
    },
  };

  view = new EditorView({
    parent,
    state: EditorState.create({
      doc: text,
      extensions: [history(), keymap.of([...defaultKeymap, ...historyKeymap]), field, compartment.of(blockExtension)],
    }),
    dispatchTransactions(trs, v) {
      const snap = trs.some((t) => t.docChanged) ? takeSnapshot() : null;
      v.update(trs);
      restoreFocus(snap, trs);
      // undo and redo scroll to the old selection (the top, for block edits): show what changed instead
      const last = trs.find((t) => t.docChanged && (t.isUserEvent("undo") || t.isUserEvent("redo")));
      if (last) {
        let at = -1;
        last.changes.iterChangedRanges((_a, _b, fromB) => {
          if (at < 0) at = fromB;
        });
        if (at >= 0) {
          v.dispatch({ effects: EditorView.scrollIntoView(at, { y: "nearest" }) });
          restoreFocus(snap, trs);
        }
      }
    },
  });
  const interaction = attachInteraction(ed);
  view.dom.addEventListener("focusin", (e) => {
    const n = renderer.nodeOf(e.target as Element);
    if (n) lastNode = n;
  });
  internals.set(ed, { field, blockMode: () => blockMode });
  return ed;
}

const internals = new WeakMap<LezerBlockEditor, { field: StateField<LState>; blockMode: () => boolean }>();

/**
 * How often the editor's tree differed from a fresh parse of the same text
 * while the text had Lezer error nodes, and the editor's roots were exactly what
 * its own (incrementally reparsed) Lezer tree gives. Lezer's incremental parse
 * is not guaranteed to recover from errors the way a fresh parse does.
 */
export const divergences = { count: 0 };

/* ------------------------------------------------------------- the checker */

const FIELDS = ["kind", "from", "to", "value", "dataType", "modifier", "keyword", "keywordTo", "brackets"] as const;

/** where two DOM trees first differ, as a short description (for the checker's message) */
function domDiff(live: Element, fresh: Element, path = ""): string {
  const here = `${path}/${live.className.toString().split(" ").slice(0, 2).join(".")}`;
  const names = new Set([...live.getAttributeNames(), ...fresh.getAttributeNames()]);
  for (const a of names) if (live.getAttribute(a) !== fresh.getAttribute(a)) return `${here} @${a}: live ${live.getAttribute(a)}, fresh ${fresh.getAttribute(a)}`;
  if (live.children.length !== fresh.children.length) return `${here}: ${live.children.length} children, fresh ${fresh.children.length}`;
  if (live.children.length === 0 && live.textContent !== fresh.textContent) return `${here}: text ${live.textContent}, fresh ${fresh.textContent}`;
  for (let i = 0; i < live.children.length; i++) {
    const d = domDiff(live.children[i], fresh.children[i], `${here}[${i}]`);
    if (d) return d;
  }
  return "";
}

/**
 * The live block tree equals a fresh parse of the text (kinds, slots, values,
 * ranges); links and byId are right; decorations match the roots; the live DOM
 * equals a fresh drawing. Empty is fine.
 */
export function checkLezerEditor(ed: LezerBlockEditor): string[] {
  const problems: string[] = [];
  const say = (m: string) => {
    if (problems.length < 30) problems.push(m);
  };
  const inner = internals.get(ed) as { field: StateField<LState>; blockMode: () => boolean };
  const state = ed.view.state;
  const text = state.doc.toString();
  const prog = ed.doc.program;
  const roots = prog.slots[0].nodes;
  if (prog.to !== text.length) say(`program ends at ${prog.to}, the text has ${text.length}`);

  const compareLists = (live: BNode[], ref: BNode[], out: string[]): void => {
    const compare = (l: BNode, r: BNode, path: string): void => {
      for (const f of FIELDS) {
        if (l[f] !== r[f]) return void out.push(`${path}: ${f} is ${String(l[f])}, expected ${String(r[f])}`);
      }
      if (l.slots.length !== r.slots.length) return void out.push(`${path}: ${l.slots.length} slots, expected ${r.slots.length}`);
      l.slots.forEach((ls, i) => {
        const rs = r.slots[i];
        if (ls.name !== rs.name || ls.kind !== rs.kind) return void out.push(`${path}: slot ${i} differs`);
        if (ls.nodes.length !== rs.nodes.length) return void out.push(`${path}.${ls.name}: ${ls.nodes.length} nodes, expected ${rs.nodes.length}`);
        ls.nodes.forEach((c, j) => compare(c, rs.nodes[j], `${path}.${ls.name}[${j}]`));
      });
    };
    if (live.length !== ref.length) return void out.push(`${live.length} roots, expected ${ref.length}`);
    live.forEach((r, i) => compare(r, ref[i], `roots[${i}]`));
  };
  const freshTree = (ed.options.parser as Parser).parse(text);
  const fresh = ed.language.parse(text);
  const diff: string[] = [];
  compareLists(roots, fresh, diff);
  if (diff.length) {
    const own = state.field(inner.field).tree;
    const mine: string[] = [];
    compareLists(roots, ed.language.fromTree(own, text), mine);
    let errors = false;
    for (const t of [own, freshTree]) t.iterate({ enter: (n) => { if (n.type.isError) errors = true; } });
    if (mine.length === 0 && errors) divergences.count++;
    else for (const d of mine.length ? mine : diff) say(mine.length ? `(not what its own tree gives) ${d}` : d);
  }

  const seen = new Set<BNode>();
  const links = (n: BNode, path: string): void => {
    if (seen.has(n)) return say(`${path}: in the tree twice`);
    seen.add(n);
    if (ed.doc.byId.get(n.id) !== n) say(`${path}: byId does not hold node ${n.id}`);
    for (const slot of n.slots) {
      if (slot.owner !== n) say(`${path}.${slot.name}: slot owner wrong`);
      slot.nodes.forEach((c, i) => {
        if (c.parent !== n || c.slot !== slot) say(`${path}.${slot.name}[${i}]: parent/slot link wrong`);
        links(c, `${path}.${slot.name}[${i}]`);
      });
    }
  };
  links(prog, "program");
  if (ed.doc.byId.size !== seen.size) say(`byId holds ${ed.doc.byId.size} nodes, the tree has ${seen.size}`);

  const decos: { from: number; to: number; node: BNode }[] = [];
  state.field(inner.field).decos.between(0, state.doc.length, (from, to, d) => {
    decos.push({ from, to, node: widgetNode(d) });
  });
  for (const d of decos) if (!roots.includes(d.node)) say(`a decoration for node ${d.node.id}, which is not a root`);
  const vp = ed.view.viewport;
  const on = inner.blockMode();
  let freshR: Renderer | null = null;
  for (const r of roots) {
    const mine = decos.filter((d) => d.node === r);
    if (r.kind === "error") {
      if (mine.length) say(`error root ${r.id} has a decoration`);
      continue;
    }
    if (mine.length !== 1) {
      say(`root ${r.id} [${r.from},${r.to}) has ${mine.length} decorations`);
      continue;
    }
    if (mine[0].from !== r.from || mine[0].to !== r.to) say(`root ${r.id}: decoration [${mine[0].from},${mine[0].to}), node [${r.from},${r.to})`);
    if (!ed.renderer.has(r)) {
      if (on && r.from >= vp.from && r.to <= vp.to) say(`root ${r.id} is in the viewport and has no element`);
      continue;
    }
    const el = ed.renderer.element(r);
    if (on && r.from >= vp.from && r.to <= vp.to && !el.isConnected) say(`root ${r.id} is in the viewport and its element is not in the document`);
    if (!freshR) freshR = new Renderer(ed.language);
    if (!freshR.element(r).isEqualNode(el)) say(`root ${r.id}: its DOM is not what a fresh drawing gives (${domDiff(el, freshR.element(r))})`);
  }
  return problems;
}
