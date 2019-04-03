import React from 'react';
import hashObject from 'object-hash';
import Node from '../../components/Node';
import Args from '../../components/Args';
import * as P from '../../pretty';

import { ASTNode, pluralize, enumerateList } from '../../ast';
import { Literal } from '../../nodes';

// Binop ABlank Bind Func Sekwence Var Assign Let

// each class has constructor longDescription pretty render

const INDENT = P.txt("  ");

export class Binop extends ASTNode {
  op: ASTNode;
  left: ASTNode;
  right: ASTNode;

  constructor(from, to, op, left, right, options = {}) {
    super(from, to, 'binop', ['op', 'left', 'right'], options);
    // op is just a string, so not a part of children
    this.op = op;
    this.left = left;
    this.right = right;
    super.hash = super.computeHash();
  }

  longDescription(level) {
    return `a ${this.op.describe(level)} expression with ${this.left.describe(level)} and ${this.right.describe(level)}`;
  }

  pretty(): P.Doc {
    return P.ifFlat(P.horz(this.left, " ", this.op, " ", this.right),
                    P.vert(this.left, P.horz(" ", this.op, " ", this.right)));
  }

  render(props) {
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">
          {this.op.reactElement()}
        </span>
        {this.left.reactElement()}
        {this.right.reactElement()}
      </Node>
    );
  }
}

export class Bind extends ASTNode {
  ann: ASTNode | null;
  ident: Literal;

  constructor(from, to, id: Literal, ann, options = {}) {
    super(from, to, 'bind', ['ann', 'ident'], options);
    this.ident = id;
    this.ann = ann;
    super.hash = super.computeHash();
  }

  longDescription(level) {
    return `a bind expression with ${this.ident.value} and ${this.ann}`;
  }

  pretty() {
    if (this.ann === null) {
      return this.ident.pretty();
    } else {
      return P.horz(this.ident, P.txt(" :: "), this.ann);
    }
  }

  render(props) {
    if (this.ann === null) {
      return this.ident.reactElement();
    } else {
      return (<span>{this.ident.reactElement()} :: {this.ann.reactElement()}</span>)
    }
  }
}

export class Func extends ASTNode {
  name: string;
  args: ASTNode[];
  retAnn: ASTNode | null;
  doc: string | null;
  body: ASTNode;

  constructor(from, to, name, args, retAnn, doc, body, options = {}) {
    super(from, to, 'functionDefinition', ['args', 'retAnn', 'body'], options);
    this.name = name;
    this.args = args;
    this.retAnn = retAnn;
    this.doc = doc;
    this.body = body;
    super.hash = super.computeHash();
  }

  longDescription(level) {
    return `a func expression with ${this.name}, ${this.args} and ${this.body.describe(level)}`;
  }

  pretty() {
    // TODO: show doc
    let retAnn = this.retAnn ? P.horz(" -> ", this.retAnn) : "";
    let header = P.ifFlat(
      P.horz("fun ", this.name, "(", P.sepBy(", ", "", this.args), ")", retAnn, ":"),
      P.vert(P.horz("fun ", this.name, "("),
             P.horz(INDENT, P.sepBy(", ", "", this.args), ")", retAnn, ":")));
    // either one line or multiple; helper for joining args together
    return P.ifFlat(
      P.horz(header, " ", this.body, " end"),
      P.vert(header,
             P.horz(INDENT, this.body),
             "end"));
  }

  render(props) {
    // TODO: show doc, retAnn
    let body = this.body.reactElement();
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">
          fun {this.name}(<Args>{this.args}</Args>):
        </span>
        {body}
      </Node>
    );
  }
}

export class Block extends ASTNode {
  stmts: ASTNode[];
  name: string;

  constructor(from, to, stmts, name, options = {}) {
    super(from, to, 'block', ['stmts'], options);
    this.stmts = stmts;
    this.name = name;
    super.hash = super.computeHash();
  }

  longDescription(level) {
    return `a sequence containing ${enumerateList(this.stmts, level)}`;
  }

  pretty() {
    return P.vertArray(this.stmts);
  }

  render(props) {
    // NOTE: This is not returning a Node, as `render` generally should!
    // The reason we can get away with that here is that 
    console.log("?", this.stmts);
    // TODO: This probably doesn't render well; need vertical alignment
    return this.stmts.map(e => e.reactElement());
  }
}

export class Let extends ASTNode {
  ident: Literal;
  rhs: ASTNode;

  constructor(from, to, id, rhs, options = {}) {
    super(from, to, 'let', ['ident', 'rhs'], options);
    this.ident = id;
    this.rhs = rhs;
    super.hash = super.computeHash();
  }

  longDescription(level) {
    return `a let setting ${this.ident} to ${this.rhs}`;
  }

  pretty() {
    return P.ifFlat(
      P.horz(this.ident, " = ", this.rhs),
      P.vert(P.horz(this.ident, " ="),
             P.horz(INDENT, this.rhs)));
  }

