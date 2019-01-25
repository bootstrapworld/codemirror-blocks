import React from 'react';
import Node from '../../components/Node';
import * as P from '../../pretty';

import {ASTNode, pluralize, descDepth} from '../../ast';


// Binop ABlank Bind Func Sekwence Var Assign Let

// each class has constructor toDescription pretty render

export class Binop extends ASTNode {
  constructor(from, to, op, left, right, options={}) {
    super(from, to, 'binop', ['left', 'right'], options);
    this.op = op;
    this.left = left;
    this.right = right;
  }

  toDescription(level) {
    if ((this.level - level) >= descDepth) return this.options['aria-label'];
    return `a ${this.op} expression with ${this.left.toDescription(level)} and ${this.right.toDescription(level)}`;
  }

  pretty() {
    return P.standardSexpr(this.op, [this.left, this.right]);
  }

  render(props) {
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">{this.op}</span>
        {this.left.reactElement()}
        {this.right.reactElement()}
      </Node>
    );
  }
}

export class ABlank extends ASTNode {
  constructor(from, to, options={}) {
    super(from, to, 'a-blank', [], options);
  }

  toDescription(level) {
    if ((this.level - level) >= descDepth) return this.options['aria-label'];
    return `a blank expression`;
  }

  pretty() {
    return P.standardSexpr('Any');
  }

  render(props) {
    return (
      <Node node={this} {...props}>
        <span className="blocks-literal-symbol">BLANK</span>
      </Node>
    );
  }
}

export class Bind extends ASTNode {
  constructor(from, to, id, ann, options={}) {
    super(from, to, 'bind', ['ann'], options);
    this.id = id;
    this.ann = ann;
  }

  toDescription(level) {
    if ((this.level - level) >= descDepth) return this.options['aria-label'];
    return `a bind expression with ${this.id} and ${this.ann}`;
  }

  pretty() {
    return P.standardSexpr(this.id, [this.ann]);
  }

  render(props) {
    return (
      <Node node={this} {...props}>
        <span className="blocks-literal-symbol">{this.id}</span>
      </Node>
    );
  }
}

export class Func extends ASTNode {
  constructor(from, to, name, args, retAnn, doc, body, options={}) {
    super(from, to, 'func', ['args', 'retAnn', 'body'], options);
    this.name = name;
    this.args = args;
    this.retAnn = retAnn;
    this.doc = doc;
    this.body = body;
  }

  toDescription(level) {
    if ((this.level - level) >= descDepth) return this.options['aria-label'];
    return `a func expression with ${this.name}, ${this.args} and ${this.body.toDescription(level)}`;
  }

  pretty() {
    return P.lambdaLikeSexpr(this.id, this.args, this.body);
  }

  render(props) {
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">{this.name}</span>
        <span className="blocks-args">{this.args.reactElement()}</span>
        {this.body.reactElement()}
      </Node>
    );
  }
}

export class Sekwence extends ASTNode {
  constructor(from, to, exprs, name, options={}) {
    super(from, to, 'sekwence', ['exprs'], options);
    this.exprs = exprs;
    this.name = name;
  }

  toDescription(level) {
    if ((this.level - level) >= descDepth) return this.options['aria-label'];
    return `a sequence containing ${this.exprs.toDescription(level)}`;
  }

  pretty() {
    return P.standardSexpr(this.name, this.exprs);
  }

  render(props) {
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">{this.name}</span>
        {this.exprs.reactElement()}
      </Node>
    );
  }
}

export class Var extends ASTNode {
  constructor(from, to, id, rhs, options={}) {
    super(from, to, 'var', ['id', 'rhs'], options);
    this.id = id;
    this.rhs = rhs;
  }

  toDescription(level) {
    if ((this.level - level) >= descDepth) return this.options['aria-label'];
    return `a var setting ${this.id} to ${this.rhs}`;
  }

  pretty() {
    return P.standardSexpr('var', [this.id, this.rhs]);
  }

  render(props) {
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">VAR</span>
        <span className="block-args">
        {this.id.reactElement()}
        {this.rhs.reactElement()}
        </span>
      </Node>
    );
  }
}

export class Assign extends ASTNode {
  constructor(from, to, id, rhs, options={}) {
    super(from, to, 'assign', ['id', 'rhs'], options);
    this.id = id;
    this.rhs = rhs;
  }

  toDescription(level) {
    if ((this.level - level) >= descDepth) return this.options['aria-label'];
    return `a assign setting ${this.id} to ${this.rhs}`;
  }

  pretty() {
    return P.standardSexpr(':=', [this.id, this.rhs]);
  }

  render(props) {
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">:=</span>
        <span className="block-args">
        {this.id.reactElement()}
        {this.rhs.reactElement()}
        </span>
      </Node>
    );
  }
}

export class Let extends ASTNode {
  constructor(from, to, id, rhs, options={}) {
    super(from, to, 'let', ['id', 'rhs'], options);
    this.id = id;
    this.rhs = rhs;
  }

  toDescription(level) {
    if ((this.level - level) >= descDepth) return this.options['aria-label'];
    return `a let setting ${this.id} to ${this.rhs}`;
  }

  pretty() {
    return P.standardSexpr('let', [this.id, this.rhs]);
  }

  render(props) {
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">LET</span>
        <span className="block-args">
        {this.id.reactElement()}
        {this.rhs.reactElement()}
        </span>
      </Node>
    );
  }
}

