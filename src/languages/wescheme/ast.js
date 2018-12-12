import React from 'react';
import Node from '../../components/Node';

import {ASTNode, pluralize, descDepth} from '../../ast';

export class LetLikeExpr extends ASTNode {
  constructor(from, to, form, bindings, expr, options={}) {
    super(from, to, 'letLikeExpr', ['bindings', 'expr'], options);
    this.form = form;
    this.bindings = bindings;
    this.expr = expr;
  }

  toDescription(level){
    if((this.level - level) >= descDepth) return this.options['aria-label'];
    return `a ${this.form} expression with ${pluralize("binding", this.bindings.exprs)}`;
  }

  pretty() {
    return P.lambdaLikeSexpr(this.form, P.brackets(this.bindings), this.expr);
  }

  render(props) {
    const {helpers, lockedTypes} = this.props;
    return (
      <Node node={this} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-operator">{this.form}</span>
        {helpers.renderNodeForReact(this.bindings)}
        {helpers.renderNodeForReact(this.expr)}
      </Node>
    );
  }
}

export class WhenUnless extends ASTNode {
  constructor(from, to, form, predicate, exprs, options={}) {
    super(from, to, 'whenUnlessExpr', ['predicate', 'exprs'], options);
    this.form = form;
    this.predicate = predicate;
    this.exprs = exprs;
  }

  toDescription(level){
    if((this.level - level) >= descDepth) return this.options['aria-label'];
    return `a ${this.form} expression: ${this.form} ${this.predicate.toDescription(level)}, ${this.exprs.toDescription(level)}`;
  }

  pretty() {
    return P.standardSexpr(this.form, [this.predicate, this.exprs]);
  }

  render(props) {
    const {helpers, lockedTypes} = this.props;
    return (
      <Node node={this} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-operator">{this.form}</span>
        {helpers.renderNodeForReact(this.predicate)}
        {helpers.renderNodeForReact(this.exprs)}
      </Node>
    );
  }
}
