import CodeMirror from "codemirror";
import type { EditorChange } from "codemirror";
import type { AST } from "../ast";
import { CodeMirrorFacade, RangedText, ReadonlyRangedText } from "../editor";

// TODO: For efficiency, we don't really need a full CodeMirror instance here:
// create a mock one.
const tmpCM: RangedText = new CodeMirrorFacade(
  CodeMirror(document.createElement("div"), { value: "" })
);

// Check if a set of codemirror changes parses successfully. Returns one of:
//
// - {successful: true, newAST}
// - {successful: false, exception}
export function speculateChanges(
  changeArr: EditorChange[],
  parse: (code: string) => AST,
  cm: ReadonlyRangedText
) {
  tmpCM.setValue(cm.getValue());
  for (let c of changeArr) {
    tmpCM.replaceRange(c.text, c.from, c.to, c.origin);
  }
  let newText = tmpCM.getValue();
  try {
    let newAST = parse(newText);
    return { successful: true as const, newAST: newAST };
  } catch (exception) {
    return { successful: false as const, exception };
  }
}
