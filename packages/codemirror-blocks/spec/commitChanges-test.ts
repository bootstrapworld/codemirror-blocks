import CodeMirror from "codemirror";
import type { EditorChange } from "codemirror";
import { AST } from "../src/ast";
import { CodeMirrorFacade } from "../src/editor";
import {
  computeFocusNodeFromChanges,
  computeFocusNodeFromHint,
} from "../src/edits/commitChanges";
import wescheme from "../src/languages/wescheme";
import * as actions from "../src/state/actions";
import * as selectors from "../src/state/selectors";
import { createAppStore } from "../src/state/store";

// "(f x y)" on line 0, "(g z)" on line 1
const code = "(f x y)\n(g z)";

let editor!: CodeMirrorFacade;

beforeEach(() => {
  editor = new CodeMirrorFacade(CodeMirror(document.body, { value: code }));
});
afterEach(() => {
  editor.codemirror.getWrapperElement().remove();
});

const kids = (n: { children(): Iterable<any> }) => [...n.children()];
const change = (
  from: [number, number],
  to: [number, number],
  text: string,
  removed: string
): EditorChange => ({
  from: { line: from[0], ch: from[1] },
  to: { line: to[0], ch: to[1] },
  text: text.split("\n"),
  removed: removed.split("\n"),
  origin: "+input",
});

describe("computeFocusNodeFromChanges", () => {
  let ast!: AST;
  beforeEach(() => {
    ast = wescheme.buildAST(code);
  });
  const run = (changes: EditorChange[]) =>
    computeFocusNodeFromChanges(editor, changes, ast);

  it("focuses the node that was inserted", () => {
    // `y` (line 0, ch 5-6) was just typed
    expect(run([change([0, 5], [0, 5], "y", "")])).toBe(
      kids(ast.rootNodes[0])[2]
    );
  });

  it("focuses the node of the most recent insertion", () => {
    const node = run([
      change([0, 3], [0, 3], "x", ""),
      change([1, 3], [1, 3], "z", ""),
    ]);
    expect(node).toBe(ast.getNodeAt({ line: 1, ch: 3 }, { line: 1, ch: 4 }));
    expect(node).toBe(kids(ast.rootNodes[1])[1]);
  });

  it("focuses the node before a deletion", () => {
    // `y` was deleted from "(f x y)": the node before is `x`
    expect(run([change([0, 5], [0, 7], "", " y")])).toBe(
      kids(ast.rootNodes[0])[1]
    );
  });

  it("uses the earliest deletion when there are several", () => {
    const node = run([
      change([1, 3], [1, 5], "", " z"),
      change([0, 3], [0, 5], "", " x"),
    ]);
    expect(node).toBe(kids(ast.rootNodes[0])[0]);
  });

  it("falls back to the first root when the first node was deleted", () => {
    expect(run([change([0, 0], [0, 0], "", "(h)")])).toBe(ast.rootNodes[0]);
  });

  it("returns null when the tree is empty", () => {
    ast = wescheme.buildAST("");
    expect(run([change([0, 0], [0, 7], "", "(f x y)")])).toBeNull();
  });

  it("reads the removed text from the editor when the change has none", () => {
    const c = change([0, 5], [0, 7], "", "");
    delete (c as any).removed;
    expect(run([c])).toBe(kids(ast.rootNodes[0])[1]);
  });
});

describe("computeFocusNodeFromHint", () => {
  const stateFor = (collapse: (ast: AST) => any[] = () => []) => {
    const store = createAppStore();
    const ast = wescheme.buildAST(code);
    store.dispatch(actions.setAST(ast));
    // collapse against the AST the store actually holds
    collapse(selectors.getAST(store.getState())).forEach((n) =>
      store.dispatch(actions.collapseNode(n))
    );
    return {
      state: store.getState(),
      ast: selectors.getAST(store.getState()),
    };
  };
  const noChanges: EditorChange[] = [];

  it("returns the node the hint names", () => {
    const { state, ast } = stateFor();
    const target = kids(ast.rootNodes[1])[1];
    expect(
      computeFocusNodeFromHint(editor, noChanges, () => target, state)
    ).toBe(target);
  });

  it("asks the hint for the AST in the store", () => {
    const { state, ast } = stateFor();
    const hint = jest.fn(() => "fallback" as const);
    computeFocusNodeFromHint(
      editor,
      [change([0, 0], [0, 0], "", "(h)")],
      hint,
      state
    );
    expect(hint).toHaveBeenCalledTimes(1);
    expect(hint.mock.calls[0][0].rootNodes.map((n) => n.id)).toEqual(
      ast.rootNodes.map((n) => n.id)
    );
  });

  it("uses the changes when the hint says fallback", () => {
    const { state, ast } = stateFor();
    const node = computeFocusNodeFromHint(
      editor,
      [change([0, 5], [0, 7], "", " y")],
      () => "fallback",
      state
    );
    expect(node).toBe(kids(ast.rootNodes[0])[1]);
  });

  it("returns undefined when the hint finds nothing (no fallback)", () => {
    const { state } = stateFor();
    expect(
      computeFocusNodeFromHint(editor, noChanges, () => undefined, state)
    ).toBeUndefined();
  });

  it("returns undefined when the fallback finds nothing", () => {
    const store = createAppStore();
    store.dispatch(actions.setAST(wescheme.buildAST("")));
    expect(
      computeFocusNodeFromHint(
        editor,
        [change([0, 0], [0, 7], "", "(f x y)")],
        () => "fallback",
        store.getState()
      )
    ).toBeUndefined();
  });

  it("focuses the outermost collapsed ancestor of the hinted node", () => {
    const { state, ast } = stateFor((a) => [a.rootNodes[0]]);
    const inner = kids(ast.rootNodes[0])[2];
    expect(
      computeFocusNodeFromHint(editor, noChanges, () => inner, state)
    ).toBe(ast.rootNodes[0]);
  });

  it("does not climb past ancestors that are not collapsed", () => {
    const { state, ast } = stateFor((a) => [a.rootNodes[1]]);
    const inner = kids(ast.rootNodes[0])[2];
    expect(
      computeFocusNodeFromHint(editor, noChanges, () => inner, state)
    ).toBe(inner);
  });
});
