import { AST, ASTNode } from "../ast";
import type { BlockComment } from "../ast";
import { withCommentRules } from "../commentRules";
import type { CommentRules } from "../commentRules";
import type { PrimitiveGroup } from "../CodeMirrorBlocks";
import { Literal } from "../nodes";
import { Primitive } from "../parsers/primitives";

export const LANGUAGES: Record<string, Language> = {};

export type Language = LanguageConfig & {
  /**
   * A function for generating a human readable error message
   * from any exceptions that are thrown by a call to parse()
   */
  getExceptionMessage(e: unknown): string | Error;

  buildAST(code: string): AST;
};

export type LanguageConfig = {
  /**
   * A unique id for the language
   */
  id: string;

  /**
   * The name of the language
   */
  name: string;

  /**
   * Optional description of the language
   */
  description?: string;

  /**
   * A function for generating an AST from source code
   * @param code source code for the program
   * @returns The ast that codemirror-blocks will render
   */
  parse(code: string): ASTNode[];

  /**
   * How the language writes a block comment, e.g. `{ open: "#|", close: "|#" }`.
   * A language that has them can have its blocks commented from the keyboard
   * (the comment is written this way, and so it has to be something the
   * language's parser reads back as a comment); one that does not, cannot.
   */
  blockComment?: BlockComment;

  /**
   * How the language's comments are paired with its nodes, and printed, where it
   * differs from what the editor does for every language (see `CommentRules`,
   * which has the settings and the defaults): only the settings that differ. The
   * `attachComments` call of its `parse` takes them, and so does the printing of
   * its nodes.
   */
  commentRules?: Partial<CommentRules>;

  /**
   * A function for generating a human readable error message
   * from any exceptions that are thrown by a call to parse()
   */
  getExceptionMessage?(e: unknown): string | Error;

  /**
   * A function for generating ASTNodes from Primitives
   */
  getASTNodeForPrimitive?: (primitive: Primitive) => ASTNode;

  /**
   * A function for generating a Literal ast node from a Primitive
   */
  getLiteralNodeForPrimitive?: (
    primitive: Primitive
  ) => ReturnType<typeof Literal>;

  /**
   * Returns a list of language primitives that will be displayed
   * in the search bar.
   */
  primitivesFn?: () => PrimitiveGroup;
};

export function addLanguage(languageDefinition: LanguageConfig) {
  const id = languageDefinition.id;
  if (!id) {
    throw new Error(`language definition missing an 'id' attribute`);
  }
  if (LANGUAGES[id]) {
    throw new Error(`language ${id} has already been added.`);
  }
  if (!languageDefinition.name) {
    throw new Error(
      `language definition for ${id} is missing a 'name' attribute.`
    );
  }
  if (!languageDefinition.parse) {
    throw new Error(
      `language definition for ${id} is missing a 'parse' function.`
    );
  }

  const language: Language = {
    getExceptionMessage: (e: unknown) => String(e) || "Parser error",
    ...languageDefinition,
    buildAST: (code: string) => {
      return AST.from(
        id,
        withCommentRules(languageDefinition.commentRules, () =>
          languageDefinition.parse(code)
        )
      );
    },
  };
  LANGUAGES[id] = language;
  return language;
}

export function getLanguage(languageId: string) {
  if (!LANGUAGES[languageId]) {
    console.warn(
      "Trying to get language",
      languageId,
      "but it hasn't been added yet"
    );
  }
  return LANGUAGES[languageId];
}

export function removeLanguage(languageId: string) {
  delete LANGUAGES[languageId];
}

export function getLanguages() {
  return Object.values(LANGUAGES);
}
