import { fireEvent } from "@testing-library/react";
import { ASTNode } from "../src/ast";
import { API } from "../src/CodeMirrorBlocks";
import {
  findAdjacentDropTargetId,
  findInsertionPlace,
} from "../src/components/DropTarget";
import {
  cmd_ctrl,
  elementForNode,
  keyDown,
  mountCMB,
  mouseDown,
  teardown,
} from "../src/toolkit/test-utils";
import { installFakeClipboard } from "./helpers/clipboard";
import { drag } from "./helpers/dnd";
import { setEditableText } from "./helpers/editing";
import { allowConsoleErrors } from "./globalSetup";
import {
  bad,
  badopt,
  makeLayoutLanguage,
  shape,
} from "./helpers/layoutLanguage";

/**
 * A DropTarget says where it inserts with its `field` and `index`, and not by
 * where it is in the page: these programs lay their lists out so that the
 * targets are far from the elements they are for (see helpers/layoutLanguage).
 */

let cmb!: API;
let removeLanguage!: () => void;
let clipboard: ReturnType<typeof installFakeClipboard> | undefined;

const mount = (code: string) => {
  const { language, remove } = makeLayoutLanguage();
  removeLanguage = remove;
  cmb = mountCMB(language).cmb;
  cmb.setValue(code);
};
// (the click that follows a drag is ignored until a timer has run: a test that
// drops and then clicks, and the test after one that dropped, wait for it)
const tick = () => new Promise((done) => setTimeout(done, 0));
afterEach(async () => {
  await tick();
  clipboard?.restore();
  clipboard = undefined;
  jest.restoreAllMocks();
  teardown();
  removeLanguage();
});

const root = (i = 0) => cmb.getAst().rootNodes[i];
const list = (node: ASTNode, field: string) =>
  (node.fields as Record<string, ASTNode[]>)[field];
const roots = () => cmb.getAst().rootNodes.map(shape);

/** the drop targets of a list field of a node, in order of their index */
const targets = (parent: ASTNode, field: string) =>
  [
    ...document.querySelectorAll<HTMLElement>(
      `.blocks-drop-target[data-drop-parent="${parent.id}"][data-field="${field}"]`
    ),
  ].sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index));
const target = (parent: ASTNode, field: string, index: number) => {
  const found = targets(parent, field).filter(
    (el) => el.dataset.index === String(index)
  );
  expect(found).toHaveLength(1);
  return found[0];
};

const isEditing = () =>
  document.activeElement?.getAttribute("contenteditable") === "true";

/** click a drop target and type `text` in it, as a person would */
const insertThrough = (el: Element, text: string) => {
  fireEvent.click(el);
  expect(isEditing()).toBe(true);
  setEditableText(text);
  keyDown("Enter");
};

