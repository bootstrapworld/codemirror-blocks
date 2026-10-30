import CodeMirror from "codemirror";
import { AST, ASTNode } from "../src/ast";
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
import { AppStore, createAppStore } from "../src/state/store";
import * as actions from "../src/state/actions";
import * as selectors from "../src/state/selectors";

let editor!: CodeMirrorFacade;
let ast!: AST;

const initialCode = `
(doWhatever)
(doSomething (add 34 5234) param2)
(doOtherThing param3)
`;

const setCode = (code: string) => {
  editor.setValue(code);
  ast = wescheme.buildAST(editor.getValue());
};
const apply = (edits: EditInterface[]) => applyEdits(edits, ast, editor);

beforeEach(() => {
  editor = new CodeMirrorFacade(CodeMirror(document.body, { value: "" }));
});

afterEach(() => {
  editor.codemirror.getWrapperElement().remove();
});

describe("applyEdits", () => {
  beforeEach(() => {
    setCode(initialCode);
  });
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

  describe("OverwriteEdit", () => {
    it("replaces a range of text", () => {
      const edit = edit_overwrite(
        "foo",
        { line: 1, ch: 0 },
        { line: 3, ch: 0 }
      );
      expect(edit.toString()).toEqual("Overwrite 1:0-3:0");
      const result = apply([edit]);
      expect(result.successful).toBe(true);
      expect(editor.getValue()).toEqual(`
foo
(doOtherThing param3)
`);
    });
    it("inserts a newline when inserting at the beginning of a line that another node occupies", () => {
      const edit = edit_overwrite(
        "foo",
        ast.rootNodes[1].from,
        ast.rootNodes[1].from
      );
      const result = apply([edit]);
      expect(result.successful).toBe(true);
      expect(editor.getValue()).toEqual(`
(doWhatever)
foo
(doSomething (add 34 5234) param2)
(doOtherThing param3)
`);
    });
    it("inserts a newline when inserting at the end of a line that another node occupies", () => {
      const edit = edit_overwrite(
        "foo",
        ast.rootNodes[1].to,
        ast.rootNodes[1].to
      );
      const result = apply([edit]);
      expect(result.successful).toBe(true);
      expect(editor.getValue()).toEqual(`
(doWhatever)
(doSomething (add 34 5234) param2)
foo
(doOtherThing param3)
`);
    });

    it("takes comments into account when inserting newlines", () => {
      setCode(`
#| this node is commented |#
(+ 1 #| this is a nested comment |# 2)      
`);
      const edit = edit_overwrite(
        "foo",
        { line: 1, ch: 0 },
        { line: 1, ch: 0 }
      );
      const result = apply([edit]);
      expect(result.successful).toBe(true);
      expect(editor.getValue()).toEqual(`
foo
#| this node is commented |#
(+ 1 #| this is a nested comment |# 2)      
`);
    });
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
    expect(node.type).toBe("functionApp");

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
    expect(node.type).toBe("functionApp");

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
      const msg = wescheme.getExceptionMessage(result.exception);
      expect(msg).toMatchInlineSnapshot(
        `[Error: Your program could not be parsed]`
      );
    }
    expect(editor.getValue()).toEqual(initialCode);
  });
});

