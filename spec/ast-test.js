import {AST, Literal, Expression} from 'codemirror-blocks/ast';

describe("The Literal Class", function() {
  it("should be constructed with a value and data type", function() {
    var from = {line: 0, ch: 0};
    var to = {line: 0, ch: 2};
    var literal = new Literal(from, to, 11, 'number');
    expect(literal.from).toBe(from);
    expect(literal.to).toBe(to);
    expect(literal.value).toBe(11);
    expect(literal.dataType).toBe('number');
    expect(literal.options).toEqual({});
  });

  it("should set a default data type of unknown if one isn't provided", function() {
    var literal = new Literal({line: 0, ch: 0}, {line: 0, ch: 2}, 11);
    expect(literal.dataType).toBe('unknown');
  });

  it("should only return itself when iterated over", function() {
    var literal = new Literal({line: 0, ch: 0}, {line: 0, ch: 2}, 11);
    expect([...literal]).toEqual([literal]);
  });

  it("should take an optional options parameter in it's constructor", function() {
    var literal = new Literal(
      {line: 0, ch: 0},
      {line: 0, ch: 2},
      11,
      'number',
      {'aria-label':'11'}
    );
    expect(literal.options).toEqual({'aria-label':'11'});
  });

});

describe("The Expression Class", function() {
  var expression, func, args, nestedExpression, ast;
  beforeEach(function() {
    func = new Literal({line: 1, ch: 1}, {line: 1, ch: 2}, '+', 'symbol');
    args = [
      new Literal({line: 1, ch: 3}, {line: 1, ch: 5}, 11),
      new Literal({line: 1, ch: 6}, {line: 0, ch: 8}, 22)
    ];
    // (+ 11 22)
    expression = new Expression(
      {line: 1, ch: 0},
      {line: 1, ch: 9},
      func,
      args,
      {'aria-label':'+ expression'}
    );
    // (+ 11 (- 15 35))
    nestedExpression = new Expression(
      {line: 1, ch: 0},
      {line: 1, ch: 9},
      new Literal({line: 1, ch: 1}, {line: 1, ch: 2}, '+', 'symbol'),
      [
        new Literal({line: 1, ch: 3}, {line: 1, ch: 5}, 11),
        new Expression(
          {line: 1, ch: 0},
          {line: 1, ch: 9},
          new Literal({line: 1, ch: 1}, {line: 1, ch: 2}, '-', 'symbol'),
          [
            new Literal({line: 1, ch: 3}, {line: 1, ch: 5}, 15),
            new Literal({line: 1, ch: 3}, {line: 1, ch: 5}, 35)
          ]
        )
      ]
    );
    // build the AST, thereby assigning parent/child/sibling relationships
    ast = new AST([expression]);
  });

  it("should take a function name and list of args in it's constructor", function() {
    expect(expression.args).toBe(args);
    expect(expression.func).toBe(func);
    expect(expression.options).toEqual({'aria-label':'+ expression'});
  });

  it("should return itself and it's descendants when iterated over", function() {
    expect([...nestedExpression]).toEqual([
      nestedExpression,
      nestedExpression.func,
      nestedExpression.args[0],
      nestedExpression.args[1]
    ]);
  });

  it("should have all navigation pointers and aria attributes set", function() {
    expect(ast.getNodeFirstChild(expression)).toEqual(expression.func);
    expect(ast.getNodeParent(expression.func)).toEqual(expression);
    expect(ast.getNodeAfter(expression.func)).toEqual(expression.args[0]);
    expect(ast.getNodeParent(expression.args[0])).toEqual(expression);
    expect(ast.getNodeBefore(expression.args[0])).toEqual(expression.func);
    expect(ast.getNodeAfter(expression.args[0])).toEqual(expression.args[1]);
    expect(ast.getNodeParent(expression.args[1])).toEqual(expression);
    expect(ast.getNodeBefore(expression.args[1])).toEqual(expression.args[0]);
    expect(ast.getNodeAfter(expression.args[1])).toEqual(false);
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
        new Literal({line: 1, ch: 1}, {line: 1, ch: 2}, '+', 'symbol'),
        [
          new Literal({line: 1, ch: 3}, {line: 1, ch: 5}, 11),
          new Literal({line: 1, ch: 6}, {line: 0, ch: 8}, 22)
        ]
      )
    ];
    var ast = new AST(nodes);
    expect(ast.nodeIdMap.get(nodes[0].id)).toBe(nodes[0]);
    expect(ast.nodeIdMap.get(nodes[1].id)).toBe(nodes[1]);
    expect(ast.nodeIdMap.get(nodes[1].args[0].id)).toBe(nodes[1].args[0]);
    expect(ast.nodeIdMap.get(nodes[1].args[1].id)).toBe(nodes[1].args[1]);
  });
});
