import React from "react";
import * as P from "pretty-fast-pretty-printer";
import {
  Args,
  defineNode,
  DropTarget,
  field,
  Node,
  Nodes,
  pluralize,
  withoutOrphans,
} from "@bootstrapworld/codemirror-blocks";
import type { ASTNode } from "@bootstrapworld/codemirror-blocks";

/* Override the default pretty printer for Sequences,
 * so that they print as s-expressions
 */

const { CoreAST, createASTSpec } = Nodes;
export const Sequence = Nodes.defineSequence((node) =>
  P.standardSexpr(node.fields.name || "", node.fields.exprs)
);

// (a node is told apart by its type here: the AST of the language is made of
// these kinds, and cannot be named in them)
const isSequence = (node: ASTNode) => node.type === "sequence";

export const LetLikeExpr = defineNode({
  type: "letLikeExpr",
  label: "let expression",
  fields: {
    form: field.value<string>(),
    bindings: field.required(),
    expr: field.required(),
  },
  pretty(node) {
    const { bindings } = node.fields;
    if (!isSequence(bindings)) {
      throw new Error(
        `Expected letLikeExpr to be constructed with sequence for its binding field`
      );
    }
    return P.lambdaLikeSexpr(
      node.fields.form,
      P.horz(
        "(",
        P.sepBy(
          (bindings.fields.exprs as unknown as ASTNode[]).map((expr) => {
            if (expr.type !== "variableDefinition") {
              throw new Error(
                `Expected letLikeExpr to have sequence of variableDefinition nodes`
              );
            }
            return Nodes.withComment(
              P.standardSexpr(expr.fields.name as ASTNode, [
                expr.fields.body as ASTNode,
              ]),
              expr.options.comment,
              expr as unknown as Parameters<typeof Nodes.withComment>[2]
            );
          }),
          " "
        ),
        ")"
      ),
      node.fields.expr
    );
  },
  render(props) {
    return (
      <Node {...props} variant="compound">
        <span className="blocks-operator">{props.node.fields.form}</span>
        {props.node.fields.bindings.reactElement()}
        {props.node.fields.expr.reactElement()}
      </Node>
    );
  },
  longDescription(node, _level) {
    const { bindings } = node.fields;
    if (!isSequence(bindings)) {
      throw new Error(
        `Expected letLikeExpr to be constructed with sequence for its binding field`
      );
    }
    return `a ${node.fields.form} expression with ${pluralize(
      "binding",
      bindings.fields.exprs as unknown as ASTNode[]
    )}`;
  },
});

export const WhenUnless = defineNode({
  type: "whenUnlessExpr",
  label: "when or unless expression",
  fields: {
    form: field.value<string>(),
    predicate: field.required(),
    exprs: field.required(),
  },
  pretty(node) {
    // The body is a sequence whose `begin` is only there so that the block
    // shows the body as one group (see parseNode). It is not in the source:
    // printing it would wrap the body in another `begin` each time the
    // program went from blocks to text and back.
    const body = node.fields.exprs;
    const doc = P.standardSexpr(node.fields.form, [
      node.fields.predicate,
      ...(isSequence(body)
        ? (body.fields.exprs as unknown as ASTNode[])
        : [body]),
    ]);
    // (the comment of the body is the node's own, if it has none: the editor
    // prints the node's own comment)
    return node.options.comment
      ? doc
      : Nodes.withComment(doc, body.options.comment, node);
  },
  render(props) {
    return (
      <Node {...props} variant="compound">
        <span className="blocks-operator">{props.node.fields.form}</span>
        {props.node.fields.predicate.reactElement()}
        {props.node.fields.exprs.reactElement()}
      </Node>
    );
  },
  longDescription(node, level) {
    return `a ${node.fields.form} expression: ${
      node.fields.form
    } ${node.fields.predicate.describe(level)}, ${node.fields.exprs.describe(
      level
    )}`;
  },
});

/**
 * `cond` is the core Conditional (clauses are its branches, and the `else`
 * clause its otherwise), written the WeScheme way: square brackets, and a table
 * of a test and its result for each clause.
 */
export const { Conditional, ConditionalBranch } = Nodes.forLanguage({
  ConditionalBranch: {
    label: "conditional clause",
    pretty: (node) =>
      P.horz("[", P.sepBy([node.fields.test, ...node.fields.body], " "), "]"),
    render(props) {
      return (
        <Node {...props}>
          <div className="blocks-cond-row">
            <div className="blocks-cond-predicate">
              {props.node.fields.test.reactElement()}
            </div>
            <Args className="blocks-cond-result" field="body">
              {props.node.fields.body}
            </Args>
          </div>
        </Node>
      );
    },
    longDescription: (node, level) =>
      `condition: if ${node.fields.test.describe(
        level
      )}, then, ${withoutOrphans(node.fields.body).map((te) => te.describe(level))}`,
  },
  Conditional: {
    label: "conditional expression",
    pretty: (node) =>
      P.beginLikeSexpr("cond", [
        ...node.fields.branches,
        ...(node.fields.otherwise.length
          ? [P.horz("[else ", P.sepBy(node.fields.otherwise, " "), "]")]
          : []),
      ]),
    render(props) {
      const { branches, otherwise } = props.node.fields;
      return (
        <Node {...props} variant="compound">
          <span className="blocks-operator">cond</span>
          <div className="blocks-cond-table">
            {branches.map((branch, index) =>
              branch.reactElement({ key: index })
            )}
            <div
              className={`blocks-cond-row blocks-cond-else-row${
                otherwise.length === 0 ? " blocks-not-live" : ""
              }`}
            >
              <div className="blocks-cond-predicate blocks-cond-else">else</div>
              {otherwise.length ? (
                <Args className="blocks-cond-result" field="otherwise">
                  {otherwise}
                </Args>
              ) : (
                <DropTarget field="otherwise" index={0} label="add an else" />
              )}
            </div>
          </div>
        </Node>
      );
    },
    longDescription: (node, level) =>
      `a conditional expression with ${pluralize(
        "condition",
        node.fields.branches
      )}: 
                ${node.fields.branches.map((c) => c.describe(level))}${
                  withoutOrphans(node.fields.otherwise).length
                    ? `, else ${withoutOrphans(node.fields.otherwise).map((e) => e.describe(level))}`
                    : ""
                }`,
  },
});

export const WeSchemeAST = createASTSpec({
  ...CoreAST.config,
  letLikeExpr: LetLikeExpr.spec,
  whenUnlessExpr: WhenUnless.spec,
});
