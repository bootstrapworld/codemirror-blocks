import type * as P from "pretty-fast-pretty-printer";
import { ASTNode } from "./ast";
import type {
  ASTNodeProps,
  NodeFields,
  NodeForSpec,
  NodeOptions,
  Pos,
} from "./ast";
import * as Spec from "./nodeSpec";
import { warn } from "./utils";

/*
 * `defineNode` says what a kind of node is once: its fields, what it is called,
 * how it is printed, drawn and described. It gives back the function that makes
 * one:
 *
 *   const Define = defineNode({
 *     type: "define",
 *     label: "definition",
 *     fields: { name: field.required(), start: field.optional() },
 *     pretty: (node) => P.standardSexpr("let", [node.fields.name]),
 *     render: (props) => <Node {...props}>...</Node>,
 *   });
 *
 *   Define(from, to, { name, start: null }, options);
 *
 * (Without it, the fields are said in the spec, in the parameters of a
 * constructor function, in `fields:` of `makeNode`, and in the parser.)
 */

type RequiredField = { kind: "required" };
type OptionalField = { kind: "optional" };
type ListField = { kind: "list"; orphans: boolean };
type ValueField<V> = { kind: "value"; readonly type?: V };
type FieldDeclaration =
  | RequiredField
  | OptionalField
  | ListField
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | ValueField<any>;

/** What each field of a node holds */
export const field = {
  /** one node, always there */
  required: (): RequiredField => ({ kind: "required" }),
  /** one node, or nothing: `null`, or `undefined`, or left out */
  optional: (): OptionalField => ({ kind: "optional" }),
  /**
   * any number of nodes. A list that has `orphans` can also hold comments that
   * go with no node of their own (see `orphans.ts`).
   */
  list: ({ orphans = false }: { orphans?: boolean } = {}): ListField => ({
    kind: "list",
    orphans,
  }),
  /** something that is not a node (a string, a number, ...) */
  value: <V>(): ValueField<V> => ({ kind: "value" }),
};

type SpecFor<K extends string, D> = D extends RequiredField
  ? Spec.Required<K>
  : D extends OptionalField
    ? Spec.Optional<K>
    : D extends ListField
      ? Spec.List<K>
      : D extends ValueField<infer V>
        ? Spec.Value<K, V>
        : never;

/** The spec that fields declared as `F` make (with a type for each field) */
type SpecOf<F extends Record<string, FieldDeclaration>> = Spec.NodeSpec<
  { [K in keyof F & string]: SpecFor<K, F[K]> }[keyof F & string]
>;

/** The fields of a node of kind F (a conditional, to show they are node fields) */
type FieldsOf<F extends Record<string, FieldDeclaration>> =
  Spec.FieldsForSpec<SpecOf<F>> extends infer X
    ? X extends NodeFields<string>
      ? X
      : never
    : never;

type Definition<F extends Record<string, FieldDeclaration>> = {
  /** the name of this kind of node: its blocks have the class `blocks-<type>` */
  type: string;
  /** what it is called, to people and screenreaders: "function definition" */
  label: string;
  /** the plural, if adding an "s" is wrong */
  pluralLabel?: string;
  /** the fields, in the order they are in the spec */
  fields: F;
  /**
   * How it is printed: a doc of the pretty-printer, or text, if the language
   * has a printer of its own. The comment that goes with the node is printed
   * for you, above it or beside it.
   */
  pretty: (node: NodeForSpec<SpecOf<F>>) => P.Doc | string;
  render: ASTNodeProps<SpecOf<F>>["render"];
  longDescription?: ASTNodeProps<SpecOf<F>>["longDescription"];
  /**
   * What the node reads as, from the node (and so from its `label`): any node
   * of this kind that has an `ariaLabel` of its own in its options keeps it.
   */
  ariaLabel?: (node: ASTNode) => string;
};

/**
 * What a language can say again about a kind of node, without changing what the
 * kind is (its `type` and its fields): how it is printed, drawn and described.
 */
