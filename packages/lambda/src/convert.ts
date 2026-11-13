import { parseWithComments } from "./parser";
import type { LambdaNode } from "./parser";
import {
  Assignment,
  Binary,
  Call,
  Conditional,
  Lambda,
  LAMBDA_BLOCK_COMMENT,
  Let,
  Not,
  Prog,
  VarDef,
} from "./ast";
import { attachComments, Nodes } from "@bootstrapworld/codemirror-blocks";
import type { ASTNode, Pos } from "@bootstrapworld/codemirror-blocks";

const { Literal, Blank } = Nodes;

type Loc = { from: Pos; to: Pos };

/** A string as it is written: the parser's escapes, undone */
function quote(str: string) {
  const escaped = str
    .replace(/[\\"]/g, "\\$&")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t")
    .replace(/\r/g, "\\r");
  return '"' + escaped + '"';
}

/**
 * Convert the parser's intermediate tree into ASTNodes. A few nodes
 * synthesized by the parser (e.g. the `false` filling in for a missing
 * `let` binding) carry no location, so they take their parent's.
 */
function convert(node: LambdaNode, parent: Loc): ASTNode {
  const loc: Loc = {
    from: node.from ?? parent.from,
    to: node.to ?? parent.to,
  };
  const { from, to } = loc;
  const all = (nodes: LambdaNode[]) => nodes.map((n) => convert(n, loc));
  switch (node.type) {
    case "prog":
      return Prog(from, to, all(node.prog));
    case "num":
      return Literal(from, to, {
        value: String(node.value),
        dataType: "number",
      });
    case "str":
      return Literal(from, to, {
        value: quote(node.value),
        dataType: "string",
      });
    case "blank":
      return Blank(from, to, { value: "...", dataType: "blank" });
    case "bool":
      return Literal(from, to, { value: String(node.value), dataType: "bool" });
    case "var":
      return Literal(from, to, { value: node.value, dataType: "symbol" });
    case "literal":
      // variable names, as read by `parseVarname`
      return Literal(from, to, { value: node.name.value, dataType: "symbol" });
    case "raw":
      return Literal(from, to, {
        value: "js:raw " + quote(node.code),
        dataType: "raw",
      });
    case "def":
      return VarDef(
        from,
        to,
        convert(node.name, loc),
        node.body ? convert(node.body, loc) : null
      );
    case "lambda":
      return Lambda(
        from,
        to,
        node.name
          ? Literal(from, from, { value: node.name, dataType: "symbol" })
          : null,
        all(node.vars),
        convert(node.body, loc)
      );
    case "call":
      return Call(from, to, convert(node.func, loc), all(node.args));
    case "assign":
      return Assignment(
        from,
        to,
        node.operator,
        convert(node.left, loc),
        convert(node.right, loc)
      );
    case "binary":
      return Binary(
        from,
        to,
        node.operator,
        convert(node.left, loc),
        convert(node.right, loc)
      );
    case "let":
      return Let(
        from,
        to,
        node.name ? convert(node.name, loc) : null,
        all(node.vars),
        convert(node.body, loc)
      );
    case "if": {
      // (`else if` is an else of one step that is another if)
      const otherwise = node.else
        ? node.else.type === "prog"
          ? node.else.prog
          : [node.else]
        : [];
      return Conditional(
        from,
        to,
        convert(node.cond, loc),
        steps(node.then, loc),
        all(otherwise)
      );
    }
    case "not":
      return Not(from, to, convert(node.body, loc));
    default:
      throw new Error("Don't know how to convert node of type " + node.type);
  }
}

/** The steps of a then-part: those of a block of several, or the one step */
function steps(node: LambdaNode, loc: Loc): ASTNode[] {
  const list = node.type === "prog" ? node.prog : [node];
  return list.map((n: LambdaNode) => convert(n, loc));
}

export default function parseString(code: string): ASTNode[] {
  const { root, comments } = parseWithComments(code);
  const origin = { line: 0, ch: 0 };
  const lines = code.split("\n");
  const end = { line: lines.length - 1, ch: lines[lines.length - 1].length };
  // a program of nothing has no block to draw (one of only comments has one)
  if (root.type === "prog" && root.prog.length === 0 && comments.length === 0) {
    return [];
  }
  // (the program is all of the text, so that the comments before its first
  // statement and after its last are in it)
  const prog = convert(
    { ...root, from: origin, to: end },
    { from: origin, to: end }
  );
  return attachComments(code, [prog], {
    blockComment: LAMBDA_BLOCK_COMMENT,
    comments,
    topLevel: prog,
  });
}
