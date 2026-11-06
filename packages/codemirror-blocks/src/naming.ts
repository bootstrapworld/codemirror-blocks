/**
 * What a kind of node is called, for people (and screenreaders):
 * `label` is the singular ("function definition"), `pluralLabel` the plural
 * when adding an "s" would be wrong.
 */
export type NodeNaming = { label: string; pluralLabel?: string };

/** "function definition" -> "function definitions" */
export const pluralOf = (name: string) =>
  /[^aeiou]y$/.test(name)
    ? name.slice(0, -1) + "ies"
    : /(s|x|ch|sh)$/.test(name)
      ? name + "es"
      : name + "s";

/**
 * A stand-in for a type that did not declare a label: "functionApp" ->
 * "functionapp" would be unreadable, so split the camelCase into words.
 */
export const labelFromType = (type: string) =>
  type.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();

/**
 * Items joined as a person says them: "a", "a and b", "a, b, and c" (with the
 * comma before the last "and", which a screenreader pauses at). (English only:
 * `Intl.ListFormat` would do this for more, but is not in the browsers and the
 * TypeScript library this supports.)
 */
export const joinWithAnd = (items: readonly string[]) =>
  items.length <= 2
    ? items.join(" and ")
    : `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;

/**
 * A count and a noun: "0 arguments", "1 argument", "3 arguments". Give the
 * count, or the things that are counted. A noun that adds more than an s (a
 * category, a box) is the plural that {@link pluralOf} makes.
 */
export function pluralize(noun: string, counted: number | readonly unknown[]) {
  const n = typeof counted === "number" ? counted : counted.length;
  return `${n} ${n === 1 ? noun : pluralOf(noun)}`;
}
