import {warn, poscmp, srcRangeContains} from './utils';
import {Blank, FakeInsertNode} from './nodes';
import {ASTNode} from './ast';
import hashObject from 'object-hash';



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

// Private-ish - used only in `edits/`
export function findInsertionPoint(parent, fieldName, pos) {
  return new InsertionPoint(parent, fieldName, pos);
}

// Private-ish - used only in `edits/`
export function findReplacementPoint(parent, child) {
  return new ReplacementPoint(parent, child);
}

// Private-ish - used only in `edits/`
export function cloneNode(oldNode) {
  let newNode = new ASTNode(oldNode.from, oldNode.to, oldNode.type, oldNode.options);
  for (const spec of oldNode.spec.childSpecs) {
    if (spec instanceof Required || spec instanceof Optional) {
      if (oldNode[spec.fieldName]) {
        newNode[spec.fieldName] = cloneNode(oldNode[spec.fieldName]);
      } else {
        newNode[spec.fieldName] = null;
      }
    } else if (spec instanceof Value) {
      newNode[spec.fieldName] = oldNode[spec.fieldName];
    } else if (spec instanceof List) {
      newNode[spec.fieldName] = oldNode[spec.fieldName].map(cloneNode);
    }
  }
  newNode.type = oldNode.type;
  newNode.id = oldNode.id;
  newNode.hash = oldNode.hash;
  newNode.spec = oldNode.spec;
  newNode.pretty = oldNode.pretty;
  return newNode;
}

class NodeSpec {
  constructor(childSpecs) {
    if (!childSpecs instanceof Array) {
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
        yield field.hash;
      }
    }
  }
}

class InsertionPoint {
  constructor(parent, fieldName, pos) {
    this.parent = parent;
    this.pos = pos;
    // Find the spec that matches the supplied field name.
    let spec = null;
    for (const s of parent.spec.childSpecs) {
      if (s instanceof List && s.fieldName === fieldName) {
        spec = s;
      }
    }
    if (spec === null) {
      warn('NodeSpec', "Failed to find list to insert child into.");
    }
    this.spec = spec;
    // If `pos` is null, that means the list is empty.
    if (pos === null) {
      this.index = 0;
      return;
    }
    // `pos` lies inside the list. Find out where.
    const list = parent[fieldName];
    for (const i in list) {
      if (poscmp(pos, list[i].srcRange().from) <= 0) {
        this.index = i;
        return;
      }
    }
    this.index = list.length;
    return;
  }

  insertChild(text) {
    const newChildNode = new FakeInsertNode(this.pos, this.pos, text);
    this.parent[this.spec.fieldName].splice(this.index, 0, newChildNode);
  }

  findChild(newAST) {
    const newParent = newAST.getNodeById(this.parent.id);
    return newParent[this.spec.fieldName][this.index];
  }
}

class ReplacementPoint {
  constructor(parent, child) {
    this.parent = parent;
    this.child = child;
    for (const spec of parent.spec.childSpecs) {
      const field = parent[spec.fieldName];
      if (spec instanceof Required && field.id === child.id) {
        this.spec = spec;
        return;
      } else if (spec instanceof Optional && field && field.id === child.id) {
        this.spec = spec;
        return;
      } else if (spec instanceof List) {
        for (const i in field) {
          if (field[i].id === child.id) {
            this.spec = spec;
            this.index = i;
            return;
          }
        }
      }
    }
    warn('new ReplacementPoint', "Failed to find child to be replaced/deleted.");
  }

  replaceChild(text) {
    const newChildNode = new FakeInsertNode(this.child.from, this.child.to, text);
    if (this.index) {
      this.parent[this.spec.fieldName][this.index] = newChildNode;
    } else {
      this.parent[this.spec.fieldName] = newChildNode;
    }
  }

  deleteChild() {
    if (this.index) {
      this.parent[this.spec.fieldName].splice(this.index, 1); // Remove the i'th element.
    } else if (this.spec instanceof Optional) {
      this.parent[this.spec.fieldName] = null;
    } else {
      this.parent[this.spec.fieldName] = new Blank(this.child.from, this.child.to);
    }
  }

  findChild(newAST) {
    const newParent = newAST.getNodeById(this.parent.id);
    if (this.index) {
      return this.parent[this.spec.fieldName][this.index];
    } else {
      return this.parent[this.spec.fieldName];
    }
  }
}

class ChildSpec {}

class Required extends ChildSpec {
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

class Optional extends ChildSpec {
  constructor(fieldName) {
    super();
    this.fieldName = fieldName;
  }

  validate(parent) {
    let child = parent[this.fieldName];
    if (true || child !== null && !(child instanceof ASTNode)) {
      throw new Error(`Expected the optional field '${this.fieldName}' of '${parent.type}' to contain an ASTNode or null.`);
    }
  }
}

class List extends ChildSpec {
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

class Value extends ChildSpec {
  constructor(fieldName) {
    super();
    this.fieldName = fieldName;
  }

  validate(parent) {
    // Any value is valid, even `undefined`, so there's nothing to check.
  }
}
