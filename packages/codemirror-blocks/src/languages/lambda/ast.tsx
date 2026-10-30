import React from "react";
import * as P from "pretty-fast-pretty-printer";
import type { ASTNode, Pos } from "../../ast";
import Args from "../../components/Args";
import Node from "../../components/Node";
import * as Spec from "../../nodeSpec";
import { CoreAST, createASTSpec } from "../../nodes";

const operatorSpec = [
  Spec.value<string, "operator">("operator"),
  Spec.required("left"),
  Spec.required("right"),
] as const;

export const LambdaAST = createASTSpec({
  ...CoreAST.config,
  prog: Spec.nodeSpec([Spec.list("exprs")]),
  call: Spec.nodeSpec([Spec.required("func"), Spec.list("args")]),
  lambda: Spec.nodeSpec([
    Spec.optional("name"),
    Spec.list("vars"),
    Spec.required("body"),
  ]),
  vardef: Spec.nodeSpec([Spec.required("name"), Spec.optional("body")]),
  letExpr: Spec.nodeSpec([Spec.list("vars"), Spec.required("body")]),
  conditional: Spec.nodeSpec([
    Spec.required("cond"),
    Spec.required("then"),
    Spec.optional("else"),
  ]),
  not: Spec.nodeSpec([Spec.required("body")]),
  binary: Spec.nodeSpec(operatorSpec),
  assignment: Spec.nodeSpec(operatorSpec),
});

/**
 * Operands of operators, the function of a call, and the body of `!` are
 * parsed greedily, so anything that isn't an atom gets parenthesized when it
 * is printed back out.
 */
function atomic(node: ASTNode): P.DocLike {
  return node.type === "literal" || node.type === "call"
    ? node
    : P.horz("(", node, ")");
}

function commaSeparated(nodes: ASTNode[]) {
  return P.horz("(", P.sepBy(nodes, ", ", ", "), ")");
}

export function Prog(from: Pos, to: Pos, exprs: ASTNode[], options = {}) {
  return LambdaAST.makeNode({
    from,
    to,
    type: "prog",
    fields: { exprs },
    options,
    pretty(node) {
      const statements = node.fields.exprs.map((expr, i, all) =>
        i < all.length - 1 ? P.horz(expr, ";") : expr
      );
      // the top-level program is bare, nested ones are `{ ...; ... }` blocks
      return node.level <= 1
        ? P.vertArray(statements)
        : P.horz("{ ", P.vertArray(statements), " }");
    },
    render(props) {
      return (
        <Node {...props}>
          <h4>Your Lambda Program</h4>
          <Args field="exprs">{props.node.fields.exprs}</Args>
        </Node>
      );
    },
    longDescription(node) {
      return `a program with ${node.fields.exprs.length} expressions`;
    },
  });
}

export function Call(
  from: Pos,
  to: Pos,
  func: ASTNode,
  args: ASTNode[],
  options = {}
) {
  return LambdaAST.makeNode({
    from,
    to,
    type: "call",
    fields: { func, args },
    options,
    pretty: (node) =>
      P.horz(atomic(node.fields.func), commaSeparated(node.fields.args)),
    render(props) {
      return (
        <Node {...props}>
          <span className="blocks-operator">
            {props.node.fields.func.reactElement()}
          </span>
          <Args field="args">{props.node.fields.args}</Args>
        </Node>
      );
    },
    longDescription: (node, level) =>
      `a call to ${node.fields.func.describe(level)} with ${
        node.fields.args.length
      } arguments`,
  });
}

export function Lambda(
  from: Pos,
  to: Pos,
  name: ASTNode | null,
  vars: ASTNode[],
  body: ASTNode,
  options = {}
) {
  return LambdaAST.makeNode({
    from,
    to,
    type: "lambda",
    fields: { name, vars, body },
    options,
    pretty: (node) =>
      P.horz(
        "lambda ",
        node.fields.name ?? "",
        commaSeparated(node.fields.vars),
        " ",
        node.fields.body
      ),
    render(props) {
      return (
        <Node {...props}>
          <span className="blocks-operator">lambda</span>
          {props.node.fields.name?.reactElement()}
          <Args field="vars">{props.node.fields.vars}</Args>
          {props.node.fields.body.reactElement()}
        </Node>
      );
    },
    longDescription: (node) =>
      `a lambda expression with ${node.fields.vars.length} parameters`,
  });
}

