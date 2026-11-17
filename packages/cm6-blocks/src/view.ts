/*
 * EXPERIMENT. The CodeMirror 6 layer: one EditorView, one mutable tree, and the
 * page of each top-level form drawn once and patched in place.
 *
 * Three things have to stay in step at every moment CodeMirror draws: the text,
 * the tree (doc.ts) and the widgets (one replace decoration per drawn root,
 * whose DOM is the renderer's element for that root). The rules:
 *
 * - An OPERATION (insert/remove/replace) changes the tree first (doc.ts says
 *   what changed and fixes every position), then `settle` reads the changed
 *   node again, then the renderer patches the page for each TreeChange, and only
 *   then ONE transaction is dispatched: the text change, an effect that adds and
 *   drops root decorations, and an annotation that marks it as ours.
 *   Why this order: CodeMirror calls `toDOM`/`updateDOM` while it dispatches;
 *   by then the tree is final and every element it can be handed is already
 *   patched, so it never sees a widget whose element is stale. The reverse
 *   order would let `toDOM` build an element for a node from a tree that is
 *   about to change under it, and patch it twice.
 *
 * - Any other transaction that changes the text (typing, a paste, undo, redo,
 *   an outside dispatch) goes through `dispatchTransactions` (the view's own
 *   hook for it), where the transactions are final (no filter can change them
 *   any more, so mutating the tree there is safe: a transactionExtender or a
 *   filter may run for a transaction that is never dispatched). For each changed
 *   range, `reparseChange` fixes the tree and the renderer is told; the
 *   decoration changes go in ONE extra transaction (effects only) that is handed
 *   to `view.update` in the same array, so CodeMirror draws once, from the final
 *   state: it never draws the text change with the old decorations.
 *
 * The widgets keep the element of their node: `toDOM` returns the renderer's
 * element (the same one every time), and `updateDOM` answers true only for that
 * element (CodeMirror offers ANY old widget DOM of the class to a widget that is
 * not `eq` to it: answering true for another node's element would show the wrong block).
 */
import {
  Annotation,
  ChangeSet,
  Compartment,
  EditorState,
  Extension,
  StateEffect,
  StateField,
  Text,
  Transaction,
} from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  WidgetType,
  keymap,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  isolateHistory,
} from "@codemirror/commands";
import {
  checkDoc,
  createDoc,
  insertNode,
  removeNode,
  replaceNode,
  reparseChange,
  settle,
} from "./doc";
import { Renderer } from "./render";
import {
  BNode,
  Doc,
  Language,
  OpResult,
  ParseError,
  Slot,
  TextChange,
  TextSource,
  TreeChange,
} from "./types";

export interface BlockEditor {
  readonly view: EditorView;
  readonly doc: Doc;
  readonly renderer: Renderer;
  /** run one of the operations of doc.ts as ONE CodeMirror transaction (one undo step) */
  insert(slot: Slot, index: number, node: BNode): void;
  remove(node: BNode): void;
  replace(old: BNode, node: BNode): void;
  /** parse a snippet into detached nodes (throws ParseError) */
  parse(text: string): BNode[];
  /** give keyboard focus to a node's element (scrolling it into view) */
  focusNode(node: BNode): void;
  /** the node that has keyboard focus, if a block has it */
  focusedNode(): BNode | null;
  /** block mode on or off (off: plain text, the tree is still kept up to date) */
  setBlockMode(on: boolean): void;
  /** counters for the experiment */
  stats(): {
    ops: number;
    reparses: number;
    widgetsBuilt: number;
    focusRestores: number;
  };
  destroy(): void;
}

/* ------------------------------------------------------------ the widgets */

interface Counters {
  ops: number;
  reparses: number;
  widgetsBuilt: number;
  focusRestores: number;
}

export class RootWidget extends WidgetType {
  constructor(
    readonly node: BNode,
    readonly renderer: Renderer,
    private counters?: Counters
  ) {
    super();
  }
  eq(other: RootWidget): boolean {
    return other.node === this.node;
  }
  toDOM(): HTMLElement {
    if (this.counters) this.counters.widgetsBuilt++;
    return this.renderer.element(this.node);
  }
  /** our element is already right (the renderer patched it); true only for OUR element */
  updateDOM(dom: HTMLElement): boolean {
    return (
      this.renderer.has(this.node) && this.renderer.element(this.node) === dom
    );
  }
  ignoreEvent(): boolean {
    return true;
  }
  destroy(): void {
    /* the renderer owns the element */
  }
}

