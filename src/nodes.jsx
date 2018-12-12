import * as P from './pretty';
import React from 'react';
import {ASTNode, descDepth, enumerateList, pluralize} from './ast';
import hashObject from 'object-hash';
import Node from './components/Node';
import Args from './components/Args';
import makeDropTargets from './components/makeDropTargets';

// TODO: factor out DropTarget/editable!


export class Unknown extends ASTNode {
  constructor(from, to, elts, options={}) {
    super(from, to, 'unknown', ['elts'], options);
    this.elts = elts;
    this.hash = hashObject(['unknown', elts.map(elt => elt.hash)]);
  }

  toDescription(level){
    if((this.level - level) >= descDepth) return this.options['aria-label'];
    return `an unknown expression with ${pluralize("children", this.elts)} `+ 
      this.elts.map((e, i, elts)  => (elts.length>1? (i+1) + ": " : "")+ e.toDescription(level)).join(", ");
  }

  toString() {
    return `(${this.func} ${this.args.join(' ')})`;
  }

  pretty() {
    return P.standardSexpr(this.elts[0], this.elts.slice(1));
  }

  render(props) {
    const {helpers, lockedTypes} = props;
    const firstElt = this.elts[0];
    const restElts = this.elts.slice(1);
    return (
      <Node node={this} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-operator">{helpers.renderNodeForReact(firstElt)}</span>
        <span className="blocks-args">
          <Args helpers={helpers} location={firstElt.to}>{restElts}</Args>
        </span>
      </Node>
    );
  }
}

export class FunctionApp extends ASTNode {
  constructor(from, to, func, args, options={}) {
    super(from, to, 'functionApp', ['func', 'args'], options);
    this.func = func;
    this.args = args;
    this.hash = hashObject(['function-app', func.hash, args.map(arg => arg.hash)]);
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

  toString() {
    return `(${this.func} ${this.args.join(' ')})`;
  }

  pretty() {
    return P.standardSexpr(this.func, this.args);
  }

  render(props) {
    const {helpers, lockedTypes} = props;
    return (
      <Node node={this} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-operator">
          <Args helpers={helpers}>{[this.func]}</Args>
        </span>
        <span className="blocks-args">
          <Args helpers={helpers} location={this.func.to}>{this.args}</Args>
        </span>
      </Node>
    );
  }
}

export class IdentifierList extends ASTNode {
  constructor(from, to, kind, ids, options={}) {
    super(from, to, 'identifierList', ['ids'], options);
    this.kind = kind;
    this.ids = ids;
    this.hash = hashObject(['identifierList', this.kind, this.ids.map(id => id.hash)]);
  }

  toDescription(level){
    if((this.level  - level) >= descDepth) return this.options['aria-label'];
    return enumerateList(this.ids, level);
  }

  toString() {
    return `${this.ids.join(' ')}`;
  }

  pretty() {
    return P.spaceSep(this.ids);
  }

  render(props) {
    const {helpers, lockedTypes} = props;
    return (
      <Node node={this} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-args">
          <Args helpers={helpers} location={this.from}>{this.ids}</Args>
        </span>
      </Node>
    );
  }
}

export class StructDefinition extends ASTNode {
  constructor(from, to, name, fields, options={}) {
    super(from, to, 'structDefinition', ['name', 'fields'], options);
    this.name = name;
    this.fields = fields;
    this.hash = hashObject(['structDefinition', name.hash, fields.hash]);
  }

  toDescription(level){
    if((this.level  - level) >= descDepth) return this.options['aria-label'];
    return `define ${this.name.toDescription(level)} to be a structure with
            ${this.fields.toDescription(level)}`;
  }

  toString() {
    return `(define-struct ${this.name} (${this.fields.toString()}))`;
  }

  pretty() {
    return P.lambdaLikeSexpr("define-struct", this.name, P.parens(this.fields));
  }

  render(props) {
    const {helpers, lockedTypes} = props;
    return (
      <Node node={this} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-operator">
          define-struct
          <Args helpers={helpers}>{[this.name]}</Args>
        </span>
        {helpers.renderNodeForReact(this.fields)}
      </Node>
    );
  }
}

export class VariableDefinition extends ASTNode {
  constructor(from, to, name, body, options={}) {
    super(from, to, 'variableDefinition', ['name', 'body'], options);
    this.name = name;
    this.body = body;
    this.hash = hashObject(['variableDefinition', name.hash, body.hash]);
  }

  toDescription(level){
    if((this.level  - level) >= descDepth) return this.options['aria-label'];
    let insert = ["literal", "blank"].includes(this.body.type)? "" : "the result of:";
    return `define ${this.name} to be ${insert} ${this.body.toDescription(level)}`;
  }

  toString() {
    return `(define ${this.name} ${this.body})`;
  }

  pretty() {
    return P.lambdaLikeSexpr("define", this.name, this.body);
  }

