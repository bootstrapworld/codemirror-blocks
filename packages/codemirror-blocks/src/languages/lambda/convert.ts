import type { ASTNode, Pos } from "../../ast";
import { Comment, Literal } from "../../nodes";
import { attachComments, parseToIntermediateAST } from "./parser";
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
  // (comments that no list of orphans took go with the node they were before)
  if (node.before) {
    attachComments(node, node.before);
    delete node.before;
  }
  // (whatever comment came before the node goes with it)
  const { comment } = node;
  const options = comment
    ? {
        comment: Comment(comment.from, comment.to, comment.text, {
          blockComment: LAMBDA_BLOCK_COMMENT,
        }),
      }
    : {};
  switch (node.type) {
    case "orphan":
      return Comment(from, to, comment!.text, {
        blockComment: LAMBDA_BLOCK_COMMENT,
        orphan: true,
      });
    case "prog": {
      // the parser gives a program the location of its last token: it spans
      // what it holds, or its block would not cover its own children
      const body = all(node.prog);
      // (a comment that goes with the first or the last is in the program too)
      return body.length
        ? Prog(
            body[0].srcRange().from,
            body[body.length - 1].srcRange().to,
            body,
            options
          )
        : Prog(from, to, body, options);
    }
    case "num":
      return Literal(from, to, String(node.value), "number", options);
    case "str":
      return Literal(from, to, quote(node.value), "string", options);
    case "bool":
      return Literal(from, to, String(node.value), "bool", options);
    case "var":
      return Literal(from, to, node.value, "symbol", options);
    case "literal":
      // variable names, as read by `parseVarname`
      return Literal(from, to, node.name.value, "symbol", options);
    case "raw":
      return Literal(from, to, "js:raw " + quote(node.code), "raw", options);
    case "def":
      return VarDef(
        from,
        to,
        convert(node.name, loc),
        node.body ? convert(node.body, loc) : null,
        options
      );
    case "lambda":
      return Lambda(
        from,
        to,
        node.name ? Literal(from, from, node.name, "symbol") : null,
        all(node.vars),
        convert(node.body, loc),
        options
      );
    case "call":
      return Call(from, to, convert(node.func, loc), all(node.args), options);
    case "assign":
      return Assignment(
        from,
        to,
        node.operator,
        convert(node.left, loc),
        convert(node.right, loc),
        options
      );
    case "binary":
      return Binary(
        from,
        to,
        node.operator,
        convert(node.left, loc),
        convert(node.right, loc),
        options
      );
    case "let":
      return Let(
        from,
        to,
        node.name ? convert(node.name, loc) : null,
        all(node.vars),
        convert(node.body, loc),
        options
      );
    case "if":
      return Conditional(
        from,
        to,
        convert(node.cond, loc),
        convert(node.then, loc),
        node.else ? convert(node.else, loc) : null,
        options
      );
    case "not":
      return Not(from, to, convert(node.body, loc), options);
    default:
      throw new Error("Don't know how to convert node of type " + node.type);
  }
}

export default function parseString(code: string): ASTNode[] {
  const root = parseToIntermediateAST(code);
  const origin = { line: 0, ch: 0 };
  // a program of nothing has no block to draw (one of only comments has one)
  if (root.type === "prog" && root.prog.length === 0) return [];
  return [convert(root, { from: origin, to: origin })];
}
