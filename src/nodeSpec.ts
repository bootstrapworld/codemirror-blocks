import { ASTNode } from './ast';
import { hashObject } from './utils';

// A NodeSpec declares the types of the fields of an ASTNode.
// It is used to compute hashes, to validate nodes (to prevent the construction
// of an ill-formed AST), and to deal with some edits.
// Its constructor expects a list of:
//
// - required: an ASTNode.
// - optional: either an ASTNode, or `null`.
// - list: an array of ASTNodes.
// - value: an ordinary value that does not contain an ASTNode.

// nodeSpec :: Array<ChildSpec> -> NodeSpec
export function nodeSpec(childSpecs: ChildSpec[]) {
  return new NodeSpec(childSpecs);
}

// required :: String -> ChildSpec
export function required(fieldName: string) {
  return new Required(fieldName);
}

// optional :: String -> ChildSpec
export function optional(fieldName: string) {
  return new Optional(fieldName);
}

// list :: String -> ChildSpec
export function list(fieldName: string) {
  return new List(fieldName);
}

// value :: any -> ChildSpec
export function value(fieldName: string) {
  return new Value(fieldName);
}

export class NodeSpec {
  childSpecs: ChildSpec[];
  constructor(childSpecs: ChildSpec[]) {
    if (!(childSpecs instanceof Array)) {
      throw new Error(
        'NodeSpec: expected to receive an array of required/optional/list specs.'
      );
    }
    for (const childSpec of childSpecs) {
      if (!(childSpec instanceof ChildSpec)) {
        throw new Error(
          'NodeSpec: all child specs must be created by one of the functions: required/optional/list.'
        );
      }
    }
    this.childSpecs = childSpecs;
  }

  validate(node: ASTNode) {
    for (const childSpec of this.childSpecs) {
      childSpec.validate(node);
    }
  }

  hash(node: ASTNode) {
    let hashes = new HashIterator(node, this);
    return hashObject([node.type, [...hashes], node.options.comment?.comment]);
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
    for (let spec of this.nodeSpec.childSpecs) {
      if (spec instanceof Value) continue;
      let field = spec.getField(this.parent);
      if (field instanceof ASTNode) {
        yield field;
      } else if (field instanceof Array) {
        for (let elem of field) {
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

  *[Symbol.iterator]() {
    for (let spec of this.nodeSpec.childSpecs) {
      let field = spec.getField(this.parent);
      if (spec instanceof Value) {
        yield hashObject(field);
      } else if (spec instanceof List) {
        for (let elem of field) {
          yield elem.hash;
        }
      } else {
        yield field == null ? hashObject(null) : field.hash;
      }
    }
  }
}

abstract class ChildSpec {
  fieldName: string;

  constructor(fieldName: string) {
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
  getField<N extends ASTNode>(node: N) {
    return (node as any)[this.fieldName];
  }

  /**
   * Set the field for this spec on at ast node
   * @internal
   * @param node ASTNode on which to set the field
   * @param value the new value for the field
   */
  setField<N extends ASTNode>(node: N, value: ASTNode|null) {
    (node as any)[this.fieldName] = value;
  }

  abstract validate(parent:ASTNode): void;
}

export class Required extends ChildSpec {
  validate(parent:ASTNode) {
    if (!(this.getField(parent) instanceof ASTNode)) {
      throw new Error(`Expected the required field '${this.fieldName}' of '${parent.type}' to contain an ASTNode.`);
    }
  }
}

export class Optional extends ChildSpec {
  validate(parent:ASTNode) {
    let child = this.getField(parent);
    if (child !== null && !(child instanceof ASTNode)) {
      throw new Error(`Expected the optional field '${this.fieldName}' of '${parent.type}' to contain an ASTNode or null.`);
    }
  }
}

export class List extends ChildSpec {
  validate(parent:ASTNode) {
    let array = this.getField(parent);
    let valid = true;
    if (array instanceof Array) {
      for (const elem of array) {
        if (!(elem instanceof ASTNode)) valid = false;
      }
    } else {
      valid = false;
    }
    if (!valid) {
      throw new Error(`Expected the listy field '${this.fieldName}' of '${parent.type}' to contain an array of ASTNodes.`);
    }
  }
}

export class Value extends ChildSpec {
  validate(_parent:ASTNode) {
    // Any value is valid, even `undefined`, so there's nothing to check.
  }
}
