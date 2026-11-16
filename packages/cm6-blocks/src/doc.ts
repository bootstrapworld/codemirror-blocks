/*
 * The document model: one mutable tree and the three operations that change it.
 * Each operation says exactly what changed (one TextChange, one TreeChange),
 * fixes the positions of every other node for that one change, and touches no
 * DOM and no editor. `checkDoc` is the oracle: it parses the text afresh and
 * compares it with the live tree.
 */
import { BNode, Doc, Language, OpResult, Slot, TextChange } from "./types";
import { makeNode } from "./wescheme";

/* ---------------------------------------------------------------- creation */

function link(owner: BNode, slotName: string, nodes: BNode[]): void {
  const slot = owner.slots.find((s) => s.name === slotName) as Slot;
  for (const n of nodes) {
    n.parent = owner;
    n.slot = slot;
    slot.nodes.push(n);
  }
}

export function createDoc(language: Language, text: string): Doc {
  const program = makeNode("program", [["roots", "list"]], {
    from: 0,
    to: text.length,
  });
  link(program, "roots", language.parse(text));
  const doc: Doc = { language, program, byId: new Map() };
  walk(program, (n) => doc.byId.set(n.id, n));
  return doc;
}

/* ------------------------------------------------------------------ access */

/** All the children of a node, in text order. */
export function children(node: BNode): BNode[] {
  const out: BNode[] = [];
  for (const slot of node.slots) for (const n of slot.nodes) out.push(n);
  return out;
}

/** `fn` on the node and all its descendants, parents first, in text order. */
export function walk(node: BNode, fn: (n: BNode) => void): void {
  fn(node);
  for (const slot of node.slots) for (const n of slot.nodes) walk(n, fn);
}

/** Where the node is in its slot (-1 for the program). */
export function indexInSlot(node: BNode): number {
  return node.slot ? node.slot.nodes.indexOf(node) : -1;
}

/** The node just before position (slot, index) in text order: in the slot, else in the closest earlier slot that has one. */
function prevInText(slot: Slot, index: number): BNode | null {
  if (index > 0) return slot.nodes[index - 1];
  const slots = slot.owner.slots;
  for (let i = slots.indexOf(slot) - 1; i >= 0; i--) {
    const nodes = slots[i].nodes;
    if (nodes.length > 0) return nodes[nodes.length - 1];
  }
  return null;
}

/** The node just after position (slot, index) (the one at `index` itself if there is one). */
function nextInText(slot: Slot, index: number): BNode | null {
  if (index < slot.nodes.length) return slot.nodes[index];
  const slots = slot.owner.slots;
  for (let i = slots.indexOf(slot) + 1; i < slots.length; i++) {
    if (slots[i].nodes.length > 0) return slots[i].nodes[0];
  }
  return null;
}

/** Where the text before position (slot, index) ends, if it is a child or a keyword; null if it is the open bracket. */
function prevEnd(slot: Slot, index: number): number | null {
  const prev = prevInText(slot, index);
  if (prev) return prev.to;
  const owner = slot.owner;
  return owner.keywordTo !== undefined ? owner.keywordTo : null;
}

/* ------------------------------------------------------------------- text */

export function applyText(text: string, change: TextChange): string {
  return text.slice(0, change.from) + change.insert + text.slice(change.to);
}

/**
 * Fix every node's offsets for one change of the text. `change` is in the
 * coordinates of the text before it; `skip` is a node (with its descendants)
 * that is already placed in the coordinates after it, and is left alone.
 *
 * - a node wholly at or after `change.to` moves by delta = insert.length - (to - from);
 * - a node that contains the change (it starts at or before change.from and
 *   ends after it) grows by delta;
 * - a node wholly before change.from is not touched. An insertion exactly at a
 *   node's end does not grow it; one exactly at its start pushes it right;
 * - a node that STRADDLES one end of the change (one end of it is strictly
 *   inside the replaced range) cannot come out of the operations in this file,
 *   since they only replace or delete whole nodes (with separators between
 *   them); it is cleaned up here anyway: its start inside the range moves to
 *   the end of the inserted text, its end inside the range moves to the start
 *   of the change. (Typing in the editor will want a smarter rule.)
 * - the program always starts at 0 and ends at the end of the text.
 */
export function shift(doc: Doc, change: TextChange, skip?: BNode): void {
  const delta = change.insert.length - (change.to - change.from);
  const fromPos = (x: number): number => {
    if (x >= change.to) return x + delta;
    if (x > change.from) return change.from + change.insert.length;
    return x;
  };
  const toPos = (x: number): number => {
    if (x > change.from) {
      return x >= change.to ? x + delta : change.from;
    }
    return x;
  };
  const fix = (n: BNode): void => {
    if (n === skip) return;
    if (n.parent === null) {
      n.from = 0;
      n.to += delta;
    } else {
      // wholly before the change: nothing in it moves
      if (n.to <= change.from) return;
      n.from = fromPos(n.from);
      n.to = toPos(n.to);
      if (n.keywordTo !== undefined) n.keywordTo = toPos(n.keywordTo);
    }
    for (const slot of n.slots) for (const c of slot.nodes) fix(c);
  };
  fix(doc.program);
}

