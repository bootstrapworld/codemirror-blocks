import React from 'react';
import Node from '../../components/Node';
import Args from '../../components/Args';
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

export class Bind extends ASTNode {
  ann: any | null;
  level: any;
  ident: Identifier;
  options: any;
  constructor(from: any, to: any, id: Identifier, ann: any | null, options = {}) {
    super(from, to, 'bind', ['ident', 'ann'], options);
    this.ident = id;
    this.ann = ann;
  }

  toDescription(level) {
    if ((this.level - level) >= descDepth) return this.options['aria-label'];
    return `a bind expression with ${this.ident.value} and ${this.ann}`;
  }

  pretty() {
    if (this.ann != null)
      return P.horzArray(P.txt(this.ident.value), P.txt(" :: "), P.txt(this.ann));
    else
      return P.txt(this.ident.value);
  }

  render(props) {
    return (
      // format with span if annotation?
      this.ident.reactElement()
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
  }

  toDescription(level) {
    if ((this.level - level) >= descDepth) return this.options['aria-label'];
    return `a func expression with ${this.name}, ${this.args_reversed} and ${this.body.toDescription(level)}`;
  }

  pretty() {
    let header = P.horzArray([P.txt("fun "), this.name,
      P.txt("("), P.sepBy(", ", "", this.args.map(p => p.pretty())), P.txt("):")]);
    // either one line or multiple; helper for joining args together
    return P.ifFlat(P.horzArray([header, P.txt(" "), this.body, " end"]),
      P.vertArray([header,
        P.horz("  ", this.body),
        "end"
      ])
    );
  }

  render(props) {
    let args = this.args.map(e => e.reactElement());
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
  ident: any;
  options: any;
  constructor(from, to, id, rhs, options = {}) {
    super(from, to, 'var', ['ident', 'rhs'], options);
    this.ident = id;
    this.rhs = rhs;
  }

  toDescription(level) {
    if ((this.level - level) >= descDepth) return this.options['aria-label'];
    return `a var setting ${this.ident} to ${this.rhs}`;
  }

  pretty() {
    return P.txt(this.ident + " = " + this.rhs);
  }

  render(props) {
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">VAR</span>
        <span className="block-args">
          {this.ident.reactElement()}
          {this.rhs.reactElement()}
        </span>
      </Node>
    );
  }
}

export class Assign extends ASTNode {
  rhs: any;
  level: any;
  ident: any;
  options: any;
  constructor(from, to, id, rhs, options = {}) {
    super(from, to, 'assign', ['ident', 'rhs'], options);
    this.ident = id;
    this.rhs = rhs;
  }

  toDescription(level) {
    if ((this.level - level) >= descDepth) return this.options['aria-label'];
    return `an assign setting ${this.ident} to ${this.rhs}`;
  }

  pretty() {
    return P.txt(this.ident + ' := ' + this.rhs);
  }

  render(props) {
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">:=</span>
        <span className="block-args">
          {this.ident.reactElement()}
          {this.rhs.reactElement()}
        </span>
      </Node>
    );
  }
}

export class Let extends ASTNode {
  rhs: any;
  level: any;
  ident: any;
  options: any;
  constructor(from, to, id, rhs, options = {}) {
    super(from, to, 'let', ['ident', 'rhs'], options);
    this.ident = id;
    this.rhs = rhs;
  }

  toDescription(level) {
    if ((this.level - level) >= descDepth) return this.options['aria-label'];
    return `a let setting ${this.ident} to ${this.rhs}`;
  }

  pretty() {
    return P.horzArray([this.ident, P.txt(' = '), this.rhs]);
  }

  render(props) {
    let identifier = this.ident.reactElement();
    console.log(identifier);
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">{identifier} = {this.rhs.reactElement()}</span>
      </Node>
    );
  }
}