/* ------------------------------------------------- decorations of the roots */

/** what changes in the set of root decorations; positions are in the document AFTER the transaction */
interface RootsChange {
  drop: ReadonlySet<BNode>;
  add: { from: number; to: number; deco: Decoration }[];
  /** the range in which the dropped decorations are looked for */
  lo: number;
  hi: number;
}

const rootsEffect = StateEffect.define<RootsChange>({
  map: (v, m) => ({
    drop: v.drop,
    add: v.add.map((a) => ({
      from: m.mapPos(a.from, 1),
      to: m.mapPos(a.to, -1),
      deco: a.deco,
    })),
    lo: m.mapPos(v.lo, -1),
    hi: m.mapPos(v.hi, 1),
  }),
});

function widgetNode(deco: Decoration): BNode {
  return (deco.spec.widget as RootWidget).node;
}

/**
 * The decorations of the drawn roots. NOT rebuilt from the tree: mapped through
 * the changes of each transaction, and changed by `rootsEffect`.
 */
const rootsField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(set, tr) {
    if (tr.docChanged) set = set.map(tr.changes);
    for (const e of tr.effects) {
      if (!e.is(rootsEffect)) continue;
      const c = e.value;
      set = set.update({
        add: c.add.map((a) => a.deco.range(a.from, a.to)),
        sort: true,
        filter:
          c.drop.size > 0
            ? (_f, _t, deco) => !c.drop.has(widgetNode(deco))
            : undefined,
        filterFrom: c.lo,
        filterTo: c.hi,
      });
    }
    return set;
  },
});

/** accumulates RootsChanges (the later one wins nothing: they are about different nodes) */
class RootsBuilder {
  drop = new Set<BNode>();
  add: { from: number; to: number; deco: Decoration }[] = [];
  lo = Infinity;
  hi = -Infinity;
  touch(a: number, b: number): void {
    this.lo = Math.min(this.lo, a);
    this.hi = Math.max(this.hi, b);
  }
  get empty(): boolean {
    return this.drop.size === 0 && this.add.length === 0;
  }
  build(): RootsChange {
    return { drop: this.drop, add: this.add, lo: this.lo, hi: this.hi };
  }
}

function mapChange(c: RootsChange, m: ChangeSet): RootsChange {
  return {
    drop: c.drop,
    add: c.add.map((a) => ({
      from: m.mapPos(a.from, 1),
      to: m.mapPos(a.to, -1),
      deco: a.deco,
    })),
    lo: m.mapPos(c.lo, -1),
    hi: m.mapPos(c.hi, 1),
  };
}

function sourceOf(doc: Text): TextSource {
  return { length: doc.length, slice: (a, b) => doc.sliceString(a, b) };
}

const ownTx = Annotation.define<boolean>();

/* ------------------------------------------------------------ the editor */

interface Internals {
  compartment: Compartment;
  blockMode: boolean;
}
const internals = new WeakMap<BlockEditor, Internals>();

interface FocusSnapshot {
  node: BNode;
  /** (slot index, index in slot) from the roots down to the node */
  path: [number, number][];
}

