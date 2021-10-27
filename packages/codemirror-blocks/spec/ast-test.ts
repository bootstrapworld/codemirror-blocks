import CodeMirror from "codemirror";
import { AST, NodeRef } from "../src/ast";
import {
  FunctionApp,
  Literal,
  Sequence,
  Comment,
  FunctionAppNode,
  LiteralNode,
  SequenceNode,
} from "../src/nodes";

describe("The Literal Class", () => {
  it("should be constructed with a value and data type", () => {
    const from = { line: 0, ch: 0 };
    const to = { line: 0, ch: 2 };
    const literal = Literal(from, to, "11", "number");
    expect(literal.from).toBe(from);
    expect(literal.to).toBe(to);
    expect(literal.fields.value).toBe("11");
    expect(literal.fields.dataType).toBe("number");
    expect(literal.options).toEqual({});
  });

  it("should set a default data type of unknown if one isn't provided", () => {
    const literal = Literal({ line: 0, ch: 0 }, { line: 0, ch: 2 }, "11");
    expect(literal.fields.dataType).toBe("unknown");
  });

  it("should take an optional options parameter in its constructor", () => {
    const literal = Literal(
      { line: 0, ch: 0 },
      { line: 0, ch: 2 },
      "11",
      "number",
      { "aria-label": "11" }
    );
    expect(literal.options).toEqual({ "aria-label": "11" });
  });
});

describe("The Sequence Class", () => {
  let sequence: SequenceNode;
  let expression1: FunctionAppNode;
  let expression2: FunctionAppNode;
  let from: CodeMirror.Position;
  let to: CodeMirror.Position;
  let name: LiteralNode;
  let exprs: FunctionAppNode[];

  beforeEach(() => {
    // (+ 1 2)
    const func1 = Literal(
      { line: 0, ch: 8 },
      { line: 0, ch: 9 },
      "+",
      "symbol"
    );
    const args1 = [
      Literal({ line: 0, ch: 10 }, { line: 0, ch: 11 }, "1"),
      Literal({ line: 0, ch: 12 }, { line: 0, ch: 13 }, "2"),
    ];
    expression1 = FunctionApp(
      { line: 0, ch: 7 },
      { line: 0, ch: 14 },
      func1,
      args1,
      { "aria-label": "+ expression" }
    );

    // (- 2 3)
    const func2 = Literal(
      { line: 0, ch: 16 },
      { line: 0, ch: 17 },
      "-",
      "symbol"
    );
    const args2 = [
      Literal({ line: 0, ch: 18 }, { line: 0, ch: 19 }, "2"),
      Literal({ line: 0, ch: 20 }, { line: 0, ch: 21 }, "3"),
    ];
    expression2 = FunctionApp(
      { line: 0, ch: 15 },
      { line: 0, ch: 22 },
      func2,
      args2,
      { "aria-label": "+ expression" }
    );

    // (begin (+ 1 2) (- 2 3))
    from = { line: 0, ch: 0 };
    to = { line: 0, ch: 23 };
    name = Literal({ line: 0, ch: 1 }, { line: 0, ch: 6 }, "begin", "symbol");
    exprs = [expression1, expression2];
    sequence = Sequence(from, to, exprs, name);
  });

  it("should be constructed with a list of expressions", () => {
    expect(sequence.from).toBe(from);
    expect(sequence.to).toBe(to);
    expect(sequence.fields.exprs).toBe(exprs);
    expect(sequence.fields.name).toEqual(name);
  });

  it("should take an optional options parameter in its constructor", () => {
    const options = { "aria-label": "sequence" };
    const newSequence = Sequence(from, to, exprs, name, options);
    expect(newSequence.options).toEqual(options);
  });
});

describe("The FunctionApp Class", () => {
  let expression: FunctionAppNode;
  let expressionRef: NodeRef<FunctionAppNode>;
  let func: LiteralNode;
  let args: LiteralNode[];
  let ast: AST;
  beforeEach(() => {
    func = Literal({ line: 1, ch: 1 }, { line: 1, ch: 2 }, "+", "symbol");
    args = [
      Literal({ line: 1, ch: 3 }, { line: 1, ch: 5 }, "11"),
      Literal({ line: 1, ch: 6 }, { line: 0, ch: 8 }, "22"),
    ];
    // (+ 11 22)
    expression = FunctionApp(
      { line: 1, ch: 0 },
      { line: 1, ch: 9 },
      func,
      args,
      { "aria-label": "+ expression" }
    );
    // build the AST, thereby assigning parent/child/sibling relationships
    ast = new AST([expression]);
    expressionRef = ast.children()[0] as NodeRef<FunctionAppNode>;
  });

  it("should take a function name and list of args in its constructor", () => {
    expect(expression.fields.args).toBe(args);
    expect(expression.fields.func).toBe(func);
    expect(expression.options).toEqual({ "aria-label": "+ expression" });
  });

  it("should return itself and its descendants when iterated over", () => {
    // (+ 11 (- 15 35))
    const nestedExpression = FunctionApp(
      { line: 1, ch: 0 },
      { line: 1, ch: 9 },
      Literal({ line: 1, ch: 1 }, { line: 1, ch: 2 }, "+", "symbol"),
      [
        Literal({ line: 1, ch: 3 }, { line: 1, ch: 5 }, "11"),
        FunctionApp(
          { line: 1, ch: 0 },
          { line: 1, ch: 9 },
          Literal({ line: 1, ch: 1 }, { line: 1, ch: 2 }, "-", "symbol"),
          [
            Literal({ line: 1, ch: 3 }, { line: 1, ch: 5 }, "15"),
            Literal({ line: 1, ch: 3 }, { line: 1, ch: 5 }, "35"),
          ]
        ),
      ]
    );
    const ast = new AST([nestedExpression]);
    expect(
      [...ast.refFor(nestedExpression).descendants()].map((ref) => ref.node)
    ).toEqual([
      nestedExpression,
      nestedExpression.fields.func,
      nestedExpression.fields.args[0],
      ...[...ast.refFor(nestedExpression.fields.args[1]).descendants()].map(
        (ref) => ref.node
      ),
    ]);
  });

  it("should have all navigation pointers and aria attributes set", () => {
    expect(expressionRef.next?.node).toEqual(expression.fields.func);
    expect(ast.refFor(expression.fields.func).parent?.node).toEqual(expression);
    expect(ast.refFor(expression.fields.func).next?.node).toEqual(
      expression.fields.args[0]
    );
    expect(ast.refFor(expression.fields.args[0]).parent?.node).toEqual(
      expression
    );
    expect(ast.refFor(expression.fields.args[0]).prev?.node).toEqual(
      expression.fields.func
    );
    expect(ast.refFor(expression.fields.args[0]).next?.node).toEqual(
      expression.fields.args[1]
    );
    expect(ast.refFor(expression.fields.args[1]).parent?.node).toEqual(
      expression
    );
    expect(ast.refFor(expression.fields.args[1]).prev?.node).toEqual(
      expression.fields.args[0]
    );
    expect(ast.refFor(expression.fields.args[1]).next).toBeNull();
  });
});

