import React from "react";
import * as P from "pretty-fast-pretty-printer";
import {
  Args,
  DropTarget,
  Node,
  Nodes,
  NodeSpec as Spec,
  poscmp,
  withoutOrphans,
} from "@bootstrapworld/codemirror-blocks";
import type { ASTNode, Pos } from "@bootstrapworld/codemirror-blocks";

/** How the language writes a comment, when it writes one back out */

const { CoreAST, createASTSpec } = Nodes;
export const LAMBDA_BLOCK_COMMENT = { open: "#|", close: "|#" };

export const LambdaAST = createASTSpec({
  ...CoreAST.config,
  prog: Spec.nodeSpec([Spec.list("exprs", { orphans: true })], {
    label: "program",
  }),
  lambda: Spec.nodeSpec(
    [Spec.optional("name"), Spec.list("vars"), Spec.required("body")],
    { label: "lambda expression" }
  ),
  vardef: Spec.nodeSpec([Spec.required("name"), Spec.optional("body")], {
    label: "variable definition",
  }),
  letExpr: Spec.nodeSpec(
    [Spec.optional("name"), Spec.list("vars"), Spec.required("body")],
    { label: "let expression" }
  ),
});

/**
 * Operands of operators, the function of a call, and the body of `!` are
 * parsed greedily, so anything that isn't an atom gets parenthesized when it
 * is printed back out.
 */
function atomic(node: ASTNode): P.DocLike {
  // (a comment above a node makes it more than an atom: it is in parentheses)
  const above =
    node.options.comment && poscmp(node.options.comment.from, node.from) < 0;
  return (node.type === "literal" || node.type === "functionApp") && !above
    ? node
    : P.horz("(", node, ")");
}

function commaSeparated(nodes: ASTNode[]) {
  if (!nodes.some((n) => n.options.orphan)) {
    return P.horz("(", P.sepBy(nodes, ", ", ", "), ")");
  }
  // Orphan comments are not arguments, so they get no comma; each one is on
  // a line of its own (it has to be, to read back as one)
  let remaining = withoutOrphans(nodes).length;
  const items = nodes.map((n) =>
    n.options.orphan || --remaining === 0 ? n : P.horz(n, ",")
  );
  // (one that is first goes on the line after the bracket: on the line of `f(`
  // it would read back as a comment after `f`, and go with it)
  return nodes[0].options.orphan
    ? P.vert("(", P.horz("  ", P.vertArray(items)), ")")
    : P.horz("(", P.vertArray(items), ")");
}

/** Statements in braces: `{ a; b }`, a comment on a line of its own */
function braced(exprs: ASTNode[]): P.Doc {
  // (a `;` goes after every statement but the last; a comment has none)
  let remaining = withoutOrphans(exprs).length;
  const statements = exprs.map((expr) =>
    expr.options.orphan || --remaining === 0 ? expr : P.horz(expr, ";")
  );
  return exprs.some((e) => e.options.orphan)
    ? P.vert("{", P.horz("  ", P.vertArray(statements)), "}")
    : P.horz("{ ", P.vertArray(statements), " }");
}

/** The steps of a branch: bare if there is one, in braces if not */
function steps(body: ASTNode[]): P.DocLike {
  return body.length === 1 && !body[0].options.orphan ? body[0] : braced(body);
}

export function Prog(from: Pos, to: Pos, exprs: ASTNode[], options = {}) {
  return LambdaAST.makeNode({
    from,
    to,
    type: "prog",
    fields: { exprs },
    options,
    pretty(node) {
      // (a `;` goes after every statement but the last; a comment has none)
      let remaining = withoutOrphans(node.fields.exprs).length;
      const statements = node.fields.exprs.map((expr) =>
        expr.options.orphan || --remaining === 0 ? expr : P.horz(expr, ";")
      );
      // the top-level program is bare, nested ones are `{ ...; ... }` blocks
      // (a comment is on a line of its own, never after the `{`)
      if (node.level <= 1) {
        // (a comment right after the last statement would go with it, so
        // those at the end are set apart by a blank line)
        const exprs = node.fields.exprs;
        let end = exprs.length;
        while (end > 0 && exprs[end - 1].options.orphan) end--;
        const lines: P.DocLike[] = [...statements];
        if (end > 0 && end < exprs.length) lines.splice(end, 0, "");
        return P.vertArray(lines);
      }
      return braced(node.fields.exprs);
    },
    render(props) {
      return (
        <Node {...props} variant="compound">
          <h4>Your Lambda Program</h4>
          <Args className="blocks-statements" field="exprs">
            {props.node.fields.exprs}
          </Args>
        </Node>
      );
    },
    longDescription(node) {
      return `a program with ${withoutOrphans(node.fields.exprs).length} expressions`;
    },
  });
}

