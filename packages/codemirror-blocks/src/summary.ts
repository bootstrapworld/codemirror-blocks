import type { ASTNode } from "./ast";

/** The kinds of top-level form that get their own count, in the order said */
const KINDS: { types: string[]; one: string; many: string }[] = [
  {
    types: ["functionDefinition"],
    one: "function definition",
    many: "function definitions",
  },
  {
    types: ["variableDefinition"],
    one: "variable definition",
    many: "variable definitions",
  },
  {
    types: ["structDefinition"],
    one: "structure definition",
    many: "structure definitions",
  },
];

const KIND_OF_TYPE = new Map(
  KINDS.flatMap((kind, i) => kind.types.map((t) => [t, i] as const))
);

const EXPRESSION = { one: "expression", many: "expressions" };

const countOf = (n: number, { one, many }: { one: string; many: string }) =>
  `${n} ${n === 1 ? one : many}`;

const joinList = (items: string[]) =>
  items.length <= 2
    ? items.join(" and ")
    : `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;

/**
 * Say what is at the top level of a program, e.g. "At the top level, this
 * program contains 10 function definitions, 2 variable definitions, and 3
 * expressions." Anything that is not a definition counts as an expression.
 * (Comments belong to the form they are next to, so they are not counted.) Returns null for a program with nothing in it.
 */
export function summarizeProgram(rootNodes: readonly ASTNode[]) {
  if (!rootNodes.length) {
    return null;
  }
  const counts = KINDS.map(() => 0);
  let expressions = 0;
  for (const node of rootNodes) {
    const kind = KIND_OF_TYPE.get(node.type);
    if (kind === undefined) {
      expressions++;
    } else {
      counts[kind]++;
    }
  }
  const parts = KINDS.flatMap((kind, i) =>
    counts[i] ? [countOf(counts[i], kind)] : []
  );
  if (expressions) {
    parts.push(countOf(expressions, EXPRESSION));
  }
  return `At the top level, this program contains ${joinList(parts)}.`;
}
