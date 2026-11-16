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
import { BlockTable, insertChange, LezerLanguage, lezerLanguage, removeChange, keyOfNode, hasError } from "./lezer";
import { Renderer } from "./render";
import { RootWidget } from "./view";
import { makeNode } from "./wescheme";
import type { BNode, Doc, Slot, TextChange } from "./types";

export interface LezerOptions {
  parser: Parser;
  table: BlockTable;
}

export interface LezerStats {
  edits: number;
  reparses: number;
  widgetsBuilt: number;
  focusRestores: number;
  rootsKept: number;
  rootsRebuilt: number;
  nodesRebuilt: number;
  /** nodes in the largest root rebuilt so far */
  maxRootNodes: number;
}

export interface LezerBlockEditor {
  readonly view: EditorView;
  readonly doc: Doc;
  readonly language: LezerLanguage;
  readonly renderer: Renderer;
  readonly options: LezerOptions;
  roots(): BNode[];
  /** insert source text `snippet` as element `index` of a list slot (a text change, one undo step) */
  insertText(slot: Slot, index: number, snippet: string): void;
  /** remove a node: out of a list with one separator, or (a "one" slot) put the table's blank there */
  removeNode(node: BNode): void;
  /** replace the text of a node */
  replaceText(node: BNode, snippet: string): void;
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
    rootsKept: 0, rootsRebuilt: 0, nodesRebuilt: 0, maxRootNodes: 0,
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
      const tree = parser.parse(s, frags);

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
      const old = new Map<number, { node: BNode; to: number; touched: boolean }>();
      rs.forEach((r, k) => {
        const from = tr.changes.mapPos(r.from, 1);
        const to = tr.changes.mapPos(r.to, -1);
        if (to > from) old.set(from, { node: r, to, touched: affected.has(k) });
      });
      const kept = new Set<BNode>();
      const roots = language.fromTree(tree, s, (from, to, key) => {
        const o = old.get(from);
        if (!o || o.touched || o.to !== to || keyOfNode(o.node) !== key || hasError(o.node)) return null;
        kept.add(o.node);
        return o.node;
      });
      const dropped = v.roots.filter((r) => !kept.has(r));
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
        } else {
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
      if (drop.size || add.length) {
        let lo = Infinity;
        let hi = -Infinity;
        for (const r of drop) {
          lo = Math.min(lo, tr.changes.mapPos(r.from, -1));
          hi = Math.max(hi, tr.changes.mapPos(r.to, 1));
        }
        decos = decos.update({
          add,
          sort: true,
          filter: drop.size ? (_f, _t, d) => !drop.has(widgetNode(d)) : undefined,
          filterFrom: drop.size ? lo : undefined,
          filterTo: drop.size ? hi : undefined,
        });
      }
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

  const ed: LezerBlockEditor = {
    get view() {
      return view;
    },
    doc,
    language,
    renderer,
    options,
    roots: () => rootsSlot.nodes,
    insertText(slot, index, snippet) {
      if (slot.nodes.length === 0) {
        if (slot.owner === program) {
          dispatch({ from: 0, to: 0, insert: snippet + (view.state.doc.length ? "\n" : "") });
          return;
        }
        throw new Error("insert into an empty list: where it goes needs a rule per language");
      }
      dispatch(insertChange(table, currentText(), slot, index, snippet));
    },
    removeNode(node) {
      if (!node.slot) throw new Error("not removable");
      if (node.slot.kind === "one") dispatch({ from: node.from, to: node.to, insert: table.blank ?? "..." });
      else dispatch(removeChange(node));
    },
    replaceText(node, snippet) {
      dispatch({ from: node.from, to: node.to, insert: snippet });
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
    },
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

const FIELDS = ["kind", "from", "to", "value", "dataType", "keyword", "keywordTo", "brackets"] as const;

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
    if (!freshR.element(r).isEqualNode(el)) say(`root ${r.id}: its DOM is not what a fresh drawing gives`);
  }
  return problems;
}
