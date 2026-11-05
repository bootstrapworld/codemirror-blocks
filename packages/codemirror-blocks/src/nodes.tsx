import * as P from "pretty-fast-pretty-printer";
import React from "react";
import {
  ASTNode,
  ASTNodeProps,
  enumerateList,
  NodeForSpec,
  NodeOptions,
  pluralize,
  Pos,
  withoutOrphans,
} from "./ast";
import Node from "./components/Node";
import Args from "./components/Args";
import { DropTarget } from "./components/DropTarget";
import * as Spec from "./nodeSpec";

/**
 * The pretty printer refuses text with a newline in it. A string literal can
 * hold one (`"a` newline `b"`), and `\n` in its place reads as the same string.
 */
const singleLine = (text: string) => text.replace(/\r?\n/g, "\\n");

// Displays a comment according to specific rules.
//
// - `doc` is what's being commented.
// - `comment` is the comment itself. If it is falsy, there is no comment.
// - `container` is the ast node that owns the comment. This argument is used to
//   determine if the comment is a line comment (appears after `container` on
//   the same line). Line comments will stay as line comments _as long as they
//   fit on the line_. If they don't, they'll be converted into a comment on the
//   previous line.
export function withComment(
  doc: P.Doc,
  comment: ASTNode | undefined,
  container: NodeForSpec
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

const specs = {
  unknown: Spec.nodeSpec([Spec.list("elts")], {
    label: "unknown expression",
  }),
  functionApp: Spec.nodeSpec(
    [Spec.required("func"), Spec.list("args", { orphans: true })],
    {
      label: "function application",
    }
  ),
  identifierList: Spec.nodeSpec([Spec.value("kind"), Spec.list("ids")], {
    label: "identifier list",
  }),
  structDefinition: Spec.nodeSpec(
    [Spec.required("name"), Spec.required("fields")],
    { label: "structure definition" }
  ),
  variableDefinition: Spec.nodeSpec(
    [Spec.required("name"), Spec.required("body")],
    { label: "variable definition" }
  ),
  lambdaExpression: Spec.nodeSpec(
    [Spec.required("args"), Spec.required("body")],
    { label: "lambda expression" }
  ),
  functionDefinition: Spec.nodeSpec(
    [Spec.required("name"), Spec.required("params"), Spec.required("body")],
    { label: "function definition" }
  ),
  condClause: Spec.nodeSpec(
    [Spec.required("testExpr"), Spec.list("thenExprs", { orphans: true })],
    { label: "conditional clause" }
  ),
  condExpression: Spec.nodeSpec([Spec.list("clauses")], {
    label: "conditional expression",
  }),
  ifExpression: Spec.nodeSpec(
    [
      Spec.required("testExpr"),
      Spec.required("thenExpr"),
      Spec.required("elseExpr"),
    ],
    { label: "if expression" }
  ),
  literal: Spec.nodeSpec(
    [Spec.value<string, "value">("value"), Spec.value("dataType")],
    { label: "literal" }
  ),
  comment: Spec.nodeSpec([Spec.value<string, "comment">("comment")], {
    label: "comment",
  }),
  blank: Spec.nodeSpec(
    [Spec.value<string, "value">("value"), Spec.value("dataType")],
    { label: "blank" }
  ),
  sequence: Spec.nodeSpec(
    [Spec.optional("name"), Spec.list("exprs", { orphans: true })],
    { label: "sequence" }
  ),
};

export const CoreAST = createASTSpec(specs);

export function Unknown(
  from: Pos,
  to: Pos,
  elts: ASTNode[],
  options: NodeOptions = {}
) {
  return CoreAST.makeNode({
    from,
    to,
    type: "unknown",
    fields: { elts },
    options,
    pretty: (node) =>
      withComment(
        node.fields.elts.length
          ? P.standardSexpr(node.fields.elts[0], node.fields.elts.slice(1))
          : P.txt("()"),
        node.options.comment,
        node
      ),
    render(props) {
      const firstElt = props.node.fields.elts[0].reactElement();
      const restElts = props.node.fields.elts.slice(1);
      return (
        <Node {...props}>
          <span className="blocks-operator">{firstElt}</span>
          <span className="blocks-args">
            <Args field="elts">{restElts}</Args>
          </span>
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
}

export type FunctionAppNode = ReturnType<typeof FunctionApp>;
export function FunctionApp(
  from: Pos,
  to: Pos,
  func: ASTNode,
  args: ASTNode[],
  options: NodeOptions = {}
) {
  return CoreAST.makeNode({
    from,
    to,
    type: "functionApp",
    fields: { func, args },
    options,
    pretty: (node) =>
      withComment(
        P.standardSexpr(node.fields.func, node.fields.args),
        node.options.comment,
        node
      ),
    render(props) {
      return (
        <Node {...props}>
          <span className="blocks-operator">
            {props.node.fields.func.reactElement()}
          </span>
          <span className="blocks-args">
            <Args field="args">{props.node.fields.args}</Args>
          </span>
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
}

export function IdentifierList(
  from: Pos,
  to: Pos,
  kind: string,
  ids: ASTNode[],
  options: NodeOptions = {}
) {
  return CoreAST.makeNode({
    from,
    to,
    type: "identifierList",
    fields: { kind, ids },
    options,
    pretty: (node) =>
      withComment(P.sepBy(node.fields.ids, " "), node.options.comment, node),
    render(props) {
      return (
        <Node {...props}>
          <span className="blocks-args">
            <Args field="ids">{props.node.fields.ids}</Args>
          </span>
        </Node>
      );
    },
    longDescription(node, level) {
      return enumerateList(node.fields.ids, level);
    },
  });
}

export function StructDefinition(
  from: Pos,
  to: Pos,
  name: ASTNode,
  fields: ASTNode,
  options: NodeOptions = {}
) {
  return CoreAST.makeNode({
    from,
    to,
    type: "structDefinition",
    fields: { name, fields },
    options,
    pretty: (node) =>
      withComment(
        P.lambdaLikeSexpr(
          "define-struct",
          node.fields.name,
          P.horz("(", node.fields.fields, ")")
        ),
        node.options.comment,
        node
      ),
    render(props) {
      const name = props.node.fields.name.reactElement();
      const fields = props.node.fields.fields.reactElement();
      return (
        <Node {...props}>
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
}

export function VariableDefinition(
  from: Pos,
  to: Pos,
  name: ASTNode,
  body: ASTNode,
  options = {}
) {
  return CoreAST.makeNode({
    from,
    to,
    type: "variableDefinition",
    fields: { name, body },
    options,
    pretty: (node) =>
      withComment(
        P.lambdaLikeSexpr("define", node.fields.name, node.fields.body),
        node.options.comment,
        node
      ),
    render(props) {
      const body = props.node.fields.body.reactElement();
      const name = props.node.fields.name.reactElement();
      return (
        <Node {...props}>
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
}

export function LambdaExpression(
  from: Pos,
  to: Pos,
  args: ReturnType<typeof IdentifierList>,
  body: ASTNode,
  options = {}
) {
  return CoreAST.makeNode({
    from,
    to,
    type: "lambdaExpression",
    fields: { body, args },
    options,
    pretty: (node) =>
      withComment(
        P.lambdaLikeSexpr(
          "lambda",
          P.horz("(", node.fields.args, ")"),
          node.fields.body
        ),
        node.options.comment,
        node
      ),
    render(props) {
      const args = props.node.fields.args.reactElement();
      const body = props.node.fields.body.reactElement();
      return (
        <Node {...props}>
          <span className="blocks-operator">&lambda; ({args})</span>
          <span className="blocks-args">{body}</span>
        </Node>
      );
    },
    longDescription(node, level) {
      if (CoreAST.isNodeOfType(node.fields.args, "identifierList")) {
        return `an anonymous function of ${pluralize(
          "argument",
          node.fields.args.fields.ids
        )}: 
            ${node.fields.args.describe(level)}, with body:
            ${node.fields.body.describe(level)}`;
      }
    },
  });
}

export function FunctionDefinition(
  from: Pos,
  to: Pos,
  name: ASTNode,
  params: ASTNode,
  body: ASTNode,
  options = {}
) {
  return CoreAST.makeNode({
    from,
    to,
    type: "functionDefinition",
    fields: { name, params, body },
    options,
    pretty: (node) =>
      withComment(
        P.lambdaLikeSexpr(
          "define",
          P.standardSexpr(node.fields.name, [node.fields.params]),
          node.fields.body
        ),
        node.options.comment,
        node
      ),
    render(props) {
      const params = props.node.fields.params.reactElement();
      const body = props.node.fields.body.reactElement();
      const name = props.node.fields.name.reactElement();
      return (
        <Node {...props}>
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
}

export function CondClause(
  from: Pos,
  to: Pos,
  testExpr: ASTNode,
  thenExprs: ASTNode[],
  options = {}
) {
  return CoreAST.makeNode({
    from,
    to,
    type: "condClause",
    fields: { testExpr, thenExprs },
    options,
    pretty: (node) =>
      withComment(
        P.horz(
          "[",
          P.sepBy([node.fields.testExpr].concat(node.fields.thenExprs), " "),
          "]"
        ),
        node.options.comment,
        node
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
                  <DropTarget field="thenExprs" />
                  {thenExpr.reactElement()}
                </span>
              ))}
              <DropTarget field="thenExprs" />
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
}

export function CondExpression(
  from: Pos,
  to: Pos,
  clauses: ASTNode[],
  options = {}
) {
  return CoreAST.makeNode({
    from,
    to,
    type: "condExpression",
    fields: { clauses },
    options,
    pretty: (node) =>
      withComment(
        P.beginLikeSexpr("cond", node.fields.clauses),
        node.options.comment,
        node
      ),
    render(props) {
      const clauses = props.node.fields.clauses.map((clause, index) =>
        clause.reactElement({ key: index })
      );
      return (
        <Node {...props}>
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
}

export function IfExpression(
  from: Pos,
  to: Pos,
  testExpr: ASTNode,
  thenExpr: ASTNode,
  elseExpr: ASTNode,
  options = {}
) {
  return CoreAST.makeNode({
    from,
    to,
    type: "ifExpression",
    fields: { testExpr, thenExpr, elseExpr },
    options,
    pretty: (node) =>
      withComment(
        P.standardSexpr("if", [
          node.fields.testExpr,
          node.fields.thenExpr,
          node.fields.elseExpr,
        ]),
        node.options.comment,
        node
      ),
    render(props) {
      const testExpr = props.node.fields.testExpr.reactElement();
      const thenExpr = props.node.fields.thenExpr.reactElement();
      const elseExpr = props.node.fields.elseExpr.reactElement();
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
}

export type LiteralNode = ReturnType<typeof Literal>;
export function Literal(
  from: Pos,
  to: Pos,
  value: string,
  dataType = "unknown",
  options = {}
) {
  return CoreAST.makeNode({
    from,
    to,
    type: "literal",
    fields: { value, dataType },
    options,
    pretty: (node) =>
      withComment(
        P.txt(singleLine(node.fields.value)),
        node.options.comment,
        node
      ),
    render(props) {
      return (
        <Node {...props} normallyEditable={true} expandable={false}>
          <span className={`blocks-literal-${props.node.fields.dataType}`}>
            {props.node.fields.value}
          </span>
        </Node>
      );
    },
  });
}

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
      // (a popup, shown while the node it is on is active; the node's own
      // label reads the comment, so it is not read a second time)
      const { node: _node, ...rest } = props;
      return (
        <span
          className="blocks-comment"
          aria-hidden="true"
          title={node.fields.comment.toString()}
          {...rest}
        >
          {node.fields.comment.toString()}
        </span>
      );
    },
  });
}

export function Blank(
  from: Pos,
  to: Pos,
  value: string,
  dataType = "blank",
  options = {}
) {
  return CoreAST.makeNode({
    from,
    to,
    type: "blank",
    fields: { value: value || "...", dataType },
    options,
    pretty: (node) =>
      withComment(
        P.txt(singleLine(node.fields.value)),
        node.options.comment,
        node
      ),
    render(props) {
      return (
        <Node {...props} normallyEditable={true} expandable={false}>
          <span className="blocks-literal-symbol" />
        </Node>
      );
    },
  });
}

export type SequenceNode = ReturnType<typeof Sequence>;
export type NodeForSequenceSpec = NodeForSpec<(typeof specs)["sequence"]>;
export const SequenceProps = {
  pretty: (node: NodeForSequenceSpec) =>
    withComment(
      P.vert(node.fields.name || "", ...node.fields.exprs),
      node.options.comment,
      node
    ),
  render(props: { node: NodeForSequenceSpec }) {
    return (
      <Node {...props}>
        <span className="blocks-operator">
          {props.node.fields.name?.reactElement()}
        </span>
        <span className="blocks-sequence-exprs">
          <Args field="exprs">{props.node.fields.exprs}</Args>
        </span>
      </Node>
    );
  },
  longDescription(node: NodeForSequenceSpec, level: number) {
    return `a sequence containing ${enumerateList(node.fields.exprs, level)}`;
  },
};
export function Sequence(
  from: Pos,
  to: Pos,
  exprs: ASTNode[],
  name: ASTNode,
  options = {}
) {
  return CoreAST.makeNode({
    from,
    to,
    type: "sequence",
    fields: { name, exprs },
    options,
    ...SequenceProps,
  });
}
