import type { ASTNode } from "./ast";

/** Type names are camelCase and some abbreviate: "functionApp", "letLikeExpr" */
const EXPANDED: Record<string, string> = {
  app: "application",
  expr: "expression",
  def: "definition",
  struct: "structure",
};

/** "functionApp" -> "function application" */
const nameOfType = (type: string) =>
  type
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(" ")
    .map((word) => EXPANDED[word] ?? word)
    .join(" ");

const plural = (name: string) =>
  /[^aeiou]y$/.test(name)
    ? name.slice(0, -1) + "ies"
    : /(s|x|ch|sh)$/.test(name)
      ? name + "es"
      : name + "s";

const countOf = (n: number, name: string) =>
  `${n} ${n === 1 ? name : plural(name)}`;

const joinList = (items: string[]) =>
  items.length <= 2
    ? items.join(" and ")
    : `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;

/**
 * Say what is at the top level of a program, e.g. "At the top level, this
 * program contains 10 function definitions, 2 variable definitions, and 3
 * function applications." The kinds are the types of the nodes that are there,
 * in the order they first appear; nothing is assumed about the language.
 * Returns null for a program with nothing in it.
 */
export function summarizeProgram(rootNodes: readonly ASTNode[]) {
  if (!rootNodes.length) {
    return null;
  }
  const counts = new Map<string, number>();
  for (const node of rootNodes) {
    counts.set(node.type, (counts.get(node.type) ?? 0) + 1);
  }
  const parts = [...counts].map(([type, n]) => countOf(n, nameOfType(type)));
  return `At the top level, this program contains ${joinList(parts)}.`;
}
