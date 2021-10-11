import CodeMirror from "codemirror";
import type { EditorChange } from "codemirror";
import type { AST } from "../ast";
import { CodeMirrorFacade, RangedText, ReadonlyRangedText } from "../editor";

// TODO: For efficiency, we don't really need a full CodeMirror instance here:
// create a mock one.
const tmpRangedText: RangedText = new CodeMirrorFacade(
  CodeMirror(document.createElement("div"), { value: "" })
);

// Check if a set of codemirror changes parses successfully. Returns one of:
//
// - {successful: true, newAST}
// - {successful: false, exception}
export function speculateChanges(
  changeArr: EditorChange[],
  parse: (code: string) => AST,
  text: ReadonlyRangedText
) {
  tmpRangedText.setValue(text.getValue());
  for (let c of changeArr) {
    tmpRangedText.replaceRange(c.text, c.from, c.to, c.origin);
  }
  let newText = tmpRangedText.getValue();
  try {
    let newAST = parse(newText);
    return { successful: true as const, newAST: newAST };
  } catch (exception) {
    return { successful: false as const, exception };
  }
}
