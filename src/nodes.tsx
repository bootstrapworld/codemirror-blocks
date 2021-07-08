import * as P from 'pretty-fast-pretty-printer';
import React from 'react';
import {ASTNode, enumerateList, NodeOptions, pluralize, Pos} from './ast';
import Node, { NodeProps } from './components/Node';
import Args from './components/Args';
import { DropTarget } from './components/DropTarget';
import * as Spec from './nodeSpec';



// Displays a comment according to specific rules.
//
// - `doc` is what's being commented.
// - `comment` is the comment itself. If it is falsy, there is no comment.
// - `container` is the ast node that owns the comment. This argument is used to
//   determine if the comment is a line comment (appears after `container` on
//   the same line). Line comments will stay as line comments _as long as they
//   fit on the line_. If they don't, they'll be converted into a comment on the
//   previous line.
function withComment(doc, comment, container) {
  if (comment) {
    // This comment was on the same line as the node. Keep it that way, as long as it fits on a line.
    if (container && container.to.line == comment.from.line) {
      return P.ifFlat(P.horz(doc, " ", comment), P.vert(comment, doc));
    } else {
      return P.vert(comment, doc);
    }
  } else {
    return doc;
  }
}

export class Unknown extends ASTNode {
  elts: ASTNode[];

  constructor(from: Pos, to: Pos, elts: ASTNode[], options: NodeOptions = {}) {
    super(from, to, 'unknown', options);
    this.elts = elts;
  }

  static spec = Spec.nodeSpec([
    Spec.list('elts')
  ])

  longDescription(level: number) {
    return `an unknown expression with ${pluralize("children", this.elts)} `+ 
      this.elts.map((e, i, elts)  => (elts.length>1? (i+1) + ": " : "")+ e.describe(level)).join(", ");
  }

  pretty() {
    return withComment(
      P.standardSexpr(this.elts[0], this.elts.slice(1)),
      this.options.comment,
      this);
  }

  render(props: NodeProps) {
    const firstElt = this.elts[0].reactElement();
    const restElts = this.elts.slice(1);
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">{firstElt}</span>
        <span className="blocks-args">
          <Args field="elts">{restElts}</Args>
        </span>
      </Node>
    );
  }
}

export class FunctionApp extends ASTNode {
  func: ASTNode;
  args: ASTNode[];
  
  constructor(from: Pos, to: Pos, func: ASTNode, args: ASTNode[], options:NodeOptions={}) {
    super(from, to, 'functionApp', options);
    this.func = func;
    this.args = args;
  }

  static spec = Spec.nodeSpec([
    Spec.required('func'),
    Spec.list('args')
  ])

  override longDescription(level: number) {
    // if it's the top level, enumerate the args
    if((this.level  - level) == 0) {
      return `applying the function ${this.func.describe(level)} to ${pluralize("argument", this.args)} `+
      this.args.map((a, i, args)  => (args.length>1? (i+1) + ": " : "")+ a.describe(level)).join(", ");
    }
    // if we're lower than that (but not so low that `.shortDescription()` is used), use "f of A, B, C" format
    else return `${this.func.describe(level)} of `+ this.args.map(a  => a.describe(level)).join(", ");
  }

  pretty() {
    return withComment(
      P.standardSexpr(this.func, this.args),
      this.options.comment,
      this);
  }

  render(props: NodeProps) {
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">
          {this.func.reactElement()}
        </span>
        <span className="blocks-args">
          <Args field="args">{this.args}</Args>
        </span>
    </Node>
    );
  }
}

export class IdentifierList extends ASTNode {
  kind: string;
  ids: ASTNode[];

  constructor(from: Pos, to: Pos, kind: string, ids: ASTNode[], options: NodeOptions={}) {
    super(from, to, 'identifierList', options);
    this.kind = kind;
    this.ids = ids;
  }

  static spec = Spec.nodeSpec([
    Spec.value('kind'),
    Spec.list('ids')
  ])

  longDescription(level) {
    return enumerateList(this.ids, level);
  }

  pretty() {
    return withComment(
      P.sepBy(this.ids, " "),
      this.options.comment,
      this);
  }

  render(props: NodeProps) {
    return (
      <Node node={this} {...props}>
        <span className="blocks-args">
          <Args field="ids">{this.ids}</Args>
        </span>
      </Node>
    );
  }
}

export class StructDefinition extends ASTNode {
  name: ASTNode;
  fields: ASTNode;
  constructor(from: Pos, to: Pos, name: ASTNode, fields: ASTNode, options: NodeOptions={}) {
    super(from, to, 'structDefinition', options);
    this.name = name;
    this.fields = fields;
  }

  static spec = Spec.nodeSpec([
    Spec.value('name'),
    Spec.required('fields')
  ])

  longDescription(level) {
    return `define ${this.name.describe(level)} to be a structure with ${this.fields.describe(level)}`;
  }

  pretty() {
    return withComment(
      P.lambdaLikeSexpr("define-struct", this.name, P.horz("(", this.fields, ")")),
      this.options.comment,
      this);
  }

