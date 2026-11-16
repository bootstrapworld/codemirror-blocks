/*
 * The document model: one mutable tree and the three operations that change it.
 * Each operation says exactly what changed (one TextChange, one TreeChange),
 * fixes the positions of every other node for that one change, and touches no
 * DOM and no editor. `checkDoc` is the oracle: it parses the text afresh and
 * compares it with the live tree.
 */
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
    // (text typed by hand can leave siblings touching: `()f`)
    if (index < nodes.length && nodes[index].from === pos) after = isRoots ? "\n" : " ";
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

/* ------------------------------------------------------------------ settle */

/** The node `node`'s own text, read again (a clause as a clause); null if it does not read as one node. */
function readAgain(doc: Doc, text: TextSource, node: BNode): BNode | null {
  const src = text.slice(node.from, node.to);
  try {
    if (node.kind === "clause") {
      return doc.language.parseAs ? doc.language.parseAs("clause", src, node.from) : null;
    }
    const nodes = doc.language.parse(src, node.from);
    return nodes.length === 1 ? nodes[0] : null;
  } catch (e) {
    if (e instanceof ParseError) return null;
    throw e;
  }
}

/** Same kind, keyword, brackets, slots (names, kinds, number of nodes in each) and, with no slots, the same value. */
function sameShallow(a: BNode, b: BNode): boolean {
  if (a.kind !== b.kind || a.keyword !== b.keyword || a.brackets !== b.brackets) return false;
  if (a.slots.length !== b.slots.length) return false;
  for (let i = 0; i < a.slots.length; i++) {
    const x = a.slots[i];
    const y = b.slots[i];
    if (x.name !== y.name || x.kind !== y.kind || x.nodes.length !== y.nodes.length) return false;
  }
  if (a.slots.length === 0) return a.value === b.value && a.dataType === b.dataType;
  return true;
}

/** `fresh` takes the place of `old` (same slot, same index). `old` keeps its own links. */
function swap(doc: Doc, old: BNode, fresh: BNode): TreeChange {
  const slot = old.slot as Slot;
  const index = slot.nodes.indexOf(old);
  slot.nodes[index] = fresh;
  fresh.parent = old.parent;
  fresh.slot = slot;
  dropIds(doc, old);
  addIds(doc, fresh);
  return { type: "replace", old, node: fresh, slot, index };
}

/**
 * The operations do not check that the text still reads as the tree says
 * (`()` that gains an element is a call; a call whose head becomes `define` is
 * a definition; a lambda that loses a part is a list). Call this after an
 * operation, with the text AFTER it and the node whose content changed (the
 * slot's owner): that node's own text is read again and compared shallowly
 * with the live node; if they differ, the fresh node replaces it, and the
 * check goes on with the parent (a clause's reading depends on its cond). A
 * node whose text does not parse at all sends the check to its parent. The
 * work is the size of the nodes read again.
 *
 * The new node comes with new children (their ids are new): whatever was
 * drawn for the old one is rebuilt.
 */
export function settle(doc: Doc, text: TextSource, at: BNode): TreeChange[] {
  const changes: TreeChange[] = [];
  let node: BNode | null = at;
  while (node && node.kind !== "program") {
    const fresh = readAgain(doc, text, node);
    if (fresh && sameShallow(node, fresh)) break;
    if (fresh) {
      changes.push(swap(doc, node, fresh));
      node = fresh.parent;
    } else {
      node = node.parent;
    }
  }
  return changes;
}

/* ---------------------------------------------------------------- reparse */

function tryParse(language: Language, src: string, offset: number): BNode[] | null {
  try {
    return language.parse(src, offset);
  } catch (e) {
    if (e instanceof ParseError) return null;
    throw e;
  }
}