  render(props) {
    const {helpers, lockedTypes} = props;
    return (
      <Node node={this} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-operator">
          define
          <Args helpers={helpers}>{[this.name]}</Args>
        </span>
        <span className="blocks-args">
          {helpers.renderNodeForReact(this.body)}
        </span>
      </Node>
    );
  }
}

export class LambdaExpression extends ASTNode {
  constructor(from, to, args, body, options={}) {
    super(from, to, 'lambdaExpression', ['args', 'body'], options);
    this.args = args;
    this.body = body;
    this.hash = hashObject(['lambdaExpression', args.hash, body.hash]);
  }

  toDescription(level){
    if((this.level  - level) >= descDepth) return this.options['aria-label'];
    return `an anonymous function of ${pluralize("argument", this.args.ids)}: 
            ${this.args.toDescription(level)}, with body:
            ${this.body.toDescription(level)}`;
  }

  toString() {
    return `(lambda (${this.args.toString()}) ${this.body})`;
  }

  pretty() {
    return P.lambdaLikeSexpr("lambda", P.parens(this.args), this.body);
  }

  render(props) {
    const {helpers, lockedTypes} = props;
    return (
      <Node node={this} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-operator">
          &lambda; (
          {helpers.renderNodeForReact(this.args)}
          )
        </span>
        <span className="blocks-args">
          {helpers.renderNodeForReact(this.body)}
        </span>
      </Node>
    );
  }
}

export class FunctionDefinition extends ASTNode {
  constructor(from, to, name, params, body, options={}) {
    super(from, to, 'functionDefinition', ['name', 'params', 'body'], options);
    this.name = name;
    this.params = params;
    this.body = body;
    this.hash = hashObject(['functionDefinition', name.hash, params.hash, body.hash]);
    this.state = {};
    this.DropTarget = makeDropTargets(this);
  }

  toDescription(level){
    if((this.level  - level) >= descDepth) return this.options['aria-label'];
    return `define ${this.name} to be a function of 
            ${this.params.toDescription(level)}, with body:
            ${this.body.toDescription(level)}`;
  }

  toString() {
    return `(define (${this.name} ${this.params.toString()}) ${this.body})`;
  }

  pretty() {
    return P.lambdaLikeSexpr(
      "define",
      P.standardSexpr(this.name, this.params),
      this.body);
  }

  render(props) {
    const {helpers, lockedTypes} = props;
    const DropTarget = this.DropTarget;
    return (
      <Node node={this} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-operator">
          define (<DropTarget index={0} location={this.name.from} />
          {helpers.renderNodeForReact(this.name)}
          {helpers.renderNodeForReact(this.params)}
          )
        </span>
        <span className="blocks-args">
          {helpers.renderNodeForReact(this.body)}
        </span>
      </Node>
    );
  }
}

export class CondClause extends ASTNode {
  constructor(from, to, testExpr, thenExprs, options={}) {
    super(from, to, 'condClause', ['testExpr', 'thenExprs'], options);
    this.testExpr = testExpr;
    this.thenExprs = thenExprs;
    this.hash = hashObject(['condClause', testExpr.hash, thenExprs.map(e => e.hash)]);
    this.state = {};
    this.DropTarget = makeDropTargets(this);
  }

  toDescription(level){
    if((this.level  - level) >= descDepth) return this.options['aria-label'];
    return `condition: if ${this.testExpr.toDescription(level)}, then, ${this.thenExprs.map(te => te.toDescription(level))}`;
  }

  toString() {
    return `[${this.testExpr} ${this.thenExprs.join(' ')}]`;
  }

  pretty() {
    return P.brackets(P.spaceSep([this.testExpr].concat(this.thenExprs)));
  }

  render(props) {
    const {helpers, lockedTypes} = props;
    const DropTarget = this.DropTarget;
    return (
      <Node node={this} lockedTypes={lockedTypes} helpers={helpers}>
        <div className="blocks-cond-row">
          <div className="blocks-cond-predicate">
            <DropTarget index={0} location={this.testExpr.from} />
             {helpers.renderNodeForReact(this.testExpr)}
          </div>
          <div className="blocks-cond-result">
            {this.thenExprs.map((thenExpr, index) => (
              <span key={index}>
                <DropTarget index={index+1} location={thenExpr.from} />
                {helpers.renderNodeForReact(thenExpr)}
              </span>))}
          </div>
        </div>
        <DropTarget index={this.thenExprs.length + 1} location={this.from} />
      </Node>
    );
  }
}

export class CondExpression extends ASTNode {
  constructor(from, to, clauses, options={}) {
    super(from, to, 'condExpression', ['clauses'], options);
    this.clauses = clauses;
    this.hash = hashObject(['condExpression', this.clauses.map(clause => clause.hash)]);
  }

  toDescription(level){
    if((this.level  - level) >= descDepth) return this.options['aria-label'];
    return `a conditional expression with ${pluralize("condition", this.clauses)}: 
            ${this.clauses.map(c => c.toDescription(level))}`;
  }

  toString() {
    const clauses = this.clauses.map(c => c.toString()).join(' ');
    return `(cond ${clauses})`;
  }

  pretty() {
    return P.beginLikeSexpr("cond", this.clauses);
  }

