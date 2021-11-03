import * as P from "pretty-fast-pretty-printer";
import React from "react";
import {
  ASTNode,
  ASTNodeProps,
  enumerateList,
  NodeFields,
  NodeOptions,
  pluralize,
  Pos,
  UnknownFields,
} from "./ast";
import Node from "./components/Node";
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

export const specs = {
  unknown: Spec.nodeSpec([Spec.list("elts")]),
  functionApp: Spec.nodeSpec([Spec.required("func"), Spec.list("args")]),
  identifierList: Spec.nodeSpec([Spec.value("kind"), Spec.list("ids")]),
  structDefinition: Spec.nodeSpec([
    Spec.required("name"),
    Spec.required("fields"),
  ]),
  variableDefinition: Spec.nodeSpec([
    Spec.required("name"),
    Spec.required("body"),
  ]),
  lambdaExpression: Spec.nodeSpec([
    Spec.required("args"),
    Spec.required("body"),
  ]),
  functionDefinition: Spec.nodeSpec([
    Spec.required("name"),
    Spec.required("params"),
    Spec.required("body"),
  ]),
  condClause: Spec.nodeSpec([
    Spec.required("testExpr"),
    Spec.list("thenExprs"),
  ]),
  condExpression: Spec.nodeSpec([Spec.list("clauses")]),
  ifExpression: Spec.nodeSpec([
    Spec.required("testExpr"),
    Spec.required("thenExpr"),
    Spec.required("elseExpr"),
  ]),
  literal: Spec.nodeSpec([Spec.value("value"), Spec.value("dataType")]),
  comment: Spec.nodeSpec([Spec.value("comment")]),
  blank: Spec.nodeSpec([Spec.value("value"), Spec.value("dataType")]),
  sequence: Spec.nodeSpec([Spec.optional("name"), Spec.list("exprs")]),
};

function makeNode<Fields extends NodeFields = UnknownFields>(
  props: Omit<ASTNodeProps<Fields>, "spec"> & {
    type: keyof typeof specs;
  }
): ASTNode<Fields> {
  return new ASTNode({ ...props, spec: specs[props.type] });
}

export function Unknown(
  from: Pos,
  to: Pos,
  elts: ASTNode[],
  options: NodeOptions = {}
) {
  return makeNode({
    from,
    to,
    type: "unknown",
    fields: { elts },
    options,
    pretty: (node) =>
      withComment(
        P.standardSexpr(node.fields.elts[0], node.fields.elts.slice(1)),
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
        `an unknown expression with ${pluralize(
          "children",
          node.fields.elts
        )} ` +
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
  return makeNode({
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
      // if it's the top level, enumerate the args
      if (node.level - level == 0) {
        return (
          `applying the function ${node.fields.func.describe(
            level
          )} to ${pluralize("argument", node.fields.args)} ` +
          node.fields.args
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
          node.fields.args.map((a) => a.describe(level)).join(", ")
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
  return makeNode({
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
  return makeNode({
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
  return makeNode({
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
  return makeNode({
    from,
    to,
    type: "lambdaExpression",
    fields: { body, args },
    options,
    pretty: (node) =>
      P.lambdaLikeSexpr(
        "lambda(",
        P.horz("(", node.fields.args, ")"),
        node.fields.body
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
      return `an anonymous function of ${pluralize(
        "argument",
        node.fields.args.fields.ids
      )}: 
                ${node.fields.args.describe(level)}, with body:
                ${node.fields.body.describe(level)}`;
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
  return makeNode({
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
  return makeNode({
    from,
    to,
    type: "condClause",
    fields: { testExpr, thenExprs },
    options,
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
      )}, then, ${node.fields.thenExprs.map((te) => te.describe(level))}`;
    },
  });
}

export function CondExpression(
  from: Pos,
  to: Pos,
  clauses: ASTNode[],
  options = {}
) {
  return makeNode({
    from,
    to,
    type: "condExpression",
    fields: { clauses },
    options,
    pretty: (node) => P.beginLikeSexpr("cond", node.fields.clauses),
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
  return makeNode({
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
  return makeNode({
    from,
    to,
    type: "literal",
    fields: { value, dataType },
    options,
    pretty: (node) =>
      withComment(P.txt(node.fields.value), node.options.comment, node),
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

export function Comment(from: Pos, to: Pos, comment: string, options = {}) {
  return makeNode({
    from,
    to,
    type: "comment",
    fields: { comment },
    options: { isNotEditable: true, ...options },
    pretty: (node) => {
      const words = node.fields.comment.trim().split(/\s+/);
      const wrapped = P.wrap(words);
      // Normalize all comments to block comments
      return P.concat("#| ", wrapped, " |#");
    },
    render({ node, ...props }) {
      return (
        <span className="blocks-comment" aria-hidden="true" {...props}>
          <span className="screenreader-only">Has comment,</span>{" "}
          <span>{node.fields.comment.toString()}</span>
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
  return makeNode({
    from,
    to,
    type: "blank",
    fields: { value: value || "...", dataType },
    options,
    pretty: (node) => P.txt(node.fields.value),
    render(props) {
      return (
        <Node {...props} normallyEditable={true} expandable={false}>
          <span className="blocks-literal-symbol" />
        </Node>
      );
    },
  });
}

export type SequenceNode = ASTNode<{ name: ASTNode; exprs: ASTNode[] }>;
export const SequenceProps = {
  spec: specs.sequence,
  pretty: (node: SequenceNode) =>
    P.vert(node.fields.name, ...node.fields.exprs),
  render(props: { node: SequenceNode }) {
    return (
      <Node {...props}>
        <span className="blocks-operator">
          {props.node.fields.name.reactElement()}
        </span>
        <span className="blocks-sequence-exprs">
          <Args field="exprs">{props.node.fields.exprs}</Args>
        </span>
      </Node>
    );
  },
  longDescription(node: SequenceNode, level: number) {
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
  return makeNode({
    from,
    to,
    type: "sequence",
    fields: { name, exprs },
    options,
    ...SequenceProps,
  });
}
