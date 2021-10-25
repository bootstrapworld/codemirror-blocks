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
    });
  }

  static spec = Spec.nodeSpec([
    Spec.value("form"),
    Spec.required("bindings"),
    Spec.required("expr"),
  ]);

  longDescription(_level) {
    return `a ${this.fields.form} expression with ${pluralize(
      "binding",
      this.bindings.exprs
    )}`;
  }

  pretty() {
    return P.lambdaLikeSexpr(
      this.fields.form,
      P.brackets(this.bindings),
      this.expr
    );
  }

  render(props) {
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">{this.fields.form}</span>
        {this.bindings.reactElement()}
        {this.expr.reactElement()}
      </Node>
    );
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
    });
  }

  static spec = Spec.nodeSpec([
    Spec.value("form"),
    Spec.required("predicate"),
    Spec.required("exprs"),
  ]);

  longDescription(level) {
    return `a ${this.fields.form} expression: ${
      this.fields.form
    } ${this.fields.predicate.describe(level)}, ${this.fields.exprs.describe(
      level
    )}`;
  }

  pretty() {
    return P.standardSexpr(this.fields.form, [
      this.fields.predicate,
      this.fields.exprs,
    ]);
  }

  render(props) {
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">{this.fields.form}</span>
        {this.fields.predicate.reactElement()}
        {this.fields.exprs.reactElement()}
      </Node>
    );
  }
}
