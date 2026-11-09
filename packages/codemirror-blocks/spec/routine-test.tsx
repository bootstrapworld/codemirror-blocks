import { fireEvent } from "@testing-library/react";
import { ASTNode } from "../src/ast";
import { API } from "../src/CodeMirrorBlocks";
import routine from "@bootstrapworld/routine";
import {
  elementForNode,
  keyDown,
  mountCMB,
  mouseDown,
  teardown,
} from "../src/toolkit/test-utils";
import { drag } from "./helpers/dnd";
import { setEditableText } from "./helpers/editing";

/**
 * Routine (src/languages/routine) is a language written to use the editor's
 * newer API: these check that it does what each part of it is there to show.
 */

let cmb!: API;
const mount = (code: string) => {
  cmb = mountCMB(routine).cmb;
  cmb.setValue(code);
};
const tick = () => new Promise((done) => setTimeout(done, 0));
afterEach(async () => {
  await tick();
  teardown();
});

const root = (i = 0) => cmb.getAst().rootNodes[i];
const text = () => cmb.getAst().toString();
const targets = (parent: ASTNode, field: string) =>
  [
    ...document.querySelectorAll<HTMLElement>(
      `.blocks-drop-target[data-drop-parent="${parent.id}"][data-field="${field}"]`
    ),
  ].sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index));
const insertThrough = (el: Element, value: string) => {
  fireEvent.click(el);
  expect(document.activeElement?.getAttribute("contenteditable")).toBe("true");
  setEditableText(value);
  keyDown("Enter");
};
const hints = () =>
  [...document.querySelectorAll(".blocks-hint")].map((el) => el.textContent);