/* -------------------------------------------------------------- operations */

function addIds(doc: Doc, node: BNode): void {
  walk(node, (n) => doc.byId.set(n.id, n));
}
function dropIds(doc: Doc, node: BNode): void {
  walk(node, (n) => doc.byId.delete(n.id));
}

/** same kinds and slot layout, so that positions can be copied from one to the other */
function sameShape(a: BNode, b: BNode): boolean {
  if (a.kind !== b.kind || a.slots.length !== b.slots.length) return false;
  for (let i = 0; i < a.slots.length; i++) {
    const x = a.slots[i];
    const y = b.slots[i];
    if (x.name !== y.name || x.nodes.length !== y.nodes.length) return false;
    for (let j = 0; j < x.nodes.length; j++) {
      if (!sameShape(x.nodes[j], y.nodes[j])) return false;
    }
  }
  return true;
}
function copyPositions(a: BNode, b: BNode): void {
  a.from = b.from;
  a.to = b.to;
  if (b.keywordTo !== undefined) a.keywordTo = b.keywordTo;
  else delete a.keywordTo;
  for (let i = 0; i < a.slots.length; i++) {
    for (let j = 0; j < a.slots[i].nodes.length; j++) {
      copyPositions(a.slots[i].nodes[j], b.slots[i].nodes[j]);
    }
  }
}

/**
 * Give a detached node (and its descendants) the offsets it has when `text` is
 * written at `start`: the printed text is read back, and its positions copied.
 * Throws, before anything is changed, if the text reads back as another shape
 * (a node whose printed form is a different kind of node, say).
 */
function place(doc: Doc, node: BNode, text: string, start: number): () => void {
  let back = doc.language.parse(text, start);
  if (back.length === 1 && !sameShape(node, back[0]) && doc.language.parseAs) {
    const as = doc.language.parseAs(node.kind, text, start);
    if (as) back = [as];
  }
  if (back.length !== 1 || !sameShape(node, back[0])) {
    throw new Error(
      `cannot place a node whose text "${text}" does not read back as itself`
    );
  }
  return () => copyPositions(node, back[0]);
}

