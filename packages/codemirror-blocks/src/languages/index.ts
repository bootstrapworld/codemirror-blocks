import { ASTNode } from "../ast";
import type { PrimitiveGroup } from "../CodeMirrorBlocks";
import { Literal } from "../nodes";
import { Primitive } from "../parsers/primitives";

export const LANGUAGES: Record<string, Language> = {};

export type Language = LanguageConfig & {
  /**
   * A function for generating a human readable error message
   * from any exceptions that are thrown by a call to parse()
   */
  getExceptionMessage(e: unknown): string;
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
   * A function for generating a human readable error message
   * from any exceptions that are thrown by a call to parse()
   */
  getExceptionMessage?(e: unknown): string;

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
