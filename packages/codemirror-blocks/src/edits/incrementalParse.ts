import type { EditorChange } from "codemirror";
import { AST, ASTNode, Pos } from "../ast";
import type { Language } from "../languages";
import { changeEnd, poscmp } from "../utils";

/**
 * A copy of `node` and everything inside it, moved by `shift`. The copy keeps
 * the ids (so that blocks that didn't change are not drawn again), and the old
 * tree is left alone: it still belongs to the editor's old state until the new
 * one is committed.
 */
function moved(node: ASTNode, shift: (pos: Pos) => Pos): ASTNode {
  const copy = Object.assign(
    Object.create(Object.getPrototypeOf(node)),
    node
  ) as {
    -readonly [K in keyof ASTNode]: ASTNode[K];
  };
  copy.from = shift(node.from);
  copy.to = shift(node.to);
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node.fields)) {
    fields[key] = Array.isArray(value)
      ? value.map((v) => (v instanceof ASTNode ? moved(v, shift) : v))
      : value instanceof ASTNode
        ? moved(value, shift)
        : value;
  }
  copy.fields = fields as typeof copy.fields;
  const comment = node.options.comment;
  if (comment) {
    copy.options = { ...node.options, comment: moved(comment, shift) };
  }
  return copy as ASTNode;
}

// Characters that start or end a string, a comment or an escape. A parser
// doesn't have to complain about a string or block comment left open at the end
// of the window (the parse of the whole program would carry on into the forms
// after it), so an edit that could open or close one, or that could move a line
// comment's end, is left to the full parse.
const LEXICAL = /["|;\\#]/;

function changesLexing(change: EditorChange, oldText: string) {
  if (change.text.some((line) => LEXICAL.test(line))) return true;
  const removed = oldText.slice(
    offsetOf(oldText, change.from),
    offsetOf(oldText, change.to)
  );
  if (LEXICAL.test(removed)) return true;
  // joining lines pulls the next line into a line comment
  if (change.from.line !== change.to.line) {
    const lines = oldText.split("\n");
    for (let l = change.from.line; l <= change.to.line; l++) {
      if (lines[l].includes(";")) return true;
    }
  }
  return false;
}

/** The offset of `pos` in `text` */
function offsetOf(text: string, pos: Pos) {
  let offset = 0;
  for (let line = 0; line < pos.line; line++) {
    const next = text.indexOf("\n", offset);
    if (next < 0) return text.length;
    offset = next + 1;
  }
  return Math.min(offset + pos.ch, text.length);
}

function endOf(text: string): Pos {
  const lines = text.split("\n");
  return { line: lines.length - 1, ch: lines[lines.length - 1].length };
}

/**
 * Build the AST of `newText`, which is `oldAST`'s text with `change` applied,
 * by parsing only the top-level forms the change touches (and the one on each
 * side of them, and whatever lies between), and moving the others.
 *
 * Top-level forms are read one after another, each starting where the last
 * ended, so the forms around the window read the same whether or not the window
 * is parsed together with them, as long as the window parses on its own (every
 * string, comment and parenthesis in it is closed): when it doesn't, this
 * returns undefined and the caller parses everything.
 */
export function incrementalBuildAST(
  language: Language,
  oldAST: AST,
  change: EditorChange,
  oldText: string,
  newText: string
): AST | undefined {
  const roots = oldAST.rootNodes;
  const n = roots.length;
  if (n === 0 || !change.text || oldAST.sourceText !== oldText) {
    return undefined;
  }
  if (changesLexing(change, oldText)) return undefined;
  const range = (i: number) => roots[i].srcRange();

  // the forms the change reaches (touching one at either end counts)
  let lo = 0;
  while (lo < n && poscmp(range(lo).to, change.from) < 0) lo++;
  let hi = n - 1;
  while (hi >= 0 && poscmp(range(hi).from, change.to) > 0) hi--;
  const first = Math.max(0, lo - 1);
  const last = Math.min(n - 1, Math.max(hi, lo - 1) + 1);

  // The window runs from where the form before the first one ends to where the
  // form after the last one starts, so that everything between forms (comments
  // included) is in it. At either end of the program it runs to the end.
  const oldStart: Pos = first === 0 ? { line: 0, ch: 0 } : range(first - 1).to;
  const oldEnd: Pos | undefined =
    last === n - 1 ? undefined : range(last + 1).from;
  if (poscmp(oldStart, change.from) > 0) return undefined;
  if (oldEnd && poscmp(oldEnd, change.to) < 0) return undefined;

  const end = changeEnd(change);
  const shift = (pos: Pos): Pos =>
    pos.line === change.to.line
      ? { line: end.line, ch: end.ch + pos.ch - change.to.ch }
      : { line: pos.line + end.line - change.to.line, ch: pos.ch };
  const newEnd = oldEnd ? shift(oldEnd) : endOf(newText);

  // parse the window where it is in the document: pad it with blank lines and
  // spaces, so that every position in the result is the right one
  const from = offsetOf(newText, oldStart);
  const to = offsetOf(newText, newEnd);
  const padded =
    "\n".repeat(oldStart.line) +
    " ".repeat(oldStart.ch) +
    newText.slice(from, to);
  let parsed: ASTNode[];
  try {
    parsed = language.parse(padded);
  } catch {
    return undefined;
  }

  const same = (pos: Pos) => pos;
  return AST.from(
    language.id,
    [
      ...roots.slice(0, first).map((r) => moved(r, same)),
      ...parsed,
      ...roots.slice(last + 1).map((r) => moved(r, shift)),
    ],
    newText
  );
}
