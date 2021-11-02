import CodeMirror from "codemirror";
import type { EditorChange } from "codemirror";
import { AST } from "../ast";
import { CodeMirrorFacade, RangedText } from "../editor";
import { err, ok, Result } from "./result";
import { Language } from "../CodeMirrorBlocks";

// TODO: For efficiency, we don't really need a full CodeMirror instance here:
// create a mock one.
const tmpRangedText: RangedText = new CodeMirrorFacade(
  CodeMirror(document.createElement("div"), { value: "" })
);

/**
 * Check if a set of codemirror changes parses successfully.
 * @returns a Result object containing the new AST if successful, or an error if not
 */
export function speculateChanges(
  changeArr: EditorChange[],
  parse: Language["parse"],
  text: string
): Result<AST> {
  tmpRangedText.setValue(text);
  for (const c of changeArr) {
    tmpRangedText.replaceRange(c.text, c.from, c.to, c.origin);
  }
  const newText = tmpRangedText.getValue();
  try {
    return ok(AST.from(parse(newText)));
  } catch (exception) {
    return err(exception);
  }
}
