import CodeMirror from "codemirror";
import { AST, ASTNode } from "../src/ast";
import { findInsertionPlace } from "../src/components/DropTarget";
import { CodeMirrorFacade } from "../src/editor";
import { applyEdits, edit_insert } from "../src/edits/performEdits";
import { FakeAstInsertion, insertionPos } from "../src/edits/fakeAstEdits";
import wescheme from "../src/languages/wescheme";
import { InsertTarget } from "../src/state/actions";

/**
 * A place in a list is its index: the index of the element it goes before, or
 * the length of the list for the end. The text position it is at follows from
 * that, and is not what says where it is.
 */

const build = (code: string): AST => wescheme.buildAST(code);
const args = (node: ASTNode) =>
  (node.fields as { args: ASTNode[] }).args as ASTNode[];

describe("FakeAstInsertion", () => {
  const insertion = (code: string, index: number) => {
    const ast = build(code);
    return {
      ast,
      insertion: new FakeAstInsertion(ast.rootNodes[0], "args", index),
    };
  };

  it.each([
    [-5, 0],
    [-1, 0],
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 2],
    [99, 2],
  ])("an index of %i in a list of two is %i", (given, expected) => {
    expect(insertion("(f x y)", given).insertion.index).toBe(expected);
  });

  it("takes the whole part of an index that is not a whole number", () => {
    expect(insertion("(f x y)", 1.9).insertion.index).toBe(1);
  });

  it("is at the start of the first element for the index 0", () => {
    const { ast, insertion: i } = insertion("(f x y)", 0);
    expect(i.pos).toEqual(args(ast.rootNodes[0])[0].from);
  });

  it("is at the end of the element before it, for an index in the list", () => {
    const { ast, insertion: i } = insertion("(f x   y)", 1);
    expect(i.pos).toEqual(args(ast.rootNodes[0])[0].to);
  });

  it("is at the end of the last element for the end of the list", () => {
    const { ast, insertion: i } = insertion("(f x y)", 2);
    expect(i.pos).toEqual(args(ast.rootNodes[0])[1].to);
  });

  it("is at the start of the parent for an empty list", () => {
    const { ast, insertion: i } = insertion("  (f)", 0);
    expect(i.index).toBe(0);
    expect(i.pos).toEqual(ast.rootNodes[0].from);
  });

  it("is on the right line when the list is on several", () => {
    const { ast, insertion: i } = insertion("(f x\n   y\n   z)", 2);
    expect(i.pos).toEqual(args(ast.rootNodes[0])[1].to);
    expect(i.pos.line).toBe(1);
  });

  it("refuses a field that is not a list of the node", () => {
    const ast = build("(f x y)");
    expect(() => new FakeAstInsertion(ast.rootNodes[0], "func", 0)).toThrow(
      /Failed to find list/
    );
    expect(() => new FakeAstInsertion(ast.rootNodes[0], "nope", 0)).toThrow(
      /Failed to find list/
    );
  });

  it("counts an orphan comment in the list as an element", () => {
    const ast = build("(f x\n\n#| c |#\n\ny)");
    const list = args(ast.rootNodes[0]);
    expect(list.map((n) => n.type)).toEqual(["literal", "comment", "literal"]);
    const at = (index: number) =>
      new FakeAstInsertion(ast.rootNodes[0], "args", index);
    expect(at(1).pos).toEqual(list[0].to); // before the comment
    expect(at(2).pos).toEqual(list[1].to); // after it
    expect(at(3).index).toBe(3);
  });
});

describe("insertionPos", () => {
  it("is the end of the element before, or the start of the first", () => {
    const ast = build("(f x y)");
    const parent = ast.rootNodes[0];
    const list = args(parent);
    expect(insertionPos(parent, list, 0)).toEqual(list[0].from);
    expect(insertionPos(parent, list, 1)).toEqual(list[0].to);
    expect(insertionPos(parent, list, 2)).toEqual(list[1].to);
    expect(insertionPos(parent, [], 0)).toEqual(parent.from);
  });
});

