import type { Language } from "../languages";

/*
 * A language's parser has to handle its comments: read every one it skips and
 * report it to `attachComments` (see `doc/language.md`). This checks that it
 * does, for a set of programs that have comments in the places that are
 * awkward: it returns what is wrong, so that a language can test itself:
 *
 *   expect(
 *     commentProblems(myLanguage, {
 *       comment: (text) => `// ${text}\n`,
 *       programs: ["@@ (f 1)", "(f @@ 1)", "(f 1) @@", "(f 1) @@ (g 2)"],
 *     })
 *   ).toEqual([]);
 */

/** The marks in a program that stand for a comment */
const MARK = "@@";

export type CommentCheck = {
  /**
   * Programs of the language with a `@@` wherever a comment is to be put. They
   * need not all be well formed: one that the parser rejects is a problem.
   */
  programs: string[];
  /**
   * How the language writes a comment that says `text` (a word with no spaces).
   * A comment that runs to the end of the line has to end the line itself.
   */
  comment: (text: string) => string;
};

/** Every way the programs are wrong for the language, as sentences ([] if none) */
export function commentProblems(
  language: Language,
  { programs, comment }: CommentCheck
): string[] {
  const problems: string[] = [];
  for (const template of programs) {
    const notes: string[] = [];
    let k = 0;
    const code = template.replace(new RegExp(MARK, "g"), () => {
      const note = `note${++k}x`;
      notes.push(note);
      return comment(note);
    });
    const where = JSON.stringify(code);
    let printed: string;
    try {
      printed = language.buildAST(code).toString();
    } catch (e) {
      problems.push(`${where} is not parsed: ${String(e)}`);
      continue;
    }
    for (const note of notes) {
      const times = printed.split(note).length - 1;
      if (times !== 1) {
        problems.push(
          `${where}: the comment ${note} is printed ${times} times, not once (${JSON.stringify(printed)})`
        );
      }
    }
    try {
      const again = language.buildAST(printed).toString();
      if (again !== printed) {
        problems.push(
          `${where}: printing is not stable: ${JSON.stringify(printed)} then ${JSON.stringify(again)}`
        );
      }
    } catch (e) {
      problems.push(`${where}: what is printed is not parsed: ${String(e)}`);
    }
  }
  return problems;
}
