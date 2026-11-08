import example from "@bootstrapworld/example";
import lambda from "@bootstrapworld/lambda";
import routine from "@bootstrapworld/routine";
import wescheme from "@bootstrapworld/wescheme";
import type { Language } from "../src/languages";
import { commentProblems } from "../src/toolkit/comment-conformance";

/** Each of our languages handles its comments, in the awkward places too */
const scheme = (language: Language, f: string) => ({
  language,
  programs: [
    `@@\n${f}`,
    `${f}\n@@`,
    `${f} @@\n(${f.slice(1)}`,
    `@@\n${f}\n\n@@\n\n${f} @@\n@@`,
    `(@@ ${f.slice(1)}`,
    `@@\n@@\n${f}`,
  ],
  comment: (text: string) => `; ${text}\n`,
});

describe("commentProblems", () => {
  it.each([
    ["WeScheme", scheme(wescheme, "(f 1)")],
    ["example", scheme(example, "(f 1)")],
    ["Routine", scheme(routine, "(show 1)")],
  ])("finds nothing wrong with %s", (_name, { language, ...check }) => {
    expect(commentProblems(language, check)).toEqual([]);
  });

  it("finds nothing wrong with lambda", () => {
    expect(
      commentProblems(lambda, {
        comment: (text) => `# ${text}\n`,
        programs: [
          "@@\na = 1;",
          "a = 1;\n@@",
          "a = 1; @@\nb = 2;",
          "@@\n@@\na = 1;",
        ],
      })
    ).toEqual([]);
  });

  it("says what is wrong with a parser that loses a comment", () => {
    const losing = {
      ...wescheme,
      buildAST: (code: string) =>
        wescheme.buildAST(code.replace(/;[^\n]*/g, "")),
    } as Language;
    expect(
      commentProblems(losing, {
        comment: (text) => `; ${text}\n`,
        programs: ["@@\n(f 1)"],
      })[0]
    ).toMatch(/printed 0 times/);
  });
});
