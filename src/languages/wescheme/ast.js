import React from 'react';
import Node from '../../components/Node';
import * as P from 'pretty-fast-pretty-printer';
import * as Spec from '../../nodeSpec';
import {ASTNode, pluralize} from '../../ast';


export class LetLikeExpr extends ASTNode {
  constructor(from, to, form, bindings, expr, options={}) {
    super(from, to, 'letLikeExpr', options);
    this.form = form;
    this.bindings = bindings;
    this.expr = expr;
  }

  static spec = Spec.nodeSpec([
    Spec.value('form'),
    Spec.required('bindings'),
    Spec.required('expr')
  ])

  longDescription(_level) {
    return `a ${this.form} expression with ${pluralize("binding", this.bindings.exprs)}`;
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

export class WhenUnless extends ASTNode {
  constructor(from, to, form, predicate, exprs, options={}) {
    super(from, to, 'whenUnlessExpr', options);
    this.form = form;
    this.predicate = predicate;
    this.exprs = exprs;
  }

  static spec = Spec.nodeSpec([
    Spec.value('form'),
    Spec.required('predicate'),
    Spec.required('exprs')
  ])

  longDescription(level) {
    return `a ${this.form} expression: ${this.form} ${this.predicate.describe(level)}, ${this.exprs.describe(level)}`;
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
