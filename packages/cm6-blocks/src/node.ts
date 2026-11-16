// EXPERIMENT: making nodes (kept apart from wescheme.ts so that a bundle without WeScheme does not carry its lexer).
import type { BNode } from "./types";

let idCounter = 0;
/** A fresh node id. */
export function nextId(): number {
  return ++idCounter;
}

/** A node with the given slots (`[name, kind]`), no children yet. from/to are 0 until placed. */
export function makeNode(
  kind: string,
  slots: [string, "one" | "list"][] = [],
  extra: Partial<BNode> = {}
): BNode {
  const node: BNode = {
    id: nextId(),
    kind,
    from: 0,
    to: 0,
    parent: null,
    slot: null,
    slots: [],
    ...extra,
  };
  for (const [name, k] of slots) {
    node.slots.push({ name, kind: k, owner: node, nodes: [] });
  }
  return node;
}
