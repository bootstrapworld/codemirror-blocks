import CodeMirror from "codemirror";
import { CodeMirrorFacade } from "../src/editor";

describe("CodeMirrorFacade.getTopmostAction", () => {
  const makeEditor = () => {
    const cm = CodeMirror(document.createElement("div"), { value: "a b" });
    cm.getDoc().clearHistory();
    cm.replaceRange("c", { line: 0, ch: 3 });
    return new CodeMirrorFacade(cm);
  };

  it("returns the live history event, so annotations stick", () => {
    const editor = makeEditor();
    const item = editor.getTopmostAction("undo");
    item.undoableAction = "inserted c";
    item.actionFocus = { oldFocusNId: 1, newFocusNId: 2 };

    expect(editor.getTopmostAction("undo")).toBe(item);
    expect(editor.getTopmostAction("undo").undoableAction).toBe("inserted c");
  });

  it("returns an empty object when there is no history", () => {
    const cm = CodeMirror(document.createElement("div"), { value: "a" });
    expect(new CodeMirrorFacade(cm).getTopmostAction("redo")).toEqual({});
  });
});
