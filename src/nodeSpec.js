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
export function nodeSpec(childSpecs) {
  return new NodeSpec(childSpecs);
}

// required :: String -> ChildSpec
export function required(fieldName) {
  return new Required(fieldName);
}

// optional :: String -> ChildSpec
export function optional(fieldName) {
  return new Optional(fieldName);
}

// list :: String -> ChildSpec
export function list(fieldName) {
  return new List(fieldName);
}

// value :: any -> ChildSpec
export function value(fieldName) {
  return new Value(fieldName);
}

class NodeSpec {
  constructor(childSpecs) {
    if (!(childSpecs instanceof Array)) {
      throw new Error("NodeSpec: expected to receive an array of required/optional/list specs.");
    }
    for (const childSpec of childSpecs) {
      if (!(childSpec instanceof ChildSpec)) {
        throw new Error("NodeSpec: all child specs must be created by one of the functions: required/optional/list.");
      }
    }
    this.childSpecs = childSpecs;
  }

  validate(node) {
    for (const childSpec of this.childSpecs) {
      childSpec.validate(node);
    }
  }

  hash(node) {
    let hashes = new HashIterator(node, this);
    return hashObject([node.type, [...hashes]]);
  }

  children(node) {
    return new ChildrenIterator(node, this);
  }

  fieldNames() {
    return this.childSpecs.map((spec) => spec.fieldName);
  }
}

class ChildrenIterator {
  constructor(parent, nodeSpec) {
    this.parent = parent;
    this.nodeSpec = nodeSpec;
  }

  *[Symbol.iterator]() {
    for (let spec of this.nodeSpec.childSpecs) {
      if (spec instanceof Value) continue;
      let field = this.parent[spec.fieldName];
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
  constructor(parent, nodeSpec) {
    this.parent = parent;
    this.nodeSpec = nodeSpec;
  }

  *[Symbol.iterator]() {
    for (let spec of this.nodeSpec.childSpecs) {
      let field = this.parent[spec.fieldName];
      if (spec instanceof Value) {
        yield hashObject(field);
      } else if (spec instanceof List) {
        for (let elem of field) {
          yield elem.hash;
        }
      } else {
        yield (field == null)? hashObject(null) : field.hash;
      }
    }
  }
}

class ChildSpec {}

export class Required extends ChildSpec {
  constructor(fieldName) {
    super();
    this.fieldName = fieldName;
  }

  validate(parent) {
    if (!(parent[this.fieldName] instanceof ASTNode)) {
      throw new Error(`Expected the required field '${this.fieldName}' of '${parent.type}' to contain an ASTNode.`);
    }
  }
}

export class Optional extends ChildSpec {
  constructor(fieldName) {
    super();
    this.fieldName = fieldName;
  }

  validate(parent) {
    let child = parent[this.fieldName];
    if (child !== null && !(child instanceof ASTNode)) {
      throw new Error(`Expected the optional field '${this.fieldName}' of '${parent.type}' to contain an ASTNode or null.`);
    }
  }
}

export class List extends ChildSpec {
  constructor(fieldName) {
    super();
    this.fieldName = fieldName;
  }

  validate(parent) {
    let array = parent[this.fieldName];
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
  constructor(fieldName) {
    super();
    this.fieldName = fieldName;
  }

  validate(_parent) {
    // Any value is valid, even `undefined`, so there's nothing to check.
  }
}
