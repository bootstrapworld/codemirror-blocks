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
import { bad, makeLayoutLanguage, shape } from "./helpers/layoutLanguage";

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