  render(props) {
    const {helpers, lockedTypes} = props;
    return (
      <Node node={this} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-operator">cond</span>
        <div className="blocks-cond-table">
          {this.clauses.map((clause, index) => helpers.renderNodeForReact(clause, index)) }
        </div>
      </Node>
    );
  }
}

export class IfExpression extends ASTNode {
  constructor(from, to, testExpr, thenExpr, elseExpr, options={}) {
    super(from, to, 'ifExpression', ['testExpr', 'thenExpr', 'elseExpr'], options);
    this.testExpr = testExpr;
    this.thenExpr = thenExpr;
    this.elseExpr = elseExpr;
    this.hash = hashObject(['ifExpression', testExpr.hash, thenExpr.hash, elseExpr.hash]);
    this.state = {};
    this.DropTarget = makeDropTargets(this);
  }

  toDescription(level){
    if((this.level  - level) >= descDepth) return this.options['aria-label'];
    return `an if expression: if ${this.testExpr.toDescription(level)}, then ${this.thenExpr.toDescription(level)} `+
            `else ${this.elseExpr.toDescription(level)}`;
  }

  toString() {
    return `(if ${this.testExpr} ${this.thenExpr} ${this.elseExpr})`;
  }

  pretty() {
    return P.standardSexpr("if", [this.testExpr, this.thenExpr, this.elseExpr]);
  }

  render(props) {
    const {helpers, lockedTypes} = props;
    const DropTarget = this.DropTarget;
    return (
      <Node node={this} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-operator">if</span>
        <div className="blocks-cond-table">
          <div className="blocks-cond-row">
            <div className="blocks-cond-predicate">
              <DropTarget index={0} location={this.testExpr.from} />
              {helpers.renderNodeForReact(this.testExpr)}
            </div>
            <div className="blocks-cond-result">
              <DropTarget index={1} location={this.thenExpr.from} />
              {helpers.renderNodeForReact(this.thenExpr)}
            </div>
          </div>
          <div className="blocks-cond-row">
            <div className="blocks-cond-predicate blocks-cond-else">
              else
            </div>
            <div className="blocks-cond-result">
              <DropTarget index={2} location={this.elseExpr.from} />
              {helpers.renderNodeForReact(this.elseExpr)}
            </div>
            <div className="blocks-cond-result">
              <DropTarget index={3} location={this.elseExpr.to} />
            </div>
          </div>
        </div>
      </Node>
    );
  }
}

export class Literal extends ASTNode {
  constructor(from, to, value, dataType='unknown', options={}) {
    super(from, to, 'literal', [], options);
    this.value = value;
    this.dataType = dataType;
    this.hash = hashObject(['literal', this.value, this.dataType]);
  }

  toString() {
    return `${this.value}`;
  }

  pretty() {
    return P.txt(this.value);
  }

  render(props) {
    const {helpers, lockedTypes} = props;
    return (
      <Node node={this}
            lockedTypes={lockedTypes}
            normallyEditable={true}
            expandable={false}
            helpers={helpers}>
        <span className={`blocks-literal-${this.dataType}`}>
          {this.value.toString()}
        </span>
      </Node>
    );
  }
}

export class Comment extends ASTNode {
  constructor(from, to, comment, options={}) {
    super(from, to, 'comment', [], options);
    this.comment = comment;
    this.hash = hashObject(['comment', this.comment]);
  }

  toString() {
    return `${this.comment}`;
  }

  pretty() {
    return P.wrap(this.comment.split(/\s+/));
  }

  render(props) {
    return (<span className="blocks-comment" id={this.id} aria-hidden="true">
      <span className="screenreader-only">Has comment,</span> {this.comment.toString()}
    </span>);
  }
}

export class Blank extends ASTNode {
  constructor(from, to, value, dataType='blank', options={}) {
    super(from, to, 'blank', [], options);
    this.value = value || "...";
    this.dataType = dataType;
    this.hash = hashObject(['blank', this.value, this.dataType]);
  }

  toString() {
    return `${this.value}`;
  }

  pretty() {
    return P.txt(this.value);
  }

  render(props) {
    const {helpers, lockedTypes} = props;
    return (
      <Node node={this}
            lockedTypes={lockedTypes}
            normallyEditable={true}
            expandable={false}
            helpers={helpers}>
        <span className="blocks-literal-symbol" />
      </Node>
    );
  }
}

export class Sequence extends ASTNode {
  constructor(from, to, exprs, name, options={}) {
    super(from, to, 'sequence', ['exprs'], options);
    this.exprs = exprs;
    this.name = name;
    this.hash = hashObject(['sequence', this.name, this.exprs.map(expr => expr.hash)]);
  }

  toDescription(level) {
    if((this.level  - level) >= descDepth) return this.options['aria-label'];
    return `a sequence containing ${enumerateList(this.exprs, level)}`;
  }

  toString() {
    return `(${this.name} ${this.exprs.join(" ")})`;
  }

  pretty() {
    return P.standardSexpr(this.name, this.exprs);
  }

  render(props) {
    const {helpers, lockedTypes} = props;
    return (
      <Node node={this} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-operator">{this.name}</span>
        <div className="blocks-sequence-exprs">
          <Args helpers={helpers} location={this.name.to}>{this.exprs}</Args>
        </div>
      </Node>
    );
  }
}

