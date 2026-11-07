import type { ASTNode, BlockComment, Pos } from "./ast";
import { Comment } from "./nodes";
import { List } from "./nodeSpec";
import { rulesInEffect } from "./commentRules";
import type { CommentRules } from "./commentRules";
import { poscmp } from "./utils";

/*
 * Orphan comments: comments that go with no node (see `Comment` in nodes.tsx).
 *
 * A parser that finds its comments apart from the nodes (so that it knows
 * which ones no node took) hands them to `placeOrphans`, which gives each one
 * a place in the tree: among the elements of the nearest list around it that
 * can hold one (declared with `Spec.list(name, { orphans: true })`), or, where
 * there is none, with the node beside it.
 */

// (by the range of the node itself, and not with the comment that goes with it,
// which grows as comments are given to it: a comment before it is not in it)
const contains = (node: ASTNode, c: ASTNode) =>
  poscmp(node.from, c.from) <= 0 && poscmp(c.to, node.to) <= 0;

/** One comment that goes with `node`, made of the one it has and `extra` */
export function addComment(
  node: ASTNode,
  extra: ASTNode,
  blockComment?: BlockComment
) {
  const old = node.options.comment;
  if (!old) {
    node.options.comment = Comment(
      extra.from,
      extra.to,
      String(extra.fields.comment),
      {
        blockComment,
      }
    );
    return;
  }
  const first = poscmp(old.from, extra.from) <= 0 ? old : extra;
  const second = first === old ? extra : old;
  node.options.comment = Comment(
    first.from,
    poscmp(old.to, extra.to) >= 0 ? old.to : extra.to,
    `${String(first.fields.comment)} ${String(second.fields.comment)}`,
    { blockComment }
  );
}

function place(node: ASTNode, orphan: ASTNode, blockComment?: BlockComment) {
  const kids = [...node.children()];
  const inner = kids.find((k) => contains(k, orphan));
  if (inner) {
    place(inner, orphan, blockComment);
    return;
  }
  for (const spec of node.spec.childSpecs) {
    if (spec instanceof List && spec.orphans && !node.options.noOrphans) {
      const list = spec.getField(node);
      const at = list.findIndex(
        (e) => poscmp(e.srcRange().from, orphan.from) > 0
      );
      list.splice(at < 0 ? list.length : at, 0, orphan);
      return;
    }
  }
  if (!kids.length) {
    // (inside something with no nodes in it, a form that is kept as the text
    // it was written as: the comment is part of that text)
    return;
  }
  // (a list that cannot hold a comment of its own: it goes with the node that
  // comes after it, or with the last)
  const next = kids.find((k) => poscmp(k.from, orphan.to) >= 0);
  addComment(next ?? kids[kids.length - 1], orphan, blockComment);
}

/**
 * Put the orphans (in document order) in their places among the nodes of a
 * program, and return its root nodes: each is a block of its own, in the list
 * of the nearest node around it that can hold one, or among the roots, which
 * can always hold them. (Which comments go with a node and which stand alone
 * is not decided here: see `attachComments`.)
 */
export function placeOrphans(
  roots: ASTNode[],
  orphans: ASTNode[],
  blockComment?: BlockComment
): ASTNode[] {
  const result = [...roots];
  for (const orphan of orphans) {
    const home = result.find((r) => contains(r, orphan));
    if (home) {
      place(home, orphan, blockComment);
      continue;
    }
    const at = result.findIndex(
      (r) => poscmp(r.srcRange().from, orphan.from) > 0
    );
    result.splice(at < 0 ? result.length : at, 0, orphan);
  }
  return result;
}

/**
 * A comment the parser skipped, where it was in `code`: as offsets, or as
 * positions. `text` is what it says, if the parser knows; if not, it is what is
 * left of the source when the marks that start (and end) it are taken off.
 */
export type ReportedComment = {
  from: number | Pos;
  to: number | Pos;
  text?: string;
};

type Found = {
  from: Pos;
  to: Pos;
  lastFrom: Pos;
  text: string;
  /** there is code before it on its line (it is not in a row with the others) */
  trailing: boolean;
  /** an opening bracket comes before it on its line */
  opener: boolean;
  /** there is code after it on its line */
  codeAfter: boolean;
};

/**
 * What the comments say, from where the parser says they are: the ones in a row
 * (on lines one after the other) are one, as a lexer that gives a node the
 * comments above it sees them; `lastFrom` is where the last of them starts. A
 * comment that follows code on its line is one of its own.
 */