export function VarDef(
  from: Pos,
  to: Pos,
  name: ASTNode,
  body: ASTNode | null,
  options = {}
) {
  return LambdaAST.makeNode({
    from,
    to,
    type: "vardef",
    fields: { name, body },
    options,
    pretty: (node) =>
      node.fields.body
        ? P.horz(node.fields.name, " = ", node.fields.body)
        : P.horz(node.fields.name),
    render(props) {
      return (
        <Node {...props}>
          {props.node.fields.name.reactElement()}
          {props.node.fields.body ? (
            <>
              <span className="blocks-operator">=</span>
              {props.node.fields.body.reactElement()}
            </>
          ) : null}
        </Node>
      );
    },
    longDescription: (node, level) =>
      `a definition of ${node.fields.name.describe(level)}`,
  });
}

export function Let(
  from: Pos,
  to: Pos,
  vars: ASTNode[],
  body: ASTNode,
  options = {}
) {
  return LambdaAST.makeNode({
    from,
    to,
    type: "letExpr",
    fields: { vars, body },
    options,
    pretty: (node) =>
      P.horz("let ", commaSeparated(node.fields.vars), " ", node.fields.body),
    render(props) {
      return (
        <Node {...props}>
          <span className="blocks-operator">let</span>
          <Args field="vars">{props.node.fields.vars}</Args>
          {props.node.fields.body.reactElement()}
        </Node>
      );
    },
    longDescription: (node) =>
      `a let expression with ${node.fields.vars.length} variables`,
  });
}

export function Conditional(
  from: Pos,
  to: Pos,
  cond: ASTNode,
  then: ASTNode,
  else_: ASTNode | null,
  options = {}
) {
  return LambdaAST.makeNode({
    from,
    to,
    type: "conditional",
    fields: { cond, then, else: else_ },
    options,
    pretty: (node) =>
      node.fields.else
        ? P.horz(
            "if ",
            node.fields.cond,
            " then ",
            node.fields.then,
            " else ",
            node.fields.else
          )
        : P.horz("if ", node.fields.cond, " then ", node.fields.then),
    render(props) {
      const { cond, then, else: else_ } = props.node.fields;
      return (
        <Node {...props}>
          <span className="blocks-operator">if</span>
          {cond.reactElement()}
          <span className="blocks-operator">then</span>
          {then.reactElement()}
          {else_ ? (
            <>
              <span className="blocks-operator">else</span>
              {else_.reactElement()}
            </>
          ) : null}
        </Node>
      );
    },
    longDescription: (node, level) =>
      `an if expression: if ${node.fields.cond.describe(
        level
      )}, then ${node.fields.then.describe(level)}`,
  });
}

export function Not(from: Pos, to: Pos, body: ASTNode, options = {}) {
  return LambdaAST.makeNode({
    from,
    to,
    type: "not",
    fields: { body },
    options,
    pretty: (node) => P.horz("!", atomic(node.fields.body)),
    render(props) {
      return (
        <Node {...props}>
          <span className="blocks-operator">!</span>
          {props.node.fields.body.reactElement()}
        </Node>
      );
    },
    longDescription: (node, level) =>
      `the negation of ${node.fields.body.describe(level)}`,
  });
}

function operatorNode(type: "binary" | "assignment") {
  return (
    from: Pos,
    to: Pos,
    operator: string,
    left: ASTNode,
    right: ASTNode,
    options = {}
  ) =>
    LambdaAST.makeNode({
      from,
      to,
      type,
      fields: { operator, left, right },
      options,
      pretty: (node) =>
        P.horz(
          atomic(node.fields.left),
          ` ${node.fields.operator} `,
          atomic(node.fields.right)
        ),
      render(props) {
        return (
          <Node {...props}>
            {props.node.fields.left.reactElement()}
            <span className="blocks-operator">
              {props.node.fields.operator}
            </span>
            {props.node.fields.right.reactElement()}
          </Node>
        );
      },
      longDescription: (node, level) =>
        `${node.fields.left.describe(level)} ${
          node.fields.operator
        } ${node.fields.right.describe(level)}`,
    });
}

export const Binary = operatorNode("binary");
export const Assignment = operatorNode("assignment");
