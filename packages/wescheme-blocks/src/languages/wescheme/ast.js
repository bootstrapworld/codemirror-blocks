import {
  React,
  ASTNode,
  Pretty as P,
  Node,
  Nodes,
  NodeSpec as Spec,
} from "codemirror-blocks";

/**
 * given a noun and an array, generate a (possibly-plural)
 * version of that noun
 */
function pluralize(noun, set) {
  return set.length + " " + noun + (set.length != 1 ? "s" : "");
}

/* Override the default pretty printer for Sequences,
 * so that they print as s-expressions
 */
export class Sequence extends Nodes.Sequence {
  pretty() {
    return P.standardSexpr(this.fields.name, this.fields.exprs);
  }
}

export class LetLikeExpr extends ASTNode {
  constructor(from, to, form, bindings, expr, options = {}) {
    super({
      from,
      to,
      type: "letLikeExpr",
      fields: { form, bindings, expr },
      options,
      pretty(node) {
        return P.lambdaLikeSexpr(
          node.fields.form,
          P.brackets(node.bindings),
          node.expr
        );
      },
      render(props) {
        return (
          <Node node={this} {...props}>
            <span className="blocks-operator">{props.node.fields.form}</span>
            {props.node.bindings.reactElement()}
            {props.node.expr.reactElement()}
          </Node>
        );
      },
      longDescription(node, _level) {
        return `a ${node.fields.form} expression with ${pluralize(
          "binding",
          node.bindings.exprs
        )}`;
      },
      spec: Spec.nodeSpec([
        Spec.value("form"),
        Spec.required("bindings"),
        Spec.required("expr"),
      ]),
    });
  }
}

export class WhenUnless extends ASTNode {
  constructor(from, to, form, predicate, exprs, options = {}) {
    super({
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
          <Node node={this} {...props}>
            <span className="blocks-operator">{props.node.fields.form}</span>
            {props.node.fields.predicate.reactElement()}
            {props.node.fields.exprs.reactElement()}
          </Node>
        );
      },
      longDescription(node, level) {
        return `a ${node.fields.form} expression: ${
          node.fields.form
        } ${node.fields.predicate.describe(
          level
        )}, ${node.fields.exprs.describe(level)}`;
      },
      spec: Spec.nodeSpec([
        Spec.value("form"),
        Spec.required("predicate"),
        Spec.required("exprs"),
      ]),
    });
  }
}
