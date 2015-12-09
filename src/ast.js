import uuid from 'node-uuid';

export class AST {
  constructor(rootNodes) {
    this.nodeMap = new Map();
    this.rootNodes = rootNodes;
    for (let rootNode of this.rootNodes) {
      for (let node of rootNode) {
        if (node) {
          this.nodeMap.set(node.id, node);
        }
      }
    }
  }
}

class ASTNode {
  constructor(from, to, type, options) {
    this.from = from;
    this.to = to;
    this.type = type;
    this.options = options;
    this.id = uuid.v4();
  }
}

export class Expression extends ASTNode {
  constructor(from, to, func, args, options={}) {
    super(from, to, 'expression', options);
    this.func = func;
    this.args = args;
  }

  *[Symbol.iterator]() {
    yield this;
    for (let arg of this.args) {
      for (let node of arg) {
        yield node;
      }
    }
  }

  toString() {
    return `(${this.func} ${this.args.join(' ')})`;
  }
}

export class Struct extends ASTNode {
  constructor(from, to, name, fields, options={}) {
    super(from, to, 'struct', options);
    this.name = name;
    this.fields = fields;
  }

  *[Symbol.iterator]() {
    yield this;
  }

  toString() {
    return `(define-struct ${this.name} ${this.fields.join(' ')})`;
  }
}

export class FunctionDefinition extends ASTNode {
  constructor(from, to, name, args, body, options={}) {
    super(from, to, 'functionDef', options);
    this.name = name;
    this.args = args;
    this.body = body;
  }

  *[Symbol.iterator]() {
    yield this;
    for (let node of this.body) {
      yield node;
    }
  }

  toString() {
    return `(define (${this.name} ${this.args.join(' ')}) ${this.body})`;
  }
}

export class Literal extends ASTNode {
  constructor(from, to, value, dataType='unknown', options={}) {
    super(from, to, 'literal', options);
    this.value = value;
    this.dataType = dataType;
  }

  *[Symbol.iterator]() {
    yield this;
  }

  toString() {
    return `${this.value}`;
  }
}
