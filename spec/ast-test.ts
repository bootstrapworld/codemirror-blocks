import CodeMirror from "codemirror";
import { AST } from "../src/CodeMirrorBlocks";
import { FunctionApp, Literal, Sequence, Comment } from "../src/nodes";

describe("The Literal Class", () => {
  it("should be constructed with a value and data type", () => {
    const from = { line: 0, ch: 0 };
    const to = { line: 0, ch: 2 };
    const literal = new Literal(from, to, 11, "number");
    expect(literal.from).toBe(from);
    expect(literal.to).toBe(to);
    expect(literal.value).toBe(11);
    expect(literal.dataType).toBe("number");
    expect(literal.options).toEqual({});
  });

  it("should set a default data type of unknown if one isn't provided", () => {
    const literal = new Literal({ line: 0, ch: 0 }, { line: 0, ch: 2 }, 11);
    expect(literal.dataType).toBe("unknown");
  });

  it("should only return itself when iterated over", () => {
    const literal = new Literal({ line: 0, ch: 0 }, { line: 0, ch: 2 }, 11);
    expect([...literal.descendants()]).toEqual([literal]);
  });

  it("should take an optional options parameter in its constructor", () => {
    const literal = new Literal(
      { line: 0, ch: 0 },
      { line: 0, ch: 2 },
      11,
      "number",
      { "aria-label": "11" }
    );
    expect(literal.options).toEqual({ "aria-label": "11" });
  });
});

describe("The Sequence Class", () => {
  let sequence: Sequence;
  let expression1: FunctionApp;
  let expression2: FunctionApp;
  let from: CodeMirror.Position;
  let to: CodeMirror.Position;
  let name: Literal;
  let exprs: FunctionApp[];

  beforeEach(() => {
    // (+ 1 2)
    const func1 = new Literal(
      { line: 0, ch: 8 },
      { line: 0, ch: 9 },
      "+",
      "symbol"
    );
    const args1 = [
      new Literal({ line: 0, ch: 10 }, { line: 0, ch: 11 }, 1),
      new Literal({ line: 0, ch: 12 }, { line: 0, ch: 13 }, 2),
    ];
    expression1 = new FunctionApp(
      { line: 0, ch: 7 },
      { line: 0, ch: 14 },
      func1,
      args1,
      { "aria-label": "+ expression" }
    );

    // (- 2 3)
    const func2 = new Literal(
      { line: 0, ch: 16 },
      { line: 0, ch: 17 },
      "-",
      "symbol"
    );
    const args2 = [
      new Literal({ line: 0, ch: 18 }, { line: 0, ch: 19 }, 2),
      new Literal({ line: 0, ch: 20 }, { line: 0, ch: 21 }, 3),
    ];
    expression2 = new FunctionApp(
      { line: 0, ch: 15 },
      { line: 0, ch: 22 },
      func2,
      args2,
      { "aria-label": "+ expression" }
    );

    // (begin (+ 1 2) (- 2 3))
    from = { line: 0, ch: 0 };
    to = { line: 0, ch: 23 };
    name = new Literal(
      { line: 0, ch: 1 },
      { line: 0, ch: 6 },
      "begin",
      "symbol"
    );
    exprs = [expression1, expression2];
    sequence = new Sequence(from, to, exprs, name);
  });

  it("should be constructed with a list of expressions", () => {
    expect(sequence.from).toBe(from);
    expect(sequence.to).toBe(to);
    expect(sequence.exprs).toBe(exprs);
    expect(sequence.name).toEqual(name);
  });

  it("should take an optional options parameter in its constructor", () => {
    const options = { "aria-label": "sequence" };
    const newSequence = new Sequence(from, to, exprs, name, options);
    expect(newSequence.options).toEqual(options);
  });
});

describe("The FunctionApp Class", () => {
  let expression: FunctionApp;
  let func: Literal;
  let args: Literal[];
  let nestedExpression: FunctionApp;
  let ast: AST.AST;
  beforeEach(() => {
    func = new Literal({ line: 1, ch: 1 }, { line: 1, ch: 2 }, "+", "symbol");
    args = [
      new Literal({ line: 1, ch: 3 }, { line: 1, ch: 5 }, 11),
      new Literal({ line: 1, ch: 6 }, { line: 0, ch: 8 }, 22),
    ];
    // (+ 11 22)
    expression = new FunctionApp(
      { line: 1, ch: 0 },
      { line: 1, ch: 9 },
      func,
      args,
      { "aria-label": "+ expression" }
    );
    // (+ 11 (- 15 35))
    nestedExpression = new FunctionApp(
      { line: 1, ch: 0 },
      { line: 1, ch: 9 },
      new Literal({ line: 1, ch: 1 }, { line: 1, ch: 2 }, "+", "symbol"),
      [
        new Literal({ line: 1, ch: 3 }, { line: 1, ch: 5 }, 11),
        new FunctionApp(
          { line: 1, ch: 0 },
          { line: 1, ch: 9 },
          new Literal({ line: 1, ch: 1 }, { line: 1, ch: 2 }, "-", "symbol"),
          [
            new Literal({ line: 1, ch: 3 }, { line: 1, ch: 5 }, 15),
            new Literal({ line: 1, ch: 3 }, { line: 1, ch: 5 }, 35),
          ]
        ),
      ]
    );
    // build the AST, thereby assigning parent/child/sibling relationships
    ast = new AST.AST([expression]);
  });

  it("should take a function name and list of args in its constructor", () => {
    expect(expression.args).toBe(args);
    expect(expression.func).toBe(func);
    expect(expression.options).toEqual({ "aria-label": "+ expression" });
  });

  it("should return itself and its descendants when iterated over", () => {
    expect([...nestedExpression.descendants()]).toEqual([
      nestedExpression,
      nestedExpression.func,
      nestedExpression.args[0],
      ...nestedExpression.args[1].descendants(),
    ]);
  });

  it("should have all navigation pointers and aria attributes set", () => {
    expect(expression.next).toEqual(expression.func);
    expect(ast.getNodeParent(expression.func)).toEqual(expression);
    expect(ast.getNodeAfter(expression.func)).toEqual(expression.args[0]);
    expect(ast.getNodeParent(expression.args[0])).toEqual(expression);
    expect(ast.getNodeBefore(expression.args[0])).toEqual(expression.func);
    expect(ast.getNodeAfter(expression.args[0])).toEqual(expression.args[1]);
    expect(ast.getNodeParent(expression.args[1])).toEqual(expression);
    expect(ast.getNodeBefore(expression.args[1])).toEqual(expression.args[0]);
    expect(ast.getNodeAfter(expression.args[1])).toBeNull();
  });
});

