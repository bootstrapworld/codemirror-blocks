import type { ASTNode, Pos } from "../../ast";
import { Literal } from "../../nodes";
import { parseToIntermediateAST } from "./parser";
import type { LambdaNode } from "./parser";
import {
  Assignment,
  Binary,
  Call,
  Conditional,
  Lambda,
  Let,
  Not,
  Prog,
  VarDef,
} from "./ast";

type Loc = { from: Pos; to: Pos };

function quote(str: string) {
  return '"' + str.replace(/[\\"]/g, "\\$&") + '"';
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
      return Literal(from, to, String(node.value), "number");
    case "str":
      return Literal(from, to, quote(node.value), "string");
    case "bool":
      return Literal(from, to, String(node.value), "bool");
    case "var":
      return Literal(from, to, node.value, "symbol");
    case "literal":
      // variable names, as read by `parseVarname`
      return Literal(from, to, node.name.value, "symbol");
    case "raw":
      return Literal(from, to, "js:raw " + quote(node.code), "raw");
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
        node.name ? Literal(from, from, node.name, "symbol") : null,
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
      return Let(from, to, all(node.vars), convert(node.body, loc));
    case "if":
      return Conditional(
        from,
        to,
        convert(node.cond, loc),
        convert(node.then, loc),
        node.else ? convert(node.else, loc) : null
      );
    case "not":
      return Not(from, to, convert(node.body, loc));
    default:
      throw new Error("Don't know how to convert node of type " + node.type);
  }
}

export default function parseString(code: string): ASTNode[] {
  const root = parseToIntermediateAST(code);
  const origin = { line: 0, ch: 0 };
  return [convert(root, { from: origin, to: origin })];
}
