import type { ASTNode, BlockComment, Pos } from "./ast";
import { Comment } from "./nodes";
import { List } from "./nodeSpec";
import { COMMENT_RULES } from "./commentRules";
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

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type ScannedComment = {
  from: Pos;
  to: Pos;
  lastFrom: Pos;
  text: string;
  /** there is code before it on its line (it is not in a row with the others) */
  trailing: boolean;
};

/** How a language writes a comment */
export type CommentSyntax = {
  /** what starts a comment that runs to the end of the line (`;`, `//`) */
  line?: string;
  /** what starts and ends a comment that can be many lines (`#|` and `|#`) */
  block?: BlockComment;
  /**
   * Whether the code has Scheme's other ways of writing things that look like
   * the start of a comment: `#\;` (a character), `#;` (a comment of a form) and
   * `|a;b|` (a symbol with bars). They are not comments, and are left alone.
   */
  scheme?: boolean;
};

/** Scheme's comments: `; line` and `#| block |#` */
export const SCHEME_COMMENTS: CommentSyntax = {
  line: ";",
  block: { open: "#|", close: "|#" },
  scheme: true,
};

/**
 * The comments in Scheme-like source text (see {@link scanComments})
 */
export function scanSchemeComments(code: string): ScannedComment[] {
  return scanComments(code, SCHEME_COMMENTS);
}

/**
 * The comments in source text, with the ones in a row (on lines one after the
 * other) as one, as a lexer that gives a node the comments above it sees them:
 * `lastFrom` is where the last of them starts. A comment that follows code on
 * its line is one of its own. Text in `"quotes"` holds no comment.
 */
export function scanComments(
  code: string,
  syntax: CommentSyntax
): ScannedComment[] {
  const found: (ScannedComment & {
    trailing: boolean;
    codeAfter?: boolean;
    opener: boolean;
  })[] = [];
  let line = 0;
  let col = 0;
  let hasCode = false;
  let opened = false; // (an opening bracket came before, on this line)
  let i = 0;
  const pos = (): Pos => ({ line, ch: col });
  // (code after a comment on its line ends the row of comments it is in)
  const code_ = () => {
    hasCode = true;
    const last = found[found.length - 1];
    if (last && last.to.line === line) last.codeAfter = true;
  };
  const step = (n = 1) => {
    for (let k = 0; k < n && i < code.length; k++, i++) {
      if (code[i] === "\n") {
        line++;
        col = 0;
        hasCode = false;
        opened = false;
      } else {
        col++;
      }
    }
  };
  while (i < code.length) {
    const c = code[i];
    if (syntax.block && code.startsWith(syntax.block.open, i)) {
      const { open, close } = syntax.block;
      const from = pos();
      const trailing = hasCode;
      let end = code.indexOf(close, i + open.length);
      end = end < 0 ? code.length : end + close.length;
      const text = code
        .slice(i + open.length, end - close.length)
        .trim()
        .replace(/\s+/g, " ");
      step(end - i);
      found.push({
        from,
        to: pos(),
        lastFrom: from,
        text,
        trailing,
        opener: opened,
      });
    } else if (syntax.line && code.startsWith(syntax.line, i)) {
      const from = pos();
      const trailing = hasCode;
      let end = code.indexOf("\n", i);
      if (end < 0) end = code.length;
      const text = code
        .slice(i, end)
        .replace(new RegExp(`^(${escapeRegExp(syntax.line)}|\\s)*`), "")
        .trim();
      step(end - i);
      found.push({
        from,
        to: pos(),
        lastFrom: from,
        text,
        trailing,
        opener: opened,
      });
    } else if (c === '"') {
      code_();
      step();
      while (i < code.length && code[i] !== '"') step(code[i] === "\\" ? 2 : 1);
      step();
    } else if (
      syntax.scheme &&
      c === "#" &&
      (code[i + 1] === "\\" || code[i + 1] === ";")
    ) {
      if (code[i + 1] === "\\") code_();
      step(2);
    } else if (syntax.scheme && c === "|") {
      code_();
      const end = code.indexOf("|", i + 1);
      step(end < 0 ? code.length - i : end + 1 - i);
    } else {
      // (an opening bracket does not make a comment after it trail: the
      // comment is above what follows, as a lexer reads it)
      if (/[([{]/.test(c)) opened = true;
      else if (!/\s/.test(c)) code_();
      step();
    }
  }
  const groups: ScannedComment[] = [];
  let previous: (typeof found)[number] | undefined;
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
    } else {
      groups.push({
        from: c.from,
        to: c.to,
        lastFrom: c.lastFrom,
        text: c.text,
        trailing: c.trailing,
      });
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
 * The parser has only to skip comments as it reads (they are found again here,
 * in `code`), and the language has to say how it writes them. `topLevel` is the
 * node that holds the whole program, for a language that has one (the end of
 * the program is the end of its list), where there is not one root for each
 * thing in it.
 */
export function attachComments(
  code: string,
  roots: ASTNode[],
  {
    blockComment,
    syntax = SCHEME_COMMENTS,
    rules: given,
    topLevel = null,
  }: {
    blockComment: BlockComment;
    syntax?: CommentSyntax;
    rules?: Partial<CommentRules>;
    topLevel?: ASTNode | null;
  }
): ASTNode[] {
  const rules = { ...COMMENT_RULES, ...given };
  const all: Placed[] = [];
  for (const root of roots) walk(root, null, all);
  const orphans: ASTNode[] = [];
  for (const c of scanComments(code, syntax)) {
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