/** the first index in [from, list.length) whose node satisfies `pred` (which must be false then true along the list) */
function firstIndex(list: BNode[], pred: (n: BNode) => boolean, from = 0): number {
  let lo = from;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (pred(list[mid])) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

/** the offset just after the first line break at or after `pos` (the end of the text if none) */
function lineEnd(text: TextSource, pos: number): number {
  let p = pos;
  while (p < text.length) {
    const chunk = text.slice(p, Math.min(text.length, p + 256));
    const k = chunk.indexOf("\n");
    if (k >= 0) return p + k + 1;
    p += chunk.length;
  }
  return text.length;
}

/**
 * Fix the tree for a change of the text that no operation made (typing, a
 * paste, an undo). `text` is the text AFTER the change, `change` is in the
 * coordinates of the text BEFORE it. Only the top-level forms the change
 * touches are read again.
 *
 * The window: from the end of the last root that ends strictly before the
 * change (a root that touches it is in the window: `a` and a typed `b` are
 * one atom), to the first root that starts at or after the end of the
 * change's last line (a `;` typed in a line comments out the rest of the
 * line; if the change ends at the start of a line, just its end). Both ends are between forms, where the reader is in its plain state.
 *
 *   (An error root is always inside the window of an edit next to it: it may end in
 *   the middle of a comment, which is not a place to start reading.)
 * - The window text parses: its roots replace the old ones, except that an
 *   old root keeps its object when it does not touch the change and the new
 *   reading has a root with the same range (shifted by the change if it is
 *   after it): same range, same text, same tree. Ids, and the page drawn for
 *   them, survive. (No old text is needed to know this.)
 * - It does not: the rest of the document, read from the window (or from the
 *   first error root, if that is earlier), is tried; if THAT parses, those
 *   roots replace the old ones (a typed `"` that pairs with a later one). Else
 *   the window becomes ONE root of kind "error" with the trimmed text of the
 *   window (none if the text is blank), and the roots outside are kept.
 *
 * Returns the TreeChanges to apply one at a time to a list of the roots:
 * removes (from the last), then inserts (from the first).
 *
 * Costs: a binary search for the window, the parse of the window, and a
 * `shift` of everything after the change (offsets are absolute). A window that
 * does not parse costs a parse of the rest of the document.
 */
export function reparseChange(doc: Doc, text: TextSource, change: TextChange): TreeChange[] {
  const language = doc.language;
  const slot = doc.program.slots[0];
  const list = slot.nodes;
  const delta = change.insert.length - (change.to - change.from);
  const endNew = change.from + change.insert.length;
  // a `;` before the end of the change comments out the rest of its line, unless the change ends at a line start
  const limit =
    endNew === 0 || text.slice(endNew - 1, endNew) === "\n" ? endNew : lineEnd(text, endNew);

  let bi = firstIndex(list, (n) => n.to >= change.from);
  // an error root may end inside a line comment: the window starts after the last root that is not one
  while (bi > 0 && list[bi - 1].kind === "error") bi--;
  const minFrom = Math.max(change.to, limit - delta);
  let ai = firstIndex(list, (n) => n.from >= minFrom, bi);
  let ws = bi > 0 ? list[bi - 1].to : 0;
  let we = ai < list.length ? list[ai].from + delta : text.length;

  // The rest of the document, from the first error root (or this window), read as whole forms: the
  // tail. A window that does not parse may belong to a form that ends later (a typed `"` pairs with
  // one further down); a window that parses may have been what kept the document from parsing
  // (a deleted stray bracket lets a `'` before it reach the form after it).
  const tailFrom = (): BNode[] | null => {
    const ei = list.findIndex((n) => n.kind === "error");
    const si = ei >= 0 && ei < bi ? ei : bi;
    const s2 = si > 0 ? list[si - 1].to : 0;
    const tail = tryParse(language, text.slice(s2, text.length), s2);
    if (tail !== null) {
      bi = si;
      ai = list.length;
      ws = s2;
      we = text.length;
    }
    return tail;
  };

  let fresh = tryParse(language, text.slice(ws, we), ws);
  if (fresh === null) {
    fresh = tailFrom();
    if (fresh === null) {
      const raw = text.slice(ws, we);
      const trimmed = raw.trim();
      const lead = raw.length - raw.trimStart().length;
      fresh = trimmed
        ? [
            makeNode("error", [], {
              value: trimmed,
              from: ws + lead,
              to: ws + lead + trimmed.length,
            }),
          ]
        : [];
    }
  } else if (list.slice(bi, ai).some((n) => n.kind === "error")) {
    // an error root was in the window, and is not any more; is there another error root left that this repairs?
    if (list.some((n, i) => n.kind === "error" && (i < bi || i >= ai))) {
      const tail = tailFrom();
      if (tail !== null) fresh = tail;
    }
  }

  // Keep the old objects that the new reading has again: a root that does not touch the change, and
  // is a root again at the same range (shifted by the change if it is after it) is the same text, so
  // the same tree. Both lists are in text order, so one pass pairs them.
  const old = list.slice(bi, ai);
  const pair: (BNode | null)[] = fresh.map(() => null); // the old node kept for fresh[j]
  const kept = new Set<BNode>();
  for (let i = 0, j = 0; i < old.length && j < fresh.length; ) {
    const o = old[i];
    const n = fresh[j];
    let want: number | null = null; // where it would start now
    if (o.kind !== "error") {
      if (o.to <= change.from) want = o.from;
      else if (o.from >= change.to) want = o.from + delta;
    }
    if (want === null) {
      i++;
    } else if (n.from < want) {
      j++;
    } else if (n.from > want) {
      i++;
    } else if (n.kind !== "error" && n.to - n.from === o.to - o.from) {
      pair[j] = o;
      kept.add(o);
      i++;
      j++;
    } else {
      i++;
    }
  }

  // the old roots of the window leave; the kept ones are put back, moved
  list.splice(bi, old.length);
  for (const o of old) if (!kept.has(o)) dropIds(doc, o);
  shift(doc, change); // everything after the window (and the program)
  const window = fresh.map((n, j) => {
    const o = pair[j];
    if (o === null) {
      addIds(doc, n);
      return n;
    }
    if (o.from >= change.to) moveBy(o, delta);
    return o;
  });
  for (const n of window) {
    n.parent = doc.program;
    n.slot = slot;
  }
  list.splice(bi, 0, ...window);

  const changes: TreeChange[] = [];
  for (let k = old.length - 1; k >= 0; k--) {
    if (!kept.has(old[k])) changes.push({ type: "remove", node: old[k], slot, index: bi + k });
  }
  fresh.forEach((node, j) => {
    if (pair[j] === null) changes.push({ type: "insert", node, slot, index: bi + j });
  });
  return changes;
}

/** move a node and everything in it by `by` */
function moveBy(n: BNode, by: number): void {
  n.from += by;
  n.to += by;
  if (n.keywordTo !== undefined) n.keywordTo += by;
  for (const s of n.slots) for (const c of s.nodes) moveBy(c, by);
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
 *
 * When the text as a whole does not parse, the tree has "error" roots and
 * cannot equal a parse; then the check is weaker: every other root must equal
 * a parse of its own text (read at its offset), every error root must be
 * trimmed text that does not parse by itself, and the text outside all roots
 * must be only whitespace and comments (a gap between roots must parse, alone,
 * to no node). It does not check that the error roots are where a
 * smarter reader would put them.
 */
export function checkDoc(doc: Doc, text: string): string[] {
  const problems: string[] = [];
  const say = (m: string) => {
    if (problems.length < 30) problems.push(m);
  };
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

  const fresh = tryParse(doc.language, text, 0);
  if (fresh !== null) {
    compareList(prog.slots[0].nodes, fresh, "roots");
  } else {
    // the weaker check, root by root
    let pos = 0;
    const gap = (from: number, to: number, where: string): void => {
      if (to < from) return;
      const nodes = tryParse(doc.language, text.slice(from, to), from);
      if (nodes === null || nodes.length > 0) {
        say(`${where}: text outside the roots is not only space and comments: ${JSON.stringify(text.slice(from, to).slice(0, 40))}`);
      }
    };
    prog.slots[0].nodes.forEach((r, i) => {
      const path = `roots[${i}]`;
      if (r.from < pos) say(`${path}: starts at ${r.from}, before the end of the one before (${pos})`);
      gap(pos, r.from, `before ${path}`);
      const own = text.slice(r.from, r.to);
      if (r.kind === "error") {
        if (r.slots.length !== 0) say(`${path}: an error root has slots`);
        if (r.value !== own) say(`${path}: error value is not its text`);
        if (own !== own.trim() || own === "") say(`${path}: error text is not trimmed`);
        if (tryParse(doc.language, own, r.from) !== null) say(`${path}: an error root whose text parses`);
      } else {
        const ref = tryParse(doc.language, own, r.from);
        if (ref === null || ref.length !== 1) say(`${path}: the text of a root does not parse as one node`);
        else compare(r, ref[0], path);
      }
      pos = Math.max(pos, r.to);
    });
    gap(pos, text.length, "after the last root");
  }

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
