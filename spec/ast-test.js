/* globals describe it expect beforeEach */

import {AST, Literal, Expression} from '../src/ast';

describe("The Literal Class", function() {
  it("should be constructed with a value and data type", function() {
    var from = {line: 0, ch: 0};
    var to = {line: 0, ch: 2};
    var literal = new Literal(from, to, 11, 'number');
    expect(literal.from).toBe(from);
    expect(literal.to).toBe(to);
    expect(literal.value).toBe(11);
    expect(literal.dataType).toBe('number');
  });

  it("should set a default data type of unknown if one isn't provided", function() {
    var literal = new Literal({line: 0, ch: 0}, {line: 0, ch: 2}, 11);
    expect(literal.dataType).toBe('unknown');
  });

  it("should only return itself when iterated over", function() {
    var literal = new Literal({line: 0, ch: 0}, {line: 0, ch: 2}, 11);
    expect([...literal]).toEqual([literal]);
  });
});

describe("The Expression Class", function() {
  var expression, args, nestedExpression;
  beforeEach(function() {
    args = [
      new Literal({line: 1, ch: 3}, {line: 1, ch: 5}, 11),
      new Literal({line: 1, ch: 6}, {line: 0, ch: 8}, 22)
    ];
    expression = new Expression(
      {line: 1, ch: 0},
      {line: 1, ch: 9},
      '+',
      args
    );
    nestedExpression = new Expression(
      {line: 1, ch: 0},
      {line: 1, ch: 9},
      '+',
      [
        new Literal({line: 1, ch: 3}, {line: 1, ch: 5}, 11),
        new Expression(
          {line: 1, ch: 0},
          {line: 1, ch: 9},
          '-',
          [
            new Literal({line: 1, ch: 3}, {line: 1, ch: 5}, 15),
            new Literal({line: 1, ch: 3}, {line: 1, ch: 5}, 35)
          ]
        )
      ]
    );
  });

  it("should take a function name and list of args in it's constructor", function() {
    expect(expression.args).toBe(args);
    expect(expression.func).toBe('+');
  });

  it("should return itself and all sub-nodes when iterated over", function() {
    expect([...nestedExpression]).toEqual([
      nestedExpression,
      nestedExpression.args[0],
      nestedExpression.args[1],
      nestedExpression.args[1].args[0],
      nestedExpression.args[1].args[1]
    ]);
  });
});

describe("The AST Class", function() {
  it("should take a set of root nodes in it's constructor", function() {
    var nodes = [new Literal({line: 0, ch: 0}, {line: 0, ch: 2}, 11)];
    var ast = new AST(nodes);
    expect(ast.rootNodes).toBe(nodes);
  });

  it("should add every node to a node map for quick lookup", function() {
    var nodes = [
      new Literal({line: 0, ch: 0}, {line: 0, ch: 2}, 11),
      new Expression(
        {line: 1, ch: 0},
        {line: 1, ch: 9},
        '+',
        [
          new Literal({line: 1, ch: 3}, {line: 1, ch: 5}, 11),
          new Literal({line: 1, ch: 6}, {line: 0, ch: 8}, 22)
        ]
      )
    ];
    var ast = new AST(nodes);
    expect(ast.nodeMap.get(nodes[0].id)).toBe(nodes[0]);
    expect(ast.nodeMap.get(nodes[1].id)).toBe(nodes[1]);
    expect(ast.nodeMap.get(nodes[1].args[0].id)).toBe(nodes[1].args[0]);
    expect(ast.nodeMap.get(nodes[1].args[1].id)).toBe(nodes[1].args[1]);
  });
});
