import React from "react";
import { ASTNode } from "../../ast";
import Node from "../../components/Node";

export class Conditional extends ASTNode {
  constructor(
    from,
    to,
    condStatement,
    thenStatement,
    elseStatement,
    options = {}
  ) {
    super(from, to, "conditional", options);
    this.condStatement = condStatement;
    this.thenStatement = thenStatement;
    this.elseStatement = elseStatement;
  }

  *[Symbol.iterator]() {
    yield this;
    for (let node of this.condStatement) {
      yield node;
    }
    for (let node of this.thenStatement) {
      yield node;
    }
    if (this.elseStatement) {
      for (let node of this.elseStatement) {
        yield node;
      }
    }
  }

  toString() {
    if (!this.elseStatement) {
      return `if (${this.condStatement}) { ${this.thenStatement.join(" ")} }`;
    }
    return `if (${this.condStatement}) { ${this.thenStatement.join(
      " "
    )} } else { ${this.body} })`;
  }
}

//TODO: add a toString() method
export class Assignment extends ASTNode {
  constructor(from, to, operator, left, right, options = {}) {
    super(from, to, "assignment", options);
    this.operator = operator;
    this.left = left;
    this.right = right;
  }

  *[Symbol.iterator]() {
    yield this;
    for (let node of this.left) {
      yield node;
    }
    for (let node of this.right) {
      yield node;
    }
  }
}

//TODO: add a toString() method
//is it possible to merge this somehow with assign class? Almost identical with it
export class Binary extends ASTNode {
  constructor(from, to, operator, left, right, options = {}) {
    super(from, to, "binary", options);
    this.operator = operator;
    this.left = left;
    this.right = right;
  }

  *[Symbol.iterator]() {
    yield this;
    for (let node of this.left) {
      yield node;
    }
    for (let node of this.right) {
      yield node;
    }
  }
}

//TODO: add a toString() method
//use struct toString method as template for this toString() method?
export class Prog extends ASTNode {
  constructor(from, to, prog, options = {}) {
    super(from, to, "prog", options);
    this.prog = prog;
  }

  *[Symbol.iterator]() {
    yield this;
    for (let node of this.prog) {
      yield node;
    }
  }

  render(props) {
    return (
      <Node node={this} {...props}>
        <h4>Your Lambda Program</h4>
        {this.prog.map((node, index) => (
          <span key={index}>{node.reactElement()}</span>
        ))}
      </Node>
    );
  }
}

//TODO: add a toString() method
export class Let extends ASTNode {
  constructor(from, to, vars, body, options = {}) {
    super(from, to, "let", options);
    this.vars = vars;
    this.body = body;
  }

  *[Symbol.iterator]() {
    yield this;
    for (let node of this.vars) {
      yield node;
    }
    //why does body not need a for loop to be iterated over
    yield this.body;
  }
}