  render(props: NodeProps) {
    const name = this.name.reactElement();
    const fields = this.fields.reactElement();
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">
          define-struct
          {name}
        </span>
        {fields}
      </Node>
    );
  }
}

export class VariableDefinition extends ASTNode {
  name: ASTNode;
  body: ASTNode;

  constructor(from: Pos, to: Pos, name: ASTNode, body: ASTNode, options={}) {
    super(from, to, 'variableDefinition', options);
    this.name = name;
    this.body = body;
  }

  static spec = Spec.nodeSpec([
    Spec.required('name'),
    Spec.required('body')
  ])

  longDescription(level) {
    let insert = ["literal", "blank"].includes(this.body.type)? "" : "the result of:";
    return `define ${this.name} to be ${insert} ${this.body.describe(level)}`;
  }

  pretty() {
    return withComment(
      P.lambdaLikeSexpr("define", this.name, this.body),
      this.options.comment,
      this);
  }

  render(props: NodeProps) {
    const body = this.body.reactElement();
    const name = this.name.reactElement();
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">
          define
          {name}
        </span>
        <span className="blocks-args">
          {body}
        </span>
      </Node>
    );
  }
}

export class LambdaExpression extends ASTNode {
  body: ASTNode;
  args: IdentifierList;
  constructor(from: Pos, to: Pos, args: IdentifierList, body: ASTNode, options={}) {
    super(from, to, 'lambdaExpression', options);
    this.args = args;
    this.body = body;
  }

  static spec = Spec.nodeSpec([
    Spec.required('args'),
    Spec.required('body')
  ])

  longDescription(level) {
    return `an anonymous function of ${pluralize("argument", this.args.ids)}: 
            ${this.args.describe(level)}, with body:
            ${this.body.describe(level)}`;
  }

  pretty() {
    return P.lambdaLikeSexpr("lambda(", P.horz("(", this.args, ")"), this.body);
  }

  render(props: NodeProps) {
    const args = this.args.reactElement();
    const body = this.body.reactElement();
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">
          &lambda; ({args})
        </span>
        <span className="blocks-args">
          {body}
        </span>
      </Node>
    );
  }
}

export class FunctionDefinition extends ASTNode {
  name: ASTNode;
  params: ASTNode;
  body: ASTNode;
  constructor(from: Pos, to: Pos, name: ASTNode, params: ASTNode, body: ASTNode, options={}) {
    super(from, to, 'functionDefinition', options);
    this.name = name;
    this.params = params;
    this.body = body;
  }

  static spec = Spec.nodeSpec([
    Spec.required('name'),
    Spec.required('params'),
    Spec.required('body')
  ])

  longDescription(level) {
    return `define ${this.name} to be a function of 
            ${this.params.describe(level)}, with body:
            ${this.body.describe(level)}`;
  }

  pretty() {
    return withComment(
      P.lambdaLikeSexpr(
        "define",
        P.standardSexpr(this.name, this.params),
        this.body),
      this.options.comment,
      this);
  }

  render(props: NodeProps) {
    let params = this.params.reactElement();
    let body = this.body.reactElement();
    let name = this.name.reactElement();
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">
          define ({name} {params})
        </span>
        <span className="blocks-args">
          {body}
        </span>
      </Node>
    );
  }
}

export class CondClause extends ASTNode {
  testExpr: ASTNode;
  thenExprs: ASTNode[];
  constructor(from: Pos, to: Pos, testExpr: ASTNode, thenExprs: ASTNode[], options={}) {
    super(from, to, 'condClause', options);
    this.testExpr = testExpr;
    this.thenExprs = thenExprs;
  }

  static spec = Spec.nodeSpec([
    Spec.required('testExpr'),
    Spec.list('thenExprs')
  ])

  longDescription(level) {
    return `condition: if ${this.testExpr.describe(level)}, then, ${this.thenExprs.map(te => te.describe(level))}`;
  }

  pretty() {
    return P.horz("[", P.sepBy([this.testExpr].concat(this.thenExprs), " "), "]");
  }

  render(props: NodeProps) {
    const testExpr = this.testExpr.reactElement();
    return (
      <Node node={this} {...props}>
        <div className="blocks-cond-row">
          <div className="blocks-cond-predicate">
            {testExpr}
          </div>
          <div className="blocks-cond-result">
            {this.thenExprs.map((thenExpr, index) => (
              <span key={index}>
                <DropTarget field="thenExprs"/>
                {thenExpr.reactElement()}
              </span>))}
            <DropTarget field="thenExprs"/>
          </div>
        </div>
      </Node>
    );
  }
}

export class CondExpression extends ASTNode {
  clauses: ASTNode[];
  constructor(from: Pos, to: Pos, clauses: ASTNode[], options={}) {
    super(from, to, 'condExpression', options);
    this.clauses = clauses;
  }

  static spec = Spec.nodeSpec([
    Spec.list('clauses')
  ])

  longDescription(level: number) {
    return `a conditional expression with ${pluralize("condition", this.clauses)}: 
            ${this.clauses.map(c => c.describe(level))}`;
  }

  pretty() {
    return P.beginLikeSexpr("cond", this.clauses);
  }

