import CodeMirror from "codemirror";
import { AST, ASTNode } from "../src/ast";
import { findInsertionPlace } from "../src/components/DropTarget";
import { CodeMirrorFacade } from "../src/editor";
import {
  applyEdits,
  edit_insert,
  performEdits,
} from "../src/edits/performEdits";
import type { EditInterface } from "../src/edits/performEdits";
import { FakeAstInsertion, insertionPos } from "../src/edits/fakeAstEdits";
import wescheme from "@bootstrapworld/wescheme";
import { makeLayoutLanguage } from "./helpers/layoutLanguage";
import * as actions from "../src/state/actions";
import * as selectors from "../src/state/selectors";
import { createAppStore } from "../src/state/store";
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

describe("an optional field", () => {
  let editor!: CodeMirrorFacade;
  let language!: ReturnType<typeof makeLayoutLanguage>;
  beforeEach(() => {
    language = makeLayoutLanguage();
    editor = new CodeMirrorFacade(CodeMirror(document.body, { value: "" }));
  });
  afterEach(() => {
    editor.codemirror.getWrapperElement().remove();
    language.remove();
  });

  const parse = (code: string) => language.language.buildAST(code);
  const init = (node: ASTNode) =>
    (node.fields as { init?: ASTNode | null }).init;

  /** perform an edit made by `make` on `code`; the text after, and what its focusHint said */
  const performed = (
    code: string,
    make: (ast: AST) => EditInterface
  ): { text: string; hint: unknown; ast: AST; edit: EditInterface } => {
    editor.setValue(code);
    const ast = parse(code);
    const store = createAppStore();
    store.dispatch(actions.setAST(ast));
    const edit = make(ast);
    const spy = jest.spyOn(edit, "focusHint");
    const result = store.dispatch(performEdits([edit], editor));
    if (!result.successful) throw result.exception;
    return {
      text: editor.getValue(),
      hint: spy.mock.results[0]?.value,
      ast: selectors.getAST(store.getState()),
      edit,
    };
  };

  describe("FakeAstInsertion", () => {
    it("is for an empty field: index 0, at the end of the parent", () => {
      const ast = parse("  (let x)");
      const parent = ast.rootNodes[0];
      const insertion = new FakeAstInsertion(parent, "init");
      expect(insertion.index).toBe(0);
      expect(insertion.pos).toEqual(parent.srcRange().to);
    });

    it("leaves out an index that is given: there is only the one place", () => {
      const ast = parse("(let x)");
      for (const given of [0, 1, 5, -2]) {
        const insertion = new FakeAstInsertion(ast.rootNodes[0], "init", given);
        expect(insertion.index).toBe(0);
        expect(insertion.pos).toEqual(ast.rootNodes[0].srcRange().to);
      }
    });

    it("is the same for a field that is undefined, not null", () => {
      const ast = parse("(letbody x ; a)");
      expect(init(ast.rootNodes[0])).toBeUndefined();
      const insertion = new FakeAstInsertion(ast.rootNodes[0], "init");
      expect(insertion.pos).toEqual(ast.rootNodes[0].srcRange().to);
    });

    it("throws for a field that holds a node already", () => {
      const ast = parse("(let x 1)");
      expect(() => new FakeAstInsertion(ast.rootNodes[0], "init")).toThrow(
        /optional field 'init' of 'let' holds a node already/
      );
    });

    it("throws for a field that is neither a list nor optional", () => {
      const ast = parse("(let x)");
      expect(() => new FakeAstInsertion(ast.rootNodes[0], "symbol")).toThrow(
        /Failed to find list or optional field/
      );
    });

    it("still finds the list of a node that has both", () => {
      const ast = parse("(letbody x ; a b)");
      const insertion = new FakeAstInsertion(ast.rootNodes[0], "body", 1);
      expect(insertion.index).toBe(1);
    });

    it("sets the field of a clone, and finds what it set", () => {
      const ast = parse("(let x)");
      const insertion = new FakeAstInsertion(ast.rootNodes[0], "init");
      const clone = ast.rootNodes[0];
      insertion.insertChild(clone, "1");
      expect(init(clone)?.toString()).toBe("1");
      // (found by the parent, in the AST that has it)
      expect(insertion.findChild(ast)).toBe(init(clone));
    });

    it("finds nothing in an AST that has no such parent", () => {
      const ast = parse("(let x)");
      const insertion = new FakeAstInsertion(ast.rootNodes[0], "init");
      expect(insertion.findChild(parse("(let y)"))).toBeNull();
    });
  });

  describe("edit_insert", () => {
    it("sets an empty field", () => {
      expect(
        performed("(let x)", (a) => edit_insert("1", a.rootNodes[0], "init"))
          .text
      ).toBe("(let x 1)");
    });

    it("sets a field that is undefined", () => {
      expect(
        performed("(letbody x ; a)", (a) =>
          edit_insert("1", a.rootNodes[0], "init")
        ).text
      ).toBe("(letbody x 1 ; a)");
    });

    it("sets it to an expression", () => {
      expect(
        performed("(let x)", (a) =>
          edit_insert("(plain a b)", a.rootNodes[0], "init")
        ).text
      ).toBe("(let x (plain a b))");
    });

    it("sets a field of a node that is inside another", () => {
      const { text } = performed("(block a (let x) b)", (a) =>
        edit_insert(
          "1",
          (a.rootNodes[0].fields as { statements: ASTNode[] }).statements[1],
          "init"
        )
      );
      expect(text).toBe("(block a (let x 1) b)");
    });

    it("throws for a field that holds a node, as the edit is made", () => {
      const ast = parse("(let x 1)");
      expect(() => edit_insert("2", ast.rootNodes[0], "init")).toThrow(
        /holds a node already/
      );
    });

    it("inserting nothing changes nothing, and points nowhere in particular", () => {
      const done = performed("(let x)", (a) =>
        edit_insert("  ", a.rootNodes[0], "init")
      );
      expect(done.text).toBe("(let x)");
      expect(done.hint).toBe("fallback");
    });

    it("points the focus at the node that was set", () => {
      const { hint } = performed("(let x)", (a) =>
        edit_insert("1", a.rootNodes[0], "init")
      );
      expect((hint as ASTNode).toString()).toBe("1");
    });

    it("finds the node it set in the AST that results", () => {
      const { ast, edit } = performed("(let x)", (a) =>
        edit_insert("1", a.rootNodes[0], "init")
      );
      const found = (
        edit as unknown as { fakeAstInsertion: FakeAstInsertion }
      ).fakeAstInsertion.findChild(ast);
      expect(found && (found as ASTNode).toString()).toBe("1");
      expect(init(ast.rootNodes[0])).toBe(found);
    });
  });

  describe("InsertTarget", () => {
    it("has no index, and the position at the end of its parent", () => {
      const ast = parse("(let x)");
      const target = new InsertTarget(ast.rootNodes[0], "init");
      expect(target.index).toBeUndefined();
      expect(target.field).toBe("init");
      expect(target.srcRange()).toEqual({
        from: ast.rootNodes[0].srcRange().to,
        to: ast.rootNodes[0].srcRange().to,
      });
    });

    it("makes the edit that sets the field", () => {
      const ast = parse("(let x)");
      const edit = new InsertTarget(ast.rootNodes[0], "init").toEdit(ast, "1");
      expect(edit.toString()).toMatch(/^InsertChild /);
    });

    it("throws for a field that is full", () => {
      const ast = parse("(let x 1)");
      expect(() => new InsertTarget(ast.rootNodes[0], "init")).toThrow(
        /holds a node already/
      );
    });
  });

  describe("findInsertionPlace", () => {
    it("is null for what an optional field holds: it is not in a list", () => {
      const ast = parse("(let x 1)");
      expect(findInsertionPlace(ast, init(ast.rootNodes[0])!)).toBeNull();
    });
  });
});
