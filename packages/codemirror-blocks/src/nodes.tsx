import * as P from "pretty-fast-pretty-printer";
import React from "react";
import {
  ASTNode,
  ASTNodeProps,
  enumerateList,
  NodeOptions,
  pluralize,
  Pos,
  withComment,
  withoutOrphans,
} from "./ast";
import Node, { COMMENT_PREFIX } from "./components/Node";
import Args from "./components/Args";
import { DropTarget } from "./components/DropTarget";
import { defineCoreNode as defineNode, field } from "./defineNode";
import type { NodeMaker, NodeOf, Overrides } from "./defineNode";
import * as Spec from "./nodeSpec";
import { poscmp } from "./utils";

/**
 * The pretty printer refuses text with a newline in it. A string literal can
 * hold one (`"a` newline `b"`), and `\n` in its place reads as the same string.
 */
const singleLine = (text: string) => text.replace(/\r?\n/g, "\\n");

export { withComment };

type ASTSpecConfig = { [key: string]: Spec.NodeSpec };

type ASTSpec<NodeSpecs extends ASTSpecConfig> = {
  config: NodeSpecs;

  /**
   * Checks whether the given node is of the given type.
   *
   * This is a typeguard that can be used for type narrowing
   * @param type The type of node you want to check against
   * @param node The ASTNode instance to check
   * @returns
   */
  isNodeOfType<T extends keyof NodeSpecs>(
    node: ASTNode,
    type: T
  ): node is ASTNode<NodeSpecs[T], Spec.FieldsForSpec<NodeSpecs[T]>>;

  /**
   * Create a node that conforms to the specification for this AST.
   */
  makeNode<T extends keyof NodeSpecs>(
    props: Omit<ASTNodeProps<NodeSpecs[T]>, "spec"> & {
      type: T;
    }
  ): ASTNode<NodeSpecs[T], Spec.FieldsForSpec<NodeSpecs[T]>>;
};

export function createASTSpec<NodeSpecs extends ASTSpecConfig>(
  config: NodeSpecs = {} as NodeSpecs
): ASTSpec<NodeSpecs> {
  return {
    config,
    isNodeOfType<T extends keyof NodeSpecs>(
      node: ASTNode,
      type: T
    ): node is ASTNode<NodeSpecs[T], Spec.FieldsForSpec<NodeSpecs[T]>> {
      return node.type === type;
    },
    makeNode<T extends keyof NodeSpecs>(
      props: Omit<ASTNodeProps<NodeSpecs[T]>, "spec"> & {
        type: T;
      }
    ): ASTNode<NodeSpecs[T], Spec.FieldsForSpec<NodeSpecs[T]>> {
      return new ASTNode({ ...props, spec: config[props.type] });
    },
  };
}

export const Unknown = defineNode({
  type: "unknown",
  label: "unknown expression",
  fields: {
    elts: field.list(),
  },
  pretty: (node) =>
    node.fields.elts.length
      ? P.standardSexpr(node.fields.elts[0], node.fields.elts.slice(1))
      : P.txt("()"),
  render(props) {
    const firstElt = props.node.fields.elts[0].reactElement();
    const restElts = props.node.fields.elts.slice(1);
    return (
      <Node {...props} variant="compound">
        <span className="blocks-operator">{firstElt}</span>
        <Args className="blocks-args" field="elts">
          {restElts}
        </Args>
      </Node>
    );
  },
  longDescription(node, level) {
    return (
      `an unknown expression with ${node.fields.elts.length} ${
        node.fields.elts.length === 1 ? "child" : "children"
      } ` +
      node.fields.elts
        .map(
          (e, i, elts) =>
            (elts.length > 1 ? i + 1 + ": " : "") + e.describe(level)
        )
        .join(", ")
    );
  },
});