  render(props: NodeProps) {
    const clauses = this.clauses.map((clause, index) => clause.reactElement({key: index}));
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">cond</span>
        <div className="blocks-cond-table">
          {clauses}
        </div>
      </Node>
    );
  }
}

export class IfExpression extends ASTNode {
  testExpr: ASTNode;
  thenExpr: ASTNode;
  elseExpr: ASTNode;
  constructor(from: Pos, to: Pos, testExpr: ASTNode, thenExpr: ASTNode, elseExpr: ASTNode, options={}) {
    super(from, to, 'ifExpression', options);
    this.testExpr = testExpr;
    this.thenExpr = thenExpr;
    this.elseExpr = elseExpr;
  }

  static spec = Spec.nodeSpec([
    Spec.required('testExpr'),
    Spec.required('thenExpr'),
    Spec.required('elseExpr')
  ])

  longDescription(level) {
    return `an if expression: if ${this.testExpr.describe(level)}, then ${this.thenExpr.describe(level)} `+
            `else ${this.elseExpr.describe(level)}`;
  }

  pretty() {
    return withComment(
      P.standardSexpr("if", [this.testExpr, this.thenExpr, this.elseExpr]),
      this.options.comment,
      this);
  }

  render(props: NodeProps) {
    const testExpr = this.testExpr.reactElement();
    const thenExpr = this.thenExpr.reactElement();
    const elseExpr = this.elseExpr.reactElement();
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">if</span>
        <div className="blocks-cond-table">
          <div className="blocks-cond-row">
            <div className="blocks-cond-predicate">
              {testExpr}
            </div>
            <div className="blocks-cond-result">
              {thenExpr}
            </div>
          </div>
          <div className="blocks-cond-row">
            <div className="blocks-cond-predicate blocks-cond-else">
              else
            </div>
            <div className="blocks-cond-result">
              {elseExpr}
            </div>
          </div>
        </div>
      </Node>
    );
  }
}

export class Literal extends ASTNode {
  value: any;
  dataType: any;
  constructor(from: Pos, to: Pos, value: any, dataType:any='unknown', options={}) {
    super(from, to, 'literal', options);
    this.value = value;
    this.dataType = dataType;
  }

  static spec = Spec.nodeSpec([
    Spec.value('value'),
    Spec.value('dataType')
  ])

  describe(_level) {
    return this.options["aria-label"];
  }

  pretty() {
    return withComment(P.txt(this.value), this.options.comment, this);
  }

  render(props: NodeProps) {
    return (
      <Node node={this}
            normallyEditable={true}
            expandable={false}
            {...props}>
        <span className={`blocks-literal-${this.dataType}`}>
          {this.value.toString()}
        </span>
      </Node>
    );
  }
}

export class Comment extends ASTNode {
  comment: string;
  constructor(from: Pos, to: Pos, comment: string, options={}) {
    super(from, to, 'comment', options);
    this.value = comment;
  }

  static spec = Spec.nodeSpec([
    Spec.value('value')
  ])

  describe(_level) {
    return this.options["aria-label"];
  }

  pretty() {
    let words = this.value.trim().split(/\s+/);
    let wrapped = P.wrap(words);
    // Normalize all comments to block comments
    return P.concat("#| ", wrapped, " |#");
  }

  render(props: NodeProps) { // eslint-disable-line no-unused-vars
    return (
      <Node node={this} 
            id={this.id} 
            normallyEditable={true}
            expandable={false}
            {...props}>
        <span
            aria-hidden="true" 
            ref={(el) => this.element = el} >
          <span className="screenreader-only">Has comment,</span> <span>{this.value.toString()}</span>
        </span>
      </Node>
    );
  }
}

export class Blank extends ASTNode {
  value: any;
  dataType: any;
  constructor(from: Pos, to: Pos, value: any, dataType: any = 'blank', options={}) {
    super(from, to, 'blank', options);
    this.value = value || "...";
    this.dataType = dataType;
  }

  static spec = Spec.nodeSpec([
    Spec.value('value'),
    Spec.value('dataType')
  ])

  describe(_level) {
    return this.options["aria-label"];
  }

  pretty() {
    return P.txt(this.value);
  }

  render(props: NodeProps) {
    return (
      <Node node={this}
            normallyEditable={true}
            expandable={false}
            {...props}>
        <span className="blocks-literal-symbol" />
      </Node>
    );
  }
}

export class Sequence extends ASTNode {
  name: ASTNode;
  exprs: ASTNode[];
  constructor(from: Pos, to: Pos, exprs: ASTNode[], name: ASTNode, options={}) {
    super(from, to, 'sequence', options);
    this.name = name;
    this.exprs = exprs;
  }

  static spec = Spec.nodeSpec([
    Spec.optional('name'),
    Spec.list('exprs'),
  ])

  longDescription(level) {
    return `a sequence containing ${enumerateList(this.exprs, level)}`;
  }

  pretty() {
    return P.vert(this.name, ...this.exprs);
  }

  render(props: NodeProps) {
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">
          {this.name.reactElement()}
        </span>
        <span className="blocks-sequence-exprs">
          <Args field="exprs">{this.exprs}</Args>
        </span>
      </Node>
    );
  }
}