export class Construct extends ASTNode {
  modifier: any;
  construktor: any;
  constructor_name: string;
  values: any[];
  options: any;
  level: any;
  constructor(from, to, modifier, construktor, values, options = {}) {
    super(from, to, 'constructor', ['modifier', 'construktor', 'values'], options);
    this.modifier = modifier;
    this.construktor = construktor;
    this.constructor_name = this.construktor.toString();
    this.values = values;
  }

  toDescription(level) {
    if ((this.level - level) >= descDepth) return this.options['aria-label'];
    return `${this.constructor_name} with ${this.values}`;
  }

  pretty() {
    let header = P.txt("[" + this.constructor_name + ":");
    let values = P.sepBy(", ", "", this.values.map(p => p.pretty()));
    let footer = P.txt("]");
    // either one line or multiple; helper for joining args together
    return P.ifFlat(P.horzArray([header, P.txt(" "), values, footer]),
      P.vertArray([header,
        P.horz("  ", values), // maybe make values in P.vertArray
        footer,
      ])
    );
  }

  render(props) {
    let values = this.values.map(e => e.reactElement());
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">{this.constructor_name}</span>
        {values}
      </Node>
    );
  }
}

export class FunctionApp extends ASTNode {
  func: {toString: () => string, toDescription: () => string};
  args: any[];
  level: any;
  options: any;
  constructor(from, to, func, args, options={}) {
    super(from, to, 'functionApp', ['func', 'args'], options);
    this.func = func;
    this.args = args;
  }

  toDescription(level){
    // if it's the top level, enumerate the args
    if((this.level  - level) == 0) {
      return `applying the function ${this.func.toDescription()} to ${pluralize("argument", this.args)} `+
      this.args.map((a, i, args)  => (args.length>1? (i+1) + ": " : "")+ a.toDescription(level)).join(", ");
    }
    // if we've bottomed out, use the aria label
    if((this.level  - level) >= descDepth) return this.options['aria-label'];
    // if we're in between, use "f of A, B, C" format
    else return `${this.func.toDescription()} of `+ this.args.map(a  => a.toDescription(level)).join(", ");
      
  }

  pretty() {
    let header = P.txt(this.func + "(");
    let values = (this.args.length != 0)? P.sepBy(", ", "", this.args.map(p => p.pretty())) : P.txt("");
    let footer = P.txt(")");
    // either one line or multiple; helper for joining args together
    return P.ifFlat(P.horzArray([header, values, footer]),
      P.vertArray([header,
        P.horz("  ", values), // maybe make values in P.vertArray
        footer,
      ])
    );
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
  fields: any[];
  options: any;
  level: any;
  constructor(from, to, fields, options = {}) {
    super(from, to, 'tuple', ['fields'], options);
    this.fields = fields;
  }

  toDescription(level) {
    if ((this.level - level) >= descDepth) return this.options['aria-label'];
    return `tuple with ${this.fields}`;
  }

  pretty() {
    let header = P.txt("{");
    let values = P.sepBy("; ", "", this.fields.map(p => p.pretty()));
    let footer = P.txt("}");
    // either one line or multiple; helper for joining args together
    return P.ifFlat(P.horzArray([header, values, footer]),
      P.vertArray([header,
        P.horz("  ", values), // maybe make values in P.vertArray
        footer,
      ])
    );
  }

  render(props) {
    let values = this.fields.map(e => e.reactElement());
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">tuple</span>
        {values}
      </Node>
    );
  }
}

export class Check extends ASTNode {
  options: any;
  level: any;
  name: string | undefined;
  body: any;
  keyword_check: boolean;
  constructor(from, to, name, body, keyword_check, options = {}) {
    super(from, to, 'check', ['name', 'body', 'keyword_check'], options);
    this.name = name;
    this.body = body;
    this.keyword_check = keyword_check;
  }

  toDescription(level) {
    if ((this.level - level) >= descDepth) return this.options['aria-label'];
    return `check with ${this.body}`;
  }

