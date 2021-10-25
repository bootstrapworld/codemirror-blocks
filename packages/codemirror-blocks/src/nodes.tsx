import * as P from "pretty-fast-pretty-printer";
import React from "react";
import { ASTNode, enumerateList, NodeOptions, pluralize, Pos } from "./ast";
import Node, { Props as NodeProps } from "./components/Node";
import Args from "./components/Args";
import { DropTarget } from "./components/DropTarget";
import * as Spec from "./nodeSpec";

// Displays a comment according to specific rules.
//
// - `doc` is what's being commented.
// - `comment` is the comment itself. If it is falsy, there is no comment.
// - `container` is the ast node that owns the comment. This argument is used to
//   determine if the comment is a line comment (appears after `container` on
//   the same line). Line comments will stay as line comments _as long as they
//   fit on the line_. If they don't, they'll be converted into a comment on the
//   previous line.
function withComment(
  doc: P.Doc,
  comment: ASTNode | undefined,
  container: ASTNode
): P.Doc {
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

export class Unknown extends ASTNode<{ elts: ASTNode[] }> {
  constructor(from: Pos, to: Pos, elts: ASTNode[], options: NodeOptions = {}) {
    super({ from, to, type: "unknown", fields: { elts }, options });
  }

  static spec = Spec.nodeSpec([Spec.list("elts")]);

  longDescription(level: number) {
    return (
      `an unknown expression with ${pluralize("children", this.fields.elts)} ` +
      this.fields.elts
        .map(
          (e, i, elts) =>
            (elts.length > 1 ? i + 1 + ": " : "") + e.describe(level)
        )
        .join(", ")
    );
  }

  pretty(): P.Doc {
    return withComment(
      P.standardSexpr(this.fields.elts[0], this.fields.elts.slice(1)),
      this.options.comment,
      this
    );
  }

  render(props: NodeProps) {
    const firstElt = this.fields.elts[0].reactElement();
    const restElts = this.fields.elts.slice(1);
    return (
      <Node {...props}>
        <span className="blocks-operator">{firstElt}</span>
        <span className="blocks-args">
          <Args field="elts">{restElts}</Args>
        </span>
      </Node>
    );
  }
}

export class FunctionApp extends ASTNode<{ func: ASTNode; args: ASTNode[] }> {
  constructor(
    from: Pos,
    to: Pos,
    func: ASTNode,
    args: ASTNode[],
    options: NodeOptions = {}
  ) {
    super({ from, to, type: "functionApp", fields: { func, args }, options });
  }

  static spec = Spec.nodeSpec([Spec.required("func"), Spec.list("args")]);

  override longDescription(level: number) {
    // if it's the top level, enumerate the args
    if (this.level - level == 0) {
      return (
        `applying the function ${this.fields.func.describe(
          level
        )} to ${pluralize("argument", this.fields.args)} ` +
        this.fields.args
          .map(
            (a, i, args) =>
              (args.length > 1 ? i + 1 + ": " : "") + a.describe(level)
          )
          .join(", ")
      );
    }
    // if we're lower than that (but not so low that `.shortDescription()` is used), use "f of A, B, C" format
    else
      return (
        `${this.fields.func.describe(level)} of ` +
        this.fields.args.map((a) => a.describe(level)).join(", ")
      );
  }

  pretty(): P.Doc {
    return withComment(
      P.standardSexpr(this.fields.func, this.fields.args),
      this.options.comment,
      this
    );
  }

  render(props: NodeProps) {
    return (
      <Node {...props}>
        <span className="blocks-operator">
          {this.fields.func.reactElement()}
        </span>
        <span className="blocks-args">
          <Args field="args">{this.fields.args}</Args>
        </span>
      </Node>
    );
  }
}

export class IdentifierList extends ASTNode<{ kind: string; ids: ASTNode[] }> {
  constructor(
    from: Pos,
    to: Pos,
    kind: string,
    ids: ASTNode[],
    options: NodeOptions = {}
  ) {
    super({ from, to, type: "identifierList", fields: { kind, ids }, options });
  }

  static spec = Spec.nodeSpec([Spec.value("kind"), Spec.list("ids")]);

  longDescription(level: number) {
    return enumerateList(this.fields.ids, level);
  }

  pretty(): P.Doc {
    return withComment(
      P.sepBy(this.fields.ids, " "),
      this.options.comment,
      this
    );
  }

  render(props: NodeProps) {
    return (
      <Node {...props}>
        <span className="blocks-args">
          <Args field="ids">{this.fields.ids}</Args>
        </span>
      </Node>
    );
  }
}

export class StructDefinition extends ASTNode<{
  name: ASTNode;
  fields: ASTNode;
}> {
  constructor(
    from: Pos,
    to: Pos,
    name: ASTNode,
    fields: ASTNode,
    options: NodeOptions = {}
  ) {
    super({
      from,
      to,
      type: "structDefinition",
      fields: { name, fields },
      options,
    });
  }

  static spec = Spec.nodeSpec([Spec.value("name"), Spec.required("fields")]);

  longDescription(level: number) {
    return `define ${this.fields.name.describe(
      level
    )} to be a structure with ${this.fields.fields.describe(level)}`;
  }

  pretty(): P.Doc {
    return withComment(
      P.lambdaLikeSexpr(
        "define-struct",
        this.fields.name,
        P.horz("(", this.fields.fields, ")")
      ),
      this.options.comment,
      this
    );
  }

  render(props: NodeProps) {
    const name = this.fields.name.reactElement();
    const fields = this.fields.fields.reactElement();
    return (
      <Node {...props}>
        <span className="blocks-operator">
          define-struct
          {name}
        </span>
        {fields}
      </Node>
    );
  }
}

export class VariableDefinition extends ASTNode<{
  name: ASTNode;
  body: ASTNode;
}> {
  constructor(from: Pos, to: Pos, name: ASTNode, body: ASTNode, options = {}) {
    super({
      from,
      to,
      type: "variableDefinition",
      fields: { name, body },
      options,
    });
  }

  static spec = Spec.nodeSpec([Spec.required("name"), Spec.required("body")]);

  longDescription(level: number) {
    const insert = ["literal", "blank"].includes(this.fields.body.type)
      ? ""
      : "the result of:";
    return `define ${
      this.fields.name
    } to be ${insert} ${this.fields.body.describe(level)}`;
  }

  pretty(): P.Doc {
    return withComment(
      P.lambdaLikeSexpr("define", this.fields.name, this.fields.body),
      this.options.comment,
      this
    );
  }

  render(props: NodeProps) {
    const body = this.fields.body.reactElement();
    const name = this.fields.name.reactElement();
    return (
      <Node {...props}>
        <span className="blocks-operator">
          define
          {name}
        </span>
        <span className="blocks-args">{body}</span>
      </Node>
    );
  }
}

export class LambdaExpression extends ASTNode<{
  body: ASTNode;
  args: IdentifierList;
}> {
  constructor(
    from: Pos,
    to: Pos,
    args: IdentifierList,
    body: ASTNode,
    options = {}
  ) {
    super({
      from,
      to,
      type: "lambdaExpression",
      fields: { body, args },
      options,
    });
  }

  static spec = Spec.nodeSpec([Spec.required("args"), Spec.required("body")]);

  longDescription(level: number) {
    return `an anonymous function of ${pluralize(
      "argument",
      this.fields.args.fields.ids
    )}: 
            ${this.fields.args.describe(level)}, with body:
            ${this.fields.body.describe(level)}`;
  }

  pretty(): P.Doc {
    return P.lambdaLikeSexpr(
      "lambda(",
      P.horz("(", this.fields.args, ")"),
      this.fields.body
    );
  }

  render(props: NodeProps) {
    const args = this.fields.args.reactElement();
    const body = this.fields.body.reactElement();
    return (
      <Node {...props}>
        <span className="blocks-operator">&lambda; ({args})</span>
        <span className="blocks-args">{body}</span>
      </Node>
    );
  }
}

export class FunctionDefinition extends ASTNode<{
  name: ASTNode;
  params: ASTNode;
  body: ASTNode;
}> {
  constructor(
    from: Pos,
    to: Pos,
    name: ASTNode,
    params: ASTNode,
    body: ASTNode,
    options = {}
  ) {
    super({
      from,
      to,
      type: "functionDefinition",
      fields: { name, params, body },
      options,
    });
  }

  static spec = Spec.nodeSpec([
    Spec.required("name"),
    Spec.required("params"),
    Spec.required("body"),
  ]);

  longDescription(level: number) {
    return `define ${this.fields.name} to be a function of 
            ${this.fields.params.describe(level)}, with body:
            ${this.fields.body.describe(level)}`;
  }

  pretty(): P.Doc {
    return withComment(
      P.lambdaLikeSexpr(
        "define",
        P.standardSexpr(this.fields.name, [this.fields.params]),
        this.fields.body
      ),
      this.options.comment,
      this
    );
  }

  render(props: NodeProps) {
    const params = this.fields.params.reactElement();
    const body = this.fields.body.reactElement();
    const name = this.fields.name.reactElement();
    return (
      <Node {...props}>
        <span className="blocks-operator">
          define ({name} {params})
        </span>
        <span className="blocks-args">{body}</span>
      </Node>
    );
  }
}

export class CondClause extends ASTNode<{
  testExpr: ASTNode;
  thenExprs: ASTNode[];
}> {
  constructor(
    from: Pos,
    to: Pos,
    testExpr: ASTNode,
    thenExprs: ASTNode[],
    options = {}
  ) {
    super({
      from,
      to,
      type: "condClause",
      fields: { testExpr, thenExprs },
      options,
    });
  }

  static spec = Spec.nodeSpec([
    Spec.required("testExpr"),
    Spec.list("thenExprs"),
  ]);

  longDescription(level: number) {
    return `condition: if ${this.fields.testExpr.describe(
      level
    )}, then, ${this.fields.thenExprs.map((te) => te.describe(level))}`;
  }

  pretty(): P.Doc {
    return P.horz(
      "[",
      P.sepBy([this.fields.testExpr].concat(this.fields.thenExprs), " "),
      "]"
    );
  }

  render(props: NodeProps) {
    const testExpr = this.fields.testExpr.reactElement();
    return (
      <Node {...props}>
        <div className="blocks-cond-row">
          <div className="blocks-cond-predicate">{testExpr}</div>
          <div className="blocks-cond-result">
            {this.fields.thenExprs.map((thenExpr, index) => (
              <span key={index}>
                <DropTarget field="thenExprs" />
                {thenExpr.reactElement()}
              </span>
            ))}
            <DropTarget field="thenExprs" />
          </div>
        </div>
      </Node>
    );
  }
}

export class CondExpression extends ASTNode<{ clauses: ASTNode[] }> {
  constructor(from: Pos, to: Pos, clauses: ASTNode[], options = {}) {
    super({ from, to, type: "condExpression", fields: { clauses }, options });
  }

  static spec = Spec.nodeSpec([Spec.list("clauses")]);

  longDescription(level: number) {
    return `a conditional expression with ${pluralize(
      "condition",
      this.fields.clauses
    )}: 
            ${this.fields.clauses.map((c) => c.describe(level))}`;
  }

  pretty(): P.Doc {
    return P.beginLikeSexpr("cond", this.fields.clauses);
  }

  render(props: NodeProps) {
    const clauses = this.fields.clauses.map((clause, index) =>
      clause.reactElement({ key: index })
    );
    return (
      <Node {...props}>
        <span className="blocks-operator">cond</span>
        <div className="blocks-cond-table">{clauses}</div>
      </Node>
    );
  }
}

export class IfExpression extends ASTNode<{
  testExpr: ASTNode;
  thenExpr: ASTNode;
  elseExpr: ASTNode;
}> {
  constructor(
    from: Pos,
    to: Pos,
    testExpr: ASTNode,
    thenExpr: ASTNode,
    elseExpr: ASTNode,
    options = {}
  ) {
    super({
      from,
      to,
      type: "ifExpression",
      fields: { testExpr, thenExpr, elseExpr },
      options,
    });
  }

  static spec = Spec.nodeSpec([
    Spec.required("testExpr"),
    Spec.required("thenExpr"),
    Spec.required("elseExpr"),
  ]);

  longDescription(level: number) {
    return (
      `an if expression: if ${this.fields.testExpr.describe(
        level
      )}, then ${this.fields.thenExpr.describe(level)} ` +
      `else ${this.fields.elseExpr.describe(level)}`
    );
  }

  pretty(): P.Doc {
    return withComment(
      P.standardSexpr("if", [
        this.fields.testExpr,
        this.fields.thenExpr,
        this.fields.elseExpr,
      ]),
      this.options.comment,
      this
    );
  }

  render(props: NodeProps) {
    const testExpr = this.fields.testExpr.reactElement();
    const thenExpr = this.fields.thenExpr.reactElement();
    const elseExpr = this.fields.elseExpr.reactElement();
    return (
      <Node {...props}>
        <span className="blocks-operator">if</span>
        <div className="blocks-cond-table">
          <div className="blocks-cond-row">
            <div className="blocks-cond-predicate">{testExpr}</div>
            <div className="blocks-cond-result">{thenExpr}</div>
          </div>
          <div className="blocks-cond-row">
            <div className="blocks-cond-predicate blocks-cond-else">else</div>
            <div className="blocks-cond-result">{elseExpr}</div>
          </div>
        </div>
      </Node>
    );
  }
}

export class Literal extends ASTNode<{ value: string; dataType: string }> {
  constructor(
    from: Pos,
    to: Pos,
    value: string,
    dataType = "unknown",
    options = {}
  ) {
    super({ from, to, type: "literal", fields: { value, dataType }, options });
  }

  static spec = Spec.nodeSpec([Spec.value("value"), Spec.value("dataType")]);

  describe() {
    return this.options["aria-label"];
  }

  pretty(): P.Doc {
    return withComment(P.txt(this.fields.value), this.options.comment, this);
  }

  render(props: NodeProps) {
    return (
      <Node {...props} normallyEditable={true} expandable={false}>
        <span className={`blocks-literal-${this.fields.dataType}`}>
          {this.fields.value}
        </span>
      </Node>
    );
  }
}

export class Comment extends ASTNode<{ comment: string }> {
  constructor(from: Pos, to: Pos, comment: string, options = {}) {
    super({ from, to, type: "comment", fields: { comment }, options });
    this.isLockedP = true;
  }

  static spec = Spec.nodeSpec([Spec.value("comment")]);

  describe(): string | undefined {
    return this.options["aria-label"];
  }

  pretty(): P.Doc {
    const words = this.fields.comment.trim().split(/\s+/);
    const wrapped = P.wrap(words);
    // Normalize all comments to block comments
    return P.concat("#| ", wrapped, " |#");
  }

  render() {
    // eslint-disable-line no-unused-vars
    return (
      <span className="blocks-comment" id={this.id} aria-hidden="true">
        <span className="screenreader-only">Has comment,</span>{" "}
        <span>{this.fields.comment.toString()}</span>
      </span>
    );
  }
}

export class Blank extends ASTNode<{ value: string; dataType: string }> {
  constructor(
    from: Pos,
    to: Pos,
    value: string,
    dataType = "blank",
    options = {}
  ) {
    super({
      from,
      to,
      type: "blank",
      fields: { value: value || "...", dataType },
      options,
    });
  }

  static spec = Spec.nodeSpec([Spec.value("value"), Spec.value("dataType")]);

  describe() {
    return this.options["aria-label"];
  }

  pretty(): P.Doc {
    return P.txt(this.fields.value);
  }

  render(props: NodeProps) {
    return (
      <Node {...props} normallyEditable={true} expandable={false}>
        <span className="blocks-literal-symbol" />
      </Node>
    );
  }
}

export class Sequence extends ASTNode<{ name: ASTNode; exprs: ASTNode[] }> {
  constructor(
    from: Pos,
    to: Pos,
    exprs: ASTNode[],
    name: ASTNode,
    options = {}
  ) {
    super({ from, to, type: "sequence", fields: { name, exprs }, options });
  }

  static spec = Spec.nodeSpec([Spec.optional("name"), Spec.list("exprs")]);

  longDescription(level: number) {
    return `a sequence containing ${enumerateList(this.fields.exprs, level)}`;
  }

  pretty(): P.Doc {
    return P.vert(this.fields.name, ...this.fields.exprs);
  }

  render(props: NodeProps) {
    return (
      <Node {...props}>
        <span className="blocks-operator">
          {this.fields.name.reactElement()}
        </span>
        <span className="blocks-sequence-exprs">
          <Args field="exprs">{this.fields.exprs}</Args>
        </span>
      </Node>
    );
  }
}
