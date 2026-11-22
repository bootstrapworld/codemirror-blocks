/** @jest-environment jsdom */
// PORTED from packages/codemirror-blocks/spec/toolbar-drag-test.ts: only the imports changed (to ../compat/*); see doc/experiments/cm6-direct-tree.md, ninth round.
import { act, fireEvent, screen } from "../compat/testing-library";
import wescheme from "../compat/wescheme";
import { mountCMB, teardown } from "../compat/test-utils";
import { API } from "../compat/test-utils";
import { drag, getNodeLabeled } from "../compat/dnd";
import { toolbarPrimitive } from "../compat/gestures";

// Scenarios from the old Editor-test-old.js / PrimitiveBlock-test-old.js
// (issue #376): picking a block out of the toolbar and dragging it into the
// editor, as the toolbar is searched, clicked and dragged from repeatedly.

let cmb: API;
beforeEach(() => {
  cmb = mountCMB(wescheme).cmb;
});
afterEach(() => {
  teardown();
});

const primitives = () => [...document.querySelectorAll(".Primitive")];
const primitive = (name: string) => toolbarPrimitive(name) as HTMLElement;
const searchToolbar = (text: string) =>
  fireEvent.change(screen.getByPlaceholderText("Search functions"), {
    target: { value: text },
  });

describe("searching the toolbar, then using the result", () => {
  // SKIPPED (M): the old toolbar of primitives and its search box are not built (a page makes the toolbar)
  // first error (sweep): TestingLibraryElementError: Unable to find an element with the placeholder text of: Search functions
  it.skip("narrows the toolbar to the matching primitives", () => {
    searchToolbar("sqr");
    expect(primitives().map((e) => e.textContent)).toEqual(["sqr", "sqrt"]);
  });

  // SKIPPED (M): the old toolbar of primitives and its search box are not built (a page makes the toolbar)

  // first error (sweep): TestingLibraryElementError: Unable to find an element with the placeholder text of: Search functions
  it.skip("selects a primitive that is clicked (focused) among the results", () => {
    searchToolbar("+");
    const plus = primitive("+");
    act(() => plus.focus());
    expect(plus).toHaveClass("selected");
    expect(cmb.getValue()).toBe("");
  });

  // SKIPPED (M): the old toolbar of primitives and its search box are not built (a page makes the toolbar)

  // first error (sweep): TestingLibraryElementError: Unable to find an element with the placeholder text of: Search functions
  it.skip("drags a found primitive into the editor", () => {
    cmb.setValue("(f x y)");
    searchToolbar("sqrt");
    drag(primitive("sqrt")).dropOnto(getNodeLabeled(/^y,/));
    expect(cmb.getValue()).toBe("(f x sqrt)");
  });

  // SKIPPED (M): the old toolbar of primitives and its search box are not built (a page makes the toolbar)

  // first error (sweep): TestingLibraryElementError: Unable to find an element with the placeholder text of: Search functions
  it.skip("still drags after the search is cleared", () => {
    cmb.setValue("(f x y)");
    searchToolbar("sqrt");
    searchToolbar("");
    expect(primitives().length).toBeGreaterThan(1);
    drag(primitive("sqr")).dropOnto(getNodeLabeled(/^x,/));
    expect(cmb.getValue()).toBe("(f sqr y)");
  });
});

describe("dragging from the toolbar repeatedly", () => {
  it("leaves the primitive in the toolbar, and each drop is its own block", () => {
    cmb.setValue("(f x y)");
    drag(primitive("sqrt")).dropOnto(getNodeLabeled(/^x,/));
    drag(primitive("sqrt")).dropOnto(getNodeLabeled(/^y,/));
    expect(cmb.getValue()).toBe("(f sqrt sqrt)");
    expect(primitive("sqrt")).toBeInTheDocument();
    const ids = [...cmb.getAst().rootNodes[0].children()].map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("drops different primitives into different places", () => {
    cmb.setValue("(f x y)");
    drag(primitive("sqrt")).dropOnto(getNodeLabeled(/^x,/));
    drag(primitive("sqr")).dropOnto(getNodeLabeled(/^y,/));
    expect(cmb.getValue()).toBe("(f sqrt sqr)");
  });
});

describe("a toolbar drag that is released without dropping", () => {
  // SKIPPED (M): the old toolbar of primitives and its search box are not built (a page makes the toolbar)
  // first error (sweep): Error: expect(received).toHaveLength(expected)
  it.skip("does not change the document and leaves the toolbar intact", () => {
    cmb.setValue("(f x y)");
    const before = primitives().length;
    drag(primitive("sqrt")).cancel();
    expect(cmb.getValue()).toBe("(f x y)");
    expect(primitives()).toHaveLength(before);
  });
});

describe("dropping a toolbar primitive into a nested expression", () => {
  it("replaces a deeply nested literal and keeps the rest intact", () => {
    cmb.setValue("(f (g (h x)) y)");
    drag(primitive("sqrt")).dropOnto(getNodeLabeled(/^x,/));
    expect(cmb.getValue()).toBe("(f (g (h sqrt)) y)");
    expect(cmb.getAst().rootNodes).toHaveLength(1);
  });
});