describe("The AST Class", () => {
  it("should take a set of root nodes in its constructor", () => {
    const nodes = [Literal({ line: 0, ch: 0 }, { line: 0, ch: 2 }, "11")];
    const ast = new AST(nodes);
    expect(ast.rootNodes).toBe(nodes);
  });

  it("should add every node to a node map for quick lookup", () => {
    const nodes = [
      Literal({ line: 0, ch: 0 }, { line: 0, ch: 2 }, "11"),
      FunctionApp(
        { line: 1, ch: 0 },
        { line: 1, ch: 9 },
        Literal({ line: 1, ch: 1 }, { line: 1, ch: 2 }, "+", "symbol"),
        [
          Literal({ line: 1, ch: 3 }, { line: 1, ch: 5 }, "11"),
          Literal({ line: 1, ch: 6 }, { line: 0, ch: 8 }, "22"),
        ]
      ),
    ] as [LiteralNode, FunctionAppNode];
    const ast = new AST(nodes);
    expect(ast.getNodeById(nodes[0].id)).toBe(nodes[0]);
    expect(ast.getNodeById(nodes[1].id)).toBe(nodes[1]);
    expect(ast.getNodeById(nodes[1].fields.args[0].id)).toBe(
      nodes[1].fields.args[0]
    );
    expect(ast.getNodeById(nodes[1].fields.args[1].id)).toBe(
      nodes[1].fields.args[1]
    );
  });

  it("idential subtrees should have the same hash", () => {
    const nodes1 = [
      Literal({ line: 0, ch: 0 }, { line: 0, ch: 2 }, "11"),
      FunctionApp(
        { line: 1, ch: 0 },
        { line: 1, ch: 9 },
        Literal({ line: 1, ch: 1 }, { line: 1, ch: 2 }, "+", "symbol"),
        [
          Literal({ line: 1, ch: 3 }, { line: 1, ch: 5 }, "11"),
          Literal({ line: 1, ch: 6 }, { line: 1, ch: 8 }, "22"),
        ]
      ),
    ];
    const nodes2 = [
      Literal({ line: 1, ch: 0 }, { line: 1, ch: 2 }, "11"),
      FunctionApp(
        { line: 2, ch: 0 },
        { line: 2, ch: 9 },
        Literal({ line: 2, ch: 1 }, { line: 2, ch: 2 }, "+", "symbol"),
        [
          Literal({ line: 2, ch: 3 }, { line: 2, ch: 5 }, "11"),
          Literal({ line: 2, ch: 6 }, { line: 2, ch: 8 }, "22"),
        ]
      ),
    ];
    const ast1 = new AST(nodes1);
    const ast2 = new AST(nodes2);
    expect(ast1.rootNodes[0].hash).toBe(ast2.rootNodes[0].hash);
  });

  it("idential subtrees with different comments should have different hashes", () => {
    const nodes1 = [
      Literal({ line: 0, ch: 0 }, { line: 0, ch: 2 }, "11", "Number", {
        comment: Comment({ line: 0, ch: 4 }, { line: 0, ch: 7 }, "moo"),
      }),
      FunctionApp(
        { line: 1, ch: 0 },
        { line: 1, ch: 9 },
        Literal({ line: 1, ch: 1 }, { line: 1, ch: 2 }, "+", "symbol"),
        [
          Literal({ line: 1, ch: 3 }, { line: 1, ch: 5 }, "11"),
          Literal({ line: 1, ch: 6 }, { line: 1, ch: 8 }, "22"),
        ]
      ),
    ];
    const nodes2 = [
      Literal({ line: 1, ch: 0 }, { line: 1, ch: 2 }, "11"),
      FunctionApp(
        { line: 2, ch: 0 },
        { line: 2, ch: 9 },
        Literal({ line: 2, ch: 1 }, { line: 2, ch: 2 }, "+", "symbol"),
        [
          Literal({ line: 2, ch: 3 }, { line: 2, ch: 5 }, "11"),
          Literal({ line: 2, ch: 6 }, { line: 2, ch: 8 }, "22"),
        ]
      ),
    ];
    const ast1 = new AST(nodes1);
    const ast2 = new AST(nodes2);
    expect(ast1.rootNodes[0].hash).not.toBe(ast2.rootNodes[0].hash);
  });
});
