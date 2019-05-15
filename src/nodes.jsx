import * as P from 'pretty-fast-pretty-printer';
import React from 'react';
import {ASTNode, descDepth, enumerateList, pluralize} from './ast';
import Node from './components/Node';
import Args from './components/Args';
import {DropTarget, DropTargetContainer} from './components/DropTarget';
import * as Spec from './nodeSpec';



// Display a Scheme-style comment.
//
// - `doc` is what's being commented.
// - `comment` is the comment itself. If it is falsy, there is no comment.
// - `container` is the ast node that owns the comment. This argument is used to
//   determine if the comment is a line comment (appears after `container` on
//   the same line). Line comments will stay as line comments _as long as they
//   fit on the line_. If they don't, they'll be converted into a comment on the
//   previous line.
function withSchemeComment(doc, comment, container) {
  if (comment) {
    if (container && container.to.line == comment.from.line) {
      // This comment was on the same line as the node. Keep it that way, as long as it fits on a line.
      return P.ifFlat(P.horz(doc, " ", comment),
                      P.vert(comment, doc));
    } else {
      return P.vert(comment, doc);
    }
  } else {
    return doc;
  }
}

export class Unknown extends ASTNode {
  constructor(from, to, elts, options={}) {
    super(from, to, 'unknown', options);
    this.elts = elts;
  }

  static spec = Spec.nodeSpec([
    Spec.list('elts')
  ])

  toDescription(level){
    if((this.level - level) >= descDepth) return this.options['aria-label'];
    return `an unknown expression with ${pluralize("children", this.elts)} `+ 
      this.elts.map((e, i, elts) => (elts.length>1? (i+1) + ": " : "")+ e.toDescription(level)).join(", ");
  }

  pretty() {
    return withSchemeComment(
      P.standardSexpr(this.elts[0], this.elts.slice(1)),
      this.options.comment,
      this);
  }

  render(props) {
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

export class FakeInsertNode extends ASTNode {
  constructor(from, to, text, options={}) {
    super(from, to, 'fakeInsertNode', options);
    this.text = text;
  }

  static spec = Spec.nodeSpec([
    Spec.value('text')
  ])

  toDescription(level) {
    return "";
  }

  pretty() {
    return P.txt(this.text);
  }

  render(props) {
    console.warn("FakeInsertNode: didn't expect to be rendered!");
  }
}

export class FunctionApp extends ASTNode {
  constructor(from, to, func, args, options={}) {
    super(from, to, 'functionApp', options);
    this.func = func;
    this.args = args;
  }

  static spec = Spec.nodeSpec([
    Spec.required('func'),
    Spec.list('args')
  ])

  toDescription(level){
    // if it's the top level, enumerate the args
    if((this.level  - level) == 0) {
      return `applying the function ${this.func.toDescription()} to ${pluralize("argument", this.args)} `+
      this.args.map((a, i, args) => (args.length>1? (i+1) + ": " : "")+ a.toDescription(level)).join(", ");
    }
    // if we've bottomed out, use the aria label
    if((this.level  - level) >= descDepth) return this.options['aria-label'];
    // if we're in between, use "f of A, B, C" format
    else return `${this.func.toDescription()} of `+ this.args.map(a  => a.toDescription(level)).join(", ");
      
  }

  pretty() {
    return withSchemeComment(
      P.standardSexpr(this.func, this.args),
      this.options.comment,
      this);
  }

  render(props) {
    const func = this.func.reactElement();
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">
          {func}
        </span>
        <span className="blocks-args">
          <Args field="args">{this.args}</Args>
        </span>
    </Node>
    );
  }
}

export class IdentifierList extends ASTNode {
  constructor(from, to, kind, ids, options={}) {
    super(from, to, 'identifierList', options);
    this.kind = kind;
    this.ids = ids;
  }

  static spec = Spec.nodeSpec([
    Spec.value('kind'),
    Spec.list('ids')
  ])

  toDescription(level){
    if((this.level  - level) >= descDepth) return this.options['aria-label'];
    return enumerateList(this.ids, level);
  }

  pretty() {
    return withSchemeComment(
      P.sepBy(this.ids, " "),
      this.options.comment,
      this);
  }

