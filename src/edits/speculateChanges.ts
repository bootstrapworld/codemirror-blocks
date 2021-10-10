import CodeMirror, { Editor } from "codemirror";
import type { EditorChange } from "codemirror";
import type { AST } from "../ast";

// TODO: For efficiency, we don't really need a full CodeMirror instance here:
// create a mock one.
const tmpDiv = document.createElement("div");
const tmpCM = CodeMirror(tmpDiv, { value: "" });

// Check if a set of codemirror changes parses successfully. Returns one of:
//
// - {successful: true, newAST}
// - {successful: false, exception}
export function speculateChanges(
  changeArr: EditorChange[],
  parse: (code: string) => AST,
  cm: Editor
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

export function getTempCM(cm: Editor) {
  const tmpCM = CodeMirror(tmpDiv, { value: cm.getValue() });
  tmpCM.setCursor(cm.getCursor());
  return tmpCM;
}
