import CodeMirror from "codemirror";
import type { EditorChange } from "codemirror";
import type { AST } from "../ast";
import { CodeMirrorFacade, RangedText } from "../editor";
import { err, ok, Result } from "./result";

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
  parse: (code: string) => AST,
  text: string
): Result<AST> {
  tmpRangedText.setValue(text);
  for (let c of changeArr) {
    tmpRangedText.replaceRange(c.text, c.from, c.to, c.origin);
  }
  let newText = tmpRangedText.getValue();
  try {
    let newAST = parse(newText);
    return ok(newAST);
  } catch (exception) {
    return err(exception);
  }
}
