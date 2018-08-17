import {ASTNode, pluralize, descDepth} from '../../ast';

// TODO: toDescription

export class Binop extends ASTNode {
  constructor(from, to, op, left, right, options={}) {
    super(from, to, 'binop', ['left', 'right'], options);
    this.op = op;
    this.left = left;
    this.right = right;
  }
  toString() {
    return `(${this.op} ${this.left} ${this.right})`;
  }
}

export class ABlank extends ASTNode {
  constructor(from, to, options={}) {
    super(from, to, 'a-blank', [], options);
  }
  toString() {
    return `Any`;
  }
}

export class Bind extends ASTNode {
  constructor(from, to, id, ann, options={}) {
    super(from, to, 'bind', ['ann'], options);
    this.id = id;
    this.ann = ann;
  }
  toString() {
    return `(bind ${this.id} ${this.ann})`;
  }
}

export class Func extends ASTNode {
  constructor(from, to, name, args, retAnn, doc, body, options={}) {
    super(from, to, 'func', ['args', 'retAnn', 'body'], options);
    this.name = name;
    this.args = args;
    this.retAnn = retAnn;
    this.doc = doc;
    this.body = body;
  }
  toString() {
    return `(fun (${this.args.join(" ")}) ${this.retAnn} "${this.doc}" ${this.body})`;
  }
}

// TODO: Why does this not work if I just say `export class ...`?
module.exports = {
  'Binop': Binop,
  'ABlank': ABlank,
  'Bind': Bind,
  'Func': Func
};
