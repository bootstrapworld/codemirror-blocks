/*
 * How the comments of a program are paired with its nodes, and how a comment
 * that is paired is printed. One set of rules is the default for every
 * language (`COMMENT_RULES`); a language that reads its comments differently
 * says so by giving some of them as `rules` to `attachComments` (a setting of
 * the language itself can pass them on).
 *
 * The words: a comment is *trailing* if there is code before it on its line
 * (`(f x) ; c`). One that is *above* a node ends on the line just above it, or
 * on its line, before it (`; c` above, `#| c |# x`). A comment that is *at the
 * end* is the last thing in the program, on the line after the last node.
 * Everything that is not paired is a *block of its own*: an orphan comment, in
 * the list around it that can hold one (see `orphans.ts`).
 */
export type CommentRules = {
  /**
   * A trailing comment goes with the code before it ("previous", the last node
   * of its list to end on its line), or with the node after it if that is on
   * its line ("next"), or stands "alone".
   */
  afterCode: "previous" | "next" | "alone";
  /**
   * A comment above a node goes with it ("next"), or stands "alone".
   */
  above: "next" | "alone";
  /**
   * How many lines can be between the end of a comment above and the node:
   * 1 is the line just above (no blank line between), 2 allows a blank line, 0
   * is the node's own line only.
   */
  maxLinesAbove: number;
  /**
   * A comment at the end of the program goes with the last node ("last"), or
   * stands "alone".
   */
  atEnd: "last" | "alone";
  /**
   * A comment that goes with a node and comes after it is printed beside it if
   * it fits on the line ("beside"), or above it ("above"). (A comment that comes
   * before its node is always printed above it.) Read back, both are the same.
   */
  printAfter: "beside" | "above";
};

/** What the editor does with comments, unless a language says otherwise */
export const COMMENT_RULES: CommentRules = {
  afterCode: "previous",
  above: "next",
  maxLinesAbove: 1,
  atEnd: "last",
  printAfter: "beside",
};

let inEffect: Partial<CommentRules> | undefined;

/**
 * Runs `fn` with a language's rules in effect, for the `attachComments` calls
 * it makes that do not give rules of their own (the editor does this around the
 * `parse` of a language that has `commentRules`: see `LanguageConfig`).
 */
export function withCommentRules<T>(
  rules: Partial<CommentRules> | undefined,
  fn: () => T
): T {
  const before = inEffect;
  inEffect = rules;
  try {
    return fn();
  } finally {
    inEffect = before;
  }
}

/** The rules in effect: the language's, over the defaults, and `given` over those */
export function rulesInEffect(given?: Partial<CommentRules>): CommentRules {
  return { ...COMMENT_RULES, ...inEffect, ...given };
}
