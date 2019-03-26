import * as P from './pretty';
import React from 'react';
import {ASTNode, enumerateList, pluralize} from './ast';
import hashObject from 'object-hash';
import Node from './components/Node';
import Args from './components/Args';
import {DropTarget, DropTargetSibling} from './components/DropTarget';


export class Unknown extends ASTNode {
  constructor(from, to, elts, options={}) {
    super(from, to, 'unknown', ['elts'], options);
    this.elts = elts;
  }

  longDescription(level) {
    return `an unknown expression with ${pluralize("children", this.elts)} `+ 
      this.elts.map((e, i, elts)  => (elts.length>1? (i+1) + ": " : "")+ e.describe(level)).join(", ");
  }

  pretty() {
    return P.withSchemeComment(
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
        <Args>{restElts}</Args>
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
  }

  longDescription(level) {
    // if it's the top level, enumerate the args
    if((this.level  - level) == 0) {
      return `applying the function ${this.func.describe(level)} to ${pluralize("argument", this.args)} `+
      this.args.map((a, i, args)  => (args.length>1? (i+1) + ": " : "")+ a.describe(level)).join(", ");
    }
    // if we're lower than that (but not so low that `.shortDescription()` is used), use "f of A, B, C" format
    else return `${this.func.describe(level)} of `+ this.args.map(a  => a.describe(level)).join(", ");
  }

  pretty() {
    return P.withSchemeComment(
      P.standardSexpr(this.func, this.args),
      this.options.comment,
      this);
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

export class IdentifierList extends ASTNode {
  constructor(from, to, kind, ids, options={}) {
    super(from, to, 'identifierList', ['ids'], options);
    this.kind = kind;
    this.ids = ids;
    this.hash = hashObject(['identifierList', this.kind, this.ids.map(id => id.hash)]);
  }

  longDescription(level) {
    return enumerateList(this.ids, level);
  }

  pretty() {
    return P.withSchemeComment(
      P.spaceSep(this.ids),
      this.options.comment,
      this);
  }

  render(props) {
    return (
      <Node node={this} {...props}>
        <span className="blocks-args">
          <Args>{this.ids}</Args>
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

  longDescription(level) {
    return `define ${this.name.describe(level)} to be a structure with
            ${this.fields.describe(level)}`;
  }

  pretty() {
    return P.withSchemeComment(
      P.lambdaLikeSexpr("define-struct", this.name, P.parens(this.fields)),
      this.options.comment,
      this);
  }

  render(props) {
    const fields = this.fields.reactElement();
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">
          define-struct
          <Args>{[this.name]}</Args>
        </span>
        {fields}
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

  longDescription(level) {
    let insert = ["literal", "blank"].includes(this.body.type)? "" : "the result of:";
    return `define ${this.name} to be ${insert} ${this.body.describe(level)}`;
  }

  pretty() {
    return P.withSchemeComment(
      P.lambdaLikeSexpr("define", this.name, this.body),
      this.options.comment,
      this);
  }

  render(props) {
    const body = this.body.reactElement();
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">
          define
          <Args>{[this.name]}</Args>
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
    super(from, to, 'lambdaExpression', ['args', 'body'], options);
    this.args = args;
    this.body = body;
    this.hash = hashObject(['lambdaExpression', args.hash, body.hash]);
  }

  longDescription(level) {
    return `an anonymous function of ${pluralize("argument", this.args.ids)}: 
            ${this.args.describe(level)}, with body:
            ${this.body.describe(level)}`;
  }

  pretty() {
    return P.lambdaLikeSexpr("lambda", P.parens(this.args), this.body);
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
    super(from, to, 'functionDefinition', ['name', 'params', 'body'], options);
    this.name = name;
    this.params = params;
    this.body = body;
    this.hash = hashObject(['functionDefinition', name.hash, params.hash, body.hash]);
  }

  longDescription(level) {
    return `define ${this.name} to be a function of 
            ${this.params.describe(level)}, with body:
            ${this.body.describe(level)}`;
  }

  pretty() {
    return P.withSchemeComment(
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
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">
          define (
            <DropTarget/>
            <DropTargetSibling node={this.name} left={true} />
            {params}
          )
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
    super(from, to, 'condClause', ['testExpr', 'thenExprs'], options);
    this.testExpr = testExpr;
    this.thenExprs = thenExprs;
    this.hash = hashObject(['condClause', testExpr.hash, thenExprs.map(e => e.hash)]);
  }

  longDescription(level) {
    return `condition: if ${this.testExpr.describe(level)}, then, ${this.thenExprs.map(te => te.describe(level))}`;
  }

  pretty() {
    return P.brackets(P.spaceSep([this.testExpr].concat(this.thenExprs)));
  }

  render(props) {
    return (
      <Node node={this} {...props}>
        <div className="blocks-cond-row">
          <div className="blocks-cond-predicate">
            <DropTarget/>
            <DropTargetSibling node={this.testExpr} left={true} right={true} />
          </div>
          <div className="blocks-cond-result">
            {this.thenExprs.map((thenExpr, index) => (
              <span key={index}>
                <DropTarget/>
                <DropTargetSibling node={thenExpr} left={true} right={true} />
              </span>))}
          </div>
        </div>
        <DropTarget/>
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

  longDescription(level) {
    return `a conditional expression with ${pluralize("condition", this.clauses)}: 
            ${this.clauses.map(c => c.describe(level))}`;
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
    super(from, to, 'ifExpression', ['testExpr', 'thenExpr', 'elseExpr'], options);
    this.testExpr = testExpr;
    this.thenExpr = thenExpr;
    this.elseExpr = elseExpr;
    this.hash = hashObject(['ifExpression', testExpr.hash, thenExpr.hash, elseExpr.hash]);
  }

  longDescription(level) {
    return `an if expression: if ${this.testExpr.describe(level)}, then ${this.thenExpr.describe(level)} `+
            `else ${this.elseExpr.describe(level)}`;
  }

  pretty() {
    return P.withSchemeComment(
      P.standardSexpr("if", [this.testExpr, this.thenExpr, this.elseExpr]),
      this.options.comment,
      this);
  }

  render(props) {
    return (
      <Node node={this} {...props}>
        <span className="blocks-operator">if</span>
        <div className="blocks-cond-table">
          <div className="blocks-cond-row">
            <div className="blocks-cond-predicate">
              <DropTarget/>
              <DropTargetSibling node={this.testExpr} left={true} right={true} />
            </div>
            <div className="blocks-cond-result">
              <DropTarget/>
              <DropTargetSibling node={this.thenExpr} left={true} right={true} />
            </div>
          </div>
          <div className="blocks-cond-row">
            <div className="blocks-cond-predicate blocks-cond-else">
              else
            </div>
            <div className="blocks-cond-result">
              <DropTarget/>
              <DropTargetSibling node={this.elseExpr} left={true} right={true} />
            </div>
            <div className="blocks-cond-result">
              <DropTarget/>
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

  describe(level) {
    return this.options["aria-label"];
  }

  pretty() {
    return P.withSchemeComment(P.txt(this.value), this.options.comment, this);
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
    super(from, to, 'comment', [], options);
    this.comment = comment;
    this.hash = hashObject(['comment', this.comment]);
  }

  describe(level) {
    return this.options["aria-label"];
  }

  pretty() {
    let words = this.comment.trim().split(/\s+/);
    let wrapped = P.wrap(" ", "", words);
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
    super(from, to, 'blank', [], options);
    this.value = value || "...";
    this.dataType = dataType;
    this.hash = hashObject(['blank', this.value, this.dataType]);
  }

  describe(level) {
    return this.options["aria-label"];
  }

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
    super(from, to, 'sequence', ['exprs'], options);
    this.exprs = exprs;
    this.name = name;
    this.hash = hashObject(['sequence', this.name, this.exprs.map(expr => expr.hash)]);
  }

  longDescription(level) {
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
          <Args>{this.exprs}</Args>
        </div>
      </Node>
    );
  }
}
