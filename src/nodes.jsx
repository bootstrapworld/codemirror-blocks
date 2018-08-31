import * as P from './pretty';
import React from 'react';
import {ASTNode, descDepth, enumerateList, pluralize} from './ast';
import Node from './components/Node';
import Args from './components/Args';
import DropTarget from './components/DropTarget';


export class Literal extends ASTNode {
  constructor(from, to, value, dataType='unknown', options={}) {
    super(from, to, 'literal', options);
    this.value = value;
    this.dataType = dataType;
  }

  *[Symbol.iterator]() {
    yield this;
  }

  pretty() {
    return P.txt(this.value);
  }

  render(props) {
    const {lockedTypes, helpers} = props;
    return (
      <Node node={this} lockedTypes={lockedTypes} helpers={helpers}>
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

  *[Symbol.iterator]() {
    yield this;
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

export class Sequence extends ASTNode {
  constructor(from, to, exprs, name, options={}) {
    super(from, to, 'sequence', options);
    this.exprs = exprs;
    this.name = name;
  }

  *[Symbol.iterator]() {
    yield this;
    for (let expr of this.exprs) {
      yield expr;
    }
  }

  toDescription(level) {
    if((this['aria-level'] - level) >= descDepth) return this.options['aria-label'];
    return `a sequence containing ${enumerateList(this.exprs, level)}`;
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

export class Expression extends ASTNode {
  constructor(from, to, func, args, options={}) {
    super(from, to, 'expression', options);
    this.func = func;
    this.args = args;
  }

  *[Symbol.iterator]() {
    yield this;
    yield this.func;
    for (let arg of this.args) {
      yield arg;
    }
  }

  toDescription(level){
    // if it's the top level, enumerate the args
    if((this['aria-level'] - level) == 0) { 
      return `applying the function ${this.func.toDescription()} to ${pluralize("argument", this.args)} `+
      this.args.map((a, i, args)  => (args.length>1? (i+1) + ": " : "")+ a.toDescription(level)).join(", ");
    }
    // if we've bottomed out, use the aria label
    if((this['aria-level'] - level) >= descDepth) return this.options['aria-label'];
    // if we're in between, use "f of A, B, C" format
    else return `${this.func.toDescription()} of `+ this.args.map(a  => a.toDescription(level)).join(", ");
      
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

export class Unknown extends ASTNode {
  constructor(from, to, elts, options={}) {
    super(from, to, 'unknown', options);
    this.elts = elts;
  }

  *[Symbol.iterator]() {
    yield this;
    for (let elt of this.elts) {
      yield elt;
    }
  }

  toDescription(level){
    if((this['aria-level']- level) >= descDepth) return this.options['aria-label'];
    return `an unknown expression with ${pluralize("children", this.elts)} `+ 
      this.elts.map((e, i, elts)  => (elts.length>1? (i+1) + ": " : "")+ e.toDescription(level)).join(", ");
  }

  pretty() {
    return P.standardSexpr(this.elts[0], this.elts.slice(1));
  }

  render(props) {
    const {helpers, lockedTypes} = props;
    let firstElt = this.elts[0];
    let restElts = this.elts.slice(1);
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

export class Blank extends ASTNode {
  constructor(from, to, value, dataType='blank', options={}) {
    super(from, to, 'blank', options);
    this.value = value || "...";
    this.dataType = dataType;
  }

  *[Symbol.iterator]() {
    yield this;
  }

  pretty() {
    return P.txt(this.value);
  }

  render(props) {
    const {helpers, lockedTypes} = props;
    return (
      <Node node={this} lockedTypes={lockedTypes} helpers={helpers}>
        <span className={`blocks-literal-symbol`}>
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

  *[Symbol.iterator]() {
    yield this;
    for (let id of this.ids) {
      yield id;
    }
  }

  toDescription(level){
    if((this['aria-level'] - level) >= descDepth) return this.options['aria-label'];
    return enumerateList(this.ids, level);
  }

  pretty() {
    return P.spaceSep(this.ids);
  }

  render(props) {
    const {helpers, lockedTypes} = props;
    return (
      <Node node={this} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-args">
          <Args helpers={helpers}>{this.ids}</Args>
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

  *[Symbol.iterator]() {
    yield this;
    yield this.name;
    yield this.fields;
  }

  toDescription(level){
    if((this['aria-level'] - level) >= descDepth) return this.options['aria-label'];
    return `define ${this.name.toDescription(level)} to be a structure with
            ${this.fields.toDescription(level)}`;
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
    super(from, to, 'variableDefinition', options);
    this.name = name;
    this.body = body;
  }

  toDescription(level){
    if((this['aria-level'] - level) >= descDepth) return this.options['aria-label'];
    let insert = ["literal", "blank"].includes(this.body.type)? "" : "the result of:";
    return `define ${this.name} to be ${insert} ${this.body.toDescription(level)}`;
  }

  *[Symbol.iterator]() {
    yield this;
    yield this.name;
    yield this.body;
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
    super(from, to, 'lambdaExpression', options);
    this.args = args;
    this.body = body;
  }

  *[Symbol.iterator]() {
    yield this;
    yield this.args;
    yield this.body;
  }

  toDescription(level){
    if((this['aria-level'] - level) >= descDepth) return this.options['aria-label'];
    return `an anonymous function of ${pluralize("argument", this.args.ids)}: 
            ${this.args.toDescription(level)}, with body:
            ${this.body.toDescription(level)}`;
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
    super(from, to, 'functionDefinition', options);
    this.name = name;
    this.params = params;
    this.body = body;
  }

  *[Symbol.iterator]() {
    yield this;
    yield this.name;
    yield this.params;
    yield this.body;
  }

  toDescription(level){
    if((this['aria-level'] - level) >= descDepth) return this.options['aria-label'];
    return `define ${this.name} to be a function of 
            ${this.params.toDescription(level)}, with body:
            ${this.body.toDescription(level)}`;
  }

  pretty() {
    return P.lambdaLikeSexpr(
      "define",
      P.standardSexpr(this.name, this.params),
      this.body);
  }

  render(props) {
    const {helpers, lockedTypes} = props;
    return (
      <Node node={this} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-operator">
          define (
          <DropTarget location={this.name.from} />
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
    super(from, to, 'condClause', options);
    this.testExpr = testExpr;
    this.thenExprs = thenExprs;
  }

  *[Symbol.iterator]() {
    yield this;
    yield this.testExpr;
    for(let thenExpr of this.thenExprs) {
      yield thenExpr;
    }
  }

  toDescription(level){
    if((this['aria-level'] - level) >= descDepth) return this.options['aria-label'];
    return `condition: if ${this.testExpr.toDescription(level)}, then, ${this.thenExprs.map(te => te.toDescription(level))}`;
  }

  pretty() {
    return P.brackets(P.spaceSep([this.testExpr].concat(this.thenExprs)));
  }

  render(props) {
    const {helpers, lockedTypes} = props;
    return (
      <Node node={this} lockedTypes={lockedTypes} helpers={helpers}>
        <div className="blocks-cond-row">
          <div className="blocks-cond-predicate">
            <DropTarget location={this.testExpr.from} />
            {helpers.renderNodeForReact(this.testExpr)}
          </div>
          <div className="blocks-cond-result">
            {this.thenExprs.map((thenExpr, index) => (
              <span key={index}>
                <DropTarget location={thenExpr.from} />
                {helpers.renderNodeForReact(thenExpr)}
              </span>))}
          </div>
        </div>
        <div className="blocks-cond-drop-row">
          <DropTarget location={this.from} />
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

  *[Symbol.iterator]() {
    yield this;
    for (let clause of this.clauses) {
      yield clause;
    }
  }

  toDescription(level){
    if((this['aria-level'] - level) >= descDepth) return this.options['aria-label'];
    return `a conditional expression with ${pluralize("condition", this.clauses)}: 
            ${this.clauses.map(c => c.toDescription(level))}`;
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
    super(from, to, 'ifExpression', options);
    this.testExpr = testExpr;
    this.thenExpr = thenExpr;
    this.elseExpr = elseExpr;
  }

  *[Symbol.iterator]() {
    yield this;
    yield this.testExpr;
    yield this.thenExpr;
    yield this.elseExpr;
  }

  toDescription(level){
    if((this['aria-level'] - level) >= descDepth) return this.options['aria-label'];
    return `an if expression: if ${this.testExpr.toDescription(level)}, then ${this.thenExpr.toDescription(level)} `+
            `else ${this.elseExpr.toDescription(level)}`;
  }

  pretty() {
    return P.standardSexpr("if", [this.testExpr, this.thenExpr, this.elseExpr]);
  }

  render(props) {
    const {helpers, lockedTypes} = props;
    return (
      <Node node={this} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-operator">if</span>
        <div className="blocks-cond-table">
          <div className="blocks-cond-row">
            <div className="blocks-cond-predicate">
              <DropTarget location={this.testExpr.from} />
              {helpers.renderNodeForReact(this.testExpr)}
            </div>
            <div className="blocks-cond-result">
              <DropTarget location={this.thenExpr.from} />
              {helpers.renderNodeForReact(this.thenExpr)}
            </div>
          </div>
          <div className="blocks-cond-row">
            <div className="blocks-cond-predicate blocks-cond-else">
              else
            </div>
            <div className="blocks-cond-result">
              <DropTarget location={this.elseExpr.from} />
              {helpers.renderNodeForReact(this.elseExpr)}
            </div>
          </div>
        </div>
      </Node>
    );
  }
}