describe("a layout that puts the drop targets away from the elements", () => {
  const code = "(block a b c)";

  it("has a target for every place in the list, none beside an element", () => {
    mount(code);
    const block = root();
    const all = targets(block, "statements");
    expect(all.map((el) => el.dataset.index)).toEqual(["0", "1", "2", "3"]);
    for (const el of all) {
      // (in a gutter, or in the header: never next to a statement)
      expect(el.parentElement?.matches(".block-gutter, .block-header")).toBe(
        true
      );
      expect(el.nextElementSibling?.getAttribute("role")).not.toBe("treeitem");
      expect(el.previousElementSibling?.getAttribute("role")).not.toBe(
        "treeitem"
      );
    }
    // the target for the end is above the whole list in the page
    const last = target(block, "statements", 3);
    const firstRow = document.querySelector(".block-row")!;
    expect(
      last.compareDocumentPosition(firstRow) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it.each([
    [0, "(block x a b c)"],
    [1, "(block a x b c)"],
    [2, "(block a b x c)"],
    [3, "(block a b c x)"],
  ])("typing in the target with index %i inserts there", (index, expected) => {
    mount(code);
    insertThrough(target(root(), "statements", index), "x");
    expect(roots()).toEqual([expected]);
  });

  it.each([
    [0, "(block q a b c)"],
    [1, "(block a q b c)"],
    [2, "(block a b q c)"],
    [3, "(block a b c q)"],
  ])(
    "dropping a block on the target with index %i inserts it there",
    (index, expected) => {
      mount(`${code} q`);
      const q = root(1);
      drag(elementForNode(q)!).dropOnto(target(root(0), "statements", index));
      expect(roots()).toEqual([expected]);
    }
  );

  it("dropping a block from inside the list moves it to the target", () => {
    mount(code);
    const [a] = list(root(), "statements");
    drag(elementForNode(a)!).dropOnto(target(root(), "statements", 3));
    expect(roots()).toEqual(["(block b c a)"]);
  });

  it("an empty insertion changes nothing", () => {
    mount(code);
    insertThrough(target(root(), "statements", 1), " ");
    expect(roots()).toEqual(["(block a b c)"]);
  });
});

describe("an empty list", () => {
  it("has the one target, with index 0", () => {
    mount("(block)");
    expect(targets(root(), "statements").map((el) => el.dataset.index)).toEqual(
      ["0"]
    );
  });

  it("takes what is typed into it", () => {
    mount("(block)");
    insertThrough(target(root(), "statements", 0), "x");
    expect(roots()).toEqual(["(block x)"]);
  });

  it("takes what is dropped on it", () => {
    mount("(block) q");
    drag(elementForNode(root(1))!).dropOnto(target(root(0), "statements", 0));
    expect(roots()).toEqual(["(block q)"]);
  });

  it("takes several, one after the other, each after the last", () => {
    mount("(block)");
    insertThrough(target(root(), "statements", 0), "x");
    insertThrough(target(root(), "statements", 1), "y");
    insertThrough(target(root(), "statements", 2), "z");
    expect(roots()).toEqual(["(block x y z)"]);
  });

  it("in a list the other targets of which have the same field", () => {
    mount("(two ; c)");
    expect(targets(root(), "args").map((el) => el.dataset.index)).toEqual([
      "0",
    ]);
    insertThrough(target(root(), "args", 0), "x");
    expect(roots()).toEqual(["(two x ; c)"]);
  });
});

describe("a list with orphan comments among its elements", () => {
  const code = "(block a #| note |# b)";

  it("counts the comments: the list has three elements, and four places", () => {
    mount(code);
    expect(list(root(), "statements").map(shape)).toEqual([
      "a",
      "#| note |#",
      "b",
    ]);
    expect(targets(root(), "statements").map((el) => el.dataset.index)).toEqual(
      ["0", "1", "2", "3"]
    );
  });

  it.each([
    [0, ["x", "a", "#| note |#", "b"]],
    [1, ["a", "x", "#| note |#", "b"]], // before the comment
    [2, ["a", "#| note |#", "x", "b"]], // after the comment, before b
    [3, ["a", "#| note |#", "b", "x"]],
  ])(
    "typing in the target with index %i inserts as element %i",
    (index, expected) => {
      mount(code);
      insertThrough(target(root(), "statements", index), "x");
      expect(list(root(), "statements").map(shape)).toEqual(expected);
    }
  );

  it("numbers the lines without counting the comment, unlike the index", () => {
    mount(code);
    const rows = [...document.querySelectorAll(".block-row")];
    expect(
      rows.map((row) => row.querySelector(".block-number")?.textContent)
    ).toEqual(["1", "", "2"]);
    expect(
      rows.map(
        (row) =>
          row.querySelector<HTMLElement>(".blocks-drop-target")?.dataset.index
      )
    ).toEqual(["0", "1", "2"]);
  });

  it("the line numbers carry on after an insertion, the indices too", () => {
    mount(code);
    insertThrough(target(root(), "statements", 2), "x");
    const rows = [...document.querySelectorAll(".block-row")];
    expect(
      rows.map((row) => row.querySelector(".block-number")?.textContent)
    ).toEqual(["1", "", "2", "3"]);
    expect(
      rows.map(
        (row) =>
          row.querySelector<HTMLElement>(".blocks-drop-target")?.dataset.index
      )
    ).toEqual(["0", "1", "2", "3"]);
  });

  it("finds the targets beside a comment as it does beside any element", () => {
    mount(code);
    const comment = list(root(), "statements")[1];
    const left = findAdjacentDropTargetId(cmb.getAst(), comment, true);
    const right = findAdjacentDropTargetId(cmb.getAst(), comment, false);
    expect(document.getElementById(`block-drop-target-${left}`)).toBe(
      target(root(), "statements", 1)
    );
    expect(document.getElementById(`block-drop-target-${right}`)).toBe(
      target(root(), "statements", 2)
    );
  });
});

describe("two lists in one node", () => {
  const code = "(two a b ; c d)";

  it("has targets for each, with the same indices", () => {
    mount(code);
    expect(targets(root(), "args").map((el) => el.dataset.index)).toEqual([
      "0",
      "1",
      "2",
    ]);
    expect(targets(root(), "body").map((el) => el.dataset.index)).toEqual([
      "0",
      "1",
      "2",
    ]);
  });

  it("a target of one list only changes that list", () => {
    mount(code);
    insertThrough(target(root(), "args", 1), "x");
    expect(roots()).toEqual(["(two a x b ; c d)"]);
  });

  it("the target with the same index in the other list changes the other", () => {
    mount(code);
    insertThrough(target(root(), "body", 1), "x");
    expect(roots()).toEqual(["(two a b ; c x d)"]);
  });

  it("the end of each list is its own", () => {
    mount(code);
    insertThrough(target(root(), "body", 2), "x");
    expect(roots()).toEqual(["(two a b ; c d x)"]);
    insertThrough(target(root(), "args", 2), "y");
    expect(roots()).toEqual(["(two a b y ; c d x)"]);
  });

  it("dropping a block from one list on the other list moves it", () => {
    mount(code);
    const [a] = list(root(), "args");
    drag(elementForNode(a)!).dropOnto(target(root(), "body", 1));
    expect(roots()).toEqual(["(two b ; c a d)"]);
  });

  it("finds the target beside an element in its own list, not the one with the same index in the other", () => {
    mount(code);
    const b = list(root(), "args")[1];
    const d = list(root(), "body")[1];
    const place = (child: ASTNode, onLeft: boolean) => {
      const id = findAdjacentDropTargetId(cmb.getAst(), child, onLeft);
      return document.getElementById(`block-drop-target-${id}`);
    };
    expect(place(b, true)).toBe(target(root(), "args", 1));
    expect(place(b, false)).toBe(target(root(), "args", 2));
    expect(place(d, true)).toBe(target(root(), "body", 1));
    expect(place(d, false)).toBe(target(root(), "body", 2));
  });

  it("knows where an element is among the lists of its parent", () => {
    mount(code);
    const d = list(root(), "body")[1];
    const place = findInsertionPlace(cmb.getAst(), d);
    expect(place).toMatchObject({ field: "body", index: 1 });
    expect(place?.parent.id).toBe(root().id);
    // (a root has no place, nor has a node that is not in a list)
    expect(findInsertionPlace(cmb.getAst(), root())).toBeNull();
  });
});

describe("blocks inside blocks, with the same field and indices", () => {
  const code = "(block a (block b c) d)";
  const inner = () => list(root(), "statements")[1];

  it("each node has its own targets", () => {
    mount(code);
    expect(targets(root(), "statements").map((el) => el.dataset.index)).toEqual(
      ["0", "1", "2", "3"]
    );
    expect(
      targets(inner(), "statements").map((el) => el.dataset.index)
    ).toEqual(["0", "1", "2"]);
  });

  it("the inner node's target changes the inner list", () => {
    mount(code);
    insertThrough(target(inner(), "statements", 1), "x");
    expect(roots()).toEqual(["(block a (block b x c) d)"]);
  });

  it("the outer node's target with the same index changes the outer list", () => {
    mount(code);
    insertThrough(target(root(), "statements", 1), "x");
    expect(roots()).toEqual(["(block a x (block b c) d)"]);
  });

  it("the end of the inner list is not the end of the outer", () => {
    mount(code);
    insertThrough(target(inner(), "statements", 2), "x");
    expect(roots()).toEqual(["(block a (block b c x) d)"]);
    insertThrough(target(root(), "statements", 3), "y");
    expect(roots()).toEqual(["(block a (block b c x) d y)"]);
  });

  it("finds the targets beside the inner node in the outer list", () => {
    mount(code);
    const id = (onLeft: boolean) =>
      findAdjacentDropTargetId(cmb.getAst(), inner(), onLeft);
    expect(document.getElementById(`block-drop-target-${id(true)}`)).toBe(
      target(root(), "statements", 1)
    );
    expect(document.getElementById(`block-drop-target-${id(false)}`)).toBe(
      target(root(), "statements", 2)
    );
  });

  it("finds the targets beside a node of the inner list in the inner list", () => {
    mount(code);
    const c = list(inner(), "statements")[1];
    const id = (onLeft: boolean) =>
      findAdjacentDropTargetId(cmb.getAst(), c, onLeft);
    expect(document.getElementById(`block-drop-target-${id(true)}`)).toBe(
      target(inner(), "statements", 1)
    );
    expect(document.getElementById(`block-drop-target-${id(false)}`)).toBe(
      target(inner(), "statements", 2)
    );
  });

  it("dropping the inner block on the outer list's end moves it out", () => {
    mount(code);
    drag(elementForNode(inner())!).dropOnto(target(root(), "statements", 3));
    expect(roots()).toEqual(["(block a d (block b c))"]);
  });

  it("dropping a block in a deeper level of three", () => {
    mount("(block (block (block a)) q)");
    const middle = list(root(), "statements")[0];
    const deepest = list(middle, "statements")[0];
    drag(elementForNode(list(root(), "statements")[1])!).dropOnto(
      target(deepest, "statements", 0)
    );
    expect(roots()).toEqual(["(block (block (block q a)))"]);
  });
});

describe("the keyboard, in a layout where the targets are away from the elements", () => {
  const code = "(block a #| note |# b)";
  const element = (i: number) => list(root(), "statements")[i];

  it.each([
    // [which element, key, expected]
    [0, "[", ["x", "a", "#| note |#", "b"]],
    [0, "]", ["a", "x", "#| note |#", "b"]],
    [1, "[", ["a", "x", "#| note |#", "b"]],
    [1, "]", ["a", "#| note |#", "x", "b"]],
    [2, "[", ["a", "#| note |#", "x", "b"]],
    [2, "]", ["a", "#| note |#", "b", "x"]],
  ])("element %i, Ctrl-%s opens the gap beside it", (i, key, expected) => {
    mount(code);
    const node = element(i);
    mouseDown(node);
    keyDown(key, { ctrlKey: true }, node);
    expect(isEditing()).toBe(true);
    setEditableText("x");
    keyDown("Enter");
    expect(list(root(), "statements").map(shape)).toEqual(expected);
  });

  it("opens the very target that has the index of that side", () => {
    mount(code);
    const b = element(2);
    // (the box of the target replaces the target in the page: ask before)
    const id = findAdjacentDropTargetId(cmb.getAst(), b, true);
    expect(id).not.toBeNull();
    mouseDown(b);
    keyDown("[", { ctrlKey: true }, b);
    expect(document.activeElement?.id).toBe(`block-drop-target-${id}`);
  });

  it("in the second of two lists, the gap is in that list", () => {
    mount("(two a b ; c d)");
    const d = list(root(), "body")[1];
    mouseDown(d);
    keyDown("]", { ctrlKey: true }, d);
    setEditableText("x");
    keyDown("Enter");
    expect(roots()).toEqual(["(two a b ; c d x)"]);
  });

  it("in an inner block, the gap is in the inner list", () => {
    mount("(block a (block b c) d)");
    const inner = list(root(), "statements")[1];
    const c = list(inner, "statements")[1];
    mouseDown(c);
    keyDown("[", { ctrlKey: true }, c);
    setEditableText("x");
    keyDown("Enter");
    expect(roots()).toEqual(["(block a (block b x c) d)"]);
  });

  describe("paste beside an element", () => {
    beforeEach(() => {
      clipboard = installFakeClipboard("x");
    });
    const paste = (node: ASTNode, before: boolean) => {
      mouseDown(node);
      keyDown("V", { ...cmd_ctrl, shiftKey: before }, node);
    };

    it.each([
      [0, false, ["a", "x", "#| note |#", "b"]],
      [0, true, ["x", "a", "#| note |#", "b"]],
      [1, false, ["a", "#| note |#", "x", "b"]],
      [1, true, ["a", "x", "#| note |#", "b"]],
      [2, false, ["a", "#| note |#", "b", "x"]],
      [2, true, ["a", "#| note |#", "x", "b"]],
    ])("element %i, before: %s", (i, before, expected) => {
      mount(code);
      paste(element(i), before);
      expect(list(root(), "statements").map(shape)).toEqual(expected);
    });

    it("in an inner list, goes in the inner list", () => {
      mount("(block a (block b c) d)");
      const inner = list(root(), "statements")[1];
      paste(list(inner, "statements")[0], false);
      expect(roots()).toEqual(["(block a (block b x c) d)"]);
    });

    it("beside an element of the second list, goes in that list", () => {
      mount("(two a b ; c d)");
      paste(list(root(), "body")[0], true);
      expect(roots()).toEqual(["(two a b ; x c d)"]);
    });
  });
});

describe("inserting more than once", () => {
  it("each new target has the index of its place: the one after the last insertion", () => {
    mount("(block a b)");
    insertThrough(target(root(), "statements", 1), "x");
    expect(roots()).toEqual(["(block a x b)"]);
    // (the target after x is the one with index 2 now: it was 1 before)
    insertThrough(target(root(), "statements", 2), "y");
    expect(roots()).toEqual(["(block a x y b)"]);
    insertThrough(target(root(), "statements", 4), "z");
    expect(roots()).toEqual(["(block a x y b z)"]);
    insertThrough(target(root(), "statements", 0), "w");
    expect(roots()).toEqual(["(block w a x y b z)"]);
  });

  it("the targets are renumbered when the list grows", () => {
    mount("(block a b)");
    insertThrough(target(root(), "statements", 0), "x");
    insertThrough(target(root(), "statements", 0), "y");
    expect(targets(root(), "statements").map((el) => el.dataset.index)).toEqual(
      ["0", "1", "2", "3", "4"]
    );
    expect(roots()).toEqual(["(block y x a b)"]);
  });

  it("the targets are renumbered when the list shrinks", () => {
    mount("(block a b c)");
    const [a] = list(root(), "statements");
    mouseDown(a);
    keyDown(" ", {}, a);
    keyDown("Delete", {}, a);
    expect(roots()).toEqual(["(block b c)"]);
    expect(targets(root(), "statements").map((el) => el.dataset.index)).toEqual(
      ["0", "1", "2"]
    );
    insertThrough(target(root(), "statements", 2), "x");
    expect(roots()).toEqual(["(block b c x)"]);
  });

  it("an insertion in a list does not disturb the targets of the other", () => {
    mount("(two a b ; c d)");
    insertThrough(target(root(), "args", 0), "x");
    insertThrough(target(root(), "body", 1), "y");
    insertThrough(target(root(), "args", 3), "z");
    expect(roots()).toEqual(["(two x a b z ; c y d)"]);
  });

  it("a drop, then a typed insertion beside it, then undo and redo", async () => {
    mount("(block a b) q");
    drag(elementForNode(root(1))!).dropOnto(target(root(0), "statements", 1));
    expect(roots()).toEqual(["(block a q b)"]);
    await tick();
    insertThrough(target(root(), "statements", 2), "x");
    expect(roots()).toEqual(["(block a q x b)"]);
    keyDown("Z", cmd_ctrl);
    expect(roots()).toEqual(["(block a q b)"]);
    keyDown("Z", cmd_ctrl);
    expect(roots()).toEqual(["(block a b)", "q"]);
    keyDown("Y", cmd_ctrl);
    await tick();
    insertThrough(target(root(), "statements", 3), "y");
    expect(roots()).toEqual(["(block a q b y)"]);
  });
});

describe("a drop target that is made wrong", () => {
  let errors: jest.SpyInstance;
  beforeEach(() => {
    errors = allowConsoleErrors();
    bad.field = "items";
    bad.index = 0;
  });
  afterEach(() => {
    bad.field = "items";
    bad.index = 0;
  });
  const logged = () =>
    errors.mock.calls.map((call) => call.map(String).join(" ")).join("\n");

  it("is fine with the field of a list and the index 0, in an empty list", () => {
    mount("(bad)");
    expect(errors).not.toHaveBeenCalled();
  });

  it("says so when the index is past the end of the list", () => {
    bad.index = 99;
    mount("(bad)");
    expect(logged()).toMatch(/99/);
  });

  it("says so when the index is below the start", () => {
    bad.index = -1;
    mount("(bad)");
    expect(logged()).toMatch(/-1/);
  });

  it("says so when the index is not a whole number", () => {
    bad.index = 1.5;
    mount("(bad)");
    expect(logged()).toMatch(/1\.5/);
  });

  it("says so when the index is not a number at all", () => {
    (bad as { index: unknown }).index = "first";
    mount("(bad)");
    expect(logged()).toMatch(/first/);
  });

  it("says so when the field is not a field of the node", () => {
    bad.field = "nope";
    mount("(bad)");
    expect(logged()).toMatch(/nope/);
  });

  it("says so when there is no field", () => {
    bad.field = "";
    mount("(bad)");
    expect(logged()).toMatch(/field/);
  });

  it("does not say anything about the targets of a layout that is right", () => {
    mount("(block a #| note |# b) (two a ; c d) (plain x y)");
    expect(errors).not.toHaveBeenCalled();
  });
});

/** the drop target for an optional field of a node: it has no index */
const optionalTargets = (parent: ASTNode, field: string) =>
  targets(parent, field).filter((el) => el.dataset.index === undefined);
const optionalTarget = (parent: ASTNode, field = "init") => {
  const found = optionalTargets(parent, field);
  expect(found).toHaveLength(1);
  return found[0];
};
const field = (node: ASTNode, name: string) =>
  (node.fields as Record<string, ASTNode | null | undefined>)[name];
const undo = () => keyDown("Z", cmd_ctrl);
const redo = () => keyDown("Y", cmd_ctrl);
const deleteNode = (node: ASTNode) => {
  mouseDown(node);
  keyDown(" ", {}, node);
  keyDown("Delete", {}, node);
};

describe("a drop target for an optional field", () => {
  it("is there while the field is empty, with no index, and not once it is filled", () => {
    mount("(let x) (let y 1)");
    const empty = targets(root(0), "init");
    expect(empty).toHaveLength(1);
    expect(empty[0].dataset.index).toBeUndefined();
    expect(empty[0].dataset.field).toBe("init");
    expect(empty[0].dataset.dropParent).toBe(root(0).id);
    expect(targets(root(1), "init")).toHaveLength(0);
  });

  it("takes what is typed into it, and goes", () => {
    mount("(let x)");
    insertThrough(optionalTarget(root()), "1");
    expect(roots()).toEqual(["(let x 1)"]);
    expect(cmb.getValue()).toBe("(let x 1)");
    expect(targets(root(), "init")).toHaveLength(0);
  });

  it("takes a whole expression", () => {
    mount("(let x)");
    insertThrough(optionalTarget(root()), "(plain a b)");
    expect(roots()).toEqual(["(let x (plain a b))"]);
  });

  it("an empty insertion changes nothing, and the target stays", () => {
    mount("(let x)");
    insertThrough(optionalTarget(root()), " ");
    expect(roots()).toEqual(["(let x)"]);
    expect(targets(root(), "init")).toHaveLength(1);
  });

  it("takes a block dropped on it, which leaves where it was", () => {
    mount("(let x) q");
    drag(elementForNode(root(1))!).dropOnto(optionalTarget(root(0)));
    expect(roots()).toEqual(["(let x q)"]);
  });

  it("takes a block dropped on it from inside a list", () => {
    mount("(let x) (block a b)");
    const [a] = list(root(1), "statements");
    drag(elementForNode(a)!).dropOnto(optionalTarget(root(0)));
    expect(roots()).toEqual(["(let x a)", "(block b)"]);
  });

  it("is back when the init is undone, and goes again when it is redone", () => {
    mount("(let x)");
    insertThrough(optionalTarget(root()), "1");
    expect(targets(root(), "init")).toHaveLength(0);
    undo();
    expect(roots()).toEqual(["(let x)"]);
    expect(targets(root(), "init")).toHaveLength(1);
    redo();
    expect(roots()).toEqual(["(let x 1)"]);
    expect(targets(root(), "init")).toHaveLength(0);
  });

  it("is back when the init is deleted, and can be used again", () => {
    mount("(let x 1)");
    expect(targets(root(), "init")).toHaveLength(0);
    deleteNode(field(root(), "init")!);
    expect(roots()).toEqual(["(let x)"]);
    insertThrough(optionalTarget(root()), "2");
    expect(roots()).toEqual(["(let x 2)"]);
    deleteNode(field(root(), "init")!);
    insertThrough(optionalTarget(root()), "3");
    expect(roots()).toEqual(["(let x 3)"]);
  });

  it("is back when the init is dragged away, to a list", () => {
    mount("(let x 1) (block)");
    drag(elementForNode(field(root(0), "init")!)!).dropOnto(
      target(root(1), "statements", 0)
    );
    expect(roots()).toEqual(["(let x)", "(block 1)"]);
    expect(targets(root(0), "init")).toHaveLength(1);
  });

  it("is used again after an insertion, an undo, and a drop", async () => {
    mount("(let x) q");
    insertThrough(optionalTarget(root(0)), "1");
    undo();
    await tick();
    drag(elementForNode(root(1))!).dropOnto(optionalTarget(root(0)));
    expect(roots()).toEqual(["(let x q)"]);
  });

  it("is the same when the field is undefined, not null", () => {
    mount("(letbody x ; a)");
    expect(field(root(), "init")).toBeUndefined();
    expect(targets(root(), "init")).toHaveLength(1);
    insertThrough(optionalTarget(root()), "1");
    expect(roots()).toEqual(["(letbody x 1 ; a)"]);
    undo();
    expect(field(root(), "init")).toBeFalsy();
    expect(targets(root(), "init")).toHaveLength(1);
  });
});

describe("an optional field next to a list in the same node", () => {
  const code = "(letbody x ; a b)";

  it("has one target for the optional field and the targets of the list", () => {
    mount(code);
    expect(optionalTargets(root(), "init")).toHaveLength(1);
    expect(targets(root(), "body").map((el) => el.dataset.index)).toEqual([
      "0",
      "1",
      "2",
    ]);
    // (none of the list's targets is taken for the optional field's)
    expect(optionalTargets(root(), "body")).toHaveLength(0);
  });

  it("the optional target fills the init, not the list", () => {
    mount(code);
    insertThrough(optionalTarget(root()), "1");
    expect(roots()).toEqual(["(letbody x 1 ; a b)"]);
  });

  it("a list target fills the list, not the init", () => {
    mount(code);
    insertThrough(target(root(), "body", 0), "1");
    expect(roots()).toEqual(["(letbody x ; 1 a b)"]);
    expect(targets(root(), "init")).toHaveLength(1);
  });

  it("both, one after the other, in either order", () => {
    mount(code);
    insertThrough(target(root(), "body", 1), "z");
    insertThrough(optionalTarget(root()), "1");
    insertThrough(target(root(), "body", 3), "w");
    expect(roots()).toEqual(["(letbody x 1 ; a z b w)"]);
  });

  it("dropping from the list on the init, and from the init on the list", () => {
    mount(code);
    const [a] = list(root(), "body");
    drag(elementForNode(a)!).dropOnto(optionalTarget(root()));
    expect(roots()).toEqual(["(letbody x a ; b)"]);
    drag(elementForNode(field(root(), "init")!)!).dropOnto(
      target(root(), "body", 1)
    );
    expect(roots()).toEqual(["(letbody x ; b a)"]);
  });

  it("finds the optional target to the right of the symbol, and the list's beside its elements", () => {
    mount(code);
    const symbol = field(root(), "symbol")!;
    const [a, b] = list(root(), "body");
    const el = (child: ASTNode, onLeft: boolean) =>
      document.getElementById(
        `block-drop-target-${findAdjacentDropTargetId(cmb.getAst(), child, onLeft)}`
      );
    expect(el(symbol, false)).toBe(optionalTarget(root()));
    expect(el(symbol, true)).toBeNull();
    expect(el(a, true)).toBe(target(root(), "body", 0));
    expect(el(a, false)).toBe(target(root(), "body", 1));
    expect(el(b, false)).toBe(target(root(), "body", 2));
  });

  it("a symbol is not an element of a list, an element of the body is", () => {
    mount(code);
    expect(
      findInsertionPlace(cmb.getAst(), field(root(), "symbol")!)
    ).toBeNull();
    expect(
      findInsertionPlace(cmb.getAst(), list(root(), "body")[1])
    ).toMatchObject({ field: "body", index: 1 });
  });
});

describe("the keyboard and paste, beside the symbol of a let", () => {
  const symbol = () => field(root(), "symbol")!;

  it("Ctrl-] on the symbol opens the target for the init", () => {
    mount("(let x)");
    mouseDown(symbol());
    keyDown("]", { ctrlKey: true }, symbol());
    expect(isEditing()).toBe(true);
    setEditableText("1");
    keyDown("Enter");
    expect(roots()).toEqual(["(let x 1)"]);
  });

  it("opens the very target of the field", () => {
    mount("(let x)");
    const id = findAdjacentDropTargetId(cmb.getAst(), symbol(), false);
    expect(document.getElementById(`block-drop-target-${id}`)).toBe(
      optionalTarget(root())
    );
    mouseDown(symbol());
    keyDown("]", { ctrlKey: true }, symbol());
    expect(document.activeElement?.id).toBe(`block-drop-target-${id}`);
  });

  it("Ctrl-[ on the symbol has no gap to open: nothing is to its left", () => {
    mount("(let x)");
    mouseDown(symbol());
    keyDown("[", { ctrlKey: true }, symbol());
    expect(isEditing()).toBe(false);
    expect(roots()).toEqual(["(let x)"]);
  });

  it("Ctrl-] on the symbol has no gap once the init is there", () => {
    mount("(let x 1)");
    mouseDown(symbol());
    keyDown("]", { ctrlKey: true }, symbol());
    expect(isEditing()).toBe(false);
  });

  it("Ctrl-[ on the init has no gap, and Ctrl-] neither", () => {
    mount("(let x 1)");
    const init = field(root(), "init")!;
    mouseDown(init);
    keyDown("[", { ctrlKey: true }, init);
    expect(isEditing()).toBe(false);
    keyDown("]", { ctrlKey: true }, init);
    expect(isEditing()).toBe(false);
  });

  it("Ctrl-] on the symbol of a node with a list too opens the init, not the list", () => {
    mount("(letbody x ; a b)");
    mouseDown(symbol());
    keyDown("]", { ctrlKey: true }, symbol());
    setEditableText("1");
    keyDown("Enter");
    expect(roots()).toEqual(["(letbody x 1 ; a b)"]);
  });

  describe("paste", () => {
    beforeEach(() => {
      clipboard = installFakeClipboard("7");
    });
    const paste = (node: ASTNode, before: boolean) => {
      mouseDown(node);
      keyDown("V", { ...cmd_ctrl, shiftKey: before }, node);
    };

    it("after the symbol inserts the init", () => {
      mount("(let x)");
      paste(symbol(), false);
      expect(roots()).toEqual(["(let x 7)"]);
      expect(targets(root(), "init")).toHaveLength(0);
    });

    it("before the symbol has nowhere to go", () => {
      mount("(let x)");
      paste(symbol(), true);
      expect(roots()).toEqual(["(let x)"]);
    });

    it("after the symbol, when the init is there, has nowhere to go", () => {
      mount("(let x 1)");
      paste(symbol(), false);
      expect(roots()).toEqual(["(let x 1)"]);
    });

    it("after the symbol of a node with a list, fills the init", () => {
      mount("(letbody x ; a b)");
      paste(symbol(), false);
      expect(roots()).toEqual(["(letbody x 7 ; a b)"]);
    });

    it("beside an element of the list, goes in the list", () => {
      mount("(letbody x ; a b)");
      paste(list(root(), "body")[0], false);
      expect(roots()).toEqual(["(letbody x ; a 7 b)"]);
    });
  });
});

describe("lets inside other nodes, with the same field names", () => {
  it("each let has its own target, side by side in a list", () => {
    mount("(block (let a) (let b))");
    const [a, b] = list(root(), "statements");
    expect(optionalTargets(a, "init")).toHaveLength(1);
    expect(optionalTargets(b, "init")).toHaveLength(1);
    insertThrough(optionalTarget(b), "1");
    expect(roots()).toEqual(["(block (let a) (let b 1))"]);
    insertThrough(optionalTarget(a), "2");
    expect(roots()).toEqual(["(block (let a 2) (let b 1))"]);
  });

  it("a let that is the init of a let: only the inner one is empty", () => {
    mount("(let x (let y))");
    const inner = field(root(), "init")!;
    expect(targets(root(), "init")).toHaveLength(0);
    expect(optionalTargets(inner, "init")).toHaveLength(1);
    insertThrough(optionalTarget(inner), "1");
    expect(roots()).toEqual(["(let x (let y 1))"]);
  });

  it("a let in a block that is the init of a let", () => {
    mount("(let x (block (let y)))");
    const block = field(root(), "init")!;
    const inner = list(block, "statements")[0];
    expect(targets(root(), "init")).toHaveLength(0);
    expect(optionalTargets(inner, "init")).toHaveLength(1);
    insertThrough(optionalTarget(inner), "1");
    expect(roots()).toEqual(["(let x (block (let y 1)))"]);
    // (and the block's own list is still its own)
    insertThrough(target(block, "statements", 1), "z");
    expect(roots()).toEqual(["(let x (block (let y 1) z))"]);
  });

  it("an empty let around a block with an empty let in it", () => {
    mount("(block (let a) (block (let b)))");
    const outer = list(root(), "statements");
    const innerBlock = outer[1];
    const innerLet = list(innerBlock, "statements")[0];
    insertThrough(optionalTarget(innerLet), "1");
    insertThrough(optionalTarget(outer[0]), "2");
    expect(roots()).toEqual(["(block (let a 2) (block (let b 1)))"]);
  });

  it("a let in the body of a let with a body", () => {
    mount("(letbody x ; (let y) (let z))");
    const [y, z] = list(root(), "body");
    // (the outer init target is the outer's: the inner lets' are theirs)
    expect(optionalTargets(root(), "init")).toHaveLength(1);
    insertThrough(optionalTarget(z), "1");
    insertThrough(optionalTarget(root()), "2");
    insertThrough(optionalTarget(y), "3");
    expect(roots()).toEqual(["(letbody x 2 ; (let y 3) (let z 1))"]);
  });

  it("the symbol of the inner let opens the inner target, not the outer", () => {
    mount("(letbody x ; (let y))");
    const inner = list(root(), "body")[0];
    const symbol = field(inner, "symbol")!;
    mouseDown(symbol);
    keyDown("]", { ctrlKey: true }, symbol);
    setEditableText("1");
    keyDown("Enter");
    expect(roots()).toEqual(["(letbody x ; (let y 1))"]);
  });

  it("dropping an inner let's init on the outer let's", () => {
    mount("(let x) (let y 1)");
    drag(elementForNode(field(root(1), "init")!)!).dropOnto(
      optionalTarget(root(0))
    );
    expect(roots()).toEqual(["(let x 1)", "(let y)"]);
  });
});

describe("an optional drop target that is made wrong", () => {
  let errors: jest.SpyInstance;
  beforeEach(() => {
    errors = allowConsoleErrors();
    badopt.field = "init";
    badopt.index = undefined;
  });
  afterEach(() => {
    badopt.field = "init";
    badopt.index = undefined;
  });
  const logged = () =>
    errors.mock.calls.map((call) => call.map(String).join(" ")).join("\n");

  it("is fine for an empty optional field with no index", () => {
    mount("(badopt)");
    expect(errors).not.toHaveBeenCalled();
  });

  it("says so when an index is given for an optional field", () => {
    badopt.index = 0;
    mount("(badopt)");
    expect(logged()).toMatch(/'init'.*no index/);
  });

  it("says so when the index is left out for a list", () => {
    badopt.field = "items";
    mount("(badopt)");
    expect(logged()).toMatch(/'items'.*needs an index/);
  });

  it("says so when it is drawn while the field holds a node", () => {
    mount("(badopt 1)");
    expect(logged()).toMatch(/'init'.*holds a node/);
  });
});
