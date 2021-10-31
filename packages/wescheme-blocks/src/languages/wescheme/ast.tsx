import React from "react";
import {
  ASTNode,
  Pretty as P,
  Node,
  Nodes,
  NodeSpec as Spec,
} from "codemirror-blocks";
import { Pos } from "codemirror-blocks/lib/ast";

/**
 * given a noun and an array, generate a (possibly-plural)
 * version of that noun
 */
function pluralize(noun: string, set: unknown[]) {
  return set.length + " " + noun + (set.length != 1 ? "s" : "");
}

/* Override the default pretty printer for Sequences,
 * so that they print as s-expressions
 */
export function Sequence<Expr extends ASTNode = ASTNode>(
  from: Pos,
  to: Pos,
  exprs: Expr[],
  name: ASTNode,
  options = {}
) {
  return new ASTNode({
    from,
    to,
    type: "sequence",
    fields: { name, exprs },
    options,
    ...Nodes.SequenceProps,
    pretty: (node) => P.standardSexpr(node.fields.name, node.fields.exprs),
  });
}

export function LetLikeExpr(
  from: Pos,
  to: Pos,
  form: string,
  bindings: ASTNode<{ exprs: ASTNode<{ name: ASTNode; body: ASTNode }>[] }>,
  expr: ASTNode,
  options = {}
) {
  return new ASTNode({
    from,
    to,
    type: "letLikeExpr",
    fields: { form, bindings, expr },
    options,
    pretty(node) {
      return P.lambdaLikeSexpr(
        node.fields.form,
        P.horz(
          "(",
          P.sepBy(
            node.fields.bindings.fields.exprs.map((expr) =>
              P.standardSexpr(expr.fields.name, [expr.fields.body])
            ),
            " "
          ),
          ")"
        ),
        node.fields.expr
      );
    },
    render(props) {
      return (
        <Node {...props}>
          <span className="blocks-operator">{props.node.fields.form}</span>
          {props.node.fields.bindings.reactElement()}
          {props.node.fields.expr.reactElement()}
        </Node>
      );
    },
    longDescription(node, _level) {
      return `a ${node.fields.form} expression with ${pluralize(
        "binding",
        node.fields.bindings.fields.exprs
      )}`;
    },
    spec: Spec.nodeSpec([
      Spec.value("form"),
      Spec.required("bindings"),
      Spec.required("expr"),
    ]),
  });
}
export function WhenUnless(
  from: Pos,
  to: Pos,
  form: string,
  predicate: ASTNode,
  exprs: ASTNode,
  options = {}
) {
  return new ASTNode({
    from,
    to,
    type: "whenUnlessExpr",
    fields: { form, predicate, exprs },
    options,
    pretty(node) {
      return P.standardSexpr(node.fields.form, [
        node.fields.predicate,
        node.fields.exprs,
      ]);
    },
    render(props) {
      return (
        <Node {...props}>
          <span className="blocks-operator">{props.node.fields.form}</span>
          {props.node.fields.predicate.reactElement()}
          {props.node.fields.exprs.reactElement()}
        </Node>
      );
    },
    longDescription(node, level) {
      return `a ${node.fields.form} expression: ${
        node.fields.form
      } ${node.fields.predicate.describe(level)}, ${node.fields.exprs.describe(
        level
      )}`;
    },
    spec: Spec.nodeSpec([
      Spec.value("form"),
      Spec.required("predicate"),
      Spec.required("exprs"),
    ]),
  });
}
