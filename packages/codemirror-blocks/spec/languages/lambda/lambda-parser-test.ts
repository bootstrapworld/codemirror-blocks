import { parseToIntermediateAST } from "../../../src/languages/lambda/parser";

const testData: { input: string; output: any }[] = [
  {
    input: "123.5",
    output: {
      from: { line: 0, ch: 0 },
      to: { line: 0, ch: 5 },
      type: "num",
      value: 123.5,
    },
  },
  {
    input: `"Hello World!"`,
    output: {
      from: { line: 0, ch: 0 },
      to: { line: 0, ch: 14 },
      type: "str",
      value: "Hello World!",
    },
  },
  {
    input: "true",
    output: {
      from: { line: 0, ch: 0 },
      to: { line: 0, ch: 4 },
      type: "bool",
      value: true,
    },
  },
  {
    input: "false",
    output: {
      from: { line: 0, ch: 0 },
      to: { line: 0, ch: 5 },
      type: "bool",
      value: false,
    },
  },
  {
    input: "foo",
    output: {
      from: { line: 0, ch: 0 },
      to: { line: 0, ch: 3 },
      type: "var",
      value: "foo",
    },
  },
  {
    input: "lambda (x) 10",
    output: {
      from: { line: 0, ch: 0 },
      to: { line: 0, ch: 13 },
      type: "lambda",
      name: null,
      vars: [
        {
          from: {
            line: 0,
            ch: 8,
          },
          to: {
            line: 0,
            ch: 9,
          },
          type: "literal",
          dataType: "var",
          name: {
            from: {
              line: 0,
              ch: 8,
            },
            to: {
              line: 0,
              ch: 9,
            },
            type: "var",
            value: "x",
          },
        },
      ],
      body: {
        from: { line: 0, ch: 11 },
        to: { line: 0, ch: 13 },
        type: "num",
        value: 10,
      },
    },
  },
  {
    input: "foo(a, 1)",
    output: {
      from: { line: 0, ch: 0 },
      to: { line: 0, ch: 8 },
      type: "call",
      func: {
        from: { line: 0, ch: 0 },
        to: { line: 0, ch: 3 },
        type: "var",
        value: "foo",
      },
      args: [
        {
          from: { line: 0, ch: 4 },
          to: { line: 0, ch: 5 },
          type: "var",
          value: "a",
        },
        {
          from: { line: 0, ch: 7 },
          to: { line: 0, ch: 8 },
          type: "num",
          value: 1,
        },
      ],
    },
  },
  {
    input: "if foo then bar else baz",
    output: {
      from: { line: 0, ch: 0 },
      to: { line: 0, ch: 24 },
      type: "if",
      cond: {
        from: { line: 0, ch: 3 },
        to: { line: 0, ch: 6 },
        type: "var",
        value: "foo",
      },
      then: {
        from: { line: 0, ch: 12 },
        to: { line: 0, ch: 15 },
        type: "var",
        value: "bar",
      },
      else: {
        from: { line: 0, ch: 21 },
        to: { line: 0, ch: 24 },
        type: "var",
        value: "baz",
      },
    },
  },
  {
    input: "if foo then bar",
    output: {
      from: { line: 0, ch: 0 },
      to: { line: 0, ch: 15 },
      type: "if",
      cond: {
        from: { line: 0, ch: 3 },
        to: { line: 0, ch: 6 },
        type: "var",
        value: "foo",
      },
      then: {
        from: { line: 0, ch: 12 },
        to: { line: 0, ch: 15 },
        type: "var",
        value: "bar",
      },
    },
  },
  {
    input: "a = 10",
    output: {
      from: { line: 0, ch: 0 },
      to: { line: 0, ch: 6 },
      type: "assign",
      operator: "=",
      left: {
        from: { line: 0, ch: 0 },
        to: { line: 0, ch: 1 },
        type: "var",
        value: "a",
      },
      right: {
        from: { line: 0, ch: 4 },
        to: { line: 0, ch: 6 },
        type: "num",
        value: 10,
      },
    },
  },
  {
    input: "x + y * z",
    output: {
      from: { line: 0, ch: 0 },
      to: { line: 0, ch: 9 },
      type: "binary",
      operator: "+",
      left: {
        from: { line: 0, ch: 0 },
        to: { line: 0, ch: 1 },
        type: "var",
        value: "x",
      },
      right: {
        from: { line: 0, ch: 2 },
        to: { line: 0, ch: 9 },
        type: "binary",
        operator: "*",
        left: {
          from: { line: 0, ch: 4 },
          to: { line: 0, ch: 5 },
          type: "var",
          value: "y",
        },
        right: {
          from: { line: 0, ch: 8 },
          to: { line: 0, ch: 9 },
          type: "var",
          value: "z",
        },
      },
    },
  },
  {
    input: `a = 5;
b = a * 2;
a + b;`,
    output: [
      {
        from: { line: 0, ch: 0 },
        to: { line: 0, ch: 5 },
        type: "assign",
        operator: "=",
        left: {
          from: { line: 0, ch: 0 },
          to: { line: 0, ch: 1 },
          type: "var",
          value: "a",
        },
        right: {
          from: { line: 0, ch: 4 },
          to: { line: 0, ch: 5 },
          type: "num",
          value: 5,
        },
      },
      {
        from: { line: 1, ch: 0 },
        to: { line: 1, ch: 9 },
        type: "assign",
        operator: "=",
        left: {
          from: { line: 1, ch: 0 },
          to: { line: 1, ch: 1 },
          type: "var",
          value: "b",
        },
        right: {
          from: { line: 1, ch: 2 },
          to: { line: 1, ch: 9 },
          type: "binary",
          operator: "*",
          left: {
            from: { line: 1, ch: 4 },
            to: { line: 1, ch: 5 },
            type: "var",
            value: "a",
          },
          right: {
            from: { line: 1, ch: 8 },
            to: { line: 1, ch: 9 },
            type: "num",
            value: 2,
          },
        },
      },
      {
        from: { line: 2, ch: 0 },
        to: { line: 2, ch: 5 },
        type: "binary",
        operator: "+",
        left: {
          from: { line: 2, ch: 0 },
          to: { line: 2, ch: 1 },
          type: "var",
          value: "a",
        },
        right: {
          from: { line: 2, ch: 4 },
          to: { line: 2, ch: 5 },
          type: "var",
          value: "b",
        },
      },
    ],
  },
  {
    input: `let (a = 10, b = a * 10) {a + b;}`,
    output: {
      from: { line: 0, ch: 0 },
      to: { line: 0, ch: 23 },
      type: "let",
      vars: [
        {
          from: { line: 0, ch: 7 },
          to: { line: 0, ch: 11 },
          name: "a",
          def: {
            from: { line: 0, ch: 5 },
            to: { line: 0, ch: 6 },
            type: "num",
            value: 10,
          },
        },
        {
          from: { line: 0, ch: 5 },
          to: { line: 0, ch: 6 },
          name: "b",
          def: {
            from: { line: 0, ch: 15 },
            to: { line: 0, ch: 23 },
            type: "binary",
            operator: "*",
            left: {
              from: { line: 0, ch: 17 },
              to: { line: 0, ch: 18 },
              type: "var",
              value: "a",
            },
            right: {
              from: { line: 0, ch: 21 },
              to: { line: 0, ch: 23 },
              type: "num",
              value: 10,
            },
          },
        },
      ],
      body: {
        from: { line: 0, ch: 26 },
        to: { line: 0, ch: 31 },
        type: "binary",
        operator: "+",
        left: {
          from: { line: 0, ch: 26 },
          to: { line: 0, ch: 27 },
          type: "var",
          value: "a",
        },
        right: {
          from: { line: 0, ch: 30 },
          to: { line: 0, ch: 31 },
          type: "var",
          value: "b",
        },
      },
    },
  },
];

