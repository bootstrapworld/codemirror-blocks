/*
 * EXPERIMENT. Node-level reuse: when a root is touched, the new block tree (built whole from
 * the new Lezer tree, which is cheap) is laid over the OLD one, and the old `BNode` objects
 * (and so their elements) are kept wherever the two agree. Only where they differ is the old
 * tree changed, by insert / remove / replace `TreeChange`s that the renderer patches; ancestors
 * of a change are updated in place.
 *
 * The rule that makes this safe is that nothing is assumed from "the range and text did not
 * change": every node of the new tree is compared with its old counterpart (same table row,
 * same kind, keyword, glue, slot shape, leaf value), position by position, and the old node is
 * then given ALL of the new node's fields. A mismatch replaces the old node, whatever the text
 * says, so Lezer's error recovery (or Python's dedents) cannot leave a stale node behind: the
 * result is the fresh tree by construction, with the old objects as far as they are the same.
 */
import { adoptMeta, keyOfNode, sourceOf } from "./lezer";
import type { BNode, Slot, TreeChange } from "./types";

/**
 * Thrown when the new tree holds an ANCHOR (an old node taken over as is, see lezer-view.ts) that cannot be where the new tree
 * puts it (it is not in the paired slot, or it sits in a node that is new or removed). Nothing can be trusted then: the editor
 * drops the old root and uses the new one.
 */
export class Bail extends Error {}

export interface ReconcileEnv {
  /** is this node of the new tree an old node taken over as is (an anchor)? Its subtree is not compared. */
  anchored?(node: BNode): boolean;
  /** patch the page for a change that is already made in the tree */
  apply(change: TreeChange): void;
  /** a drawn node's spoken label may have changed */
  refresh(node: BNode): void;
  /** a node (and what is under it) is new in the tree / left it */
  added(node: BNode): void;
  removed(node: BNode): void;
}

/** can `old` stand for `nw`, whatever is under them? (the same row, shape and own text) */
export function compatible(old: BNode, nw: BNode): boolean {
  if (
    old.kind !== nw.kind ||
    keyOfNode(old) !== keyOfNode(nw) ||
    old.keyword !== nw.keyword ||
    old.modifier !== nw.modifier
  )
    return false;
  if (old.slots.length !== nw.slots.length) {
    return false;
  }
  if (old.slots.length === 0)
    return old.value === nw.value && old.dataType === nw.dataType;
  for (let i = 0; i < old.slots.length; i++) {
    const a = old.slots[i];
    const b = nw.slots[i];
    if (a.name !== b.name || a.kind !== b.kind || a.glue !== b.glue)
      return false;
    // the glue word of a list slot is drawn only while the list has something in it
    if (
      a.glue &&
      a.kind === "list" &&
      a.nodes.length > 0 !== b.nodes.length > 0
    )
      return false;
  }
  return true;
}

const sameText = (a: BNode, b: BNode): boolean => sourceOf(a) === sourceOf(b);

/** a node of the new tree becomes a child of `slot` (of the old tree) */
function adopt(slot: Slot, child: BNode): void {
  child.parent = slot.owner;
  child.slot = slot;
}

/** Make `old` equal to `nw` (they are `compatible`); returns whether anything under `old` or its own text changed. */
export function reconcile(old: BNode, nw: BNode, env: ReconcileEnv): boolean {
  // (an old node that the new tree uses as an anchor, somewhere else, is not given the fields of this other new node: it would be in two
  // places, and the one that was changed in place would be wrong)
  if (old !== nw && env.anchored?.(old)) throw new Bail();
  let changed = !sameText(old, nw);
  old.from = nw.from;
  old.to = nw.to;
  old.keywordTo = nw.keywordTo;
  old.brackets = nw.brackets;
  adoptMeta(old, nw);
  for (let i = 0; i < old.slots.length; i++)
    if (reconcileSlot(old.slots[i], nw.slots[i], env)) changed = true;
  if (changed) env.refresh(old);
  return changed;
}