export function createBlockEditor(
  parent: HTMLElement,
  text: string,
  language: Language
): BlockEditor {
  const renderer = new Renderer(language);
  const counters: Counters = {
    ops: 0,
    reparses: 0,
    widgetsBuilt: 0,
    focusRestores: 0,
  };
  let doc: Doc;
  try {
    doc = createDoc(language, text);
  } catch (e) {
    if (!(e instanceof ParseError)) throw e;
    // a text that does not parse: error roots, read the way an edit is
    doc = createDoc(language, "");
    reparseChange(doc, text, { from: 0, to: 0, insert: text });
  }
  const drawn = (n: BNode): boolean =>
    n.kind !== "error" && n.kind !== "program";
  const decoFor = (n: BNode): Decoration =>
    Decoration.replace({ widget: new RootWidget(n, renderer, counters) });
  const initial: DecorationSet = Decoration.set(
    doc.program.slots[0].nodes
      .filter(drawn)
      .map((n) => decoFor(n).range(n.from, n.to)),
    true
  );

  const compartment = new Compartment();
  const blockExtension: Extension = [
    EditorView.decorations.from(rootsField),
    EditorView.atomicRanges.of((v) => v.state.field(rootsField)),
    EditorView.contentAttributes.of({ role: "tree", "aria-label": "program" }),
  ];

  let pendingSnapshot: FocusSnapshot | null = null;
  // eslint-disable-next-line prefer-const -- read by closures made before the view exists
  let view: EditorView;
  let gone = false;

  /* ---- keeping the three in step: tree changes -> renderer and decorations */

  /** apply TreeChanges of the roots' list to a RootsBuilder (positions are the ones now in the tree) */
  function noteRoots(
    b: RootsBuilder,
    c: TreeChange,
    mapOld: (n: number) => number
  ): void {
    if (c.slot.owner.kind !== "program") return;
    const gone = (n: BNode): void => {
      b.drop.add(n);
      b.touch(mapOld(n.from), mapOld(n.to));
    };
    const here = (n: BNode): void => {
      if (!drawn(n)) return;
      b.add.push({ from: n.from, to: n.to, deco: decoFor(n) });
      b.touch(n.from, n.to);
    };
    if (c.type === "insert") here(c.node);
    else if (c.type === "remove") gone(c.node);
    else {
      gone(c.old);
      here(c.node);
    }
  }

  /** Is the node, or a node above it, one of those that a settle change replaced? */
  function swallowed(c: TreeChange, replaced: Set<BNode>): boolean {
    for (let n: BNode | null = c.slot.owner; n; n = n.parent)
      if (replaced.has(n)) return true;
    return false;
  }

  /**
   * The renderer, for TreeChanges that are already in the tree. Changes inside
   * a node that a later change replaces are not applied (the replacement is
   * built whole); the nodes they took out are forgotten. A replaced ROOT is
   * done as remove + insert: the renderer's own replace would swap the element
   * inside the line that CodeMirror owns.
   */
  function patchRenderer(changes: TreeChange[]): void {
    const replaced = new Set<BNode>();
    for (const c of changes)
      if (c.type === "replace" && c !== changes[0]) replaced.add(c.old);
    // (changes[0] is the operation's own; a replace there is not a settle)
    for (const c of changes) {
      if (swallowed(c, replaced)) {
        if (c.type === "remove") renderer.forget(c.node);
        else if (c.type === "replace") renderer.forget(c.old);
        continue;
      }
      if (c.type === "replace" && c.slot.owner.kind === "program") {
        renderer.apply({
          type: "remove",
          node: c.old,
          slot: c.slot,
          index: c.index,
        });
        renderer.apply({
          type: "insert",
          node: c.node,
          slot: c.slot,
          index: c.index,
        });
      } else {
        renderer.apply(c);
      }
    }
  }

  /* ---- operations */

  function run(op: () => OpResult): void {
    pendingSnapshot = takeSnapshot();
    let res: OpResult;
    try {
      res = op();
    } catch (e) {
      pendingSnapshot = null;
      throw e;
    }
    counters.ops++;
    const t = res.text;
    const after = view.state.doc.replace(
      t.from,
      t.to,
      Text.of(t.insert.split("\n"))
    );
    const settled = settle(doc, sourceOf(after), res.tree.slot.owner);
    const changes: TreeChange[] = [res.tree, ...settled];
    patchRenderer(changes);

    const b = new RootsBuilder();
    b.touch(t.from, t.from + t.insert.length);
    const cs = ChangeSet.of(t, view.state.doc.length);
    // the node the operation took out still has the positions it had before the change
    changes.forEach((c, i) =>
      noteRoots(b, c, i === 0 ? (n) => cs.mapPos(n, 1) : (n) => n)
    );
    view.dispatch({
      changes: t,
      effects: b.empty ? [] : [rootsEffect.of(b.build())],
      annotations: [ownTx.of(true), isolateHistory.of("full")],
      userEvent: "input.block",
    });
  }

  /** reparse for one transaction that is not ours; the changes of the roots, in the coordinates after it */
  function reparseTransaction(tr: Transaction, b: RootsBuilder): void {
    const specs: TextChange[] = [];
    tr.changes.iterChanges((fa, ta, _fb, _tb, ins) =>
      specs.push({ from: fa, to: ta, insert: ins.toString() })
    );
    // last range first: the offsets of the ones before it are still those of the old text
    let d = tr.startState.doc;
    let pending = new RootsBuilder();
    for (let k = specs.length - 1; k >= 0; k--) {
      const c = specs[k];
      const cs = ChangeSet.of(c, d.length);
      d = d.replace(c.from, c.to, Text.of(c.insert.split("\n")));
      const changes = reparseChange(doc, sourceOf(d), c);
      counters.reparses++;
      patchRenderer(changes);
      // what this step says, in the coordinates of `d`; moved on by the steps still to come (all before it)
      const step = new RootsBuilder();
      step.touch(c.from, c.from + c.insert.length);
      for (const ch of changes) noteRoots(step, ch, (n) => cs.mapPos(n, 1));
      // (the ranges before this one are not affected by it: the earlier steps move what is after them)
      for (const x of step.drop) pending.drop.add(x);
      pending.add.push(...step.add);
      pending.touch(step.lo, step.hi);
      if (k > 0) {
        // the next step's change is in the coordinates of `d` as well, and moves what is after it
        const next = ChangeSet.of(specs[k - 1], d.length);
        const mapped = mapChange(pending.build(), next);
        const nb = new RootsBuilder();
        mapped.drop.forEach((x) => nb.drop.add(x));
        nb.add = mapped.add;
        nb.lo = mapped.lo;
        nb.hi = mapped.hi;
        pending = nb;
      }
    }
    for (const x of pending.drop) b.drop.add(x);
    b.add.push(...pending.add);
    b.touch(pending.lo, pending.hi);
  }

  function dispatchTransactions(
    trs: readonly Transaction[],
    v: EditorView
  ): void {
    const snapshot = pendingSnapshot ?? takeSnapshot();
    pendingSnapshot = null;
    // changes of the text made by anything but us: read the tree again
    const parts: { b: RootsBuilder; at: number }[] = [];
    trs.forEach((tr, at) => {
      if (!tr.docChanged || tr.annotation(ownTx)) return;
      const b = new RootsBuilder();
      reparseTransaction(tr, b);
      if (!b.empty) parts.push({ b, at });
    });
    let all: readonly Transaction[] = trs;
    if (parts.length > 0) {
      // all of them in the coordinates after the last transaction
      const merged = new RootsBuilder();
      for (const { b, at } of parts) {
        let c = b.build();
        for (let j = at + 1; j < trs.length; j++)
          c = mapChange(c, trs[j].changes);
        c.drop.forEach((x) => merged.drop.add(x));
        merged.add.push(...c.add);
        merged.touch(c.lo, c.hi);
      }
      const last = trs[trs.length - 1].state;
      all = [
        ...trs,
        last.update({
          effects: [rootsEffect.of(merged.build())],
          annotations: [Transaction.addToHistory.of(false)],
        }),
      ];
    }
    v.update(all);
    restoreFocus(snapshot);
  }

  /* ---- focus */

  function isDrawn(n: BNode): boolean {
    return drawn(n) && renderer.has(n) && renderer.element(n).isConnected;
  }

  function takeSnapshot(): FocusSnapshot | null {
    if (!view) return null;
    const active = view.dom.ownerDocument.activeElement;
    if (!active || !view.contentDOM.contains(active)) return null;
    const node = renderer.nodeOf(active);
    if (!node || doc.byId.get(node.id) !== node) return null;
    const path: [number, number][] = [];
    for (let n: BNode = node; n.parent && n.slot; n = n.parent) {
      path.unshift([n.parent.slots.indexOf(n.slot), n.slot.nodes.indexOf(n)]);
    }
    return { node, path };
  }

  /** the node to give the focus back to: the same one, else the one at its place, else the one before, else the parent */
  function resolve(s: FocusSnapshot): BNode | null {
    let target: BNode | null = null;
    if (doc.byId.get(s.node.id) === s.node) {
      target = s.node;
    } else {
      let owner: BNode = doc.program;
      for (const [si, idx] of s.path) {
        const slot = owner.slots[si];
        if (!slot || slot.nodes.length === 0) {
          target = owner;
          break;
        }
        if (idx >= slot.nodes.length) {
          target = slot.nodes[slot.nodes.length - 1];
          break;
        }
        owner = slot.nodes[idx];
        target = owner;
      }
    }
    while (target && !isDrawn(target)) target = target.parent;
    return target && target.kind !== "program" ? target : null;
  }

  function restoreFocus(s: FocusSnapshot | null): void {
    if (!s || gone) return;
    const active = view.dom.ownerDocument.activeElement;
    if (active && view.contentDOM.contains(active) && renderer.nodeOf(active))
      return;
    const target = resolve(s);
    if (!target) return;
    counters.focusRestores++;
    renderer.element(target).focus();
  }

  /* ---- the editor */

  const ed: BlockEditor = {
    get view() {
      return view;
    },
    doc,
    renderer,
    insert: (slot, index, node) =>
      run(() => insertNode(doc, slot, index, node)),
    remove: (node) => run(() => removeNode(doc, node)),
    replace: (old, node) => run(() => replaceNode(doc, old, node)),
    parse: (t) => language.parse(t),
    focusNode(node) {
      if (!isDrawn(node)) return;
      const el = renderer.element(node);
      el.focus();
      if (typeof el.scrollIntoView === "function")
        el.scrollIntoView({ block: "nearest", inline: "nearest" });
    },
    focusedNode() {
      const active = view.dom.ownerDocument.activeElement;
      if (!active || !view.contentDOM.contains(active)) return null;
      return renderer.nodeOf(active);
    },
    setBlockMode(on) {
      const inner = internals.get(ed) as Internals;
      if (inner.blockMode === on) return;
      inner.blockMode = on;
      view.dispatch({
        effects: compartment.reconfigure(on ? blockExtension : []),
      });
    },
    stats: () => ({ ...counters }),
    destroy() {
      gone = true;
      view.destroy();
    },
  };
  internals.set(ed, { compartment, blockMode: true });

  view = new EditorView({
    parent,
    state: EditorState.create({
      doc: text,
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        rootsField.init(() => initial),
        compartment.of(blockExtension),
      ],
    }),
    dispatchTransactions,
  });
  return ed;
}