  render(props) {
    let identifier = this.ident.reactElement();
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">
          {identifier} &nbsp;=&nbsp; {this.rhs.reactElement()}
        </span>
      </Node>
    );
  }
}

export class Var extends ASTNode {
  ident: Literal;
  rhs: ASTNode;

  constructor(from, to, id, rhs, options = {}) {
    super(from, to, 'var', ['ident', 'rhs'], options);
    this.ident = id;
    this.rhs = rhs;
    super.hash = super.computeHash();
  }

  longDescription(level) {
    return `a var setting ${this.ident} to ${this.rhs}`;
  }

  pretty() {
    return P.ifFlat(
      P.horz("var ", this.ident, " = ", this.rhs),
      P.vert(P.horz("var ", this.ident, " ="),
             P.horz(INDENT, this.rhs)));
  }

  render(props) {
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">VAR</span>
        <span className="blocks-args">
          <Args>{[this.ident, this.rhs]}</Args>
        </span>
      </Node>
    );
  }
}

export class Assign extends ASTNode {
  ident: Literal;
  rhs: ASTNode;

  constructor(from, to, id, rhs, options = {}) {
    super(from, to, 'assign', ['ident', 'rhs'], options);
    this.ident = id;
    this.rhs = rhs;
    super.hash = super.computeHash();
  }

  longDescription(level) {
    return `an assignment setting ${this.ident} to ${this.rhs}`;
  }

  pretty() {
    return P.ifFlat(
      P.horz(this.ident, " := ", this.rhs),
      P.vert(P.horz(this.ident, " :="),
             P.horz(INDENT, this.rhs)));
  }

  render(props) {
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">
          {this.ident.reactElement()} := {this.rhs.reactElement()}
        </span>
      </Node>
    );
  }
}

export class Construct extends ASTNode {
  modifier: any; // TODO: what is this?
  construktor: ASTNode;
  values: ASTNode[];

  constructor(from, to, modifier, construktor, values, options = {}) {
    super(from, to, 'constructor', ['modifier', 'construktor', 'values'], options);
    this.modifier = modifier;
    this.construktor = construktor;
    this.values = values;
    super.hash = super.computeHash();
  }

  longDescription(level) {
    return `${this.construktor.describe(level)} with ${enumerateList(this.values, level)}`;
  }

  pretty() {
    let header = P.horz("[", this.construktor, ":");
    let values = P.sepBy(", ", "", this.values);
    let footer = P.txt("]");
    // either one line or multiple; helper for joining args together
    return P.ifFlat(P.horz(header, P.txt(" "), values, footer),
      P.vert(header,
             P.horz(INDENT, values), // maybe make values in P.vertArray
             footer));
  }

  render(props) {
    let construktor = this.construktor.reactElement();
    let values = this.values.map(e => e.reactElement());
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">{construktor}</span>
        {values}
      </Node>
    );
  }
}

export class FunctionApp extends ASTNode {
  func: ASTNode;
  args: ASTNode[];

  constructor(from, to, func, args, options={}) {
    super(from, to, 'functionApp', ['func', 'args'], options);
    this.func = func;
    this.args = args;
    super.hash = super.computeHash();
  }

  longDescription(level) {
    // if it's the top level, enumerate the args
    if ((super.level  - level) == 0) {
      return `applying the function ${this.func.describe(level)} to ${pluralize("argument", this.args)} `+
      this.args.map((a, i, args) => (args.length>1? (i+1) + ": " : "") + a.describe(level)).join(", ");
    }
    // if we're lower than that (but not so low that `.shortDescription()` is used), use "f of A, B, C" format
    else return `${this.func.describe(level)} of `+ this.args.map(a  => a.describe(level)).join(", ");
  }

  pretty() {
    let header = P.txt(this.func + "(");
    let values = (this.args.length != 0)? P.sepBy(", ", "", this.args.map(p => p.pretty())) : P.txt("");
    // either one line or multiple; helper for joining args together
    return P.ifFlat(
      P.horz(header, values, ")"),
      P.vert(header,
             P.horz(INDENT, values),
             ")"));
  }

  render(props) {
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">
          <Args>{[this.func]}</Args>
        </span>
        <span className="blocks-args">
          <Args>{this.args}</Args>
        </span>
    </Node>
    );
  }
}

// could maybe combine this with list to make generic data structure pyret block
export class Tuple extends ASTNode {
  fields: ASTNode[];

  constructor(from, to, fields, options = {}) {
    super(from, to, 'tuple', ['fields'], options);
    this.fields = fields;
    super.hash = super.computeHash();
  }

  longDescription(level) {
    return `tuple with ${enumerateList(this.fields, level)}`;
  }

