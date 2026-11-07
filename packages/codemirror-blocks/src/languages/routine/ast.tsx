import React from "react";
import * as P from "pretty-fast-pretty-printer";
import { useStore } from "react-redux";
import { currentNode, withoutOrphans } from "../../ast";
import type { ASTNode, AST, DrawnNode } from "../../ast";
import Args, { listItems } from "../../components/Args";
import { DropTarget } from "../../components/DropTarget";
import Node, { useNodeState } from "../../components/Node";
import { defineNode, field } from "../../defineNode";
import { describeKinds } from "../../summary";
import * as Spec from "../../nodeSpec";
import type { RootState } from "../../state/reducers";
import * as selectors from "../../state/selectors";

/** How the language writes a comment, when it writes one back out */
export const ROUTINE_BLOCK_COMMENT = { open: "#|", close: "|#" };

/**
 * Routine: a few steps that make a small plan, written as s-expressions.
 *
 * What each kind of node is called is declared once, with the node (`label`).
 * Everything spoken about a node (its aria label, its long description) is made
 * from the labels, so that renaming one renames it everywhere.
 */

// ---------------------------------------------------------------------------
// What the editor says out loud, made from the labels

// ---------------------------------------------------------------------------
// Scope: a name's block can show what is defined before it

/** The names that a `(let name ...)` before `node`, or around it, defines */
export function namesInScope(ast: AST, node: ASTNode): string[] {
  const found: string[] = [];
  let child = node;
  for (;;) {
    const parent = ast.getNodeParent(child);
    const siblings: readonly ASTNode[] = parent
      ? (parent.spec.childSpecs
          .filter((s): s is Spec.List => s instanceof Spec.List)
          .map((s) => s.getField(parent))
          .find((list) => list.some((n) => n.id === child.id)) ?? [])
      : ast.rootNodes;
    for (const sibling of siblings) {
      if (sibling.id === child.id) break;
      if (sibling.type === "define") {
        found.push(String((sibling.fields.name as ASTNode).fields.name));
      }
    }
    if (!parent) return found;
    child = parent;
  }
}

/** Shows, while its block has focus, what a name could be */
const ScopeHint = ({ node }: { node: DrawnNode }) => {
  const { focused } = useNodeState();
  // (the language reaches for the store: a block has no way to ask for the AST)
  const store = useStore<RootState>();
  if (!focused) return null;
  const ast = selectors.getAST(store.getState());
  const names = namesInScope(ast, currentNode(ast, node));
  return (
    <span className="routine-hint" aria-hidden="true">
      {names.length ? `defined: ${names.join(", ")}` : "nothing defined yet"}
    </span>
  );
};

/** What a loop says about itself when it is collapsed */
const LoopStatus = ({ count }: { count: number }) => {
  const { collapsed } = useNodeState();
  return collapsed ? (
    <span className="routine-hint" aria-hidden="true">
      {count === 1 ? "1 step" : `${count} steps`} hidden
    </span>
  ) : null;
};

/**
 * Says that what is dragged over a value would replace it. (`over` is only
 * true for a block that a drop replaces: a value that can be edited in place. A
 * loop is not drawn as one, so it cannot say this of itself.)
 */
const ReplaceHint = () => {
  const { over } = useNodeState();
  return over ? (
    <span className="routine-hint" aria-hidden="true">
      replace
    </span>
  ) : null;
};

// ---------------------------------------------------------------------------
// The nodes: each says what it is once, and gives the function that makes one,
// as `Define(from, to, { name, start }, options)`

/** What a number, a text or a name reads as: its label, and what it says */
const labelled = (node: ASTNode) =>
  `${node.label} ${Object.values(node.fields)[0]}`;

export const Num = defineNode({
  type: "number",
  label: "number",
  fields: { value: field.value<number>() },
  // (the language has a printer of its own for atoms: text will do)
  pretty: (node) => String(node.fields.value),
  ariaLabel: labelled,
  render: (props) => (
    <Node {...props} normallyEditable={true} expandable={false}>
      <span className="routine-number-value">{props.node.fields.value}</span>
      <ReplaceHint />
    </Node>
  ),
});

export const Text = defineNode({
  type: "text",
  label: "text",
  fields: { value: field.value<string>() },
  pretty: (node) => JSON.stringify(node.fields.value),
  ariaLabel: labelled,
  render: (props) => (
    <Node {...props} normallyEditable={true} expandable={false}>
      <span className="routine-text-value">{props.node.fields.value}</span>
      <ReplaceHint />
    </Node>
  ),
});

export const Name = defineNode({
  type: "name",
  label: "name",
  fields: { name: field.value<string>() },
  pretty: (node) => node.fields.name,
  ariaLabel: labelled,
  render: (props) => (
    <Node {...props} normallyEditable={true} expandable={false}>
      <span className="routine-name">{props.node.fields.name}</span>
      <ScopeHint node={props.node} />
      <ReplaceHint />
    </Node>
  ),
});

