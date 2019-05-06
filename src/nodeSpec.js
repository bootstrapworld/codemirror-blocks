import {warn, srcRangeContains} from './utils';
import {Blank} from './nodes';
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

  clone(oldNode) {
    let newNode = new ASTNode(oldNode.from, oldNode.to, oldNode.type, oldNode.options);
    for (const spec of this.childSpecs) {
      if (spec instanceof Required || spec instanceof Optional) {
        if (oldNode[spec.fieldName]) {
          newNode[spec.fieldName] = oldNode[spec.fieldName]._clone();
        } else {
          newNode[spec.fieldName] = null;
        }
      } else if (spec instanceof Value) {
        newNode[spec.fieldName] = oldNode[spec.fieldName];
      } else if (spec instanceof List) {
        newNode[spec.fieldName] = oldNode[spec.fieldName]
          .map(node => node._clone());
      }
    }
    newNode.type = oldNode.type;
    newNode.id = oldNode.id;
    newNode.hash = oldNode.hash;
    newNode.spec = oldNode.spec;
    newNode.pretty = oldNode.pretty;
    return newNode;
  }

  insertChild(parent, pos, text) {
    let inserted = false;
    let newNode = new FakeInsertNode(pos, pos, text);
    for (const spec of this.childSpecs) {
      if (spec instanceof List) {
        const list = parent[spec.fieldName];
        if (list.length === 0) {
          // This had better be the only list.
          // It has no elements, so we can't tell whether it's the *right* list.
          list.push(newNode);
          break;
        } else if (poscmp(list[0].srcRange().from, pos) <= 0
                  && poscmp(pos, list[list.length - 1].srcRange().to) <= 0) {
          // `pos` lies inside this list.
          // We'll find out exactly where it is, and insert at that point.
          for (const i in list) {
            if (poscmp(pos, list[i].srcRange().from) <= 0) {
              list.splice(i, 0, newNode);
              break;
            }
          }
          list.splice(list.length, 0, newNode);
        }
      }
    }
    if (!inserted) {
      warn('insertChild', "Failed to find List to insert child into.");
    }
  }

  deleteChild(parent, child) {
    for (const spec of this.childSpecs) {
      let field = parent[spec.fieldName];
      if (spec instanceof Required && field.id === child.id) {
        parent[spec.fieldName] = new Blank(child.from, child.to);
      } else if (spec instanceof Optional && field && field.id === child.id) {
        parent[spec.fieldName] = null;
      } else if (spec instanceof List) {
        for (let i in field) {
          if (field[i].id === child.id) {
            field.splice(i, 1); // remove the i'th element.
          }
        }
      }
    }
  }

  replaceChild(parent, child, text) {
    let newNode = new FakeInsertNode(child.from, child.to, text);
    for (const spec of this.childSpecs) {
      let field = parent[spec.fieldName];
      if (spec instanceof Required && field.id === child.id) {
        parent[spec.fieldName] = newNode;
      } else if (spec instanceof Optional && field && field.id === child.id) {
        parent[spec.fieldName] = newNode;
      } else if (spec instanceof List) {
        for (let i in field) {
          if (field[i].id === child.id) {
            field[i] = newNode;
          }
        }
      }
    }
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

export function nodeSpec(childSpecs) {
  return new NodeSpec(childSpecs);
}

export function required(fieldName) {
  return new Required(fieldName);
}

export function optional(fieldName) {
  return new Optional(fieldName);
}

export function list(fieldName) {
  return new List(fieldName);
}

export function value(fieldName) {
  return new Value(fieldName);
}