describe("the steps of a repeat, drawn as a numbered list with its targets elsewhere", () => {
  const code = '(repeat 2 (show "a") (show "b"))';

  it("has a target for each place in the list, in the gutters and the head", () => {
    mount(code);
    const all = targets(root(), "steps");
    expect(all.map((el) => el.dataset.index)).toEqual(["0", "1", "2"]);
    const [first, , end] = all;
    expect(first.parentElement?.className).toBe("routine-gutter");
    // (the one for the end is in the head, above all the steps in the page)
    expect(end.closest("header")).not.toBeNull();
    const firstStep = document.querySelector(".routine-step")!;
    expect(
      end.compareDocumentPosition(firstStep) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it.each([
    [0, '(repeat 2\n  (show "x")\n  (show "a")\n  (show "b"))'],
    [1, '(repeat 2\n  (show "a")\n  (show "x")\n  (show "b"))'],
    [2, '(repeat 2\n  (show "a")\n  (show "b")\n  (show "x"))'],
  ])(
    "typing in the target with index %i adds the step there",
    (i, expected) => {
      mount(code);
      insertThrough(targets(root(), "steps")[i], '(show "x")');
      expect(text()).toBe(expected);
    }
  );

  it("numbers the steps, and not the comments among them", () => {
    mount("(repeat 2\n\n  #| a note |#\n\n  (show 1)\n\n  (show 2))");
    expect(
      [...document.querySelectorAll(".routine-step-number")].map(
        (el) => el.textContent
      )
    ).toEqual(["1", "2"]);
    // (but the comment is in the list: the target after it is index 2)
    const all = targets(root(), "steps");
    expect(all.map((el) => el.dataset.index)).toEqual(["0", "1", "2", "3"]);
    insertThrough(all[2], "(show 9)");
    expect(text()).toBe(
      // (a blank line keeps a comment a block of its own, with nothing on it)
      "(repeat 2\n  #| a note |#\n\n  (show 1)\n  (show 9)\n  (show 2))"
    );
  });
});

describe("an optional part with nothing in it", () => {
  it("takes a drop target, which fills it, and then is gone", () => {
    mount("(let spare)");
    const [start] = targets(root(), "start");
    expect(start.dataset.index).toBeUndefined();
    insertThrough(start, "5");
    expect(text()).toBe("(let spare 5)");
    expect(targets(root(), "start")).toHaveLength(0);
  });

  it("is the otherwise of a choice, drawn up beside the test", () => {
    mount("(if (> a 1) (show 1))");
    const [otherwise] = targets(root(), "otherwise");
    expect(otherwise.closest("header")).not.toBeNull();
    insertThrough(otherwise, "(show 2)");
    expect(text()).toBe("(if (> a 1) (show 1) (show 2))");
    expect(targets(root(), "otherwise")).toHaveLength(0);
  });

  it("is filled by dropping a block on the target", () => {
    mount("(let spare)\n7");
    drag(elementForNode(root(1))!).dropOnto(targets(root(0), "start")[0]);
    expect(text()).toBe("(let spare 7)");
  });
});

describe("the variant of a block", () => {
  it("is a class the editor's style draws a frame or a pill for", () => {
    mount("(let a 1)");
    const classes = (type: string) =>
      [...root(0).descendants(), root(0)]
        .filter((n) => n.type === type)
        .map((n) => elementForNode(n)!.className);
    expect(classes("define")[0]).toContain("blocks-compound");
    expect(classes("variable")[0]).toContain("blocks-value");
    expect(classes("number")[0]).toContain("blocks-value");
  });
});

describe("a block that draws itself from its state", () => {
  it("shows what a name could be only while the name is edited", () => {
    mount("(let a 1)\n(let b 2)\n(show (+ a b))\n(let c 3)");
    expect(hints()).toEqual([]);
    const call = [...root(2).descendants()].find((n) => n.type === "variable")!;
    mouseDown(call);
    expect(hints()).toEqual([]); // (it has focus: that is not enough)
    keyDown("Enter");
    expect(hints()).toEqual(["defined: a, b"]);
    keyDown("Escape");
    expect(hints()).toEqual([]);
  });

  it("shows it beside the edit box while the name is being edited", () => {
    mount("(let a 1)\n(let b 2)\n(show (+ a b))");
    const call = [...root(2).descendants()].find((n) => n.type === "variable")!;
    mouseDown(call);
    keyDown("Enter"); // (the name is focused: Enter opens its text)
    // (the edit box has taken the place of the name: its hint is still there)
    expect(document.querySelector("[role=textbox]")).not.toBeNull();
    expect(hints()).toEqual(["defined: a, b"]);
    expect(document.querySelector(".blocks-editing-hint")).not.toBeNull();
    keyDown("Escape");
    expect(document.querySelector(".blocks-editing-hint")).toBeNull();
  });

  it("says what is hidden in a collapsed loop", () => {
    mount("(repeat 2 (show 1) (show 2) (show 3))");
    expect(hints()).toEqual([]);
    mouseDown(root());
    keyDown("ArrowLeft");
    expect(hints()).toEqual(["3 steps hidden"]);
    keyDown("ArrowRight");
    expect(hints()).toEqual([]);
  });

  it("says a value would be replaced while something is dragged over it", () => {
    mount("(show 1)\n9");
    expect(hints()).toEqual([]);
    const one = [...root(0).descendants()].find((n) => n.type === "number")!;
    const g = drag(elementForNode(root(1))!);
    const over = g.dragOver(elementForNode(one)!);
    expect(hints()).toEqual(["replace"]);
    over.dragLeave();
    expect(hints()).toEqual([]);
  });
});

describe("what is said about a node comes from its label", () => {
  it("names a block by its label and what is in it", () => {
    mount('(let minutes 10)\n(show "hi")\n(+ minutes 1)\n(repeat 2 (show 1))');
    const [def, show, call, loop] = cmb.getAst().rootNodes;
    expect(def.shortDescription()).toBe("definition");
    expect(show.shortDescription()).toBe("show step");
    expect(call.shortDescription()).toBe("calculation +");
    expect(loop.shortDescription()).toBe("repeat loop");
    const name = [...def.descendants()].find((n) => n.type === "variable")!;
    expect(name.shortDescription()).toBe("name minutes");
  });

  it("describes the make-up of a list from the plural labels", () => {
    mount(
      "(repeat 4\n  (let a 1)\n  (let b 2)\n  (show a)\n  (+ a b)\n  (show b))"
    );
    expect(root().describe(5)).toBe(
      "a repeat loop, number 4 times, of 2 definitions, 2 show steps, and 1 calculation"
    );
  });
});

describe("the long description of each block", () => {
  const describeAll = (code: string) => {
    mount(code);
    return cmb.getAst().rootNodes.map((n) => n.describe(5));
  };

  it("says whether a definition has a start", () => {
    const [started, bare] = describeAll("(let a 1)\n(let b)");
    expect(started).toMatch(/starting as/);
    expect(bare).toMatch(/with no start yet/);
  });

  it("says what a show step shows", () => {
    expect(describeAll('(show "hi")')[0]).toMatch(/^a show step of /);
  });

  it("says whether a choice has an otherwise", () => {
    const [two, one] = describeAll(
      '(if (< 1 2) (show "a") (show "b"))\n(if (< 1 2) (show "a"))'
    );
    expect(two).toMatch(/otherwise/);
    expect(one).not.toMatch(/otherwise/);
  });

  it("lists the inputs of a calculation, if it has any", () => {
    const [some, none] = describeAll("(+ 1 2)\n(+)");
    expect(some).toMatch(/with \+ of .*: number 1, number 2/);
    expect(none).not.toMatch(/:/);
  });
});

describe("what a collapsed loop says is hidden", () => {
  it("says 1 step for a loop of one, and the count for more", () => {
    mount("(repeat 2 (show 1))\n(repeat 2 (show 1) (show 2))");
    const loops = [...document.querySelectorAll(".blocks-node")].filter((el) =>
      el.getAttribute("aria-label")?.startsWith("repeat")
    );
    expect(loops.length).toBe(2);
    cmb.getAst().rootNodes.forEach((n) => {
      mouseDown(n);
      keyDown("ArrowLeft", {}, n);
    });
    const hidden = [...document.querySelectorAll(".blocks-hint")].map(
      (el) => el.textContent
    );
    expect(hidden).toEqual(["1 step hidden", "2 steps hidden"]);
  });
});