export type Overrides<F extends Record<string, FieldDeclaration>> = Partial<
  Pick<
    Definition<F>,
    | "label"
    | "pluralLabel"
    | "pretty"
    | "render"
    | "longDescription"
    | "ariaLabel"
  >
>;

export type NodeMaker<F extends Record<string, FieldDeclaration>> = {
  (
    from: Pos,
    to: Pos,
    fields: Spec.FieldsForSpec<SpecOf<F>>,
    options?: NodeOptions
  ): ASTNode<SpecOf<F>, FieldsOf<F>>;
  /** the name of this kind of node */
  readonly type: string;
  readonly spec: SpecOf<F>;
  /**
   * The same kind of node (the same `type` and fields, so searching by type,
   * `isNodeOfType` and the CSS class do not change), with some of what it is
   * printed, drawn and described as said again. What is not said is as it was.
   * The maker it is called on is not changed.
   */
  with(overrides: Overrides<F>): NodeMaker<F>;
};

/**
 * A block has the class `blocks-<type>`, and the editor's default style has
 * rules for some of those, which are not what a kind of a language of its own
 * wants: a kind with one of these as its `type` is drawn by them (and by luck,
 * if it looks right).
 */
const RESERVED_TYPES = new Set([
  // (the kinds of the core nodes: a language that makes one of its own says
  // something else by them)
  "literal",
  "comment",
  "blank",
  "sequence",
  "unknown",
  // (what the default style calls the parts of a block, and its states)
  "name",
  "operator",
  "args",
  "node",
  "locked",
  "editing",
  "error",
  "dragging",
  "compound",
  "value",
  "hint",
  "white-space",
]);
const warned = new Set<string>();

/** `defineNode`, for the core nodes of the editor, which may have a reserved type */
export function defineCoreNode<F extends Record<string, FieldDeclaration>>(
  definition: Definition<F>
): NodeMaker<F> {
  return defineNode(definition, true);
}

export function defineNode<F extends Record<string, FieldDeclaration>>(
  definition: Definition<F>,
  core = false
): NodeMaker<F> {
  const { type, label, pluralLabel, ariaLabel } = definition;
  if (!core && RESERVED_TYPES.has(type) && !warned.has(type)) {
    warned.add(type);
    warn(
      "defineNode",
      `the kind "${type}" has the class blocks-${type}, which the editor's default style draws in a way of its own: use another type (its label can be "${definition.label}" still)`
    );
  }
  const childSpecs = Object.entries(definition.fields).map(([name, d]) => {
    switch (d.kind) {
      case "required":
        return new Spec.Required(name);
      case "optional":
        return new Spec.Optional(name);
      case "list":
        return new Spec.List(name, d.orphans);
      default:
        return new Spec.Value(name);
    }
  });
  const spec = Spec.nodeSpec(childSpecs, {
    label,
    pluralLabel,
  }) as unknown as SpecOf<F>;

  const make = Object.assign(
    (
      from: Pos,
      to: Pos,
      fields: Spec.FieldsForSpec<SpecOf<F>>,
      options: NodeOptions = {}
    ) =>
      new ASTNode<SpecOf<F>, FieldsOf<F>>({
        from,
        to,
        type,
        fields,
        options: ariaLabel ? { ariaLabel, ...options } : options,
        spec,
        pretty: definition.pretty,
        render: definition.render,
        longDescription: definition.longDescription,
      }),
    {
      type,
      spec,
      // (the same kind, so no warning about its type again)
      with: (overrides: Overrides<F>) =>
        defineNode({ ...definition, ...withoutUndefined(overrides) }, true),
    }
  );
  return make;
}

/** `{ pretty: undefined }` says nothing: the kind keeps what it had */
function withoutUndefined<T extends object>(object: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

/** A node of the kind that fields declared as `F` make (for a `pretty` that is written apart) */
export type NodeOf<F extends Record<string, FieldDeclaration>> = NodeForSpec<
  SpecOf<F>
>;