describe("lambda parser test suite", () => {
  testData.slice(0, 12).forEach((data) => {
    it("testing" + " " + data.input, () => {
      let prog = parseToIntermediateAST(data.input).prog;
      if (prog.length == 1) {
        prog = prog[0];
      }
      expect(prog).toEqual(data.output);
    });
  });
});

describe("the extent of a let", () => {
  it("reaches the end of its body", () => {
    const { prog } = parseToIntermediateAST("let (a = 1, b = 2) a + b");
    expect(prog[0].to).toEqual({ line: 0, ch: 24 });
  });
  it("starts each binding at its name", () => {
    const { prog } = parseToIntermediateAST("let (a = 1, zzz, b = 2) a + b");
    expect(prog[0].vars.map((v: any) => [v.from.ch, v.to.ch])).toEqual([
      [5, 10],
      [12, 15],
      [17, 22],
    ]);
  });
  it("reaches the end of the body of a named let", () => {
    const { prog } = parseToIntermediateAST("let loop (a = 1) a + 1");
    expect(prog[0].to).toEqual({ line: 0, ch: 22 });
  });
});

describe("the extent of a not", () => {
  it("covers the ! and its operand", () => {
    const { prog } = parseToIntermediateAST("!x");
    expect(prog[0].from).toEqual({ line: 0, ch: 0 });
    expect(prog[0].to).toEqual({ line: 0, ch: 2 });
  });
});

describe("the extent of an if", () => {
  it("reaches the end of its else branch", () => {
    const { prog } = parseToIntermediateAST("if a then b else c");
    expect(prog[0].to).toEqual({ line: 0, ch: 18 });
  });
});
