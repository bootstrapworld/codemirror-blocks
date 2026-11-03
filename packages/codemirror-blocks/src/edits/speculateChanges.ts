import CodeMirror from "codemirror";
import type { EditorChange } from "codemirror";
import { AST } from "../ast";
import { CodeMirrorFacade, RangedText } from "../editor";
import { err, ok, Result } from "./result";
import { Language } from "../CodeMirrorBlocks";
import { incrementalBuildAST } from "./incrementalParse";

// TODO: For efficiency, we don't really need a full CodeMirror instance here:
// create a mock one.
const tmpRangedText: RangedText = new CodeMirrorFacade(
  CodeMirror(document.createElement("div"), { value: "" })
);

/**
 * Check if a set of codemirror changes parses successfully.
 * @param oldAST the AST of `text`, if known: with one change to a language
 *   that can (`incrementalParse`), only the forms around it are parsed again
 * @returns a Result object containing the new AST if successful, or an error if not
 */
export function speculateChanges(
  changeArr: EditorChange[],
  language: Language,
  text: string,
  oldAST?: AST
): Result<AST> {
  tmpRangedText.setValue(text);
  for (const c of changeArr) {
    tmpRangedText.replaceRange(c.text, c.from, c.to, c.origin);
  }
  const newText = tmpRangedText.getValue();
  try {
    if (oldAST && language.incrementalParse && changeArr.length === 1) {
      const ast = incrementalBuildAST(
        language,
        oldAST,
        changeArr[0],
        text,
        newText
      );
      if (ast) return ok(ast);
    }
    return ok(language.buildAST(newText));
  } catch (exception) {
    return err(exception);
  }
}
