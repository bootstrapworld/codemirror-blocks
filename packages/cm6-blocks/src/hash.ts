// EXPERIMENT (thirteenth round, difference 11): a content hash of a node, computed only when asked.
import type { BNode } from "./types";

const cache = new WeakMap<BNode, { version: unknown; hash: number }>();

/** a 53-bit string hash (cyrb53), so that two different contents almost never meet */
function hashString(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * What a node IS, not where it is: its kind, keyword, brackets, modifier, value, data type and the hashes of its children in slot order
 * (the slot's name and kind, and its child count, are part of it). NOT offsets, NOT ids, so two parses of the same text have equal hashes
 * and a node moved to another place has the same hash.
 *
 * The result is cached per node and valid for `version`: any value that is a new object whenever the tree may have changed (the editor
 * passes its document's text object, which CodeMirror 6 replaces on every change). A node whose version is not the current one is
 * hashed again, so a changed node and all its ancestors get a new hash and nothing needs to be invalidated by hand. Unused, it costs nothing.
 */
export function contentHash(node: BNode, version: unknown): number {
  const hit = cache.get(node);
  if (hit && hit.version === version) return hit.hash;
  let s = `${node.kind}\u0001${node.keyword ?? ""}\u0001${node.brackets ?? ""}\u0001${node.modifier ?? ""}\u0001${node.dataType ?? ""}\u0001${node.value ?? ""}`;
  for (const slot of node.slots) {
    s += `\u0002${slot.name}\u0003${slot.kind}\u0003${slot.glue ?? ""}\u0003${slot.nodes.length}`;
    for (const c of slot.nodes) s += `\u0004${contentHash(c, version)}`;
  }
  const hash = hashString(s);
  cache.set(node, { version, hash });
  return hash;
}
