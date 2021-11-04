import { ASTNode, NodeFields } from "./ast";
import { hashObject } from "./utils";

// A NodeSpec declares the types of the fields of an ASTNode.
// It is used to compute hashes, to validate nodes (to prevent the construction
// of an ill-formed AST), and to deal with some edits.
// Its constructor expects a list of:
//
// - required: an ASTNode.
// - optional: either an ASTNode, or `null`.
// - list: an array of ASTNodes.
// - value: an ordinary value that does not contain an ASTNode.

/**
 * Converts a union type to an intersection type. For example:
 * ```
 * type Foo = UnionToIntersection<{a:number} | {b:string} | {c:boolean}>;
 * ```
 * is equivalent to
 * ```
 * type Foo = {a:number} & {b:string} & {c:boolean}
 * ```
 * which is equivalent to
 * ```
 * type Foo = {a:number, b:string, c:boolean}
 * ```
 *
 * See https://stackoverflow.com/questions/50374908/transform-union-type-to-intersection-type
 * for an explanation of this voodoo.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;

/**
 * Converts the type of a BaseSpec (i.e. Required/Optional/List/Value) into an object type
 * containing a single property (the field name) and the value type of that property.
 *
 * Usage looks like this:
 * ```
 * const myRequiredField = required("someField");
 * type ObjWithMyField = AsObj<typeof myRequiredField>
 * ```
 * The `ObjWithMyField` type will be equivalent to:
 * ```
 * type ObjWithMyField = {someField: ASTNode};
 * ```
 */
type AsObj<Spec> = Spec extends BaseSpec<infer FieldName, infer FieldType>
  ? Record<FieldName, FieldType>
  : never;

/**
 * This type lets you go from a NodeSpec type to an object of fields. Usage looks like:
 *
 * ```
 * const myNodeSpec = nodeSpec([required("foo"), optional("bar")]);
 * type MyNodeFields = FieldsForSpec<typeof myNodeSpec>;
 * ```
 *
 * The `MyNodeFields` type will be equivalent to:
 *
 * ```
 * type MyNodeFields = {
 *   foo: ASTNode,
 *   bar: ASTNode | null,
 * };
 * ```
 */
export type FieldsForSpec<NodeSpecType> = NodeSpecType extends NodeSpec<
  infer ChildSpecType
>
  ? UnionToIntersection<AsObj<ChildSpecType>>
  : never;

export type ChildSpec<FieldName extends string> =
  | Required<FieldName>
  | Optional<FieldName>
  | List<FieldName>
  | Value<FieldName>;

// nodeSpec :: Array<ChildSpec> -> NodeSpec
export function nodeSpec<S extends ChildSpec<string>>(
  childSpecs: readonly S[]
) {
  return new NodeSpec(childSpecs);
}

// required :: String -> ChildSpec
export function required<FieldName extends string>(fieldName: FieldName) {
  return new Required(fieldName);
}

// optional :: String -> ChildSpec
export function optional<FieldName extends string>(fieldName: FieldName) {
  return new Optional(fieldName);
}

// list :: String -> ChildSpec
export function list<FieldName extends string>(fieldName: FieldName) {
  return new List(fieldName);
}

// value :: any -> ChildSpec
export function value<FieldType, FieldName extends string>(
  fieldName: FieldName
) {
  return new Value<FieldName, FieldType>(fieldName);
}

type NodeLike = {
  fields: NodeFields<string>;
  type: string;
};

export type { NodeSpec };
class NodeSpec<Specs extends ChildSpec<string> = ChildSpec<string>> {
  readonly childSpecs: Specs[];
  constructor(childSpecs: readonly Specs[]) {
    if (!(childSpecs instanceof Array)) {
      throw new Error(
        "NodeSpec: expected to receive an array of required/optional/list specs."
      );
    }
    for (const childSpec of childSpecs) {
      if (!(childSpec instanceof BaseSpec)) {
        throw new Error(
          "NodeSpec: all child specs must be created by one of the functions: required/optional/list."
        );
      }
    }
    this.childSpecs = childSpecs;
  }

  validate(node: NodeLike) {
    for (const childSpec of this.childSpecs) {
      childSpec.validate(node);
    }
  }

  hash(node: ASTNode): number {
    const hashes: HashIterator = new HashIterator(node, this);
    return hashObject([
      node.type,
      [...hashes],
      node.options.comment && node.options.comment.fields.comment,
    ]);
  }

  children(node: ASTNode): Iterable<ASTNode> {
    return new ChildrenIterator(node, this);
  }

  fieldNames() {
    return this.childSpecs.map((spec) => spec.fieldName);
  }
}

