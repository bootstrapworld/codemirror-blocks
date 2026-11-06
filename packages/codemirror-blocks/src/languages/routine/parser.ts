import type { ASTNode, Pos } from "../../ast";
import { Comment } from "../../nodes";
import { addComment, placeOrphans, scanSchemeComments } from "../../orphans";
import { poscmp } from "../../utils";
import {
  Call,
  Choice,
  Define,
  Name,
  Num,
  Repeat,
  ROUTINE_BLOCK_COMMENT,
  Show,
  Text,
} from "./ast";

/*
 * Routine is written as s-expressions:
 *
 *   (let minutes 10)               a name, and what it starts as (or nothing yet)
 *   (show "Good morning")
 *   (repeat 3 step...)             the steps are on the lines below
 *   (if test then [otherwise])
 *   (+ minutes 5)                  any other form is a calculation
 *
 * with `;` and `#| |#` comments.
 */

type Sexp =
  | {
      kind: "atom";
      type: "number" | "text" | "name";
      text: string;
      from: Pos;
      to: Pos;
    }
  | { kind: "list"; items: Sexp[]; from: Pos; to: Pos };

/** Reads the text into s-expressions, each with its place in the text */
function read(code: string): Sexp[] {
  let i = 0;
  let line = 0;
  let ch = 0;
  const here = (): Pos => ({ line, ch });
  const step = () => {
    if (code[i] === "\n") {
      line++;
      ch = 0;
    } else {
      ch++;
    }
    i++;
  };
  const skipSpace = () => {
    for (;;) {
      if (/\s/.test(code[i] ?? "x")) {
        step();
      } else if (code[i] === ";") {
        while (i < code.length && code[i] !== "\n") step();
      } else if (code.startsWith("#|", i)) {
        let depth = 0;
        do {
          if (i >= code.length)
            throw new Error("A comment is not closed: it needs |# at the end.");
          if (code.startsWith("#|", i)) {
            depth++;
            step();
          } else if (code.startsWith("|#", i)) {
            depth--;
            step();
          }
          step();
        } while (depth > 0);
      } else {
        return;
      }
    }
  };
  const readOne = (): Sexp => {
    skipSpace();
    const from = here();
    if (code[i] === "(") {
      step();
      const items: Sexp[] = [];
      for (;;) {
        skipSpace();
        if (i >= code.length) {
          throw new Error(
            `The ( at line ${from.line + 1} is not closed: it needs a ) at the end.`
          );
        }
        if (code[i] === ")") {
          step();
          return { kind: "list", items, from, to: here() };
        }
        items.push(readOne());
      }
    }
    if (code[i] === ")") {
      throw new Error(`There is a ) at line ${line + 1} with no ( before it.`);
    }
    if (code[i] === '"') {
      let raw = '"';
      step();
      while (i < code.length && code[i] !== '"') {
        if (code[i] === "\n") {
          throw new Error(
            `The text at line ${from.line + 1} is not closed: it needs a " on the same line.`
          );
        }
        if (code[i] === "\\") {
          raw += code[i];
          step();
        }
        raw += code[i] ?? "";
        step();
      }
      if (i >= code.length) {
        throw new Error(
          `The text at line ${from.line + 1} is not closed: it needs a " at the end.`
        );
      }
      step();
      let text: string;
      try {
        text = JSON.parse(raw + '"');
      } catch {
        throw new Error(
          `The text at line ${from.line + 1} has a \\ that means nothing.`
        );
      }
      return { kind: "atom", type: "text", text, from, to: here() };
    }
    let text = "";
    while (i < code.length && /[^\s();"]/.test(code[i])) {
      text += code[i];
      step();
    }
    const type = /^-?\d+(\.\d+)?$/.test(text) ? "number" : "name";
    return { kind: "atom", type, text, from, to: here() };
  };

  const roots: Sexp[] = [];
  for (;;) {
    skipSpace();
    if (i >= code.length) return roots;
    roots.push(readOne());
  }
}

/** Makes the node an s-expression stands for */
function build(s: Sexp): ASTNode {
  if (s.kind === "atom") {
    return s.type === "number"
      ? Num(s.from, s.to, Number(s.text))
      : s.type === "text"
        ? Text(s.from, s.to, s.text)
        : Name(s.from, s.to, s.text);
  }
  const [head, ...rest] = s.items;
  if (!head) {
    throw new Error(
      `There are empty parentheses at line ${s.from.line + 1}: put a form inside.`
    );
  }
  if (head.kind !== "atom" || head.type === "text") {
    throw new Error(
      `The form at line ${s.from.line + 1} must start with a name or an operator, like show or +.`
    );
  }
  const form = head.text;
  const expect = (n: number, what: string, max = n) => {
    if (rest.length < n || rest.length > max) {
      throw new Error(
        `(${form} ...) at line ${s.from.line + 1} needs ${what}.`
      );
    }
  };
  switch (form) {
    case "let": {
      expect(1, "a name, and optionally what it starts as", 2);
      const name = rest[0];
      if (name.kind !== "atom" || name.type !== "name") {
        throw new Error(
          `(let ...) at line ${s.from.line + 1} must name something first.`
        );
      }
      return Define(s.from, s.to, build(name), rest[1] ? build(rest[1]) : null);
    }
    case "show":
      expect(1, "one thing to show");
      return Show(s.from, s.to, build(rest[0]));
    case "repeat":
      expect(1, "how many times, then the steps", Infinity);
      return Repeat(s.from, s.to, build(rest[0]), rest.slice(1).map(build));
    case "if":
      expect(2, "a test, what to do, and optionally what to do otherwise", 3);
      return Choice(
        s.from,
        s.to,
        build(rest[0]),
        build(rest[1]),
        rest[2] ? build(rest[2]) : null
      );
    default:
      return Call(s.from, s.to, form, rest.map(build));
  }
}

type Placed = { node: ASTNode; parent: ASTNode | null };
const walk = (node: ASTNode, parent: ASTNode | null, into: Placed[]) => {
  into.push({ node, parent });
  for (const child of node.children()) walk(child, node, into);
};

/**
 * A comment on the lines just above a node, in the same list, goes with it;
 * any other is a block of its own, in the list that holds it.
 */
function placeComments(code: string, roots: ASTNode[]): ASTNode[] {
  const all: Placed[] = [];
  for (const root of roots) walk(root, null, all);
  const orphans: ASTNode[] = [];
  for (const c of scanSchemeComments(code)) {
    const comment = Comment(c.from, c.to, c.text, {
      blockComment: ROUTINE_BLOCK_COMMENT,
      orphan: true,
    });
    const next = all.find(({ node }) => poscmp(node.from, c.to) >= 0);
    const adjacent = next && next.node.from.line - c.to.line <= 1;
    const sameList =
      next &&
      (!next.parent ||
        (poscmp(next.parent.from, c.from) <= 0 &&
          poscmp(c.to, next.parent.to) <= 0));
    if (next && adjacent && sameList) {
      addComment(next.node, comment, ROUTINE_BLOCK_COMMENT);
    } else {
      orphans.push(comment);
    }
  }
  return placeOrphans(roots, orphans, ROUTINE_BLOCK_COMMENT);
}

export function parse(code: string): ASTNode[] {
  const roots = read(code).map(build);
  return placeComments(code, roots);
}
