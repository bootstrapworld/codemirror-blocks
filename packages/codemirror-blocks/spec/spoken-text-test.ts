import * as fs from "fs";
import * as path from "path";
import wescheme from "@bootstrapworld/cmb-wescheme";
import lambda from "@bootstrapworld/cmb-lambda";
import { ASTNode } from "../src/ast";
import { spokenLabel } from "../src/components/Node";
import { summarizeProgram } from "../src/summary";
import { computeAccessibleName } from "dom-accessibility-api";
import { mountCMB, teardown } from "../src/toolkit/test-utils";

/**
 * The words a screen reader says are chosen with care, so any change to them
 * has to be seen and decided on. This writes down what every block of a few
 * programs says (its label, and its longer description) and compares it with
 * `spoken-text.golden.txt`. When a change is meant, look at the diff, and then
 * rewrite the file:
 *
 *   UPDATE_GOLDEN=1 npx jest spoken-text
 */
const GOLDEN = path.join(__dirname, "spoken-text.golden.txt");

const programs: [
  string,
  { parse(code: string): unknown },
  string | string[],
][] = [
  [
    "wescheme: definitions, functions and conditionals",
    wescheme,
    [
      "(define x 5)",
      "(define (area w h) (* w h))",
      "(define-struct pt (x y))",
      "(define sq (lambda (n) (* n n)))",
      '(if (> x 3) "big" "small")',
      "(cond [(< x 0) 'neg] [(= x 0) 'zero] [else 'pos])",
      "(let ([a 1] [b 2]) (+ a b))",
      "(let loop ([i 0]) (if (< i 3) (loop (+ i 1)) i))",
      "(begin (f 1) (g 2))",
      "(and (> x 1) (or (< x 9) #t))",
      "(area 3 4)",
    ].join("\n"),
  ],
  [
    "wescheme: comments that go with a node, and comments that don't",
    wescheme,
    [
      "#| about f |#",
      "(define (f x) x)",
      "",
      "#| on its own |#",
      "",
      "(f 1) ; after the call",
      "; above g",
      "(g 2)",
      "(+ 1 ; between",
      " 2)",
    ].join("\n"),
  ],
  [
    "lambda: expressions",
    lambda,
    [
      "123.5",
      '"Hello World!"',
      "foo(a, 1)",
      "lambda (x) 10",
      "if foo then bar else baz",
      "x + y * z",
      "a = 5;",
      "let (a = 10, b = a * 10) {a + b;}",
      "let loop (a = 1) a + 1",
      "!foo",
      "-3",
    ],
  ],
  [
    "lambda: comments",
    lambda,
    [
      "# about f\nf(x)",
      "# on its own\n\nf(x)",
      "f(1, 2) # after",
      "f(1, # between\n 2)",
    ],
  ],
];

function lines(parse: { parse(code: string): unknown }, code: string) {
  const out: string[] = [];
  const roots = parse.parse(code) as unknown as ASTNode[];
  const walk = (node: ASTNode) => {
    const pad = "  ".repeat(Math.max(node.level - 1, 0));
    const label = spokenLabel(node);
    const long = node.describe(0);
    out.push(`${pad}${node.type}: ${label}`);
    if (long && long !== node.shortDescription()) {
      out.push(`${pad}  long: ${long}`);
    }
    for (const child of node.children()) walk(child);
  };
  roots.forEach(walk);
  const summary = summarizeProgram(
    roots as Parameters<typeof summarizeProgram>[0]
  );
  if (summary) out.push(`summary: ${summary}`);
  return out;
}

describe("what a screen reader says", () => {
  it("is what spoken-text.golden.txt says", () => {
    const text =
      programs
        .map(([title, language, code]) =>
          [
            `## ${title}`,
            ...[code].flat().flatMap((c) => [...lines(language, c), ""]),
          ]
            .join("\n")
            .trimEnd()
        )
        .join("\n\n") + "\n";
    if (process.env.UPDATE_GOLDEN) {
      fs.writeFileSync(GOLDEN, text);
    }
    expect(text).toBe(fs.readFileSync(GOLDEN, "utf8"));
  });
});

describe("the name a browser computes for a block with a comment", () => {
  afterEach(teardown);
  it("has the comment once, after the label, as spokenLabel says", () => {
    const { cmb } = mountCMB(wescheme);
    cmb.setValue("; hello there\n(f x)");
    const el = document.querySelector<HTMLElement>("[role=treeitem]")!;
    const node = cmb.getAst().rootNodes[0];
    const name = computeAccessibleName(el)
      .replace(/\s+/g, " ")
      .replace(/ ,/g, ",");
    expect(name).toBe(spokenLabel(node));
    expect(name.split("hello there")).toHaveLength(2);
  });
});