function reconcileSlot(os: Slot, ns: Slot, env: ReconcileEnv): boolean {
  const o0 = os.nodes.slice();
  const n0 = ns.nodes.slice();
  const anchored = env.anchored ?? (() => false);
  if (os.kind === "one") {
    if (o0.length === 1 && n0.length === 1 && anchored(n0[0])) {
      if (o0[0] !== n0[0]) throw new Bail();
      adopt(os, n0[0]); // (the new parent it was built under is not the one that stays)
      return false;
    }
    if (o0.length === 1 && n0.length === 1 && compatible(o0[0], n0[0]))
      return reconcile(o0[0], n0[0], env);
    // a "one" slot always holds exactly one node: swap them (the shapes are the same)
    if (o0.length === 1 && n0.length === 1) {
      const old = o0[0];
      const node = n0[0];
      adopt(os, node);
      os.nodes[0] = node;
      env.removed(old);
      env.added(node);
      env.apply({ type: "replace", old, node, slot: os, index: 0 });
    } else {
      os.nodes = n0;
      for (const c of n0) {
        adopt(os, c);
        env.added(c);
      }
      for (const c of o0) env.removed(c);
    }
    return true;
  }
  if (!n0.some(anchored)) return reconcileRange(os, 0, o0, n0, env);
  // Anchors are old nodes of this very slot, in the same order: they split the list into stretches, and each stretch is
  // laid over the new nodes between the same two anchors
  let changed = false;
  let oi = 0;
  let ni = 0;
  for (let j = 0; j <= n0.length; j++) {
    const isAnchor = j < n0.length && anchored(n0[j]);
    if (j < n0.length && !isAnchor) continue;
    let oj = o0.length;
    if (isAnchor) {
      oj = o0.indexOf(n0[j], oi);
      if (oj < 0) throw new Bail();
      adopt(os, n0[j]);
    }
    const oldSeg = o0.slice(oi, oj);
    const newSeg = n0.slice(ni, j);
    // (the live list already holds the new nodes of the earlier stretches and the anchors: the stretch starts at index `ni`)
    if (oldSeg.length || newSeg.length)
      if (reconcileRange(os, ni, oldSeg, newSeg, env)) changed = true;
    oi = oj + 1;
    ni = j + 1;
  }
  return changed;
}

/** the stretch `o0` of the live list `os.nodes` (starting at `base`) laid over the new nodes `n0` */
function reconcileRange(
  os: Slot,
  base: number,
  o0: BNode[],
  n0: BNode[],
  env: ReconcileEnv
): boolean {
  let changed = false;
  const replaceAt = (index: number, node: BNode): void => {
    const old = os.nodes[base + index];
    adopt(os, node);
    os.nodes[base + index] = node;
    env.removed(old);
    env.added(node);
    env.apply({ type: "replace", old, node, slot: os, index: base + index });
    changed = true;
  };
  let p = 0;
  while (
    p < o0.length &&
    p < n0.length &&
    compatible(o0[p], n0[p]) &&
    sameText(o0[p], n0[p])
  )
    p++;
  let eo = o0.length;
  let en = n0.length;
  while (
    eo > p &&
    en > p &&
    compatible(o0[eo - 1], n0[en - 1]) &&
    sameText(o0[eo - 1], n0[en - 1])
  ) {
    eo--;
    en--;
  }
  const k = eo - p;
  const m = en - p;
  const both = Math.min(k, m);
  for (let j = 0; j < both; j++) {
    if (compatible(o0[p + j], n0[p + j])) {
      if (reconcile(o0[p + j], n0[p + j], env)) changed = true;
    } else replaceAt(p + j, n0[p + j]);
  }
  for (let j = both; j < m; j++) {
    const node = n0[p + j];
    adopt(os, node);
    os.nodes.splice(base + p + j, 0, node);
    env.added(node);
    env.apply({ type: "insert", node, slot: os, index: base + p + j });
    changed = true;
  }
  for (let j = both; j < k; j++) {
    const node = os.nodes[base + p + both];
    os.nodes.splice(base + p + both, 1);
    env.removed(node);
    env.apply({ type: "remove", node, slot: os, index: base + p + both });
    changed = true;
  }
  for (let j = 0; j < p; j++) if (reconcile(o0[j], n0[j], env)) changed = true;
  for (let j = 0; j < o0.length - eo; j++)
    if (reconcile(o0[eo + j], n0[en + j], env)) changed = true;
  return changed;
}