  pretty() {
    console.log(this.name);
    let header = P.txt("check" + ((this.name != null)? (` "${this.name}"`) : "") + ":");
    let values = this.body.pretty();
    let footer = P.txt("end");
    // either one line or multiple; helper for joining args together
    let ret = P.ifFlat(P.horzArray([header, P.txt(" "), values, P.txt(" "), footer]),
      P.vertArray([header,
        P.horz("  ", values), // maybe make values in P.vertArray?
        footer,
      ])
    );
    console.log(ret);
    return ret;
  }

  render(props) {
    let values = this.body.reactElement();
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">{"check" + (this.name != null? " " + this.name : "")}</span>
        {values}
      </Node>
    );
  }
}

export class CheckTest extends ASTNode {
  op: {toString: () => string, toDescription: () => string};
  hash: any;
  level: any;
  options: any;
  refinement: any;
  lhs: any;
  rhs: any | undefined;
  constructor(from, to, check_op, refinement, lhs, rhs, options={}) {
    super(from, to, 'functionApp', ['func', 'args'], options);
    this.op = check_op;
    this.refinement = refinement;
    this.lhs = lhs;
    this.rhs = rhs;
  }

  toDescription(level){
    if ((this.level - level) >= descDepth) return this.options['aria-label'];
    // how to deal with when rhs is undefined
    return `${this.op.toDescription()} ${this.lhs.toDescription()} ${(this.rhs != null)? this.rhs : ""}`;
  }

  pretty() {
    let left = this.lhs.pretty();
    let op = P.txt(this.op.toString());
    let right = (this.rhs != null)? this.rhs.pretty() : P.txt("");
    // either one line or multiple; helper for joining args together
    return P.ifFlat(P.horzArray([left, P.txt(" "), op, P.txt(" "), right]),
      P.vertArray([left,
        P.horz("  ", op), // maybe make values in P.vertArray
        right,
      ])
    );
  }

  render(props) {
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">
          {this.op.toString()}
        </span>
        <span className="blocks-args">
          {this.lhs.reactElement()}
          {this.rhs.reactElement()}
        </span>
      </Node>
    );
  }
}

export class Bracket extends ASTNode {
  base: any;
  index: any;
  level: any;
  options: any;
  constructor(from, to, base, index, options = {}) {
    super(from, to, 'let', ['ident', 'rhs'], options);
    this.index = index;
    this.base = base;
  }

  toDescription(level) {
    if ((this.level - level) >= descDepth) return this.options['aria-label'];
    return `${this.index} of ${this.base}`;
  }

  pretty() {
    let base_string = this.base.pretty();
    let index_string = this.index.pretty();
    console.log(base_string, index_string);
    return P.horzArray([base_string, P.txt('['), index_string, P.txt(']')]);
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
  rows: any[];
  sources: any[];
  hash: any;
  level: any;
  options: any;
  constructor(from, to, rows, sources, options={}) {
    super(from, to, 'functionApp', ['func', 'args'], options);
    this.rows = rows;
    this.sources = sources;
  }

  toDescription(level){
    if((this.level  - level) >= descDepth) {
      return `${this.rows} in a table from ${this.sources}`;
    }
    // if we've bottomed out, use the aria label
    return this.options['aria-label'];
  }

  pretty() {
    let header = P.txt("load-table: ");
    let row_names = P.sepBy(", ", "", this.rows.map(e => e.pretty()));
    let row_pretty = P.ifFlat(row_names, P.vertArray(this.rows.map(e => e.pretty())));
    let sources = P.horz("source: ", P.sepBy("", "source: ", this.sources.map(s => s.pretty())));
    let footer = P.txt("end");
    return P.vertArray([
      P.ifFlat(P.horz(header, row_pretty),
        P.vert(header, P.horz(P.txt("  "), row_pretty))),
      P.horz("  ", sources),
      footer]);
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