  pretty() {
    let header = P.txt("{");
    let values = P.sepBy("; ", "", this.fields);
    let footer = P.txt("}");
    // either one line or multiple; helper for joining args together
    return P.ifFlat(
      P.horz(header, values, footer),
      P.vert(header,
             P.horz(INDENT, values),
             footer));
  }

  render(props) {
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">{"{"}<Args>{this.fields}</Args>{"}"}</span>
      </Node>
    );
  }
}

export class Check extends ASTNode {
  name: string | null;
  body: ASTNode;
  keyword_check: boolean;

  constructor(from, to, name, body, keyword_check, options = {}) {
    super(from, to, 'check', ['body'], options);
    this.name = name;
    this.body = body;
    this.keyword_check = keyword_check;
    super.hash = hashObject(['check', this.name, ...[this.body, this.keyword_check].map(c => c.hash)]);
  }

  longDescription(level) {
    return `check with ${this.body}`;
  }

  pretty() {
    let header = P.txt((this.name == null) ? "check:" : `check "${this.name}":`);
    return P.ifFlat(
      P.horz(header, " ", this.body, " end"),
      P.vert(header,
             P.horz(INDENT, this.body),
             "end"));
  }

  render(props) {
    console.log("?", this.body);
    let body = this.body.reactElement();
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">
          {"check" + (this.name != null ? " " + this.name : "")}
        </span>
        <span className="blocks-args">
          {body}
        </span>
      </Node>
    );
  }
}

export class CheckTest extends ASTNode {
  op: ASTNode;
  refinement: ASTNode;
  lhs: ASTNode;
  rhs: ASTNode | null;
  
  constructor(from, to, check_op, refinement, lhs, rhs, options={}) {
    super(from, to, 'functionApp', ['op', 'refinement', 'lhs', 'rhs'], options);
    this.op = check_op;
    this.refinement = refinement;
    this.lhs = lhs;
    this.rhs = rhs;
    super.hash = super.computeHash();
  }

  longDescription(level) {
    // how to deal with when rhs is undefined
    return `${this.lhs.describe(level)} ${this.op.describe(level)} ${(this.rhs != null)? this.rhs.describe(level) : ""}`;
  }

  pretty() {
    let left = this.lhs.pretty();
    let right = this.rhs ? this.rhs.pretty() : P.txt("");
    let op = this.op.pretty();
    if (this.rhs === null) {
      return P.ifFlat(
        P.horz(left, " ", op),
        P.vert(left,
               P.horz(INDENT, op)));
    } else {
      return P.ifFlat(
        P.horz(left, " ", op, " ", right),
        P.vert(left,
               P.horz(INDENT, op, right)));
    }
  }

  render(props) {
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">
          {this.op.toString()}
        </span>
        <span className="blocks-args">
          {this.lhs.reactElement()}
          {this.rhs ? this.rhs.reactElement() : null}
        </span>
      </Node>
    );
  }
}

export class Bracket extends ASTNode {
  base: ASTNode;
  index: ASTNode;

  constructor(from, to, base, index, options = {}) {
    super(from, to, 'let', ['base', 'index'], options);
    this.base = base;
    this.index = index;
    super.hash = super.computeHash();
  }

  longDescription(level) {
    return `${this.index.describe(level)} of ${this.base.describe(level)}`;
  }

  pretty() {
    let base = this.base.pretty();
    let index = this.index.pretty();
    return P.ifFlat(
      P.horz(base, '[', index, ']'),
      P.vert(P.horz(base, '['),
             P.horz(INDENT, index),
             ']'));
  }

  render(props) {
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">
          {this.base.reactElement()} [ {this.index.reactElement()}]
        </span>
        <span className="block-args">
        </span>
      </Node>
    );
  }
}

export class LoadTable extends ASTNode {
  rows: ASTNode[];
  sources: ASTNode[];

  constructor(from, to, rows, sources, options={}) {
    super(from, to, 'functionApp', ['rows', 'sources'], options);
    this.rows = rows;
    this.sources = sources;
    super.hash = super.computeHash();
  }

  longDescription(level) {
    return `${enumerateList(this.rows, level)} in a table from ${enumerateList(this.sources, level)}`;
  }

  pretty() {
    let header = P.txt("load-table: ");
    let row_names = P.sepBy(", ", "", this.rows.map(e => e.pretty()));
    let row_pretty = P.ifFlat(row_names, P.vertArray(this.rows.map(e => e.pretty())));
    let sources = P.horz("source: ", P.sepBy("", "source: ", this.sources.map(s => s.pretty())));
    let footer = P.txt("end");
    return P.vert(
      P.ifFlat(
        P.horz(header, row_pretty),
        P.vert(header,
               P.horz(P.txt("  "), row_pretty))),
      P.horz("  ", sources),
      footer);
  }

  render(props) {
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">
          load-table
        </span>
        <span className="blocks-args">
          <Args>{this.rows}</Args>
        </span>
        {this.sources.map(e => e.reactElement())}
    </Node>
    );
  }
}
