import React from 'react';
import Node from '../../components/Node';
import * as P from '../../pretty';
import { ASTNode, descDepth } from '../../ast';
export class Binop extends ASTNode {
  constructor(from, to, op, left, right, options = {}) {
    super(from, to, 'binop', ['left', 'right'], options);
    this.op = op;
    this.left = left;
    this.right = right;
  }
  toDescription(level) {
    if ((this.level - level) >= descDepth)
      return this.options['aria-label'];
    return `a ${this.op} expression with ${this.left.toDescription(level)} and ${this.right.toDescription(level)}`;
  }
  pretty() {
    return P.horzArray([this.left, P.txt(" "), this.op, P.txt(" "), this.right]);
  }
  render(props) {
    return (React.createElement(Node, Object.assign({ node: this }, props),
      React.createElement("span", { className: "blocks-operator" }, this.op),
      this.left.reactElement(),
      this.right.reactElement()));
  }
}
export class ABlank extends ASTNode {
  constructor(from, to, options = {}) {
    super(from, to, 'a-blank', [], options);
  }
  toDescription(level) {
    if ((this.level - level) >= descDepth)
      return this.options['aria-label'];
    return `a blank expression`;
  }
  pretty() {
    return P.standardSexpr('Any');
  }
  render(props) {
    return (React.createElement(Node, Object.assign({ node: this }, props),
      React.createElement("span", { className: "blocks-literal-symbol" }, "BLANK")));
  }
}
export class Bind extends ASTNode {
  constructor(from, to, id, ann, options = {}) {
    super(from, to, 'bind', ['ann'], options);
    this.id = id;
    this.ann = ann;
  }
  toDescription(level) {
    if ((this.level - level) >= descDepth)
      return this.options['aria-label'];
    return `a bind expression with ${this.id.value} and ${this.ann}`;
  }
  pretty() {
    console.log(this.id);
    if (this.ann.type != "a-blank")
      return P.horzArray(P.txt(this.id.value), P.txt(" :: "), P.txt(this.ann));
    else
      return P.txt(this.id.value);
  }
  render(props) {
    return (React.createElement(Node, Object.assign({ node: this }, props),
      React.createElement("span", { className: "blocks-literal-symbol" }, this.id.value)));
  }
}
export class Func extends ASTNode {
  constructor(from, to, name, args, retAnn, doc, body, options = {}) {
    super(from, to, 'functionDefinition', ['args', 'retAnn', 'body'], options);
    this.name = name;
    this.args = args;
    this.retAnn = retAnn;
    this.doc = doc;
    this.body = body;
  }
  toDescription(level) {
    if ((this.level - level) >= descDepth)
      return this.options['aria-label'];
    return `a func expression with ${this.name}, ${this.args} and ${this.body.toDescription(level)}`;
  }
  pretty() {
    // either one line or multiple; helper for joining args together
    let args = this.args.slice();
    args.reverse();
    console.log(args);
    let header = P.horzArray([P.txt("fun "), this.name,
    P.txt("("), P.sepBy(", ", "", args.reverse().map(p => p.pretty())), P.txt("):")]);
    return P.ifFlat(P.horzArray([header, P.txt(" "), this.body, " end"]), P.vertArray([header,
      P.horz("  ", this.body),
      "end"
    ]));
  }
  render(props) {
    let args = this.args.map(e => e.reactElement());
    let body = this.body.reactElement();
    return (React.createElement(Node, Object.assign({ node: this }, props),
      React.createElement("span", { className: "blocks-operator" }, this.name),
      React.createElement("span", { className: "blocks-args" }, args),
      body));
  }
}
export class Sekwence extends ASTNode {
  constructor(from, to, exprs, name, options = {}) {
    super(from, to, 'sekwence', ['exprs'], options);
    this.exprs = exprs;
    this.name = name;
  }
  toDescription(level) {
    if ((this.level - level) >= descDepth)
      return this.options['aria-label'];
    return `a sequence containing ${this.exprs.toDescription(level)}`;
  }
  pretty() {
    return P.vertArray(this.exprs.map(e => P.txt(e)));
  }
  render(props) {
    return (React.createElement(Node, Object.assign({ node: this }, props),
      React.createElement("span", { className: "blocks-operator" }, this.name),
      this.exprs.map(e => e.reactElement())));
  }
}
export class Var extends ASTNode {
  constructor(from, to, id, rhs, options = {}) {
    super(from, to, 'var', ['id', 'rhs'], options);
    this.id = id;
    this.rhs = rhs;
  }
  toDescription(level) {
    if ((this.level - level) >= descDepth)
      return this.options['aria-label'];
    return `a var setting ${this.id} to ${this.rhs}`;
  }
  pretty() {
    return P.txt(this.id + " = " + this.rhs);
  }
  render(props) {
    return (React.createElement(Node, Object.assign({ node: this }, props),
      React.createElement("span", { className: "blocks-operator" }, "VAR"),
      React.createElement("span", { className: "block-args" },
        this.id.reactElement(),
        this.rhs.reactElement())));
  }
}
export class Assign extends ASTNode {
  constructor(from, to, id, rhs, options = {}) {
    super(from, to, 'assign', ['id', 'rhs'], options);
    this.id = id;
    this.rhs = rhs;
  }
  toDescription(level) {
    if ((this.level - level) >= descDepth)
      return this.options['aria-label'];
    return `an assign setting ${this.id} to ${this.rhs}`;
  }
  pretty() {
    return P.txt(this.id + ' := ' + this.rhs);
  }
  render(props) {
    return (React.createElement(Node, Object.assign({ node: this }, props),
      React.createElement("span", { className: "blocks-operator" }, ":="),
      React.createElement("span", { className: "block-args" },
        this.id.reactElement(),
        this.rhs.reactElement())));
  }
}
export class Let extends ASTNode {
  constructor(from, to, id, rhs, options = {}) {
    super(from, to, 'let', ['id', 'rhs'], options);
    this.id = id;
    this.rhs = rhs;
  }
  toDescription(level) {
    if ((this.level - level) >= descDepth)
      return this.options['aria-label'];
    return `a let setting ${this.id} to ${this.rhs}`;
  }
  pretty() {
    return P.horzArray([this.id, P.txt('let'), this.rhs]);
  }
  render(props) {
    return (React.createElement(Node, Object.assign({ node: this }, props),
      React.createElement("span", { className: "blocks-operator" }, "LET"),
      React.createElement("span", { className: "block-args" },
        this.id.reactElement(),
        this.rhs.reactElement())));
  }
}
// where are the literals?
