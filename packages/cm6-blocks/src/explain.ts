/**
 * Does an edit parse? The old editor refused an edit box whose text did not
 * parse (the parser threw). A Lezer parser does not throw: it returns a tree
 * with error nodes. So: an edit "does not parse" when the text with the edit
 * applied has MORE error nodes than the text before it, counting only the
 * top-level forms that touch the edited range. The message comes from the
 * table's optional "explain" rule (`apply(text, from, to) => string | undefined`),
 * else a generic sentence.
 */
import type { BNode, Language, TextChange } from "./types";
import type { BlockTable } from "./lezer";

const errorsIn = (roots: BNode[], a: number, b: number): BNode[] => {
  const out: BNode[] = [];
  const go = (n: BNode) => {
    if (n.kind === "error") out.push(n);
    for (const s of n.slots) for (const k of s.nodes) go(k);
  };
  for (const r of roots) if (r.to >= a && r.from <= b) go(r);
  return out;
};

/** "line L, column C" (both from 1) of an offset */
export function place(text: string, pos: number): string {
  const before = text.slice(0, pos);
  const line = before.split("\n").length;
  return `line ${line}, column ${pos - (before.lastIndexOf("\n") + 1) + 1}`;
}

export const END_MESSAGE =
  "Unexpected end of the text: a bracket or a quote may be missing";

/** the sentence for the error node `e` of `text` */
export function explainError(
  table: BlockTable | undefined,
  text: string,
  e: BNode
): string {
  for (const r of table?.rules ?? []) {
    if (r.name !== "explain") continue;
    const m = r.apply(text, e.from, e.to);
    if (m) return m;
  }
  if (e.to === e.from || e.from >= text.trimEnd().length) return END_MESSAGE;
  const token = text.slice(e.from, e.to).split(/\s/)[0];
  return `Unexpected "${token}" at ${place(text, e.from)}`;
}

/** the message that refuses `change` of `text`, or null if the edit parses */
export function refusal(
  language: Language & { table?: BlockTable },
  text: string,
  change: TextChange
): string | null {
  const next =
    text.slice(0, change.from) + change.insert + text.slice(change.to);
  let now: BNode[];
  try {
    now = language.parse(next);
  } catch {
    return END_MESSAGE;
  }
  let before: BNode[] = [];
  try {
    before = language.parse(text);
  } catch {
    // (the text before was not readable either: nothing to compare with)
  }
  const bad = errorsIn(now, change.from, change.from + change.insert.length);
  const old = errorsIn(before, change.from, change.to);
  if (bad.length <= old.length) return null;
  return explainError(language.table, next, bad[0]);
}