export type FunctionAppNode = ReturnType<typeof FunctionApp>;
export const FunctionApp = defineNode({
  type: "functionApp",
  label: "function application",
  fields: {
    func: field.required(),
    args: field.list({ orphans: true }),
  },
  pretty: (node) => {
    // An empty pair of brackets with only comments in it has a blank where
    // the function goes that was never written (it is no wider than nothing):
    // printing `...` there would make it a call of its own, and a header with
    // it a different form.
    const { func, args } = node.fields;
    const unwritten =
      func.type === "blank" &&
      poscmp(func.from, func.to) === 0 &&
      args.length > 0 &&
      args.every((a: ASTNode) => a.options.orphan);
    return P.standardSexpr(unwritten ? "" : func, args);
  },
  render(props) {
    return (
      <Node {...props} variant="compound">
        <span className="blocks-operator">
          {props.node.fields.func.reactElement()}
        </span>
        <Args className="blocks-args" field="args">
          {props.node.fields.args}
        </Args>
      </Node>
    );
  },
  longDescription(node, level) {
    // (comments among the arguments are not arguments)
    const args = withoutOrphans(node.fields.args);
    // if it's the top level, enumerate the args
    if (node.level - level == 0) {
      return (
        `applying the function ${node.fields.func.describe(
          level
        )} to ${pluralize("argument", args)} ` +
        args
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
        `${node.fields.func.describe(level)} of ` +
        args.map((a) => a.describe(level)).join(", ")
      );
  },
});

export const IdentifierList = defineNode({
  type: "identifierList",
  label: "identifier list",
  fields: {
    kind: field.value<string>(),
    ids: field.list(),
  },
  pretty: (node) => P.sepBy(node.fields.ids, " "),
  render(props) {
    return (
      <Node {...props}>
        <Args className="blocks-args" field="ids">
          {props.node.fields.ids}
        </Args>
      </Node>
    );
  },
  longDescription(node, level) {
    return enumerateList(node.fields.ids, level);
  },
});

export const StructDefinition = defineNode({
  type: "structDefinition",
  label: "structure definition",
  fields: {
    name: field.required(),
    fields: field.required(),
  },
  pretty: (node) =>
    P.lambdaLikeSexpr(
      "define-struct",
      node.fields.name,
      P.horz("(", node.fields.fields, ")")
    ),
  render(props) {
    const name = props.node.fields.name.reactElement();
    const fields = props.node.fields.fields.reactElement();
    return (
      <Node {...props} variant="compound">
        <span className="blocks-operator">
          define-struct
          {name}
        </span>
        {fields}
      </Node>
    );
  },
  longDescription(node, level) {
    return `define ${node.fields.name.describe(
      level
    )} to be a structure with ${node.fields.fields.describe(level)}`;
  },
});

export const VariableDefinition = defineNode({
  type: "variableDefinition",
  label: "variable definition",
  fields: {
    name: field.required(),
    body: field.required(),
  },
  pretty: (node) =>
    P.lambdaLikeSexpr("define", node.fields.name, node.fields.body),
  render(props) {
    const body = props.node.fields.body.reactElement();
    const name = props.node.fields.name.reactElement();
    return (
      <Node {...props} variant="compound">
        <span className="blocks-operator">
          define
          {name}
        </span>
        <span className="blocks-args">{body}</span>
      </Node>
    );
  },
  longDescription(node, level) {
    const insert = ["literal", "blank"].includes(node.fields.body.type)
      ? ""
      : "the result of:";
    return `define ${
      node.fields.name
    } to be ${insert} ${node.fields.body.describe(level)}`;
  },
});

export const LambdaExpression = defineNode({
  type: "lambdaExpression",
  label: "lambda expression",
  fields: {
    args: field.required(),
    body: field.required(),
  },
  pretty: (node) =>
    P.lambdaLikeSexpr(
      "lambda",
      P.horz("(", node.fields.args, ")"),
      node.fields.body
    ),
  render(props) {
    const args = props.node.fields.args.reactElement();
    const body = props.node.fields.body.reactElement();
    return (
      <Node {...props} variant="compound">
        <span className="blocks-operator">&lambda; ({args})</span>
        <span className="blocks-args">{body}</span>
      </Node>
    );
  },
  longDescription(node, level) {
    // (by its type: CoreAST is made of this kind, and cannot be named here)
    if (node.fields.args.type === "identifierList") {
      return `an anonymous function of ${pluralize(
        "argument",
        node.fields.args.fields.ids as unknown as ASTNode[]
      )}: 
            ${node.fields.args.describe(level)}, with body:
            ${node.fields.body.describe(level)}`;
    }
  },
});

export const FunctionDefinition = defineNode({
  type: "functionDefinition",
  label: "function definition",
  fields: {
    name: field.required(),
    params: field.required(),
    body: field.required(),
  },
  pretty: (node) =>
    P.lambdaLikeSexpr(
      "define",
      P.standardSexpr(node.fields.name, [node.fields.params]),
      node.fields.body
    ),
  render(props) {
    const params = props.node.fields.params.reactElement();
    const body = props.node.fields.body.reactElement();
    const name = props.node.fields.name.reactElement();
    return (
      <Node {...props} variant="compound">
        <span className="blocks-operator">
          define ({name} {params})
        </span>
        <span className="blocks-args">{body}</span>
      </Node>
    );
  },
  longDescription(node, level) {
    return `define ${node.fields.name} to be a function of 
                ${node.fields.params.describe(level)}, with body:
                ${node.fields.body.describe(level)}`;
  },
});

export const CondClause = defineNode({
  type: "condClause",
  label: "conditional clause",
  fields: {
    testExpr: field.required(),
    thenExprs: field.list({ orphans: true }),
  },
  pretty: (node) =>
    P.horz(
      "[",
      P.sepBy([node.fields.testExpr].concat(node.fields.thenExprs), " "),
      "]"
    ),
  render(props) {
    const testExpr = props.node.fields.testExpr.reactElement();
    return (
      <Node {...props}>
        <div className="blocks-cond-row">
          <div className="blocks-cond-predicate">{testExpr}</div>
          <div className="blocks-cond-result">
            {props.node.fields.thenExprs.map((thenExpr, index) => (
              // by place, not id: ids change with every parse
              // eslint-disable-next-line @eslint-react/no-array-index-key
              <span key={index}>
                <DropTarget field="thenExprs" index={index} />
                {thenExpr.reactElement()}
              </span>
            ))}
            <DropTarget
              field="thenExprs"
              index={props.node.fields.thenExprs.length}
            />
          </div>
        </div>
      </Node>
    );
  },
  longDescription(node, level) {
    return `condition: if ${node.fields.testExpr.describe(
      level
    )}, then, ${withoutOrphans(node.fields.thenExprs).map((te) => te.describe(level))}`;
  },
});

export const CondExpression = defineNode({
  type: "condExpression",
  label: "conditional expression",
  fields: {
    clauses: field.list(),
  },
  pretty: (node) => P.beginLikeSexpr("cond", node.fields.clauses),
  render(props) {
    const clauses = props.node.fields.clauses.map((clause, index) =>
      clause.reactElement({ key: index })
    );
    return (
      <Node {...props} variant="compound">
        <span className="blocks-operator">cond</span>
        <div className="blocks-cond-table">{clauses}</div>
      </Node>
    );
  },
  longDescription(node, level) {
    return `a conditional expression with ${pluralize(
      "condition",
      node.fields.clauses
    )}: 
                ${node.fields.clauses.map((c) => c.describe(level))}`;
  },
});

export const IfExpression = defineNode({
  type: "ifExpression",
  label: "if expression",
  fields: {
    testExpr: field.required(),
    thenExpr: field.required(),
    elseExpr: field.required(),
  },
  pretty: (node) =>
    P.standardSexpr("if", [
      node.fields.testExpr,
      node.fields.thenExpr,
      node.fields.elseExpr,
    ]),
  render(props) {
    const testExpr = props.node.fields.testExpr.reactElement();
    const thenExpr = props.node.fields.thenExpr.reactElement();
    const elseExpr = props.node.fields.elseExpr.reactElement();
    return (
      <Node {...props} variant="compound">
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
  },
  longDescription(node, level) {
    return (
      `an if expression: if ${node.fields.testExpr.describe(
        level
      )}, then ${node.fields.thenExpr.describe(level)} ` +
      `else ${node.fields.elseExpr.describe(level)}`
    );
  },
});

/**
 * A loop of any kind: `kind` says which ("while", "for-each", "for", "repeat"),
 * the `header` holds what the kind needs before the steps (a while: its test;
 * a for-each: the variable and the collection; a C-style for: its three parts;
 * a repeat: the count), and the `body` the steps. Printed as `(kind header...
 * body...)`; a language writes it its own way with `forLanguage`.
 */
export const Loop = defineNode({
  type: "loop",
  label: "loop",
  fields: {
    kind: field.value<string>(),
    header: field.list(),
    body: field.list({ orphans: true }),
  },
  pretty: (node) =>
    P.standardSexpr(node.fields.kind, [
      ...node.fields.header,
      ...node.fields.body,
    ]),
  ariaLabel: (node) => `${node.fields.kind} ${node.label}`,
  render(props) {
    return (
      <Node {...props} variant="compound">
        <span className="blocks-operator">{props.node.fields.kind}</span>
        <Args className="blocks-loop-header" field="header">
          {props.node.fields.header}
        </Args>
        <Args className="blocks-loop-body" field="body">
          {props.node.fields.body}
        </Args>
      </Node>
    );
  },
  longDescription(node, level) {
    const { kind, header, body } = node.fields;
    const over = header.length
      ? ` (${header.map((h) => h.describe(level)).join(", ")})`
      : "";
    return `a ${kind} loop${over} with ${pluralize("step", withoutOrphans(body))}`;
  },
});

/**
 * An operation on two things: `operator` is its text ("+", "and", "<="...), not a
 * node. Printed as `(operator left right)`; a language that writes operators
 * between the operands says so in `pretty`, and puts the brackets its own
 * precedence needs (the core does not do precedence).
 */
export const BinaryOperation = defineNode({
  type: "binaryOperation",
  label: "binary operation",
  fields: {
    operator: field.value<string>(),
    left: field.required(),
    right: field.required(),
  },
  pretty: (node) =>
    P.standardSexpr(node.fields.operator, [
      node.fields.left,
      node.fields.right,
    ]),
  render(props) {
    return (
      <Node {...props} variant="compound">
        <span className="blocks-operator">{props.node.fields.operator}</span>
        {props.node.fields.left.reactElement()}
        {props.node.fields.right.reactElement()}
      </Node>
    );
  },
  longDescription(node, level) {
    return `${node.fields.operator} of ${node.fields.left.describe(
      level
    )} and ${node.fields.right.describe(level)}`;
  },
});

/** An operation on one thing (`!x`, `-x`, `not x`): printed `(operator operand)` */
export const UnaryOperation = defineNode({
  type: "unaryOperation",
  label: "unary operation",
  fields: {
    operator: field.value<string>(),
    operand: field.required(),
  },
  pretty: (node) =>
    P.standardSexpr(node.fields.operator, [node.fields.operand]),
  render(props) {
    return (
      <Node {...props} variant="compound">
        <span className="blocks-operator">{props.node.fields.operator}</span>
        {props.node.fields.operand.reactElement()}
      </Node>
    );
  },
  longDescription(node, level) {
    return `${node.fields.operator} of ${node.fields.operand.describe(level)}`;
  },
});

/**
 * Putting a value into a target (`x = 1`, `x += 1`): `operator` is its text ("=",
 * "+=", ...). Printed `(set! target value)` for "=", else `(operator target
 * value)`.
 */
export const Assignment = defineNode({
  type: "assignment",
  label: "assignment",
  fields: {
    operator: field.value<string>(),
    target: field.required(),
    value: field.required(),
  },
  pretty: (node) =>
    P.standardSexpr(
      node.fields.operator === "=" ? "set!" : node.fields.operator,
      [node.fields.target, node.fields.value]
    ),
  render(props) {
    return (
      <Node {...props} variant="compound">
        {props.node.fields.target.reactElement()}
        <span className="blocks-operator">{props.node.fields.operator}</span>
        {props.node.fields.value.reactElement()}
      </Node>
    );
  },
  longDescription(node, level) {
    return `${node.fields.operator === "=" ? "set" : node.fields.operator} ${node.fields.target.describe(
      level
    )} to ${node.fields.value.describe(level)}`;
  },
});

/** One branch of a `Conditional`: a test, and the steps to take if it holds */
export const ConditionalBranch = defineNode({
  type: "conditionalBranch",
  label: "conditional branch",
  fields: {
    test: field.required(),
    body: field.list({ orphans: true }),
  },
  pretty: (node) => P.standardSexpr(node.fields.test, node.fields.body),
  render(props) {
    return (
      <Node {...props} variant="compound">
        <span className="blocks-operator">if</span>
        {props.node.fields.test.reactElement()}
        <Args className="blocks-conditional-body" field="body">
          {props.node.fields.body}
        </Args>
      </Node>
    );
  },
  longDescription(node, level) {
    return `a branch taken if ${node.fields.test.describe(level)}, with ${pluralize(
      "step",
      withoutOrphans(node.fields.body)
    )}`;
  },
});

/**
 * if, if/else and else-if chains in one node: the `branches` (of
 * `ConditionalBranch`) are tried in order, and the `otherwise` steps are taken
 * if none holds (no steps: no else). Printed as `(cond (test body...) ... (else
 * otherwise...))`.
 */
export const Conditional = defineNode({
  type: "conditional",
  label: "conditional",
  fields: {
    branches: field.list(),
    otherwise: field.list({ orphans: true }),
  },
  pretty: (node) =>
    P.standardSexpr("cond", [
      ...node.fields.branches,
      ...(node.fields.otherwise.length
        ? [P.standardSexpr("else", node.fields.otherwise)]
        : []),
    ]),
  render(props) {
    return (
      <Node {...props} variant="compound">
        <span className="blocks-operator">conditional</span>
        <Args className="blocks-conditional-branches" field="branches">
          {props.node.fields.branches}
        </Args>
        <div className="blocks-conditional-else">
          <span className="blocks-operator">else</span>
          <Args className="blocks-conditional-body" field="otherwise">
            {props.node.fields.otherwise}
          </Args>
        </div>
      </Node>
    );
  },
  longDescription(node) {
    const { branches, otherwise } = node.fields;
    return `a conditional with ${pluralize("branch", branches)}${
      withoutOrphans(otherwise).length ? " and an else" : ""
    }`;
  },
});

export type LiteralNode = ReturnType<typeof Literal>;
export const Literal = defineNode({
  type: "literal",
  label: "literal",
  fields: { value: field.value<string>(), dataType: field.value<string>() },
  pretty: (node) => P.txt(singleLine(node.fields.value)),
  render(props) {
    return (
      <Node
        {...props}
        variant="value"
        normallyEditable={true}
        expandable={false}
      >
        <span className={`blocks-literal-${props.node.fields.dataType}`}>
          {props.node.fields.value}
        </span>
      </Node>
    );
  },
});

/** Scheme's block comment, for a comment whose language does not say */
const SCHEME_COMMENT = { open: "#|", close: "|#" };

/**
 * A comment. One that goes with a node is kept as data (`options.comment` of
 * that node) and shown in a popup while it is active. One that goes with none of
 * them is an *orphan* (`options.orphan`): a node of its own, which can be
 * focused, read and edited like any other, and which is a sibling of the
 * nodes beside it.
 */
export function Comment(
  from: Pos,
  to: Pos,
  comment: string,
  options: NodeOptions = {}
) {
  const orphan = Boolean(options.orphan);
  return CoreAST.makeNode({
    from,
    to,
    type: "comment",
    fields: { comment },
    options: {
      // (an orphan is edited with Shift-Ctrl-], and is no more locked than
      // any other block)
      ...(orphan
        ? { ariaLabel: (n: ASTNode) => `${n.label}: ${n.fields.comment}` }
        : { isNotEditable: true }),
      ...options,
    },
    pretty: (node) => {
      // Normalize all comments to block comments
      const { open, close } = node.options.blockComment ?? SCHEME_COMMENT;
      // (a comment cannot hold the marks that open and close one: a line
      // comment may, and they would end or nest the block comment it becomes)
      const safe = (node.fields.comment as string)
        .split(close)
        .join(close[0] + " " + close.slice(1))
        .split(open)
        .join(open[0] + " " + open.slice(1));
      const wrapped = P.wrap(safe.trim().split(/\s+/));
      const doc = P.concat(open + " ", wrapped, " " + close);
      // An orphan is followed by a blank line, which is what makes it read
      // back as an orphan (a comment on the line above a node goes with it);
      // that also keeps whatever holds it from printing on one line.
      return orphan ? P.vert(doc, "") : doc;
    },
    render(props) {
      const { node } = props;
      if (node.options.orphan) {
        return (
          <Node {...props}>
            <span className="blocks-comment-text">
              <span aria-hidden="true">{"\u{1F4AC} "}</span>
              {node.fields.comment.toString()}
            </span>
          </Node>
        );
      }
      // (a popup, shown while the node it is on is active. The node's
      // aria-labelledby names it, so a screen reader reads it once, after the
      // node's own label: hidden, but still part of that name)
      const { node: _node, ...rest } = props;
      return (
        <span
          className="blocks-comment"
          aria-hidden="true"
          title={node.fields.comment.toString()}
          {...rest}
        >
          <span className="screenreader-only">{COMMENT_PREFIX}</span>
          {node.fields.comment.toString()}
          <span className="screenreader-only">,</span>
        </span>
      );
    },
  });
}

export const Blank = defineNode({
  type: "blank",
  label: "blank",
  fields: { value: field.value<string>(), dataType: field.value<string>() },
  pretty: (node) => P.txt(singleLine(node.fields.value)),
  render(props) {
    return (
      <Node
        {...props}
        variant="value"
        normallyEditable={true}
        expandable={false}
      >
        <span className="blocks-literal-symbol" />
      </Node>
    );
  },
});

const sequenceFields = {
  name: field.optional(),
  exprs: field.list({ orphans: true }),
};

/**
 * A kind of sequence, printed as `pretty` says (a language prints its own
 * sequences its own way: WeScheme as an s-expression)
 */
export const defineSequence = (
  pretty: (node: NodeOf<typeof sequenceFields>) => P.Doc | string
) =>
  defineNode({
    type: "sequence",
    label: "sequence",
    fields: sequenceFields,
    pretty,
    render(props) {
      return (
        <Node {...props} variant="compound">
          <span className="blocks-operator">
            {props.node.fields.name?.reactElement()}
          </span>
          <Args className="blocks-sequence-exprs" field="exprs">
            {props.node.fields.exprs}
          </Args>
        </Node>
      );
    },
    longDescription(node, level) {
      return `a sequence containing ${enumerateList(node.fields.exprs, level)}`;
    },
  });
export const Sequence = defineSequence((node) =>
  P.vert(node.fields.name || "", ...node.fields.exprs)
);
export type SequenceNode = ReturnType<typeof Sequence>;

const specs = {
  unknown: Unknown.spec,
  functionApp: FunctionApp.spec,
  identifierList: IdentifierList.spec,
  structDefinition: StructDefinition.spec,
  variableDefinition: VariableDefinition.spec,
  lambdaExpression: LambdaExpression.spec,
  functionDefinition: FunctionDefinition.spec,
  condClause: CondClause.spec,
  condExpression: CondExpression.spec,
  ifExpression: IfExpression.spec,
  loop: Loop.spec,
  binaryOperation: BinaryOperation.spec,
  unaryOperation: UnaryOperation.spec,
  assignment: Assignment.spec,
  conditionalBranch: ConditionalBranch.spec,
  conditional: Conditional.spec,
  literal: Literal.spec,
  comment: Spec.nodeSpec([Spec.value<string, "comment">("comment")], {
    label: "comment",
  }),
  blank: Blank.spec,
  sequence: Sequence.spec,
};

export const CoreAST = createASTSpec(specs);

/**
 * The core nodes that a language can say its own syntax for (`forLanguage`).
 * (A comment and a sequence are made in other ways, and are the same for all.)
 */
const customizable = {
  Unknown,
  FunctionApp,
  IdentifierList,
  StructDefinition,
  VariableDefinition,
  LambdaExpression,
  FunctionDefinition,
  CondClause,
  CondExpression,
  IfExpression,
  Loop,
  BinaryOperation,
  UnaryOperation,
  Assignment,
  ConditionalBranch,
  Conditional,
  Literal,
  Blank,
};

/**
 * What a language says about the core nodes it writes its own way, by the name
 * of the maker (`FunctionApp`, `IfExpression`...): for each, any of `pretty`,
 * `render`, `label`, `pluralLabel`, `longDescription` and `ariaLabel`.
 */
export type SyntaxTable = {
  [K in keyof typeof customizable]?: (typeof customizable)[K] extends NodeMaker<
    infer F
  >
    ? Overrides<F>
    : never;
};

/**
 * The core makers of `Nodes`, with the table's entries over the core ones, per
 * property (a missing entry, or a missing property, is the core's). The `type`,
 * the fields and the spec of a node do not change, so `isNodeOfType`, the search
 * by type and the CSS class are as for the plain `Nodes.FunctionApp`, which is
 * not changed either.
 *
 *   const { FunctionApp } = Nodes.forLanguage({
 *     FunctionApp: {
 *       pretty: (node) => P.horz(node.fields.func, "(", P.sepBy(node.fields.args, ", ", ", "), ")"),
 *     },
 *   });
 */
type WithOverrides = { with(overrides: object): unknown };

export function forLanguage(table: SyntaxTable): typeof customizable {
  return Object.fromEntries(
    Object.entries(customizable).map(([name, maker]) => {
      const overrides = table[name as keyof SyntaxTable];
      return [
        name,
        overrides ? (maker as unknown as WithOverrides).with(overrides) : maker,
      ];
    })
  ) as typeof customizable;
}