/**
 * A call is the core function application, written `f(a, b)`: the table says
 * how it is printed, drawn and described, and the node is the core's otherwise.
 */
const { FunctionApp } = Nodes.forLanguage({
  FunctionApp: {
    label: "function call",
    pretty: (node) =>
      P.horz(atomic(node.fields.func), commaSeparated(node.fields.args)),
    render(props) {
      return (
        <Node {...props} variant="compound">
          <span className="blocks-operator">
            {props.node.fields.func.reactElement()}
          </span>
          <Args field="args">{props.node.fields.args}</Args>
        </Node>
      );
    },
    longDescription: (node, level) =>
      `a call to ${node.fields.func.describe(level)} with ${
        withoutOrphans(node.fields.args).length
      } arguments`,
  },
});

export function Call(
  from: Pos,
  to: Pos,
  func: ASTNode,
  args: ASTNode[],
  options = {}
) {
  return FunctionApp(from, to, { func, args }, options);
}

export function Lambda(
  from: Pos,
  to: Pos,
  name: ASTNode | null,
  vars: ASTNode[],
  body: ASTNode,
  options = {}
) {
  return LambdaAST.makeNode({
    from,
    to,
    type: "lambda",
    fields: { name, vars, body },
    options,
    pretty: (node) =>
      P.horz(
        "lambda ",
        node.fields.name ?? "",
        commaSeparated(node.fields.vars),
        " ",
        node.fields.body
      ),
    render(props) {
      return (
        <Node {...props} variant="compound">
          <span className="blocks-operator">lambda</span>
          {props.node.fields.name?.reactElement()}
          <Args field="vars">{props.node.fields.vars}</Args>
          {props.node.fields.body.reactElement()}
        </Node>
      );
    },
    longDescription: (node) =>
      `a lambda expression with ${node.fields.vars.length} parameters`,
  });
}

export function VarDef(
  from: Pos,
  to: Pos,
  name: ASTNode,
  body: ASTNode | null,
  options = {}
) {
  return LambdaAST.makeNode({
    from,
    to,
    type: "vardef",
    fields: { name, body },
    options,
    pretty: (node) =>
      node.fields.body
        ? P.horz(node.fields.name, " = ", node.fields.body)
        : P.horz(node.fields.name),
    render(props) {
      return (
        <Node {...props} variant="compound">
          {props.node.fields.name.reactElement()}
          {props.node.fields.body ? (
            <>
              <span className="blocks-operator">=</span>
              {props.node.fields.body.reactElement()}
            </>
          ) : null}
        </Node>
      );
    },
    longDescription: (node, level) =>
      `a definition of ${node.fields.name.describe(level)}`,
  });
}

export function Let(
  from: Pos,
  to: Pos,
  name: ASTNode | null,
  vars: ASTNode[],
  body: ASTNode,
  options = {}
) {
  return LambdaAST.makeNode({
    from,
    to,
    type: "letExpr",
    fields: { name, vars, body },
    options,
    pretty: (node) =>
      P.horz(
        "let ",
        node.fields.name ? P.horz(node.fields.name, " ") : "",
        commaSeparated(node.fields.vars),
        " ",
        node.fields.body
      ),
    render(props) {
      return (
        <Node {...props} variant="compound">
          <span className="blocks-operator">let</span>
          {props.node.fields.name?.reactElement()}
          <Args field="vars">{props.node.fields.vars}</Args>
          {props.node.fields.body.reactElement()}
        </Node>
      );
    },
    longDescription: (node) =>
      `a let ${node.fields.name ? "loop" : "expression"} with ${node.fields.vars.length} variables`,
  });
}

