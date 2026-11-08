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
import type { NodeOf } from "./defineNode";
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
  literal: Literal.spec,
  comment: Spec.nodeSpec([Spec.value<string, "comment">("comment")], {
    label: "comment",
  }),
  blank: Blank.spec,
  sequence: Sequence.spec,
};

export const CoreAST = createASTSpec(specs);
