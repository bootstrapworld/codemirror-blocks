import React from 'react';
import Node from '../../components/Node';
import * as P from '../../pretty';

import { ASTNode, pluralize, descDepth } from '../../ast';


// Binop ABlank Bind Func Sekwence Var Assign Let

// each class has constructor toDescription pretty render

interface Identifier {
  value: string;
  reactElement: () => any;
}
export class Binop extends ASTNode {
  op: any;
  left: any;
  right: any;
  level: any;
  options: any;
  constructor(from, to, op, left, right, options = {}) {
    super(from, to, 'binop', ['left', 'right'], options);
    this.op = op;
    this.left = left;
    this.right = right;
  }

  toDescription(level) {
    if ((this.level - level) >= descDepth) return this.options['aria-label'];
    return `a ${this.op} expression with ${this.left.toDescription(level)} and ${this.right.toDescription(level)}`;
  }

  pretty(): P.Doc {
    return P.horzArray([this.left, P.txt(" "), this.op, P.txt(" "), this.right]);
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
  level: any;
  options: any;
  constructor(from, to, options = {}) {
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
  ann: any;
  level: any;
  id: Identifier;
  options: any;
  constructor(from: any, to: any, id: Identifier, ann: any, options = {}) {
    super(from, to, 'bind', ['ann'], options);
    this.id = id;
    this.ann = ann;
  }

  toDescription(level) {
    if ((this.level - level) >= descDepth) return this.options['aria-label'];
    return `a bind expression with ${this.id.value} and ${this.ann}`;
  }

  pretty() {
    if (this.ann.type != "a-blank")
      return P.horzArray(P.txt(this.id.value), P.txt(" :: "), P.txt(this.ann));
    else
      return P.txt(this.id.value);
  }

  render(props) {
    return (
      <Node node={this} {...props}>
        <span className="blocks-literal-symbol">{this.id.value}</span>
      </Node>
    );
  }
}

export class Func extends ASTNode {
  name: any;
  args: any[];
  retAnn: any;
  doc: any;
  body: any;
  level: any;
  options: any;
  args_reversed: any[];
  constructor(from, to, name, args, retAnn, doc, body, options = {}) {
    super(from, to, 'functionDefinition', ['args', 'retAnn', 'body'], options);
    this.name = name;
    this.args = args;
    this.retAnn = retAnn;
    this.doc = doc;
    this.body = body;
    // args are normally backwards??
    this.args_reversed = args.slice().reverse();
  }

  toDescription(level) {
    if ((this.level - level) >= descDepth) return this.options['aria-label'];
    return `a func expression with ${this.name}, ${this.args_reversed} and ${this.body.toDescription(level)}`;
  }

  pretty() {
    let header = P.horzArray([P.txt("fun "), this.name,
      P.txt("("), P.sepBy(", ", "", this.args_reversed.map(p => p.pretty())), P.txt("):")]);
    // either one line or multiple; helper for joining args together
    return P.ifFlat(P.horzArray([header, P.txt(" "), this.body, " end"]),
      P.vertArray([header,
        P.horz("  ", this.body),
        "end"
      ])
    );
  }

  render(props) {
    let args = this.args_reversed.map(e => e.reactElement());
    let body = this.body.reactElement();
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">{this.name}</span>
        <span className="blocks-args">{args}</span>
        {body}
      </Node>
    );
  }
}

export class Sekwence extends ASTNode {
  exprs: any;
  name: any;
  level: any;
  options: any;
  constructor(from, to, exprs, name, options = {}) {
    super(from, to, 'sekwence', ['exprs'], options);
    this.exprs = exprs;
    this.name = name;
  }

  toDescription(level) {
    if ((this.level - level) >= descDepth) return this.options['aria-label'];
    return `a sequence containing ${this.exprs.toDescription(level)}`;
  }

  pretty() {
    return P.vertArray(this.exprs.map(e => P.txt(e)));
  }

  render(props) {
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">{this.name}</span>
        {this.exprs.map(e => e.reactElement())}
      </Node>
    );
  }
}

export class Var extends ASTNode {
  rhs: any;
  level: any;
  id: any;
  options: any;
  constructor(from, to, id, rhs, options = {}) {
    super(from, to, 'var', ['id', 'rhs'], options);
    this.id = id;
    this.rhs = rhs;
  }

  toDescription(level) {
    if ((this.level - level) >= descDepth) return this.options['aria-label'];
    return `a var setting ${this.id} to ${this.rhs}`;
  }

  pretty() {
    return P.txt(this.id + " = " + this.rhs);
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
  rhs: any;
  level: any;
  id: any;
  options: any;
  constructor(from, to, id, rhs, options = {}) {
    super(from, to, 'assign', ['id', 'rhs'], options);
    this.id = id;
    this.rhs = rhs;
  }

  toDescription(level) {
    if ((this.level - level) >= descDepth) return this.options['aria-label'];
    return `an assign setting ${this.id} to ${this.rhs}`;
  }

  pretty() {
    return P.txt(this.id + ' := ' + this.rhs);
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
  rhs: any;
  level: any;
  id: any;
  options: any;
  constructor(from, to, id, rhs, options = {}) {
    super(from, to, 'let', ['id', 'rhs'], options);
    this.id = id;
    this.rhs = rhs;
  }

  toDescription(level) {
    if ((this.level - level) >= descDepth) return this.options['aria-label'];
    return `a let setting ${this.id} to ${this.rhs}`;
  }

  pretty() {
    return P.horzArray([this.id, P.txt('let'), this.rhs]);
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


// where are the literals?