/* ------------------------------------------------------------- the checker */

/**
 * Every disagreement between the text, the tree, the decorations and the page
 * that can be seen from outside; empty is fine.
 */
export function checkEditor(ed: BlockEditor): string[] {
  const problems: string[] = [];
  const say = (m: string) => {
    if (problems.length < 30) problems.push(m);
  };
  const state = ed.view.state;
  const text = state.doc.toString();
  problems.push(...checkDoc(ed.doc, text));

  const set = state.field(rootsField);
  const decos: { from: number; to: number; node: BNode }[] = [];
  set.between(0, state.doc.length, (from, to, deco) => {
    decos.push({ from, to, node: widgetNode(deco) });
  });
  const roots = ed.doc.program.slots[0].nodes;
  const byNode = new Map<BNode, { from: number; to: number }[]>();
  for (const d of decos) {
    const list = byNode.get(d.node) ?? [];
    list.push(d);
    byNode.set(d.node, list);
  }
  for (const d of decos) {
    if (!roots.includes(d.node))
      say(
        `a decoration [${d.from},${d.to}) for node ${d.node.id}, which is not a root`
      );
  }
  const blockMode = (internals.get(ed) as Internals).blockMode;
  const vp = ed.view.viewport;
  let fresh: Renderer | null = null;
  for (const r of roots) {
    const mine = byNode.get(r) ?? [];
    if (r.kind === "error") {
      if (mine.length > 0) say(`error root ${r.id} has a decoration`);
      if (ed.renderer.has(r)) say(`error root ${r.id} has an element`);
      continue;
    }
    if (mine.length !== 1) {
      say(`root ${r.id} [${r.from},${r.to}) has ${mine.length} decorations`);
      continue;
    }
    if (mine[0].from !== r.from || mine[0].to !== r.to) {
      say(
        `root ${r.id}: the decoration is [${mine[0].from},${mine[0].to}), the node [${r.from},${r.to})`
      );
    }
    if (!ed.renderer.has(r)) {
      // only a root whose line is not drawn (or in plain mode) may have none yet
      if (blockMode && r.from >= vp.from && r.to <= vp.to)
        say(`root ${r.id} is in the viewport and has no element`);
      continue;
    }
    const el = ed.renderer.element(r);
    if (blockMode && r.from >= vp.from && r.to <= vp.to && !el.isConnected) {
      say(
        `root ${r.id} [${r.from},${r.to}) is in the viewport and its element is not in the document`
      );
    }
    if (!fresh) fresh = new Renderer(ed.doc.language);
    if (!fresh.element(r).isEqualNode(el))
      say(`root ${r.id}: its DOM is not what a fresh drawing gives`);
  }
  return problems;
}
