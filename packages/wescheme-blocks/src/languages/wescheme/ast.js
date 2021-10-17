import {
  React,
  AST,
  Pretty as P,
  Node,
  Nodes,
  NodeSpec as Spec,
} from "codemirror-blocks";
const { pluralize } = AST;

/* Override the default pretty printer for Sequences,
 * so that they print as s-expressions
 */
export class Sequence extends Nodes.Sequence {
  pretty() {
    return P.standardSexpr(this.name, this.exprs);
  }
}

export class LetLikeExpr extends AST.ASTNode {
  constructor(from, to, form, bindings, expr, options = {}) {
    super(from, to, "letLikeExpr", options);
    this.form = form;
    this.bindings = bindings;
    this.expr = expr;
  }

  static spec = Spec.nodeSpec([
    Spec.value("form"),
    Spec.required("bindings"),
    Spec.required("expr"),
  ]);

  longDescription(_level) {
    return `a ${this.form} expression with ${pluralize(
      "binding",
      this.bindings.exprs
    )}`;
  }

  pretty() {
    return P.lambdaLikeSexpr(this.form, P.brackets(this.bindings), this.expr);
  }

  render(props) {
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">{this.form}</span>
        {this.bindings.reactElement()}
        {this.expr.reactElement()}
      </Node>
    );
  }
}

export class WhenUnless extends AST.ASTNode {
  constructor(from, to, form, predicate, exprs, options = {}) {
    super(from, to, "whenUnlessExpr", options);
    this.form = form;
    this.predicate = predicate;
    console.log("predicate is", predicate);
    this.exprs = exprs;
  }

  static spec = Spec.nodeSpec([
    Spec.value("form"),
    Spec.required("predicate"),
    Spec.required("exprs"),
  ]);

  longDescription(level) {
    return `a ${this.form} expression: ${this.form} ${this.predicate.describe(
      level
    )}, ${this.exprs.describe(level)}`;
  }

  pretty() {
    return P.standardSexpr(this.form, [this.predicate, this.exprs]);
  }

  render(props) {
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">{this.form}</span>
        {this.predicate.reactElement()}
        {this.exprs.reactElement()}
      </Node>
    );
  }
}