const ATOM_START = /^[^()\[\]{}",'`;\s]/;
const ATOM_END = /[^()\[\]{}",'`;\s"]$/;

export function insertNode(
  doc: Doc,
  slot: Slot,
  index: number,
  node: BNode
): OpResult {
  if (slot.kind !== "list") throw new Error(`slot ${slot.name} is not a list`);
  const nodes = slot.nodes;
  if (index < 0 || index > nodes.length) throw new Error("index out of range");
  const owner = slot.owner;
  const isRoots = owner.parent === null;
  const text = doc.language.print(node);
  let pos: number;
  let before = ""; // separator before the node's text
  let after = ""; // separator after it
  if (nodes.length > 0 && index > 0) {
    pos = nodes[index - 1].to;
    before = isRoots ? "\n" : " ";
  } else if (nodes.length > 0) {
    pos = nodes[0].from;
    // text before it that touches it (`f` in `(f(g))`) must not run into the new text
    if (!isRoots && prevEnd(slot, 0) === pos) before = " ";
    after = isRoots ? "\n" : " ";
  } else {
    const prev = prevInText(slot, 0);
    if (prev) {
      pos = prev.to;
      before = " ";
    } else if (owner.keywordTo !== undefined) {
      pos = owner.keywordTo;
      before = " ";
    } else if (isRoots) {
      pos = 0;
      // a document with only comments in it: keep them on their own lines
      after = owner.to === 0 ? "" : "\n";
    } else {
      pos = owner.from + 1;
    }
  }
  const change: TextChange = { from: pos, to: pos, insert: before + text + after };
  const apply = place(doc, node, text, pos + before.length);

  nodes.splice(index, 0, node);
  node.parent = owner;
  node.slot = slot;
  shift(doc, change, node);
  apply();
  addIds(doc, node);
  return { text: change, tree: { type: "insert", node, slot, index } };
}

export function removeNode(doc: Doc, node: BNode): OpResult {
  const slot = node.slot;
  const owner = node.parent;
  if (!slot || !owner) throw new Error("the program cannot be removed");
  if (slot.kind === "one") {
    return replaceNode(doc, node, doc.language.blank());
  }
  const index = slot.nodes.indexOf(node);
  const prev = index > 0 ? slot.nodes[index - 1] : null;
  const next = index < slot.nodes.length - 1 ? slot.nodes[index + 1] : null;
  let change: TextChange;
  if (prev && !(next && next.from === node.to)) {
    // the separator before it goes with it
    change = { from: prev.to, to: node.to, insert: "" };
  } else if (next) {
    // (also when it touches the next one, as in `(a)b`: deleting the separator
    // before it would run `a` into `b`)
    const pe = prevEnd(slot, index);
    change = {
      from: node.from,
      to: next.from,
      insert: pe !== null && pe === node.from ? " " : "",
    };
  } else if (owner.parent === null) {
    change = { from: node.from, to: node.to, insert: "" };
  } else {
    const pe = prevEnd(slot, index);
    change = { from: pe !== null ? pe : owner.from + 1, to: node.to, insert: "" };
  }
  slot.nodes.splice(index, 1);
  dropIds(doc, node);
  shift(doc, change);
  return { text: change, tree: { type: "remove", node, slot, index } };
}

export function replaceNode(doc: Doc, old: BNode, node: BNode): OpResult {
  const slot = old.slot;
  const owner = old.parent;
  if (!slot || !owner) throw new Error("the program cannot be replaced");
  const index = slot.nodes.indexOf(old);
  const text = doc.language.print(node);
  // an atom must not run into an atom that touched the old node
  const pe = prevEnd(slot, index);
  const nx = nextInText(slot, index + 1);
  const before = pe !== null && pe === old.from && ATOM_START.test(text) ? " " : "";
  const after = nx && nx.from === old.to && ATOM_END.test(text) ? " " : "";
  const change: TextChange = {
    from: old.from,
    to: old.to,
    insert: before + text + after,
  };
  const apply = place(doc, node, text, old.from + before.length);

  slot.nodes[index] = node;
  node.parent = owner;
  node.slot = slot;
  dropIds(doc, old);
  shift(doc, change, node);
  apply();
  addIds(doc, node);
  return { text: change, tree: { type: "replace", old, node, slot, index } };
}

/* ------------------------------------------------------------------ oracle */

const FIELDS = [
  "kind",
  "from",
  "to",
  "value",
  "dataType",
  "keyword",
  "keywordTo",
  "brackets",
] as const;

/**
 * Parse `text` afresh and compare it with the live tree, node by node (kinds,
 * slots, values, offsets), check the parent/slot links and that `byId` holds
 * exactly the nodes of the tree. Returns the problems found; empty is fine.
 */
export function checkDoc(doc: Doc, text: string): string[] {
  const problems: string[] = [];
  const say = (m: string) => {
    if (problems.length < 30) problems.push(m);
  };
  let fresh: BNode[];
  try {
    fresh = doc.language.parse(text);
  } catch (e) {
    return [`the text does not parse: ${(e as Error).message}`];
  }
  const prog = doc.program;
  if (prog.kind !== "program") say("the root is not a program");
  if (prog.from !== 0 || prog.to !== text.length) {
    say(`program range [${prog.from},${prog.to}) but the text has ${text.length}`);
  }
  if (prog.parent !== null || prog.slot !== null) say("program has a parent");
  if (prog.slots.length !== 1 || prog.slots[0].name !== "roots") {
    say("program slots are not [roots]");
    return problems;
  }

  const compareList = (live: BNode[], ref: BNode[], path: string): void => {
    if (live.length !== ref.length) {
      say(`${path}: ${live.length} nodes, the text has ${ref.length}`);
      return;
    }
    live.forEach((l, i) => compare(l, ref[i], `${path}[${i}]`));
  };
  const compare = (live: BNode, ref: BNode, path: string): void => {
    for (const f of FIELDS) {
      if (live[f] !== ref[f]) {
        say(`${path}: ${f} is ${String(live[f])}, the text says ${String(ref[f])}`);
        return;
      }
    }
    if (live.slots.length !== ref.slots.length) {
      say(`${path}: ${live.slots.length} slots, the text has ${ref.slots.length}`);
      return;
    }
    live.slots.forEach((ls, i) => {
      const rs = ref.slots[i];
      if (ls.name !== rs.name || ls.kind !== rs.kind) {
        say(`${path}: slot ${i} is ${ls.name}/${ls.kind}, the text has ${rs.name}/${rs.kind}`);
        return;
      }
      if (ls.kind === "one" && ls.nodes.length !== 1) {
        say(`${path}.${ls.name}: a "one" slot holds ${ls.nodes.length} nodes`);
      }
      compareList(ls.nodes, rs.nodes, `${path}.${ls.name}`);
    });
  };
  compareList(prog.slots[0].nodes, fresh, "roots");

  // links and ids
  const seen = new Set<BNode>();
  const links = (n: BNode, path: string): void => {
    if (seen.has(n)) {
      say(`${path}: the node is in the tree twice`);
      return;
    }
    seen.add(n);
    if (doc.byId.get(n.id) !== n) say(`${path}: byId does not hold node ${n.id}`);
    for (const slot of n.slots) {
      if (slot.owner !== n) say(`${path}.${slot.name}: slot owner is wrong`);
      slot.nodes.forEach((c, i) => {
        const p = `${path}.${slot.name}[${i}]`;
        if (c.parent !== n) say(`${p}: parent link is wrong`);
        if (c.slot !== slot) say(`${p}: slot link is wrong`);
        links(c, p);
      });
    }
  };
  links(prog, "program");
  if (doc.byId.size !== seen.size) {
    say(`byId holds ${doc.byId.size} nodes, the tree has ${seen.size}`);
  }
  return problems;
}
