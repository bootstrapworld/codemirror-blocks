import { AST, ASTNode } from "../src/ast";
import example from "../src/languages/example";
import lambda from "../src/languages/lambda";
import routine from "../src/languages/routine";
import wescheme from "../src/languages/wescheme";
import { addLanguage } from "../src/languages";
import type { Language } from "../src/languages";
import type { CommentRules } from "../src/commentRules";
import { Literal } from "../src/nodes";
import { attachComments } from "../src/orphans";

/**
 * Every language pairs its comments with its nodes by the same rules (see
 * `commentRules.ts`): the same program, written in each, gives the same answer.
 * A statement is `+` if a comment goes with it, `*` if it is a comment that
 * stands alone, and `-` if it has none.
 */
type Lang = {
  name: string;
  language: Language;
  /** a comment, as the language writes one on a line of its own */
  comment: string;
  /** two statements, and what ends the first (`;` in lambda) */
  a: string;
  b: string;
  end: string;
};
const langs: Lang[] = [
  {
    name: "WeScheme",
    language: wescheme,
    comment: "; note",
    a: "(f 1)",
    b: "(g 2)",
    end: "",
  },
  {
    name: "lambda",
    language: lambda,
    comment: "# note",
    a: "a = 1",
    b: "b = 2",
    end: ";",
  },
  {
    name: "Routine",
    language: routine,
    comment: "; note",
    a: "(show 1)",
    b: "(show 2)",
    end: "",
  },
  {
    name: "example",
    language: example,
    comment: "; note",
    a: "(f 1)",
    b: "(g 2)",
    end: "",
  },
];

/** The statements of a program (lambda has them in a program node) */
const statements = (ast: AST) => {
  const [first] = ast.rootNodes;
  return first?.type === "prog"
    ? [...(first.fields.exprs as ASTNode[])]
    : ast.rootNodes;
};
const pattern = (ast: AST) =>
  statements(ast)
    .map((n) => (n.options.orphan ? "*" : n.options.comment ? "+" : "-"))
    .join("");

describe.each(langs)(
  "comments in $name",
  ({ language, comment, a, b, end }) => {
    // (the cases are written once: A and B are the statements, C the comment, and
    // S what ends the first statement, as the language writes them)
    const make = (template: string) =>
      template.replace(
        /[ABCS]/g,
        (ch) => ({ A: a, B: b, C: comment, S: end })[ch as "A"]
      );
    const cases: [string, string, string][] = [
      ["a comment on the line above goes with the node", "C\nAS\nB", "+-"],
      ["one after code on its line goes with that code", "AS C\nB", "+-"],
      ["one with a blank line below it stands alone", "C\n\nAS\nB", "*--"],
      ["one at the end goes with the last node", "AS\nB\nC", "-+"],
      [
        "one at the end with a blank line above stands alone",
        "AS\nB\n\nC",
        "--*",
      ],
      [
        "one between, with blank lines on both sides, stands alone",
        "AS\n\nC\n\nB",
        "-*-",
      ],
    ];
    it.each(cases)("%s", (_name, template, expected) => {
      const code = make(template);
      expect([code, pattern(language.buildAST(code))]).toEqual([
        code,
        expected,
      ]);
    });
  }
);

describe("the commentRules of a language", () => {
  // (a language of words, with `// comments`, that pairs them by the rules it is
  // given: its parse does nothing about them but call attachComments)
  const BLOCK = { open: "/*", close: "*/" };
  let count = 0;
  const wordsLanguage = (commentRules?: Partial<CommentRules>) =>
    addLanguage({
      id: `words-${count++}`,
      name: "words",
      blockComment: BLOCK,
      commentRules,
      parse: (code: string) => {
        const roots = code
          .split("\n")
          .flatMap((text, line) =>
            [
              ...text
                .replace(/\/\/.*/, (c) => " ".repeat(c.length))
                .matchAll(/\S+/g),
            ].map((m) =>
              Literal(
                { line, ch: m.index! },
                { line, ch: m.index! + m[0].length },
                { value: m[0], dataType: "symbol" }
              )
            )
          );
        return attachComments(code, roots, {
          blockComment: BLOCK,
          syntax: { line: "//" },
        });
      },
    });
  const code = "a // note\nb";

  it("is the default of every language if it has none", () => {
    const ast = wordsLanguage().buildAST(code);
    expect(pattern(ast)).toBe("+-");
    expect(ast.toString()).toBe("a /* note */\nb");
  });

  it("changes how the comments of the language are paired", () => {
    const ast = wordsLanguage({ afterCode: "alone" }).buildAST(code);
    expect(pattern(ast)).toBe("-*-");
    expect(ast.toString()).toBe("a\n/* note */\n\nb");
  });

  it("changes how a comment that comes after its node is printed", () => {
    const ast = wordsLanguage({ printAfter: "above" }).buildAST(code);
    expect(pattern(ast)).toBe("+-");
    expect(ast.toString()).toBe("/* note */\na\nb");
  });

  it("changes only what it says, and not another language", () => {
    wordsLanguage({ afterCode: "alone", printAfter: "above" });
    expect(pattern(wordsLanguage().buildAST(code))).toBe("+-");
  });

  it("is not what an attachComments call that has rules of its own is given", () => {
    const own = addLanguage({
      id: `words-${count++}`,
      name: "own",
      blockComment: BLOCK,
      commentRules: { afterCode: "alone" },
      parse: (c: string) =>
        attachComments(
          c,
          [
            Literal(
              { line: 0, ch: 0 },
              { line: 0, ch: 1 },
              { value: "a", dataType: "symbol" }
            ),
          ],
          {
            blockComment: BLOCK,
            syntax: { line: "//" },
            rules: { afterCode: "previous" },
          }
        ),
    });
    expect(pattern(own.buildAST("a // note"))).toBe("+");
  });
});