describe("InsertTarget", () => {
  it("has the position of its index, as a range with no width", () => {
    const ast = build("(f x y)");
    const parent = ast.rootNodes[0];
    const target = new InsertTarget(parent, "args", 1);
    expect(target.index).toBe(1);
    expect(target.field).toBe("args");
    expect(target.srcRange()).toEqual({
      from: args(parent)[0].to,
      to: args(parent)[0].to,
    });
  });

  it("makes the edit of its index", () => {
    const ast = build("(f x y)");
    expect(
      new InsertTarget(ast.rootNodes[0], "args", 1).toEdit(ast, "z").toString()
    ).toMatch(/^InsertChild /);
  });
});

describe("edit_insert by index", () => {
  let editor!: CodeMirrorFacade;
  beforeEach(() => {
    editor = new CodeMirrorFacade(CodeMirror(document.body, { value: "" }));
  });
  afterEach(() => {
    editor.codemirror.getWrapperElement().remove();
  });

  const inserted = (code: string, index: number, text = "z") => {
    editor.setValue(code);
    const ast = wescheme.buildAST(code);
    const result = applyEdits(
      [edit_insert(text, ast.rootNodes[0], "args", index)],
      ast,
      editor
    );
    expect(result.successful).toBe(true);
    return editor.getValue();
  };

  it.each([
    [0, "(f z x y)"],
    [1, "(f x z y)"],
    [2, "(f x y z)"],
  ])("at index %i", (index, expected) => {
    expect(inserted("(f x y)", index)).toBe(expected);
  });

  it("past the end is at the end, and below the start is at the start", () => {
    expect(inserted("(f x y)", 99)).toBe("(f x y z)");
    expect(inserted("(f x y)", -3)).toBe("(f z x y)");
  });

  it("into an empty list", () => {
    expect(inserted("(f)", 0)).toBe("(f z)");
  });

  it("whatever the spacing, the index says where", () => {
    expect(inserted("(f   x\n     y)", 1)).toBe("(f x z y)");
  });

  it("among orphan comments, an index counts them", () => {
    const code = "(f x\n\n#| c |#\n\ny)";
    const elements = (index: number) => {
      const ast = wescheme.buildAST(inserted(code, index));
      return args(ast.rootNodes[0]).map((n) =>
        n.type === "comment" ? "#" : String(n.fields.value)
      );
    };
    expect(elements(0)).toEqual(["z", "x", "#", "y"]);
    expect(elements(1)).toEqual(["x", "z", "#", "y"]);
    expect(elements(2)).toEqual(["x", "#", "z", "y"]);
    expect(elements(3)).toEqual(["x", "#", "y", "z"]);
  });
});

describe("findInsertionPlace", () => {
  it("is the field and index of an element of a list", () => {
    const ast = build("(f x y)");
    const [x, y] = args(ast.rootNodes[0]);
    expect(findInsertionPlace(ast, x)).toMatchObject({
      field: "args",
      index: 0,
    });
    expect(findInsertionPlace(ast, y)).toMatchObject({
      field: "args",
      index: 1,
    });
  });

  it("is null for a root, and for a node that is not in a list", () => {
    const ast = build("(f x y)");
    expect(findInsertionPlace(ast, ast.rootNodes[0])).toBeNull();
    const func = (ast.rootNodes[0].fields as { func: ASTNode }).func;
    expect(findInsertionPlace(ast, func)).toBeNull();
  });

  it("names the parent that is nearest, for blocks inside blocks", () => {
    const ast = build("(f (g x y) z)");
    const g = args(ast.rootNodes[0])[0];
    const y = args(g)[1];
    const place = findInsertionPlace(ast, y);
    expect(place?.parent.id).toBe(g.id);
    expect(place).toMatchObject({ field: "args", index: 1 });
  });

  it("counts an orphan comment as an element", () => {
    const ast = build("(f x\n\n#| c |#\n\ny)");
    const list = args(ast.rootNodes[0]);
    expect(findInsertionPlace(ast, list[2])).toMatchObject({ index: 2 });
  });
});
