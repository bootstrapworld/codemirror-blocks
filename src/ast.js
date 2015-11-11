class ASTNode {
  constructor(from, to, type) {
    this.from = from
    this.to = to
    this.type = type
  }
}

export class Expression extends ASTNode {
  constructor(from, to, func, args) {
    super(from, to, 'expression')
    this.func = func
    this.args = args
  }

  toString() {
    return `(${this.func} ${this.args.join(' ')})`
  }
}

export class Literal extends ASTNode {
  constructor(from, to, value) {
    super(from, to, 'literal')
    this.value = value
  }

  toString() {
    return `${this.value}`
  }
}