describe("The AST Class", () => {
  it("should take a set of root nodes in its constructor", () => {
    const nodes = [new Literal({ line: 0, ch: 0 }, { line: 0, ch: 2 }, 11)];
    const ast = new AST.AST(nodes);
    expect(ast.rootNodes).toBe(nodes);
  });

  it("should add every node to a node map for quick lookup", () => {
    const nodes = [
      new Literal({ line: 0, ch: 0 }, { line: 0, ch: 2 }, 11),
      new FunctionApp(
        { line: 1, ch: 0 },
        { line: 1, ch: 9 },
        new Literal({ line: 1, ch: 1 }, { line: 1, ch: 2 }, "+", "symbol"),
        [
          new Literal({ line: 1, ch: 3 }, { line: 1, ch: 5 }, 11),
          new Literal({ line: 1, ch: 6 }, { line: 0, ch: 8 }, 22),
        ]
      ),
    ] as [Literal, FunctionApp];
    const ast = new AST.AST(nodes);
    expect(ast.nodeIdMap.get(nodes[0].id)).toBe(nodes[0]);
    expect(ast.nodeIdMap.get(nodes[1].id)).toBe(nodes[1]);
    expect(ast.nodeIdMap.get(nodes[1].args[0].id)).toBe(nodes[1].args[0]);
    expect(ast.nodeIdMap.get(nodes[1].args[1].id)).toBe(nodes[1].args[1]);
  });

  it("idential subtrees should have the same hash", () => {
    const nodes1 = [
      new Literal({ line: 0, ch: 0 }, { line: 0, ch: 2 }, 11),
      new FunctionApp(
        { line: 1, ch: 0 },
        { line: 1, ch: 9 },
        new Literal({ line: 1, ch: 1 }, { line: 1, ch: 2 }, "+", "symbol"),
        [
          new Literal({ line: 1, ch: 3 }, { line: 1, ch: 5 }, 11),
          new Literal({ line: 1, ch: 6 }, { line: 1, ch: 8 }, 22),
        ]
      ),
    ];
    const nodes2 = [
      new Literal({ line: 1, ch: 0 }, { line: 1, ch: 2 }, 11),
      new FunctionApp(
        { line: 2, ch: 0 },
        { line: 2, ch: 9 },
        new Literal({ line: 2, ch: 1 }, { line: 2, ch: 2 }, "+", "symbol"),
        [
          new Literal({ line: 2, ch: 3 }, { line: 2, ch: 5 }, 11),
          new Literal({ line: 2, ch: 6 }, { line: 2, ch: 8 }, 22),
        ]
      ),
    ];
    const ast1 = new AST.AST(nodes1);
    const ast2 = new AST.AST(nodes2);
    expect(ast1.rootNodes[0].hash).toBe(ast2.rootNodes[0].hash);
  });

  it("idential subtrees with different comments should have different hashes", () => {
    const nodes1 = [
      new Literal({ line: 0, ch: 0 }, { line: 0, ch: 2 }, 11, "Number", {
        comment: new Comment({ line: 0, ch: 4 }, { line: 0, ch: 7 }, "moo"),
      }),
      new FunctionApp(
        { line: 1, ch: 0 },
        { line: 1, ch: 9 },
        new Literal({ line: 1, ch: 1 }, { line: 1, ch: 2 }, "+", "symbol"),
        [
          new Literal({ line: 1, ch: 3 }, { line: 1, ch: 5 }, 11),
          new Literal({ line: 1, ch: 6 }, { line: 1, ch: 8 }, 22),
        ]
      ),
    ];
    const nodes2 = [
      new Literal({ line: 1, ch: 0 }, { line: 1, ch: 2 }, 11),
      new FunctionApp(
        { line: 2, ch: 0 },
        { line: 2, ch: 9 },
        new Literal({ line: 2, ch: 1 }, { line: 2, ch: 2 }, "+", "symbol"),
        [
          new Literal({ line: 2, ch: 3 }, { line: 2, ch: 5 }, 11),
          new Literal({ line: 2, ch: 6 }, { line: 2, ch: 8 }, 22),
        ]
      ),
    ];
    const ast1 = new AST.AST(nodes1);
    const ast2 = new AST.AST(nodes2);
    expect(ast1.rootNodes[0].hash).not.toBe(ast2.rootNodes[0].hash);
  });
});