export const Define = defineNode({
  type: "define",
  label: "definition",
  fields: { name: field.required(), start: field.optional() },
  pretty: (node) =>
    P.standardSexpr("let", [
      node.fields.name,
      ...(node.fields.start ? [node.fields.start] : []),
    ]),
  longDescription: (node, level) =>
    node.fields.start
      ? `a ${node.label} of ${node.fields.name.describe(level)}, starting as ${node.fields.start.describe(level)}`
      : `a ${node.label} of ${node.fields.name.describe(level)}, with no start yet`,
  render: (props) => {
    const { name, start } = props.node.fields;
    return (
      <Node {...props}>
        <span className="blocks-operator">let</span>
        <div className="routine-body">
          {name.reactElement()}
          {start ? (
            <>
              <span className="routine-word">starts as</span>
              {start.reactElement()}
            </>
          ) : (
            // (nothing to start from: the gap is where one can be dropped)
            <DropTarget field="start" />
          )}
        </div>
      </Node>
    );
  },
});

export const Show = defineNode({
  type: "show",
  label: "show step",
  fields: { what: field.required() },
  pretty: (node) => P.standardSexpr("show", [node.fields.what]),
  longDescription: (node, level) =>
    `a ${node.label} of ${node.fields.what.describe(level)}`,
  render: (props) => (
    <Node {...props}>
      <span className="blocks-operator">show</span>
      <div className="routine-body">
        {props.node.fields.what.reactElement()}
      </div>
    </Node>
  ),
});

export const Repeat = defineNode({
  type: "repeat",
  label: "repeat loop",
  fields: { times: field.required(), steps: field.list({ orphans: true }) },
  pretty: (node) =>
    node.fields.steps.length
      ? P.horz(
          P.vert(
            P.horz("(repeat ", node.fields.times),
            P.horz("  ", P.vertArray(node.fields.steps))
          ),
          ")"
        )
      : P.horz("(repeat ", node.fields.times, ")"),
  longDescription: (node, level) =>
    `a ${node.label}, ${node.fields.times.describe(level)} times, of ${describeKinds(node.fields.steps)}`,
  render: (props) => {
    const { times, steps } = props.node.fields;
    return (
      <Node {...props}>
        <header className="blocks-operator routine-loop-head">
          <span>repeat</span>
          {times.reactElement()}
          <span>times</span>
          <LoopStatus count={withoutOrphans(steps).length} />
          {/* a step added at the end is added from the top, where it is
              reached without scrolling past the others; the gap is drawn
              before the rows it follows */}
          <DropTarget field="steps" index={steps.length} />
        </header>
        <ol className="routine-steps">
          {listItems(steps).map(({ node, index, number }) => (
            <li
              key={index}
              className={node.options.orphan ? "routine-note" : "routine-step"}
            >
              <div className="routine-gutter">
                <DropTarget field="steps" index={index} />
                {number !== null && (
                  <span className="routine-step-number">{number}</span>
                )}
              </div>
              {node.reactElement()}
            </li>
          ))}
        </ol>
      </Node>
    );
  },
});

export const Choice = defineNode({
  type: "choice",
  label: "choice",
  fields: {
    test: field.required(),
    then: field.required(),
    otherwise: field.optional(),
  },
  pretty: (node) =>
    P.standardSexpr("if", [
      node.fields.test,
      node.fields.then,
      ...(node.fields.otherwise ? [node.fields.otherwise] : []),
    ]),
  longDescription: (node, level) =>
    `a ${node.label}: if ${node.fields.test.describe(level)}, ${node.fields.then.describe(level)}${
      node.fields.otherwise
        ? `, otherwise ${node.fields.otherwise.describe(level)}`
        : ""
    }`,
  render: (props) => {
    const { test, then, otherwise } = props.node.fields;
    return (
      <Node {...props}>
        <header className="blocks-operator routine-choice-head">
          <span>if</span>
          {test.reactElement()}
          {/* the place for an otherwise is up here, beside the test, though
              what it holds is shown below the then */}
          {otherwise ? null : <DropTarget field="otherwise" />}
        </header>
        <div className="routine-branch">
          <span className="routine-word">then</span>
          {then.reactElement()}
        </div>
        {otherwise ? (
          <div className="routine-branch">
            <span className="routine-word">otherwise</span>
            {otherwise.reactElement()}
          </div>
        ) : null}
      </Node>
    );
  },
});

export const Call = defineNode({
  type: "call",
  label: "calculation",
  fields: { op: field.value<string>(), args: field.list() },
  pretty: (node) => P.standardSexpr(node.fields.op, node.fields.args),
  ariaLabel: (node) => `${node.label} ${node.fields.op}`,
  longDescription: (node, level) =>
    `a ${node.label} with ${node.fields.op} of ${describeKinds(node.fields.args)}${
      node.fields.args.length
        ? `: ${node.fields.args.map((a) => a.describe(level)).join(", ")}`
        : ""
    }`,
  render: (props) => (
    <Node {...props}>
      <span className="blocks-operator">{props.node.fields.op}</span>
      <Args className="blocks-args" field="args">
        {props.node.fields.args}
      </Args>
    </Node>
  ),
});