/**
 * `if a then x else if b then y else z` is an if whose else is the one step that
 * is another if (written `else if`): the steps of a branch are written bare if
 * there is one, and in braces if there are several, which the parser reads
 * back as that list.
 */
export function Conditional(
  from: Pos,
  to: Pos,
  test: ASTNode,
  body: ASTNode[],
  otherwise: ASTNode[],
  options = {}
) {
  return If(from, to, { test, body, otherwise }, options);
}

/**
 * `!x` and `a + b` are the core operations, written the way lambda writes them:
 * an operator beside its operands, in brackets where its operands need them.
 */
const {
  BinaryOperation,
  UnaryOperation,
  Assignment: AssignmentNode,
  If,
} = Nodes.forLanguage({
  If: {
    label: "conditional expression",
    pretty: (node) =>
      P.horz(
        "if ",
        node.fields.test,
        " then ",
        steps(node.fields.body),
        node.fields.otherwise.length
          ? P.horz(" else ", steps(node.fields.otherwise))
          : ""
      ),
    render(props) {
      const { test, body, otherwise } = props.node.fields;
      return (
        <Node {...props} variant="compound">
          <span className="blocks-operator">if</span>
          {test.reactElement()}
          <span className="blocks-operator">then</span>
          <Args className="blocks-conditional-body" field="body">
            {body}
          </Args>
          <div
            className={`blocks-if-else${
              otherwise.length === 0 ? " blocks-not-live" : ""
            }`}
            {...Nodes.notLiveElseHandlers(otherwise.length === 0)}
          >
            <span className="blocks-operator">else</span>
            {otherwise.length ? (
              <Args className="blocks-conditional-body" field="otherwise">
                {otherwise}
              </Args>
            ) : (
              <DropTarget field="otherwise" index={0} label="add an else" />
            )}
          </div>
        </Node>
      );
    },
    longDescription: (node, level) =>
      `an if expression: if ${node.fields.test.describe(
        level
      )}, then ${withoutOrphans(node.fields.body)
        .map((step) => step.describe(level))
        .join(", ")}`,
  },
  BinaryOperation: {
    pretty: (node) =>
      P.horz(
        atomic(node.fields.left),
        ` ${node.fields.operator} `,
        atomic(node.fields.right)
      ),
    render(props) {
      return (
        <Node {...props} variant="compound">
          {props.node.fields.left.reactElement()}
          <span className="blocks-operator">{props.node.fields.operator}</span>
          {props.node.fields.right.reactElement()}
        </Node>
      );
    },
    longDescription: (node, level) =>
      `${node.fields.left.describe(level)} ${
        node.fields.operator
      } ${node.fields.right.describe(level)}`,
  },
  Assignment: {
    pretty: (node) =>
      P.horz(
        atomic(node.fields.target),
        ` ${node.fields.operator} `,
        atomic(node.fields.value)
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
    longDescription: (node, level) =>
      `${node.fields.target.describe(level)} ${
        node.fields.operator
      } ${node.fields.value.describe(level)}`,
  },
  UnaryOperation: {
    label: "not expression",
    pretty: (node) => P.horz(node.fields.operator, atomic(node.fields.operand)),
    render(props) {
      return (
        <Node {...props} variant="compound">
          <span className="blocks-operator">{props.node.fields.operator}</span>
          {props.node.fields.operand.reactElement()}
        </Node>
      );
    },
    longDescription: (node, level) =>
      `the negation of ${node.fields.operand.describe(level)}`,
  },
});

export function Assignment(
  from: Pos,
  to: Pos,
  operator: string,
  left: ASTNode,
  right: ASTNode,
  options = {}
) {
  return AssignmentNode(
    from,
    to,
    { operator, target: left, value: right },
    options
  );
}

export function Not(from: Pos, to: Pos, body: ASTNode, options = {}) {
  return UnaryOperation(from, to, { operator: "!", operand: body }, options);
}

export function Binary(
  from: Pos,
  to: Pos,
  operator: string,
  left: ASTNode,
  right: ASTNode,
  options = {}
) {
  return BinaryOperation(from, to, { operator, left, right }, options);
}
