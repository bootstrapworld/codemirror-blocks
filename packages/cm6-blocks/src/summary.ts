/**
 * The summary of a program, as the old editor says it ("At the top level, this program contains 2 function definitions, 1 value definition,
 * and 3 calls."), as functions of the KINDS of the nodes, so that nothing here knows a language: a kind is a name for what the node is,
 * from the row of the language table that made it (its `label`). Comments never count (unlike the old editor, which counted a comment that
 * goes with no node as a kind): `describeKinds` leaves out a comment unless `orphans: "count"` is asked for, and the editor never asks.
 */

/** what a node is, for counting: its type (two types with one label are two kinds), the words for it, and whether it is a comment */
export interface Kind {
  type: string;
  label: string;
  /** default: the label with `s` (`es` after s, x, sh, ch) */
  pluralLabel?: string;
  /** a comment that goes with no node */
  orphan?: boolean;
}

/** the plural of a table label: `call` -> `calls`, `class` -> `classes` */
export const pluralOf = (label: string): string =>
  /(s|x|sh|ch)$/.test(label) ? label + "es" : label + "s";

/** "a", "a and b", "a, b, and c" */
export function joinWithAnd(parts: readonly string[]): string {
  return parts.length > 2
    ? parts.slice(0, -1).join(", ") + ", and " + parts[parts.length - 1]
    : parts.join(" and ");
}

type Orphans = { orphans?: "count" | "skip" };

/**
 * Say what a list of nodes is made of, e.g. "2 function definitions, 1 value definition, and 3 calls": the kinds are the types of the nodes
 * that are there, in the order they first appear, each named by its own label. It reads as part of a sentence. "nothing" if there are none.
 * `orphans`: whether a comment is counted ("count") or left out ("skip", the default).
 */
export function describeKinds(
  nodes: readonly Kind[],
  { orphans = "skip" }: Orphans = {}
): string {
  const kinds = new Map<string, { kind: Kind; n: number }>();
  for (const kind of nodes) {
    if (orphans === "skip" && kind.orphan) continue;
    const k = kinds.get(kind.type);
    if (k) k.n++;
    else kinds.set(kind.type, { kind, n: 1 });
  }
  if (!kinds.size) return "nothing";
  return joinWithAnd(
    [...kinds.values()].map(
      ({ kind, n }) =>
        `${n} ${n === 1 ? kind.label : (kind.pluralLabel ?? pluralOf(kind.label))}`
    )
  );
}

/** "At the top level, this program contains ...", or null for a program with nothing in it (comments do not count) */
export function summarizeProgram(
  roots: readonly Kind[],
  { orphans = "skip" }: Orphans = {}
): string | null {
  if (!roots.some((k) => orphans === "count" || !k.orphan)) return null;
  return `At the top level, this program contains ${describeKinds(roots, { orphans })}.`;
}