describe("performEdits", () => {
  const perform = (edits: EditInterface[]) => performEdits(edits, editor);

  let store!: AppStore;

  beforeEach(() => {
    setCode(initialCode);
    store = createAppStore();
    store.dispatch(actions.setAST(ast));
  });

  it("applies edits to the editor and the ast, updating the redux store.", () => {
    const edit = edit_replace("foo", ast, [...ast.rootNodes[1].children()][1]);
    const result = store.dispatch(perform([edit]));
    if (!result.successful) {
      throw result.exception;
    }
    expect(result.successful).toBe(true);
    expect(editor.getValue()).toEqual(`
(doWhatever)
(doSomething foo param2)
(doOtherThing param3)
`);
    expect(
      selectors
        .getAST(store.getState())
        .rootNodes[1].pretty()
        .display(80)
        .join("\n")
    ).toEqual(`(doSomething foo param2)`);
  });

  it("returns an error result if something goes wrong while applying the change", () => {
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

describe("applyEdits on small documents", () => {
  const kids = (node: ASTNode) => [...node.children()];
  /** apply `make(ast)` to `code`; returns the resulting text */
  const edited = (code: string, make: (ast: AST) => EditInterface[]) => {
    setCode(code);
    const result = apply(make(ast));
    if (!result.successful) {
      throw result.exception;
    }
    return editor.getValue();
  };

  describe("deleting a root", () => {
    it("takes the separating space with it: first, middle, last, only", () => {
      const del = (i: number) => (a: AST) => [edit_delete(a, a.rootNodes[i])];
      expect(edited("a b c", del(0))).toBe("b c");
      expect(edited("a b c", del(1))).toBe("a c");
      expect(edited("a b c", del(2))).toBe("a b");
      expect(edited("a", del(0))).toBe("");
    });

    it("keeps the line structure when roots are on their own lines", () => {
      const del = (i: number) => (a: AST) => [edit_delete(a, a.rootNodes[i])];
      expect(edited("a\nb\nc", del(0))).toBe("\nb\nc");
      expect(edited("a\nb\nc", del(1))).toBe("a\n\nc");
      expect(edited("a\nb\nc", del(2))).toBe("a\nb\n");
    });

    it("takes a comment above it along", () => {
      expect(
        edited("#| n |#\na\nb", (a) => [edit_delete(a, a.rootNodes[0])])
      ).toBe("\nb");
    });
  });

  describe("deleting a child", () => {
    const child = (a: AST, i: number) => kids(a.rootNodes[0])[i];

    it("removes first, last and only arguments", () => {
      expect(edited("(f x y)", (a) => [edit_delete(a, child(a, 1))])).toBe(
        "(f y)"
      );
      expect(edited("(f x y)", (a) => [edit_delete(a, child(a, 2))])).toBe(
        "(f x)"
      );
      expect(edited("(f x)", (a) => [edit_delete(a, child(a, 1))])).toBe("(f)");
    });

    it("removes several siblings in one edit", () => {
      expect(
        edited("(f x y)", (a) => [
          edit_delete(a, child(a, 1)),
          edit_delete(a, child(a, 2)),
        ])
      ).toBe("(f)");
    });

    it("leaves a blank where a required child was", () => {
      expect(edited("(f x y)", (a) => [edit_delete(a, child(a, 0))])).toBe(
        "(... x y)"
      );
    });

    it("takes the node's own trailing comment along", () => {
      const result = edited("(f x #| c |# y)", (a) => [
        edit_delete(a, child(a, 1)),
      ]);
      expect(result).not.toContain("x");
      expect(result).toBe("(f y)");
    });
  });

  describe("replacing", () => {
    it("a child with several expressions", () => {
      expect(
        edited("(f x y)", (a) => [
          edit_replace("1 2", a, kids(a.rootNodes[0])[1]),
        ])
      ).toBe("(f 1 2 y)");
    });

    it("a root with several expressions", () => {
      expect(
        edited("a b", (a) => [edit_replace("1 2", a, a.rootNodes[0])])
      ).toBe("1 2 b");
    });

    it("a root with nothing", () => {
      expect(edited("a b", (a) => [edit_replace("", a, a.rootNodes[0])])).toBe(
        " b"
      );
    });
  });

  describe("inserting a child", () => {
    const insert = (text: string, ch: number) => (a: AST) => [
      edit_insert(text, a.rootNodes[0], "args", { line: 0, ch }),
    ];
    it("at the start, the end, and into an empty argument list", () => {
      expect(edited("(f x y)", insert("z", 3))).toBe("(f z x y)");
      expect(edited("(f x y)", insert("z", 6))).toBe("(f x y z)");
      expect(edited("(f)", insert("z", 2))).toBe("(f z)");
    });

    it("inserting an empty or blank string changes nothing", () => {
      expect(edited("(f x y)", insert("", 6))).toBe("(f x y)");
      expect(edited("(f x y)", insert("", 3))).toBe("(f x y)");
      expect(edited("(f)", insert("", 2))).toBe("(f)");
      expect(edited("(f x y)", insert("  ", 3))).toBe("(f x y)");
    });
  });

  describe("combining several edits", () => {
    it("gives the same result whatever order they are listed in", () => {
      const forward = (a: AST) => [
        edit_replace("A", a, kids(a.rootNodes[0])[1]),
        edit_replace("B", a, kids(a.rootNodes[0])[2]),
      ];
      const backward = (a: AST) => forward(a).reverse();
      expect(edited("(f x y)", forward)).toBe("(f A B)");
      expect(edited("(f x y)", backward)).toBe("(f A B)");
    });

    it("handles edits at different depths of the same root", () => {
      expect(
        edited("(f (g x) y)", (a) => {
          const g = kids(a.rootNodes[0])[1];
          return [
            edit_replace("Z", a, kids(g)[1]),
            edit_replace("Y", a, kids(a.rootNodes[0])[2]),
          ];
        })
      ).toBe("(f (g Z) Y)");
    });

    it("handles edits in different roots", () => {
      expect(
        edited("(f x)\n(g y)", (a) => [
          edit_replace("1", a, kids(a.rootNodes[0])[1]),
          edit_replace("2", a, kids(a.rootNodes[1])[1]),
        ])
      ).toBe("(f 1)\n(g 2)");
    });

    it("handles deleting a root and a child of another root together", () => {
      expect(
        edited("(f x)\n(g y)", (a) => [
          edit_delete(a, a.rootNodes[0]),
          edit_delete(a, kids(a.rootNodes[1])[1]),
        ])
      ).toBe("\n(g)");
    });

    it("rejects the whole batch if any part would not parse", () => {
      setCode("(f x y)");
      const result = apply([
        edit_replace("A", ast, kids(ast.rootNodes[0])[1]),
        edit_replace("(((", ast, kids(ast.rootNodes[0])[2]),
      ]);
      expect(result.successful).toBe(false);
      expect(editor.getValue()).toBe("(f x y)");
    });
  });

  describe("overwriting a range", () => {
    it("with nothing leaves the text alone", () => {
      expect(
        edited("a\n\nb", () => [
          edit_overwrite("", { line: 1, ch: 0 }, { line: 1, ch: 0 }),
        ])
      ).toBe("a\n\nb");
    });

    it("across several lines", () => {
      expect(
        edited("a\n\n\nb", () => [
          edit_overwrite("x", { line: 1, ch: 0 }, { line: 2, ch: 0 }),
        ])
      ).toBe("a\nx\nb");
    });
  });
});

/**
 * Each Edit has a `focusHint(newAST)`, which names the node that should get
 * focus once the edit has been applied, or "fallback" to have focus worked out
 * from the text changes instead (see issue #468).
 *
 * The hint is meant to be asked of the AST that `performEdits` commits to the
 * store: a node found by id (as a delete's "node before" is) only exists in
 * that AST, because the AST that merely validates the edit is a fresh parse
 * with fresh ids. So these specs spy on `focusHint` and read what it returned
 * for the committed AST, rather than calling it with an AST of their own.
 */
describe("focusHint", () => {
  const kids = (node: ASTNode) => [...node.children()];

  /**
   * perform `make(ast)` on `code`; returns what each edit's focusHint returned
   * (as source text, or "fallback"), or undefined for an edit never asked.
   */
  const hints = (code: string, make: (ast: AST) => EditInterface[]) => {
    setCode(code);
    const store = createAppStore();
    store.dispatch(actions.setAST(ast));
    const edits = make(ast);
    const spies = edits.map((edit) => jest.spyOn(edit, "focusHint"));
    const result = store.dispatch(performEdits(edits, editor));
    if (!result.successful) {
      throw result.exception;
    }
    return spies.map((spy) => {
      const hint = spy.mock.results[0]?.value;
      return hint === undefined || hint === "fallback"
        ? hint
        : (hint as ASTNode).toString();
    });
  };

  describe("DeleteChildEdit", () => {
    it("points at the sibling before the deleted node", () => {
      expect(
        hints("(f x y)", (a) => [edit_delete(a, kids(a.rootNodes[0])[2])])
      ).toEqual(["x"]);
      expect(
        hints("(f x y)", (a) => [edit_delete(a, kids(a.rootNodes[0])[1])])
      ).toEqual(["f"]);
    });

    it("points at the parent when the first child is deleted", () => {
      expect(
        hints("(f x y)", (a) => [edit_delete(a, kids(a.rootNodes[0])[0])])
      ).toEqual(["(... x y)"]);
    });

    it("is also what replacing a child with nothing gives", () => {
      expect(
        hints("(f x y)", (a) => [edit_replace("", a, kids(a.rootNodes[0])[2])])
      ).toEqual(["x"]);
    });
  });

  describe("DeleteRootEdit", () => {
    it("falls back, since the root and its id are gone", () => {
      for (const i of [0, 1, 2]) {
        expect(hints("a b c", (a) => [edit_delete(a, a.rootNodes[i])])).toEqual(
          ["fallback"]
        );
      }
      expect(hints("a", (a) => [edit_delete(a, a.rootNodes[0])])).toEqual([
        "fallback",
      ]);
    });
  });

  describe("ReplaceRootEdit", () => {
    it("points at the first node of the replacement", () => {
      expect(
        hints("a b", (a) => [edit_replace("1 2", a, a.rootNodes[0])])
      ).toEqual(["1"]);
    });
  });

  describe("ReplaceChildEdit", () => {
    it("points at the first node of the replacement", () => {
      expect(
        hints("(f x y)", (a) => [
          edit_replace("1 2", a, kids(a.rootNodes[0])[1]),
        ])
      ).toEqual(["1"]);
    });
  });

  describe("InsertChildEdit", () => {
    it("points at the inserted node", () => {
      expect(
        hints("(f x y)", (a) => [
          edit_insert("z", a.rootNodes[0], "args", { line: 0, ch: 3 }),
        ])
      ).toEqual(["z"]);
    });

    it("falls back when there was nothing to insert", () => {
      expect(
        hints("(f x y)", (a) => [
          edit_insert("", a.rootNodes[0], "args", { line: 0, ch: 3 }),
        ])
      ).toEqual(["fallback"]);
    });
  });

  describe("OverwriteEdit", () => {
    it("points at the node that ends where the new text ends", () => {
      expect(
        hints("a\n\nb", () => [
          edit_overwrite("foo", { line: 1, ch: 0 }, { line: 1, ch: 0 }),
        ])
      ).toEqual(["foo"]);
    });

    it("warns and falls back if asked before the change object exists", () => {
      const edit = edit_overwrite(
        "foo",
        { line: 0, ch: 0 },
        { line: 0, ch: 0 }
      );
      setCode("a");
      jest.spyOn(console, "warn").mockImplementation(() => {});
      expect(edit.focusHint(ast)).toBe("fallback");
    });
  });

  describe("with several edits", () => {
    it("only asks the last edit", () => {
      // (y's predecessor is the replacement A, which is what the delete finds)
      expect(
        hints("(f x y)", (a) => [
          edit_replace("A", a, kids(a.rootNodes[0])[1]),
          edit_delete(a, kids(a.rootNodes[0])[2]),
        ])
      ).toEqual([undefined, "A"]);
    });

    it("uses the last edit's hint whatever the others are", () => {
      expect(
        hints("(f x y)", (a) => [
          edit_delete(a, kids(a.rootNodes[0])[2]),
          edit_replace("B", a, kids(a.rootNodes[0])[1]),
        ])
      ).toEqual([undefined, "B"]);
    });
  });
});