  render(props) {
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
  constructor(from, to, name, fields, options={}) {
    super(from, to, 'structDefinition', options);
    this.name = name;
    this.fields = fields;
  }

  static spec = Spec.nodeSpec([
    Spec.value('name'),
    Spec.required('fields')
  ])

  toDescription(level){
    if((this.level  - level) >= descDepth) return this.options['aria-label'];
    return `define ${this.name.toDescription(level)} to be a structure with
            ${this.fields.toDescription(level)}`;
  }

  pretty() {
    return withSchemeComment(
      P.lambdaLikeSexpr("define-struct", this.name, P.horz("(", this.fields, ")")),
      this.options.comment,
      this);
  }

  render(props) {
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
  constructor(from, to, name, body, options={}) {
    super(from, to, 'variableDefinition', options);
    this.name = name;
    this.body = body;
  }

  static spec = Spec.nodeSpec([
    Spec.required('name'),
    Spec.required('body')
  ])

  toDescription(level){
    if((this.level  - level) >= descDepth) return this.options['aria-label'];
    let insert = ["literal", "blank"].includes(this.body.type)? "" : "the result of:";
    return `define ${this.name} to be ${insert} ${this.body.toDescription(level)}`;
  }

  pretty() {
    return withSchemeComment(
      P.lambdaLikeSexpr("define", this.name, this.body),
      this.options.comment,
      this);
  }

  render(props) {
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
  constructor(from, to, args, body, options={}) {
    super(from, to, 'lambdaExpression', options);
    this.args = args;
    this.body = body;
  }

  static spec = Spec.nodeSpec([
    Spec.required('args'),
    Spec.required('body')
  ])

  toDescription(level){
    if((this.level  - level) >= descDepth) return this.options['aria-label'];
    return `an anonymous function of ${pluralize("argument", this.args.ids)}: 
            ${this.args.toDescription(level)}, with body:
            ${this.body.toDescription(level)}`;
  }

  pretty() {
    return P.lambdaLikeSexpr("lambda(", P.horz("(", this.args, ")"), this.body);
  }

  render(props) {
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
  constructor(from, to, name, params, body, options={}) {
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

  toDescription(level){
    if((this.level  - level) >= descDepth) return this.options['aria-label'];
    return `define ${this.name} to be a function of 
            ${this.params.toDescription(level)}, with body:
            ${this.body.toDescription(level)}`;
  }

  pretty() {
    return withSchemeComment(
      P.lambdaLikeSexpr(
        "define",
        P.standardSexpr(this.name, this.params),
        this.body),
      this.options.comment,
      this);
  }

  render(props) {
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
  constructor(from, to, testExpr, thenExprs, options={}) {
    super(from, to, 'condClause', options);
    this.testExpr = testExpr;
    this.thenExprs = thenExprs;
  }

  static spec = Spec.nodeSpec([
    Spec.required('testExpr'),
    Spec.list('thenExprs')
  ])

  toDescription(level){
    if((this.level  - level) >= descDepth) return this.options['aria-label'];
    return `condition: if ${this.testExpr.toDescription(level)}, then, ${this.thenExprs.map(te => te.toDescription(level))}`;
  }

  pretty() {
    return P.horz("[", P.sepBy([this.testExpr].concat(this.thenExprs), " "), "]");
  }

  render(props) {
    const testExpr = this.testExpr.reactElement();
    return (
      <Node node={this} {...props}>
        <div className="blocks-cond-row">
          <div className="blocks-cond-predicate">
            {testExpr}
          </div>
          <div className="blocks-cond-result">
            <DropTargetContainer field="thenExprs">
              {this.thenExprs.map((thenExpr, index) => (
                <span key={index}>
                  <DropTarget/>
                  {thenExpr.reactElement()}
                </span>))}
              <DropTarget/>
            </DropTargetContainer>
          </div>
        </div>
      </Node>
    );
  }
}

export class CondExpression extends ASTNode {
  constructor(from, to, clauses, options={}) {
    super(from, to, 'condExpression', options);
    this.clauses = clauses;
  }

  static spec = Spec.nodeSpec([
    Spec.list('clauses')
  ])

  toDescription(level){
    if((this.level  - level) >= descDepth) return this.options['aria-label'];
    return `a conditional expression with ${pluralize("condition", this.clauses)}: 
            ${this.clauses.map(c => c.toDescription(level))}`;
  }

  pretty() {
    return P.beginLikeSexpr("cond", this.clauses);
  }

  render(props) {
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
  constructor(from, to, testExpr, thenExpr, elseExpr, options={}) {
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

  toDescription(level){
    if((this.level  - level) >= descDepth) return this.options['aria-label'];
    return `an if expression: if ${this.testExpr.toDescription(level)}, then ${this.thenExpr.toDescription(level)} `+
            `else ${this.elseExpr.toDescription(level)}`;
  }

  pretty() {
    return withSchemeComment(
      P.standardSexpr("if", [this.testExpr, this.thenExpr, this.elseExpr]),
      this.options.comment,
      this);
  }

  render(props) {
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
  constructor(from, to, value, dataType='unknown', options={}) {
    super(from, to, 'literal', options);
    this.value = value;
    this.dataType = dataType;
  }

  static spec = Spec.nodeSpec([
    Spec.value('value'),
    Spec.value('dataType')
  ])

  pretty() {
    return withSchemeComment(P.txt(this.value), this.options.comment, this);
  }

  render(props) {
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
  constructor(from, to, comment, options={}) {
    super(from, to, 'comment', options);
    this.comment = comment;
  }

  static spec = Spec.nodeSpec([
    Spec.value('comment')
  ])

  pretty() {
    let words = this.comment.trim().split(/\s+/);
    let wrapped = P.wrap(words);
    // Normalize all comments to block comments
    return P.concat("#| ", wrapped, " |#");
  }

  render(_props) { // eslint-disable-line no-unused-vars
    return (<span className="blocks-comment" id={this.id} aria-hidden="true">
      <span className="screenreader-only">Has comment,</span> {this.comment.toString()}
    </span>);
  }
}

export class Blank extends ASTNode {
  constructor(from, to, value, dataType='blank', options={}) {
    super(from, to, 'blank', options);
    this.value = value || "...";
    this.dataType = dataType;
  }

  static spec = Spec.nodeSpec([
    Spec.value('value'),
    Spec.value('dataType')
  ])

  pretty() {
    return P.txt(this.value);
  }

  render(props) {
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
  constructor(from, to, exprs, name, options={}) {
    super(from, to, 'sequence', options);
    this.exprs = exprs;
    this.name = name;
  }

  static spec = Spec.nodeSpec([
    Spec.list('exprs'),
    Spec.value('name')
  ])

  toDescription(level) {
    if((this.level  - level) >= descDepth) return this.options['aria-label'];
    return `a sequence containing ${enumerateList(this.exprs, level)}`;
  }

  pretty() {
    return P.standardSexpr(this.name, this.exprs);
  }

  render(props) {
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">{this.name}</span>
        <div className="blocks-sequence-exprs">
          <Args field="exprs">{this.exprs}</Args>
        </div>
      </Node>
    );
  }
}