function readComments(
  code: string,
  reported: readonly ReportedComment[],
  blockComment: BlockComment
): (Omit<Found, "opener" | "codeAfter"> & { trailing: boolean })[] {
  const lines = code.split("\n");
  const starts: number[] = [];
  let at = 0;
  for (const l of lines) {
    starts.push(at);
    at += l.length + 1;
  }
  const posAt = (offset: number): Pos => {
    let line = 0;
    while (line + 1 < starts.length && starts[line + 1] <= offset) line++;
    return { line, ch: offset - starts[line] };
  };
  const offsetOf = (p: number | Pos) =>
    typeof p === "number" ? p : (starts[p.line] ?? code.length) + p.ch;
  const sorted = reported
    .map((c) => ({ ...c, a: offsetOf(c.from), b: offsetOf(c.to) }))
    .sort((x, y) => x.a - y.a);
  // the code, with the comments blanked out (so that what is left on a line is
  // what is code)
  let blank = "";
  let end = 0;
  for (const c of sorted) {
    if (c.a < end) continue; // (inside another)
    blank += code.slice(end, c.a) + code.slice(c.a, c.b).replace(/[^\n]/g, " ");
    end = c.b;
  }
  blank += code.slice(end);
  const blankLines = blank.split("\n");
  const textOf = (a: number, b: number) => {
    const source = code.slice(a, b);
    const { open, close } = blockComment;
    if (source.startsWith(open)) {
      return source
        .slice(open.length, source.endsWith(close) ? -close.length : undefined)
        .trim()
        .replace(/\s+/g, " ");
    }
    return source.replace(/^(?:#[;!]|(\S)\1*)\s*/, "").trim();
  };

  const found: Found[] = [];
  end = 0;
  for (const c of sorted) {
    if (c.a < end) continue;
    end = c.b;
    const from = posAt(c.a);
    const to = posAt(c.b);
    const before = blankLines[from.line].slice(0, from.ch);
    const after = blankLines[to.line].slice(to.ch);
    found.push({
      from,
      to,
      lastFrom: from,
      text: c.text ?? textOf(c.a, c.b),
      trailing: /[^\s([{]/.test(before),
      opener: /[([{]/.test(before),
      codeAfter: /\S/.test(after),
    });
  }
  const groups: Found[] = [];
  let previous: Found | undefined;
  for (const c of found) {
    const group = groups[groups.length - 1];
    if (
      group &&
      previous &&
      !c.trailing &&
      !c.opener &&
      !previous.opener &&
      !previous.trailing &&
      !previous.codeAfter &&
      c.from.line === previous.to.line + 1
    ) {
      group.to = c.to;
      group.lastFrom = c.from;
      group.text += " " + c.text;
      group.codeAfter = c.codeAfter;
    } else {
      groups.push({ ...c });
    }
    previous = c;
  }
  return groups;
}

type Placed = { node: ASTNode; parent: ASTNode | null };
const walk = (node: ASTNode, parent: ASTNode | null, into: Placed[]) => {
  into.push({ node, parent });
  for (const child of node.children()) walk(child, node, into);
};

/**
 * Gives every comment in `code` its place among the nodes a parser has made
 * (`roots`, with positions), and returns the root nodes, now with comments
 * among them. The comments that go with a node are its `options.comment`; the
 * others are nodes of their own (see {@link placeOrphans}). Which is which is
 * what the `rules` say (see {@link CommentRules}, which has the defaults and
 * the words): by default, a comment after code on its line goes with that code
 * (the last node of its list to end before it), one above a node, or before it
 * on its line, goes with the node (the next in its list), one at the end of the
 * program goes with the last node, and any other stands alone.
 *
 * The parser reads the comments, as it is the one that knows what is one (and
 * not a `;` in a string): it reports each it skips, as `comments`, and this
 * decides which node each goes with. `topLevel` is the
 * node that holds the whole program, for a language that has one (the end of
 * the program is the end of its list), where there is not one root for each
 * thing in it.
 */
export function attachComments(
  code: string,
  roots: ASTNode[],
  {
    blockComment,
    comments,
    rules: given,
    topLevel = null,
  }: {
    blockComment: BlockComment;
    comments: readonly ReportedComment[];
    rules?: Partial<CommentRules>;
    topLevel?: ASTNode | null;
  }
): ASTNode[] {
  const rules = rulesInEffect(given);
  const all: Placed[] = [];
  for (const root of roots) walk(root, null, all);
  const orphans: ASTNode[] = [];
  for (const c of readComments(code, comments, blockComment)) {
    const comment = Comment(c.from, c.to, c.text, {
      blockComment,
      orphan: true,
    });
    // The list the comment is in: the innermost node that holds it (none, if it
    // is among the roots). The nodes are in the order of their starts, the
    // outermost first of those that start together.
    const container =
      [...all]
        .reverse()
        .find(
          ({ node }) =>
            poscmp(node.from, c.from) <= 0 && poscmp(c.to, node.to) <= 0
        )?.node ?? null;
    // (by identity: the nodes have no ids until the AST is made of them)
    const mine = all.filter(({ parent }) => parent === container);
    const next = mine.find(({ node }) => poscmp(node.from, c.to) >= 0);
    const linesToNext = next ? next.node.from.line - c.to.line : Infinity;

    // After code on its line: with that code, the last of the nodes of its
    // list to end before it, on the line.
    if (c.trailing && rules.afterCode === "previous") {
      const before = mine
        .filter(
          ({ node }) =>
            poscmp(node.to, c.from) <= 0 &&
            node.to.line === c.from.line &&
            // (a node that was never written, as a blank for a function that
            // is not there, is no code before it)
            poscmp(node.from, node.to) < 0
        )
        .reduce<Placed | undefined>(
          (best, p) =>
            !best || poscmp(p.node.to, best.node.to) > 0 ? p : best,
          undefined
        );
      if (before) {
        addComment(before.node, comment, blockComment);
        continue;
      }
    }
    // With the node after it, if it is above that, or before it on its line.
    const takesNext = c.trailing
      ? rules.afterCode === "next"
        ? linesToNext === 0
        : rules.afterCode === "previous" &&
          rules.above === "next" &&
          linesToNext <= rules.maxLinesAbove
      : rules.above === "next" && linesToNext <= rules.maxLinesAbove;
    if (next && takesNext) {
      addComment(next.node, comment, blockComment);
      continue;
    }
    // At the end of the program, on the line after the last node: with it.
    if (
      rules.atEnd === "last" &&
      !next &&
      !c.trailing &&
      (container === null || container === topLevel)
    ) {
      const last = [...mine]
        .reverse()
        .find(({ node }) => !node.options.orphan)?.node;
      if (last && c.from.line === last.srcRange().to.line + 1) {
        addComment(last, comment, blockComment);
        continue;
      }
    }
    orphans.push(comment);
  }
  return placeOrphans(roots, orphans, blockComment);
}
