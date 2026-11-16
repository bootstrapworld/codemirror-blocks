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

export interface ReconcileEnv {
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
  if (old.kind !== nw.kind || keyOfNode(old) !== keyOfNode(nw) || old.keyword !== nw.keyword) return false;
  if (old.slots.length !== nw.slots.length) {
    return false;
  }
  if (old.slots.length === 0) return old.value === nw.value && old.dataType === nw.dataType;
  for (let i = 0; i < old.slots.length; i++) {
    const a = old.slots[i];
    const b = nw.slots[i];
    if (a.name !== b.name || a.kind !== b.kind || a.glue !== b.glue) return false;
    // the glue word of a list slot is drawn only while the list has something in it
    if (a.glue && a.kind === "list" && a.nodes.length > 0 !== b.nodes.length > 0) return false;
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
  let changed = !sameText(old, nw);
  old.from = nw.from;
  old.to = nw.to;
  old.keywordTo = nw.keywordTo;
  old.brackets = nw.brackets;
  adoptMeta(old, nw);
  for (let i = 0; i < old.slots.length; i++) if (reconcileSlot(old.slots[i], nw.slots[i], env)) changed = true;
  if (changed) env.refresh(old);
  return changed;
}

function reconcileSlot(os: Slot, ns: Slot, env: ReconcileEnv): boolean {
  const o0 = os.nodes.slice();
  const n0 = ns.nodes.slice();
  let changed = false;
  const replaceAt = (index: number, node: BNode): void => {
    const old = os.nodes[index];
    adopt(os, node);
    os.nodes[index] = node;
    env.removed(old);
    env.added(node);
    env.apply({ type: "replace", old, node, slot: os, index });
    changed = true;
  };
  if (os.kind === "one") {
    if (o0.length === 1 && n0.length === 1 && compatible(o0[0], n0[0])) return reconcile(o0[0], n0[0], env);
    // a "one" slot always holds exactly one node: swap them (the shapes are the same)
    if (o0.length === 1 && n0.length === 1) replaceAt(0, n0[0]);
    else {
      os.nodes = n0;
      for (const c of n0) {
        adopt(os, c);
        env.added(c);
      }
      for (const c of o0) env.removed(c);
      changed = true;
    }
    return changed;
  }
  let p = 0;
  while (p < o0.length && p < n0.length && compatible(o0[p], n0[p]) && sameText(o0[p], n0[p])) p++;
  let eo = o0.length;
  let en = n0.length;
  while (eo > p && en > p && compatible(o0[eo - 1], n0[en - 1]) && sameText(o0[eo - 1], n0[en - 1])) {
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
    os.nodes.splice(p + j, 0, node);
    env.added(node);
    env.apply({ type: "insert", node, slot: os, index: p + j });
    changed = true;
  }
  for (let j = both; j < k; j++) {
    const node = os.nodes[p + both];
    os.nodes.splice(p + both, 1);
    env.removed(node);
    env.apply({ type: "remove", node, slot: os, index: p + both });
    changed = true;
  }
  for (let j = 0; j < p; j++) if (reconcile(o0[j], n0[j], env)) changed = true;
  for (let j = 0; j < o0.length - eo; j++) if (reconcile(o0[eo + j], n0[en + j], env)) changed = true;
  return changed;
}