class ChildrenIterator {
  nodeSpec: NodeSpec;
  parent: ASTNode;
  constructor(parent: ASTNode, nodeSpec: NodeSpec) {
    this.parent = parent;
    this.nodeSpec = nodeSpec;
  }

  *[Symbol.iterator]() {
    for (const spec of this.nodeSpec.childSpecs) {
      if (spec instanceof Value) continue;
      const field = spec.getField(this.parent);
      if (field instanceof ASTNode) {
        yield field;
      } else if (field instanceof Array) {
        for (const elem of field) {
          yield elem;
        }
      }
    }
  }
}

class HashIterator {
  nodeSpec: NodeSpec;
  parent: ASTNode;
  constructor(parent: ASTNode, nodeSpec: NodeSpec) {
    this.parent = parent;
    this.nodeSpec = nodeSpec;
  }

  *[Symbol.iterator](): Iterator<number> {
    for (const spec of this.nodeSpec.childSpecs) {
      if (spec instanceof Value) {
        yield hashObject(spec.getField(this.parent));
      } else if (spec instanceof List) {
        for (const elem of spec.getField(this.parent)) {
          yield elem.hash;
        }
      } else {
        const field = spec.getField(this.parent);
        yield field == null ? hashObject(null) : field.hash;
      }
    }
  }
}

abstract class BaseSpec<FieldName extends string, FieldType> {
  fieldName: FieldName;

  constructor(fieldName: FieldName) {
    this.fieldName = fieldName;
  }

  /**
   * Get the field for this spec from an ASTNode.
   *
   * At the moment, language module libraries create custom ASTNodes by
   * extending the ASTNode class and adding whatever fields they want
   * as instance properties. They can then specify a NodeSpec that says
   * what fields on the node are what. This has the potential for
   * namespace collisions between the ASTNode base class and it's
   * descendants.
   *
   * In any case, to perform runtime type validation on the descendent nodes,
   * we have to access arbitrary fields on them, which can't be statically
   * type checked. This function unifies this "unsafe" behavior in one place.
   *
   * In the future, if we wanted to provide support for static type checking
   * of ASTNode descendants, we'd have to change the way they are layed out.
   *
   * @param node ASTNode on which to lookup the field
   *
   * @internal
   */
  getField<N extends NodeLike>(node: N): FieldType {
    return node.fields[this.fieldName] as FieldType;
  }

  /**
   * Set the field for this spec on at ast node
   * @internal
   * @param node ASTNode on which to set the field
   * @param value the new value for the field
   */
  setField<N extends NodeLike>(node: N, value: FieldType) {
    node.fields[this.fieldName] = value;
  }

  abstract validate(parent: ASTNode): void;
}

export class Required<FieldName extends string = string> extends BaseSpec<
  FieldName,
  ASTNode
> {
  validate(parent: NodeLike) {
    if (!(this.getField(parent) instanceof ASTNode)) {
      throw new Error(
        `Expected the required field '${this.fieldName}' of '${parent.type}' to contain an ASTNode.`
      );
    }
  }
}

export class Optional<FieldName extends string = string> extends BaseSpec<
  FieldName,
  ASTNode | null
> {
  validate(parent: NodeLike) {
    const child = this.getField(parent);
    if (child !== null && !(child instanceof ASTNode)) {
      throw new Error(
        `Expected the optional field '${this.fieldName}' of '${parent.type}' to contain an ASTNode or null.`
      );
    }
  }
}

export class List<FieldName extends string = string> extends BaseSpec<
  FieldName,
  ASTNode[]
> {
  validate(parent: NodeLike) {
    const array = this.getField(parent);
    let valid = true;
    if (array instanceof Array) {
      for (const elem of array) {
        if (!(elem instanceof ASTNode)) {
          valid = false;
          break;
        }
      }
    } else {
      valid = false;
    }
    if (!valid) {
      throw new Error(
        `Expected the listy field '${this.fieldName}' of '${parent.type}' to contain an array of ASTNodes.`
      );
    }
  }
}

export class Value<
  FieldName extends string = string,
  V = unknown
> extends BaseSpec<FieldName, V> {
  validate(node: NodeLike) {
    const value = this.getField(node);
    if (value instanceof ASTNode) {
      throw new Error(
        `Expected value field '${this.fieldName}' of '${node.type}' to be something other than an ASTNode, Did you mean to use required() or optional() instead?`
      );
    }
    if (value instanceof Array) {
      for (const elem of value) {
        if (elem instanceof ASTNode) {
          throw new Error(
            `Expected listy field '${this.fieldName}' of '${node.type}' to contain things other than ASTNodes. Did you mean to use list() instead?`
          );
        }
      }
    }
    // Any other value is valid, even `undefined`, so there's nothing else to check.
  }
}
