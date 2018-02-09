import {AST, Literal, Expression, Sequence} from 'codemirror-blocks/ast';
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

describe("The Sequence Class", function() {
  var sequence, expression1, expression2, from, to, name, exprs;

  beforeEach(function() {
    // (+ 1 2)
    var func1 = new Literal({line: 0, ch: 8}, {line: 0, ch: 9}, '+', 'symbol');
    var args1 = [
      new Literal({line: 0, ch: 10}, {line: 0, ch: 11}, 1),
      new Literal({line: 0, ch: 12}, {line: 0, ch: 13}, 2)
    ];
    expression1 = new Expression(
      {line: 0, ch: 7},
      {line: 0, ch: 14},
      func1,
      args1,
      {'aria-label':'+ expression'}
    );

    // (- 2 3)
    var func2 = new Literal({line: 0, ch: 16}, {line: 0, ch: 17}, '-', 'symbol');
    var args2 = [
      new Literal({line: 0, ch: 18}, {line: 0, ch: 19}, 2),
      new Literal({line: 0, ch: 20}, {line: 0, ch: 21}, 3)
    ];
    expression2 = new Expression(
      {line: 0, ch: 15},
      {line: 0, ch: 22},
      func2,
      args2,
      {'aria-label':'+ expression'}
    );

    // (begin (+ 1 2) (- 2 3))
    from = {line: 0, ch: 0};
    to = {line: 0, ch: 23};
    name = 'begin';
    exprs = [expression1, expression2];
    sequence = new Sequence(from, to, exprs, name);
  });

  it("should be constructed with a list of expressions", function() {
    expect(sequence.from).toBe(from);
    expect(sequence.to).toBe(to);
    expect(sequence.exprs).toBe(exprs);
    expect(sequence.name).toEqual(name);
  });

  it("should take an optional options parameter in it's constructor", function() {
    var options = {'aria-label': 'sequence'};
    var newSequence = new Sequence(from, to, exprs, name, options);
    expect(newSequence.options).toEqual(options);
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

  it('42 (+ 1 (* 2 3)) "hello" -> 41 (+ 1 (* 2 3)) "hello"', function() {
    let newCode = '41\n\n(+ 1 (* 2 3))\n\n"hello"';
    var newAST = this.parser.parse(newCode);
    let change = { from: {line: 0, ch:0}, to: {line:0, ch:2}, text: ["41"], removed: ["42"] };
    this.ast = this.ast.patch(this.parser.parse, newCode, [change]);
    expect(this.ast.rootNodes.length).toBe(3);
    expect(this.ast.rootNodes[0].type).toBe("literal");
    expect(this.ast.rootNodes[0].value).toBe("41");
    expect(this.ast.rootNodes[1].type).toBe("expression");
  });

  it('42 (+ 1 (* 2 3)) "hello" -> 42 (if a b c) "hello"', function() {
    let newCode = '42\n\n(if a b c)\n\n"hello"';
    var newAST = this.parser.parse(newCode);
    let change = { from: {line: 2, ch:0}, to: {line:2, ch:13}, text: ["(if a b c)"], removed: ["(+ 1 (* 2 3))"] };
    this.ast = this.ast.patch(this.parser.parse, newCode, [change]);
    expect(this.ast.rootNodes.length).toBe(3);
    expect(this.ast.rootNodes[1].type).toBe("ifExpression");
    expect(this.ast.rootNodes[1].testExpr.value).toBe("a");
    expect(this.ast.rootNodes[1].thenExpr.value).toBe("b");
    expect(this.ast.rootNodes[1].elseExpr.value).toBe("c");
  });

  it('42 (+ 1 (* 2 3)) "hello" -> 42 (foo bar baz) "hello"', function() {
    let newCode = '42\n\n(foo bar baz)\n\n"hello"';
    var newAST = this.parser.parse(newCode);
    let change = { from: {line: 2, ch:0}, to: {line:2, ch:13}, text: ["(foo bar baz)"], removed: ["(+ 1 (* 2 3))"] };
    this.ast = this.ast.patch(this.parser.parse, newCode, [change]);
    expect(this.ast.rootNodes.length).toBe(3);
    expect(this.ast.rootNodes[0].type).toBe("literal");
    expect(this.ast.rootNodes[1].type).toBe("expression");
    expect(this.ast.rootNodes[1].func.value).toBe("foo");
    expect(this.ast.rootNodes[1].args.length).toBe(2);
  });

  it('42  (+ 1 (* 2 3))  "hello" --> 42  (+ 1 (* 1 2 3))  ', function() {
    let newCode = '42\n\n(+ 1 (* 1 2 3))\n\n';
    var newAST = this.parser.parse(newCode);
    let change = { from: {line: 4, ch:0}, to: {line:4, ch:7}, text: [""], removed: ['"hello"'] };
    this.ast = this.ast.patch(this.parser.parse, newCode, [change]);
    console.log(this.ast);
    expect(this.ast.rootNodes.length).toBe(2);
    expect(this.ast.rootNodes[0].type).toBe("literal");
    expect(this.ast.rootNodes[1].type).toBe("expression");
  });

  it('42  (+ 1 (* 2 3))  "hello" -> 42  (+ 1 )  "hello"', function() {
    var newCode = '42\n\n(+ 1 )\n\n"hello"';
    var newAST = this.parser.parse(newCode);
    let change = { from: {line: 2, ch:5}, to: {line:2, ch:12}, text: [""], removed: ["(* 2 3)"] };
    this.ast = this.ast.patch(this.parser.parse, newCode, [change]);
    expect(this.ast.rootNodes.length).toBe(3);
    expect(this.ast.rootNodes[0].type).toBe("literal");
    expect(this.ast.rootNodes[1].type).toBe("expression");
    expect(this.ast.rootNodes[2].type).toBe("literal");
    expect(this.ast.rootNodes[1].args.length).toBe(1);
    expect(this.ast.rootNodes[1].args[0].value).toBe("1");
  });

  it('42  (+ 1 (* 2 3))  "hello" -> (+ 1 (* 2 3)) 42 "hello"', function() {
    var newCode = '\n\n(+ 1 (* 2 3))\n42\n"hello"';
    var newAST = this.parser.parse(newCode);
    let change1 = { from: {line: 3, ch:0}, to: {line:3, ch:0}, text: ["42"], removed: [""] };
    let change2 = { from: {line: 0, ch:0}, to: {line:0, ch:2}, text: [""], removed: ["42"] };
    this.ast = this.ast.patch(this.parser.parse, newCode, [change1, change2]);
    expect(this.ast.rootNodes.length).toBe(3);
    expect(this.ast.rootNodes[0].type).toBe("expression");
    expect(this.ast.rootNodes[1].type).toBe("literal");
    expect(this.ast.rootNodes[2].type).toBe("literal");
    expect(this.ast.rootNodes[1].value).toBe("42");
    expect(this.ast.rootNodes[2].value).toBe('"hello"');
  });

  it('42  (+ 1 (* 2 3))  "hello" -> 42 "hello" (+ 1 (* 2 3))', function() {
    var newCode = '42\n"hello"\n(+ 1 (* 3 2))\n\n';
    var newAST = this.parser.parse(newCode);
    let change1 = { from: {line: 4, ch:0}, to: {line:4, ch:7}, text: [""], removed: ['"hello"'] };
    let change2 = { from: {line: 1, ch:0}, to: {line:1, ch:0}, text: ['"hello"'], removed: [""] };
    this.ast = this.ast.patch(this.parser.parse, newCode, [change1, change2]);
    expect(this.ast.rootNodes.length).toBe(3);
    expect(this.ast.rootNodes[0].value).toBe("42");
    expect(this.ast.rootNodes[1].value).toBe('"hello"');
    expect(this.ast.rootNodes[2].type).toBe("expression");
  });

  it('42  (+ 1 (* 2 3))  "hello" -> 42  (+ 1 (* 3 2))  "hello"', function() {
    var newCode = '42\n\n(+ 1 (* 3 2))\n\n"hello"';
    var newAST = this.parser.parse(newCode);
    let change1 = { from: {line: 2, ch:10}, to: {line:2, ch:11}, text: [""], removed: ["3"] };
    let change2 = { from: {line: 2, ch:8}, to: {line:2, ch:8}, text: ["3 "], removed: [""] };
    this.ast = this.ast.patch(this.parser.parse, newCode, [change1, change2]);
    expect(this.ast.rootNodes.length).toBe(3);
    expect(this.ast.rootNodes[0].type).toBe("literal");
    expect(this.ast.rootNodes[1].type).toBe("expression");
    expect(this.ast.rootNodes[1].args.length).toBe(2);
    expect(this.ast.rootNodes[1].args[1].args[0].value).toBe("3");
    expect(this.ast.rootNodes[1].args[1].args[1].value).toBe("2");
  });

  it('42  (+ 1 (* 2 3))  "hello" -> 42  (+ (* 2 3) 1)  "hello"', function() {
    var newCode = '42\n\n(+ (* 2 3) 1)\n\n"hello"';
    var newAST = this.parser.parse(newCode);
    let change1 = { from: {line: 2, ch:5}, to: {line:2, ch:12}, text: [""], removed: ["(* 2 3)"] };
    let change2 = { from: {line: 2, ch:3}, to: {line:2, ch:3}, text: ["(* 2 3)"], removed: [""] };
    this.ast = this.ast.patch(this.parser.parse, newCode, [change1, change2]);
    expect(this.ast.rootNodes.length).toBe(3);
    expect(this.ast.rootNodes[0].type).toBe("literal");
    expect(this.ast.rootNodes[1].type).toBe("expression");
    expect(this.ast.rootNodes[1].args.length).toBe(2);
    expect(this.ast.rootNodes[1].args[0].type).toBe("expression");
    expect(this.ast.rootNodes[1].args[1].type).toBe("literal");
  });

  it('42  (+ 1 (* 2 3))  "hello" -> 42  (+ 1 2 (* 3))  "hello"', function() {
    var newCode = '42\n\n(+ 1 2 (* 3))\n\n"hello"';
    var newAST = this.parser.parse(newCode);
    let change1 = { from: {line: 2, ch:8}, to: {line:2, ch:9}, text: [""], removed: ["2"] };
    let change2 = { from: {line: 2, ch:4}, to: {line:2, ch:4}, text: [" 2"], removed: [""] };
    this.ast = this.ast.patch(this.parser.parse, newCode, [change1, change2]);
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

  it('42  (+ 1 (* 2 3))  "hello" -> 42  (+ (* 1 2 3))  "hello"', function() {
    var newCode = '42\n\n(+  (* 1 2 3))\n\n"hello"';
    var newAST = this.parser.parse(newCode);
    let change1 = { from: {line: 2, ch:8}, to: {line:2, ch:8}, text: ["1 "], removed: [""] };
    let change2 = { from: {line: 2, ch:3}, to: {line:2, ch:4}, text: [""], removed: ["1"] };
    this.ast = this.ast.patch(this.parser.parse, newCode, [change1, change2]);
    expect(this.ast.rootNodes.length).toBe(3);
    expect(this.ast.rootNodes[0].type).toBe("literal");
    expect(this.ast.rootNodes[1].type).toBe("expression");
    expect(this.ast.rootNodes[1].args.length).toBe(1);
    expect(this.ast.rootNodes[1].args[0].type).toBe("expression");
    expect(this.ast.rootNodes[1].args[0].args[0].value).toBe("1");
    expect(this.ast.rootNodes[1].args[0].args.length).toBe(3);
  });

  it('42  (+ 1 (* 2 3))  "hello" -> 42  (+ 1 ) (* 2 3)  "hello"', function() {
    var newCode = '42\n\n(+ 1 ) (* 2 3)\n\n"hello"';
    var newAST = this.parser.parse(newCode);
    let change1 = { from: {line: 2, ch:13}, to: {line:2, ch:13}, text: [" (* 2 3)"], removed: [""] };
    let change2 = { from: {line: 2, ch:5}, to: {line:2, ch:12}, text: [""], removed: ["(* 2 3)"] };
    this.ast = this.ast.patch(this.parser.parse, newCode, [change1, change2]);
    expect(this.ast.rootNodes.length).toBe(4);
    expect(this.ast.rootNodes[0].type).toBe("literal");
    expect(this.ast.rootNodes[1].type).toBe("expression");
    expect(this.ast.rootNodes[2].type).toBe("expression");
    expect(this.ast.rootNodes[3].type).toBe("literal");
    expect(this.ast.rootNodes[1].args.length).toBe(1);
    expect(this.ast.rootNodes[1].func.value).toBe("+");
    expect(this.ast.rootNodes[2].args.length).toBe(2);
    expect(this.ast.rootNodes[2].func.value).toBe("*");
    expect(this.ast.rootNodes[3].value).toBe('"hello"');
  });

  it('42  (+ 1 (* 2 3))  "hello" -> 42  (* 2 3) (+ 1 )  "hello"', function() {
    var newCode = '42\n\n(* 2 3) (+ 1 )\n\n"hello"';
    var newAST = this.parser.parse(newCode);
    let change1 = { from: {line: 2, ch:5}, to: {line:2, ch:12}, text: [""], removed: ["(* 2 3)"] };
    let change2 = { from: {line: 2, ch:0, sticky: "after"}, to: {line:2, ch:0, sticky: "after"}, text: ["(* 2 3) "], removed: [""] };
    this.ast = this.ast.patch(this.parser.parse, newCode, [change1, change2]);
    expect(this.ast.rootNodes.length).toBe(4);
    expect(this.ast.rootNodes[0].type).toBe("literal");
    expect(this.ast.rootNodes[1].type).toBe("expression");
    expect(this.ast.rootNodes[2].type).toBe("expression");
    expect(this.ast.rootNodes[3].type).toBe("literal");
    expect(this.ast.rootNodes[1].args.length).toBe(2);
    expect(this.ast.rootNodes[1].func.value).toBe("*");
    expect(this.ast.rootNodes[2].args.length).toBe(1);
    expect(this.ast.rootNodes[2].func.value).toBe("+");
    expect(this.ast.rootNodes[3].value).toBe('"hello"');
  });

  it('(+ 1 (* 3 5 (- 2 9))) -> (+ (* 3 5 (- 1 2 9)))', function() {
    this.ast = this.parser.parse('(+ 1 (* 3 5 (- 2 9)))');
    var newCode = '(+ (* 3 5 (- 1 2 9)))';
    var newAST = this.parser.parse(newCode);
    let change1 = { from: {line: 0, ch:15}, to: {line:0, ch:15}, text: ["1 "], removed: [""] };
    let change2 = { from: {line: 0, ch:3}, to: {line:0, ch:4}, text: [""], removed: ["1"] };
    this.ast = this.ast.patch(this.parser.parse, newCode, [change1, change2]);
    expect(this.ast.rootNodes.length).toBe(1);
    expect(this.ast.rootNodes[0].type).toBe("expression");
    expect(this.ast.rootNodes[0].args.length).toBe(1);
    expect(this.ast.rootNodes[0].args[0].type).toBe("expression");
    expect(this.ast.rootNodes[0].args[0].args.length).toBe(3);
    expect(this.ast.rootNodes[0].args[0].args[2].type).toBe("expression");
    expect(this.ast.rootNodes[0].args[0].args[2].args.length).toBe(3);
    expect(this.ast.rootNodes[0].args[0].args[2].args[0].value).toBe("1");
  });

  it('42  (+ 1 (* 2 3))  "hello" -> 42  (+ 1 ) (* 2 3)  ', function() {
    var newCode = '42\n\n(+ 1 ) (* 2 3)\n\n';
    let change1 = { from: {line: 4, ch:0}, to: {line:4, ch:7}, text: ["(* 2 3)"], removed: ['"hello"'] };
    let change2 = { from: {line: 2, ch:5}, to: {line:2, ch:12}, text: [""], removed: ['(* 2 3)'] };
    this.ast = this.ast.patch(this.parser.parse, newCode, [change1, change2]);
    expect(this.ast.rootNodes.length).toBe(3);
    expect(this.ast.rootNodes[0].type).toBe("literal");
    expect(this.ast.rootNodes[1].type).toBe("expression");
  });

  it('42  (+ 1 (* 2 3)) moo  "hello" ->  42  (+ 1 (* 2 3) moo)  "hello"', function() {
    this.ast = this.parser.parse('42\n\n(+ 1 (* 2 3)) moo\n\n"hello"');
    var newCode = '42\n\n(+ 1 (* 2 3) moo) \n\n"hello"';
    let change1 = { from: {line: 2, ch:14}, to: {line:2, ch:17}, text: [""], removed: ["moo"] };
    let change2 = { from: {line: 2, ch:12}, to: {line:2, ch:12}, text: ["moo"], removed: [""] };
    this.ast = this.ast.patch(this.parser.parse, newCode, [change1, change2]);
    expect(this.ast.rootNodes.length).toBe(3);
    expect(this.ast.rootNodes[0].type).toBe("literal");
    expect(this.ast.rootNodes[1].type).toBe("expression");
    expect(this.ast.rootNodes[2].type).toBe("literal");
    expect(this.ast.rootNodes[1].args.length).toBe(3);
    expect(this.ast.rootNodes[1].args[2].type).toBe("literal");
    expect(this.ast.rootNodes[1].args[2].value).toBe("moo");
    expect(this.ast.rootNodes[2].value).toBe('"hello"');
  });
  
});