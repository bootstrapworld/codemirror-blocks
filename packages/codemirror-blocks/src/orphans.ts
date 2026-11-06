import type { ASTNode, BlockComment, Pos } from "./ast";
import { Comment } from "./nodes";
import { List } from "./nodeSpec";
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

const contains = (node: ASTNode, c: ASTNode) => {
  const range = node.srcRange();
  return poscmp(range.from, c.from) <= 0 && poscmp(c.to, range.to) <= 0;
};

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
  if (!kids.length) {
    // (inside something with no nodes in it, a form that is kept as the text
    // it was written as: the comment is part of that text)
    return;
  }
  for (const spec of node.spec.childSpecs) {
    if (spec instanceof List && spec.orphans && !node.options.noOrphans) {
      const list = spec.getField(node);
      const at = list.findIndex(
        (e) => poscmp(e.srcRange().from, orphan.from) > 0
      );
      if (at >= 0 && list[at].srcRange().from.line === orphan.to.line) {
        // (ahead of it on its line: it goes with it)
        addComment(list[at], orphan, blockComment);
      } else {
        list.splice(at < 0 ? list.length : at, 0, orphan);
      }
      return;
    }
  }
  const next = kids.find((k) => poscmp(k.srcRange().from, orphan.to) >= 0);
  addComment(next ?? kids[kids.length - 1], orphan, blockComment);
}

/**
 * Put the orphans (in document order) in their places among the nodes of a
 * program, and return its root nodes. Roots can always hold orphans. A comment
 * on the line after the last root, with no blank line between, goes with it.
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
    const lastReal = [...result].reverse().find((r) => !r.options.orphan);
    if (
      lastReal &&
      lastReal === result[result.length - 1] &&
      orphan.from.line === lastReal.srcRange().to.line + 1
    ) {
      addComment(lastReal, orphan, blockComment);
      continue;
    }
    const at = result.findIndex(
      (r) => poscmp(r.srcRange().from, orphan.from) > 0
    );
    if (at >= 0 && result[at].srcRange().from.line === orphan.to.line) {
      addComment(result[at], orphan, blockComment);
    } else {
      result.splice(at < 0 ? result.length : at, 0, orphan);
    }
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
    if (syntax.line && code.startsWith(syntax.line, i)) {
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
    } else if (syntax.block && code.startsWith(syntax.block.open, i)) {
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
 * among them. A comment on the line just above a node, or on its line, in the
 * same list, goes with that node (its `options.comment`); any other is a node
 * of its own, among the elements of the nearest list around it that can hold
 * one (see {@link placeOrphans}).
 *
 * The parser has only to skip comments as it reads (they are found again here,
 * in `code`), and the language has to say how it writes them.
 */
export function attachComments(
  code: string,
  roots: ASTNode[],
  {
    blockComment,
    syntax = SCHEME_COMMENTS,
  }: { blockComment: BlockComment; syntax?: CommentSyntax }
): ASTNode[] {
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
    // After code on its line, it goes with that code: the last of the nodes of
    // its list to end before it, on the line.
    const before = c.trailing
      ? mine
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
          )
      : undefined;
    if (before) {
      addComment(before.node, comment, blockComment);
      continue;
    }
    // Otherwise, with the node after it in its list, if that is on the line
    // just below it, or on its line.
    const next = mine.find(({ node }) => poscmp(node.from, c.to) >= 0);
    if (next && next.node.from.line - c.to.line <= 1) {
      addComment(next.node, comment, blockComment);
    } else {
      orphans.push(comment);
    }
  }
  return placeOrphans(roots, orphans, blockComment);
}
