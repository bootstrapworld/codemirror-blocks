import type { ASTNode } from "./ast";
import { joinWithAnd } from "./naming";

const countOf = (n: number, node: ASTNode) =>
  `${n} ${n === 1 ? node.label : node.pluralLabel}`;

/**
 * Say what a list of nodes is made of, e.g. "2 function definitions, 1 value
 * definition, and 3 function applications": the kinds are the types of the nodes
 * that are there, in the order they first appear, named by what each type
 * declares itself to be called (see {@link ASTNode.label}); nothing is assumed
 * about the language. It reads as part of a sentence of the language's own
 * ("a repeat loop of 2 definitions and 1 calculation"). "nothing" if there are
 * no nodes.
 *
 * `orphans`: whether a comment that goes with no node is counted ("count": it is
 * a block of its own, and at the top of a program is one of the things in it) or
 * left out ("skip", the default: inside a list it is not one of the elements).
 */
export function describeKinds(
  nodes: readonly ASTNode[],
  { orphans = "skip" }: { orphans?: "count" | "skip" } = {}
) {
  const kinds = new Map<string, { node: ASTNode; n: number }>();
  for (const node of nodes) {
    if (orphans === "skip" && node.options.orphan) continue;
    const kind = kinds.get(node.type);
    if (kind) {
      kind.n++;
    } else {
      kinds.set(node.type, { node, n: 1 });
    }
  }
  if (!kinds.size) return "nothing";
  return joinWithAnd(
    [...kinds.values()].map(({ node, n }) => countOf(n, node))
  );
}

/**
 * Say what is at the top level of a program, e.g. "At the top level, this
 * program contains 10 function definitions, 2 variable definitions, and 3
 * function applications." (see {@link describeKinds}, which counts the comments
 * of the program too). Returns null for a program with nothing in it.
 */
export function summarizeProgram(rootNodes: readonly ASTNode[]) {
  if (!rootNodes.length) {
    return null;
  }
  return `At the top level, this program contains ${describeKinds(rootNodes, { orphans: "count" })}.`;
}
