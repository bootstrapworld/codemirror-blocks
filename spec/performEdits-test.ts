import CodeMirror from "codemirror";
import { AST } from "../src/ast";
import { CodeMirrorFacade } from "../src/editor";
import {
  applyEdits,
  EditInterface,
  edit_delete,
  edit_insert,
  edit_overwrite,
  edit_replace,
  performEdits,
} from "../src/edits/performEdits";
import wescheme from "../src/languages/wescheme";
import { FunctionApp } from "../src/nodes";
import { AppStore, createAppStore } from "../src/store";

let editor!: CodeMirrorFacade;
let ast!: AST;

const initialCode = `
(doWhatever)
(doSomething (add 34 5234) param2)
(doOtherThing param3)
`;

const apply = (edits: EditInterface[]) =>
  applyEdits(edits, ast, editor, wescheme.parse);

beforeEach(() => {
  editor = new CodeMirrorFacade(
    CodeMirror(document.body, { value: initialCode })
  );
  ast = new AST(wescheme.parse(editor.getValue()));
});

afterEach(() => {
  editor.codemirror.getWrapperElement().remove();
});

describe("applyEdits", () => {
  it("ReplaceRootEdit replaces a root node in the ast with some text", () => {
    const edit = edit_replace(
      "(doAnotherThing otherParam)",
      ast,
      ast.rootNodes[1]
    );
    expect(edit.toString()).toEqual(
      `ReplaceRoot 2:0-2:34="(doAnotherThing otherParam)"`
    );

    const result = apply([edit]);
    expect(result.successful).toBe(true);
    expect(editor.getValue()).toEqual(`
(doWhatever)
(doAnotherThing otherParam)
(doOtherThing param3)
`);
  });

  it("DeleteRootEdit removes a root node in the ast", () => {
    const edit = edit_delete(ast, ast.rootNodes[1]);
    expect(edit.toString()).toEqual("DeleteRoot 2:0-2:34");
    const result = apply([edit]);
    expect(result.successful).toBe(true);
    expect(editor.getValue()).toEqual(`
(doWhatever)

(doOtherThing param3)
`);
  });

  it("OverwriteEdit replaces a range of text", () => {
    const edit = edit_overwrite("foo", { line: 1, ch: 0 }, { line: 3, ch: 0 });
    expect(edit.toString()).toEqual("Overwrite 1:0-3:0");
    const result = apply([edit]);
    expect(result.successful).toBe(true);
    expect(editor.getValue()).toEqual(`
foo
(doOtherThing param3)
`);
  });

  it("DeleteChildEdit removes a node from its parent", () => {
    const edit = edit_delete(ast, [...ast.rootNodes[1].children()][1]);
    expect(edit.toString()).toEqual("DeleteChild 2:13-2:26");
    const result = apply([edit]);
    expect(result.successful).toBe(true);
    expect(editor.getValue()).toEqual(`
(doWhatever)
(doSomething param2)
(doOtherThing param3)
`);
  });

  it("ReplaceChildEdit replaces a node with some text", () => {
    const edit = edit_replace("foo", ast, [...ast.rootNodes[1].children()][1]);
    expect(edit.toString()).toEqual(`ReplaceChild 2:13-2:26="foo"`);
    const result = apply([edit]);
    expect(result.successful).toBe(true);
    expect(editor.getValue()).toEqual(`
(doWhatever)
(doSomething foo param2)
(doOtherThing param3)
`);
  });

  it("InsertChildEdit replaces a node with some text", () => {
    const node = [...ast.rootNodes[1].children()][1];
    expect(node).toBeInstanceOf(FunctionApp);

    const edit = edit_insert("foo", node, "args", { line: 2, ch: 19 });
    expect(edit.toString()).toEqual("InsertChild 2:19-2:19");
    const result = apply([edit]);
    expect(result.successful).toBe(true);
    expect(editor.getValue()).toEqual(`
(doWhatever)
(doSomething (add 34 foo 5234) param2)
(doOtherThing param3)
`);
  });

  it("Combines multiple edits together", () => {
    const children = [...ast.rootNodes[1].children()];
    const node = children[1];
    expect(node).toBeInstanceOf(FunctionApp);

    const edits = [
      edit_insert("foo", node, "args", { line: 2, ch: 19 }),
      edit_replace("bar", ast, children[2]),
      edit_delete(ast, ast.rootNodes[0]),
    ];
    const result = apply(edits);
    expect(result.successful).toBe(true);
    expect(editor.getValue()).toEqual(`

(doSomething (add 34 foo 5234) bar)
(doOtherThing param3)
`);
  });

  it("Does not apply edits if it would result in a parse error", () => {
    const edit = edit_overwrite(
      "(foo won't parse",
      { line: 1, ch: 0 },
      { line: 3, ch: 0 }
    );
    expect(edit.toString()).toEqual("Overwrite 1:0-3:0");
    const result = apply([edit]);
    expect(result.successful).toBe(false);
    if (!result.successful) {
      const msg =
        wescheme.getExceptionMessage &&
        wescheme.getExceptionMessage(result.exception);
      expect(msg).toMatchInlineSnapshot(
        `[Error: Your program could not be parsed]`
      );
    }
    expect(editor.getValue()).toEqual(initialCode);
  });
});

describe("performEdits", () => {
  const perform = (edits: EditInterface[]) =>
    performEdits({} as any, edits, wescheme.parse, editor);

  let store!: AppStore;

  beforeEach(() => {
    store = createAppStore();
    store.dispatch({ type: "SET_AST", ast });
  });

  it("applies edits to the editor and the ast, updating the redux store.", () => {
    const edit = edit_replace("foo", ast, [...ast.rootNodes[1].children()][1]);
    const result = store.dispatch(perform([edit]));
    expect(result.successful).toBe(true);
    expect(editor.getValue()).toEqual(`
(doWhatever)
(doSomething foo param2)
(doOtherThing param3)
`);
    expect(
      store.getState().ast.rootNodes[1].pretty().display(80).join("\n")
    ).toEqual(`(doSomething foo param2)`);
  });

  it("returns an error result if something goes while applying the change", () => {
    const edit = edit_replace(
      "(foo won't parse",
      ast,
      [...ast.rootNodes[1].children()][1]
    );
    const result = store.dispatch(perform([edit]));
    expect(result.successful).toBe(false);
    expect(editor.getValue()).toEqual(initialCode);
  });
});
