import * as P from "pretty-fast-pretty-printer";

/*
 * Helpers for writing a node's `pretty()` with the pretty-printer (exported
 * from the package next to `Pretty`, which is the printer itself).
 */

/** What can be a part of a form: a doc, text, or nothing (left out) */
export type Part = P.DocLike | null | undefined | false;

const isThere = (part: Part): part is P.DocLike =>
  part !== null && part !== undefined && part !== false;

/**
 * `(head part part ...)`, as `Pretty.standardSexpr` prints it, with the parts
 * that are `null`, `undefined` or `false` left out: for a form with an optional
 * child, with no empty text where it is not there (which would print a space
 * before the closing bracket):
 *
 *   sexpr("let", [node.fields.name, node.fields.start])  // (let x) or (let x 1)
 */
export function sexpr(head: P.DocLike, parts: readonly Part[]): P.Doc {
  return P.standardSexpr(head, parts.filter(isThere));
}

/**
 * A form with a body of any number of things, one to a line, indented, with the
 * closing bracket after the last (`Pretty.lambdaLikeSexpr` takes one body):
 *
 *   (repeat 3
 *     (show 1)
 *     (show 2))
 *
 * The `header` (what is on the line of the keyword) can be left out.
 */
export function formSexpr(
  keyword: P.DocLike,
  header: Part,
  bodies: readonly P.DocLike[]
): P.Doc {
  const first = isThere(header)
    ? P.horz("(", keyword, " ", header)
    : P.horz("(", keyword);
  return bodies.length
    ? P.horz(P.vert(first, P.horz("  ", P.vertArray([...bodies]))), ")")
    : P.horz(first, ")");
}

/**
 * The lines of a doc at a width, with nothing on a line that has nothing else
 * (a blank line inside something indented would keep the indentation).
 */
export function displayLines(doc: P.Doc, width: number): string[] {
  return doc.display(width).map((line) => (line.trim() === "" ? "" : line));
}
