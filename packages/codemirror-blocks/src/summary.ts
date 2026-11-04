import type { ASTNode } from "./ast";

const countOf = (n: number, node: ASTNode) =>
  `${n} ${n === 1 ? node.label : node.pluralLabel}`;

const joinList = (items: string[]) =>
  items.length <= 2
    ? items.join(" and ")
    : `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;

/**
 * Say what is at the top level of a program, e.g. "At the top level, this
 * program contains 10 function definitions, 2 variable definitions, and 3
 * function applications." The kinds are the types of the nodes that are there,
 * in the order they first appear, named by what each type declares itself to
 * be called (see {@link ASTNode.label}); nothing is assumed about the language.
 * Returns null for a program with nothing in it.
 */
export function summarizeProgram(rootNodes: readonly ASTNode[]) {
  if (!rootNodes.length) {
    return null;
  }
  const kinds = new Map<string, { node: ASTNode; n: number }>();
  for (const node of rootNodes) {
    const kind = kinds.get(node.type);
    if (kind) {
      kind.n++;
    } else {
      kinds.set(node.type, { node, n: 1 });
    }
  }
  const parts = [...kinds.values()].map(({ node, n }) => countOf(n, node));
  return `At the top level, this program contains ${joinList(parts)}.`;
}
