import {AST, Literal, Expression} from 'codemirror-blocks/ast';
import WeschemeParser from 'codemirror-blocks/languages/wescheme/WeschemeParser';

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


describe("AST Patching", function() {
  beforeEach(function() {
    this.parser = new WeschemeParser();
    this.ast = this.parser.parse('42\n\n(+ 1 (* 2 3))\n\n"hello"');
  });

  it("should correctly change a root-level literal", function() {
    var newAST = this.parser.parse('41\n\n(+ 1 (* 2 3))\n\n"hello"');
    let change = { from: {line: 0, ch:0}, to: {line:0, ch:2}, text: ["41"], removed: ["42"] };
    this.ast = this.ast.patch(newAST, [change]);
    expect(this.ast.rootNodes.length).toBe(3);
    expect(this.ast.rootNodes[0].type).toBe("literal");
    expect(this.ast.rootNodes[0].value).toBe("41");
    expect(this.ast.rootNodes[1].type).toBe("expression");
  });

  it("should correctly change child node", function() {
    var newAST = this.parser.parse('41\n\n(foo bar baz)\n\n"hello"');
    let change = { from: {line: 2, ch:0}, to: {line:2, ch:13}, text: ["(foo bar baz)"], removed: ["(+ 1 (* 2 3)))"] };
    this.ast = this.ast.patch(newAST, [change]);
    expect(this.ast.rootNodes.length).toBe(3);
    expect(this.ast.rootNodes[0].type).toBe("literal");
    expect(this.ast.rootNodes[1].type).toBe("expression");
    expect(this.ast.rootNodes[1].func.value).toBe("foo");
    expect(this.ast.rootNodes[1].args.length).toBe(2);
  });

  it("should correctly delete root node", function() {
    var newAST = this.parser.parse('42\n\n(+ 1 (* 1 2 3))\n\n');
    let change = { from: {line: 4, ch:0}, to: {line:4, ch:7}, text: [""], removed: ['"hello"'] };
    this.ast = this.ast.patch(newAST, [change]);
    expect(this.ast.rootNodes.length).toBe(2);
    expect(this.ast.rootNodes[0].type).toBe("literal");
    expect(this.ast.rootNodes[1].type).toBe("expression");
  });

  it("should correctly delete non-root node", function() {
    var newAST = this.parser.parse('42\n\n(+ 1)\n\n"hello"');
    let change = { from: {line: 2, ch:5}, to: {line:2, ch:12}, text: [""], removed: ["(* 2 3)"] };
    this.ast = this.ast.patch(newAST, [change]);
    expect(this.ast.rootNodes.length).toBe(3);
    expect(this.ast.rootNodes[0].type).toBe("literal");
    expect(this.ast.rootNodes[1].type).toBe("expression");
    expect(this.ast.rootNodes[2].type).toBe("literal");
    expect(this.ast.rootNodes[1].args.length).toBe(1);
    expect(this.ast.rootNodes[1].args[0].value).toBe("1");
  });

  it("should correctly move roots forward", function() {
    var newAST = this.parser.parse('\n\n(+ 1 (* 2 3))\n42\n"hello"');
    let change1 = { from: {line: 3, ch:0}, to: {line:3, ch:0}, text: ["42"], removed: [""] };
    let change2 = { from: {line: 0, ch:0}, to: {line:0, ch:2}, text: [""], removed: ["42"] };
    this.ast = this.ast.patch(newAST, [change1, change2]);
    expect(this.ast.rootNodes.length).toBe(3);
    expect(this.ast.rootNodes[0].type).toBe("expression");
    expect(this.ast.rootNodes[1].type).toBe("literal");
    expect(this.ast.rootNodes[2].type).toBe("literal");
    expect(this.ast.rootNodes[1].value).toBe("42");
    expect(this.ast.rootNodes[2].value).toBe('"hello"');
  });

  it("should correctly move roots backward", function() {
    var newAST = this.parser.parse('42\n"hello"\n(+ 1 (* 3 2))\n\n');
    let change1 = { from: {line: 4, ch:0}, to: {line:4, ch:7}, text: [""], removed: ['"hello"'] };
    let change2 = { from: {line: 1, ch:0}, to: {line:1, ch:0}, text: ['"hello"'], removed: [""] };
    this.ast = this.ast.patch(newAST, [change1, change2]);
    expect(this.ast.rootNodes.length).toBe(3);
    expect(this.ast.rootNodes[0].value).toBe("42");
    expect(this.ast.rootNodes[1].value).toBe('"hello"');
    expect(this.ast.rootNodes[2].type).toBe("expression");
  });

  it("should correctly swap non-root siblings", function() {
    var newAST = this.parser.parse('42\n\n(+ 1 (* 3 2))\n\n"hello"');
    let change1 = { from: {line: 2, ch:10}, to: {line:2, ch:11}, text: [""], removed: ["3"] };
    let change2 = { from: {line: 2, ch:8}, to: {line:2, ch:8}, text: ["3 "], removed: [""] };
    this.ast = this.ast.patch(newAST, [change1, change2]);
    expect(this.ast.rootNodes.length).toBe(3);
    expect(this.ast.rootNodes[0].type).toBe("literal");
    expect(this.ast.rootNodes[1].type).toBe("expression");
    expect(this.ast.rootNodes[1].args.length).toBe(2);
    expect(this.ast.rootNodes[1].args[1].args[0].value).toBe("3");
    expect(this.ast.rootNodes[1].args[1].args[1].value).toBe("2");
  });

  it("should correctly swap non-literal siblings", function() {
    var newAST = this.parser.parse('42\n\n(+ (* 3 2) 1)\n\n"hello"');
    let change1 = { from: {line: 2, ch:11}, to: {line:2, ch:12}, text: [""], removed: ["(* 2 3)"] };
    let change2 = { from: {line: 2, ch:3}, to: {line:2, ch:3}, text: ["(* 2 3)"], removed: [""] };
    this.ast = this.ast.patch(newAST, [change1, change2]);
    expect(this.ast.rootNodes.length).toBe(3);
    expect(this.ast.rootNodes[0].type).toBe("literal");
    expect(this.ast.rootNodes[1].type).toBe("expression");
    expect(this.ast.rootNodes[1].args.length).toBe(2);
    expect(this.ast.rootNodes[1].args[0].type).toBe("expression");
    expect(this.ast.rootNodes[1].args[1].type).toBe("literal");
  });

  it("should correctly move nodes up to parent level", function() {
    var newAST = this.parser.parse('42\n\n(+ 1 2 (* 3))\n\n"hello"');
    let change1 = { from: {line: 2, ch:8}, to: {line:2, ch:9}, text: [""], removed: ["2"] };
    let change2 = { from: {line: 2, ch:4}, to: {line:2, ch:4}, text: [" 2"], removed: [""] };
    this.ast = this.ast.patch(newAST, [change1, change2]);
    expect(this.ast.rootNodes.length).toBe(3);
    expect(this.ast.rootNodes[0].type).toBe("literal");
    expect(this.ast.rootNodes[1].type).toBe("expression");
    expect(this.ast.rootNodes[1].args.length).toBe(3);
    expect(this.ast.rootNodes[1].args[0].value).toBe("1");
    expect(this.ast.rootNodes[1].args[1].value).toBe("2");
    expect(this.ast.rootNodes[1].args[2].type).toBe("expression");
    expect(this.ast.rootNodes[1].args[2].args[0].value).toBe("3");
    expect(this.ast.rootNodes[1].args[2].args.length).toBe(1);
  });

  it("should correctly move nodes down to child level", function() {
    var newAST = this.parser.parse('42\n\n(+ (* 1 2 3))\n\n"hello"');
    let change1 = { from: {line: 2, ch:11}, to: {line:2, ch:11}, text: [" 1"], removed: [""] };
    let change2 = { from: {line: 2, ch:3}, to: {line:2, ch:4}, text: [""], removed: ["1"] };
    this.ast = this.ast.patch(newAST, [change1, change2]);
    expect(this.ast.rootNodes.length).toBe(3);
    expect(this.ast.rootNodes[0].type).toBe("literal");
    expect(this.ast.rootNodes[1].type).toBe("expression");
    expect(this.ast.rootNodes[1].args.length).toBe(1);
    expect(this.ast.rootNodes[1].args[0].type).toBe("expression");
    expect(this.ast.rootNodes[1].args[0].args[0].value).toBe("1");
    expect(this.ast.rootNodes[1].args[0].args.length).toBe(3);
  });

  it("should correctly promote non-root nodes to root nodes", function() {
    var newAST = this.parser.parse('42\n\n(+ (* 1 2 3))\n\n"hello"');
    let change1 = { from: {line: 2, ch:13}, to: {line:2, ch:13}, text: [" 1"], removed: [""] };
    let change2 = { from: {line: 2, ch:3}, to: {line:2, ch:4}, text: [""], removed: ["1"] };
    this.ast = this.ast.patch(newAST, [change1, change2]);
    expect(this.ast.rootNodes.length).toBe(3);
    expect(this.ast.rootNodes[0].type).toBe("literal");
    expect(this.ast.rootNodes[1].type).toBe("expression");
    expect(this.ast.rootNodes[2].type).toBe("literal");
    expect(this.ast.rootNodes[2].value).toBe('"hello"');
    expect(this.ast.rootNodes[1].args.length).toBe(1);
  });

  it("should correctly move nodes down to child level", function() {
    this.ast = this.parser.parse('(+ 1 (* 3 5 (- 2 9)))');
    var newAST = this.parser.parse('(+ (* 3 5 (- 1 2 9)))');
    let change1 = { from: {line: 0, ch:15}, to: {line:0, ch:15}, text: ["1 "], removed: [""] };
    let change2 = { from: {line: 0, ch:4}, to: {line:0, ch:21}, text: [""], removed: ["1"] };
    this.ast = this.ast.patch(newAST, [change1, change2]);
    expect(this.ast.rootNodes.length).toBe(1);
    expect(this.ast.rootNodes[0].type).toBe("expression");
    expect(this.ast.rootNodes[0].args.length).toBe(1);
    expect(this.ast.rootNodes[0].args[0].type).toBe("expression");
    expect(this.ast.rootNodes[0].args[0].args.length).toBe(3);
    expect(this.ast.rootNodes[0].args[0].args[2].type).toBe("expression");
    expect(this.ast.rootNodes[0].args[0].args[2].args.length).toBe(3);
    expect(this.ast.rootNodes[0].args[0].args[2].args[0].value).toBe("1");
  });
});