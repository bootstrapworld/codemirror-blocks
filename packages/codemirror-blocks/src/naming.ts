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
