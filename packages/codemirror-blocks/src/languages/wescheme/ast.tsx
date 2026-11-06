import React from "react";
import * as P from "pretty-fast-pretty-printer";
import { ASTNode, pluralize } from "../../ast";
import type { Pos } from "../../ast";
import Node from "../../components/Node";
import * as Spec from "../../nodeSpec";
import * as Nodes from "../../nodes";
import { CoreAST, createASTSpec } from "../../nodes";

export const WeSchemeAST = createASTSpec({
  ...CoreAST.config,
  letLikeExpr: Spec.nodeSpec(
    [
      Spec.value<string, "form">("form"),
      Spec.required("bindings"),
      Spec.required("expr"),
    ],
    { label: "let expression" }
  ),
  whenUnlessExpr: Spec.nodeSpec(
    [
      Spec.value<string, "form">("form"),
      Spec.required("predicate"),
      Spec.required("exprs"),
    ],
    { label: "when or unless expression" }
  ),
});

/* Override the default pretty printer for Sequences,
 * so that they print as s-expressions
 */
export function Sequence<Expr extends ASTNode = ASTNode>(
  from: Pos,
  to: Pos,
  exprs: Expr[],
  name: ASTNode | null,
  options = {}
) {
  return WeSchemeAST.makeNode({
    from,
    to,
    type: "sequence",
    fields: { name, exprs },
    options,
    ...Nodes.SequenceProps,
    pretty: (node) =>
      Nodes.withComment(
        P.standardSexpr(node.fields.name || "", node.fields.exprs),
        node.options.comment,
        node
      ),
  });
}

export function LetLikeExpr(
  from: Pos,
  to: Pos,
  form: string,
  bindings: ASTNode,
  expr: ASTNode,
  options = {}
) {
  return WeSchemeAST.makeNode({
    from,
    to,
    type: "letLikeExpr",
    fields: { form, bindings, expr },
    options,
    pretty(node) {
      if (!WeSchemeAST.isNodeOfType(node.fields.bindings, "sequence")) {
        throw new Error(
          `Expected letLikeExpr to be constructed with sequence for its binding field`
        );
      }
      return Nodes.withComment(
        P.lambdaLikeSexpr(
          node.fields.form,
          P.horz(
            "(",
            P.sepBy(
              node.fields.bindings.fields.exprs.map((expr) => {
                if (!WeSchemeAST.isNodeOfType(expr, "variableDefinition")) {
                  throw new Error(
                    `Expected letLikeExpr to have sequence of variableDefinition nodes`
                  );
                }
                return Nodes.withComment(
                  P.standardSexpr(expr.fields.name, [expr.fields.body]),
                  expr.options.comment,
                  expr as unknown as Parameters<typeof Nodes.withComment>[2]
                );
              }),
              " "
            ),
            ")"
          ),
          node.fields.expr
        ),
        node.options.comment,
        node
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
      if (!WeSchemeAST.isNodeOfType(node.fields.bindings, "sequence")) {
        throw new Error(
          `Expected letLikeExpr to be constructed with sequence for its binding field`
        );
      }
      return `a ${node.fields.form} expression with ${pluralize(
        "binding",
        node.fields.bindings.fields.exprs
      )}`;
    },
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
  return WeSchemeAST.makeNode({
    from,
    to,
    type: "whenUnlessExpr",
    fields: { form, predicate, exprs },
    options,
    pretty(node) {
      // The body is a sequence whose `begin` is only there so that the block
      // shows the body as one group (see parseNode). It is not in the source:
      // printing it would wrap the body in another `begin` each time the
      // program went from blocks to text and back.
      const body = node.fields.exprs;
      return Nodes.withComment(
        P.standardSexpr(node.fields.form, [
          node.fields.predicate,
          ...(WeSchemeAST.isNodeOfType(body, "sequence")
            ? body.fields.exprs
            : [body]),
        ]),
        node.options.comment ?? body.options.comment,
        node
      );
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
  });
}
