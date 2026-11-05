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
function addComment(
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

export type ScannedComment = {
  from: Pos;
  to: Pos;
  lastFrom: Pos;
  text: string;
};

/**
 * The comments in Scheme-like source text, with the ones in a row (on lines one
 * after the other) as one, as a lexer that gives a node the comments above it
 * sees them: `lastFrom` is where the last of them starts. A comment that
 * follows code on its line is one of its own.
 */
export function scanSchemeComments(code: string): ScannedComment[] {
  const found: (ScannedComment & { trailing: boolean })[] = [];
  let line = 0;
  let col = 0;
  let hasCode = false;
  let i = 0;
  const pos = (): Pos => ({ line, ch: col });
  const step = (n = 1) => {
    for (let k = 0; k < n && i < code.length; k++, i++) {
      if (code[i] === "\n") {
        line++;
        col = 0;
        hasCode = false;
      } else {
        col++;
      }
    }
  };
  while (i < code.length) {
    const c = code[i];
    if (c === ";") {
      const from = pos();
      const trailing = hasCode;
      let end = code.indexOf("\n", i);
      if (end < 0) end = code.length;
      const text = code
        .slice(i, end)
        .replace(/^[;\s]*/, "")
        .trim();
      step(end - i);
      found.push({ from, to: pos(), lastFrom: from, text, trailing });
    } else if (c === "#" && code[i + 1] === "|") {
      const from = pos();
      const trailing = hasCode;
      let end = code.indexOf("|#", i + 2);
      end = end < 0 ? code.length : end + 2;
      const text = code
        .slice(i + 2, end - 2)
        .trim()
        .replace(/\s+/g, " ");
      step(end - i);
      found.push({ from, to: pos(), lastFrom: from, text, trailing });
    } else if (c === '"') {
      hasCode = true;
      step();
      while (i < code.length && code[i] !== '"') step(code[i] === "\\" ? 2 : 1);
      step();
    } else if (c === "#" && (code[i + 1] === "\\" || code[i + 1] === ";")) {
      hasCode = hasCode || code[i + 1] === "\\";
      step(2);
    } else if (c === "|") {
      hasCode = true;
      const end = code.indexOf("|", i + 1);
      step(end < 0 ? code.length - i : end + 1 - i);
    } else {
      if (!/\s/.test(c)) hasCode = true;
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
      !previous.trailing &&
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
      });
    }
    previous = c;
  }
  return groups;
}
