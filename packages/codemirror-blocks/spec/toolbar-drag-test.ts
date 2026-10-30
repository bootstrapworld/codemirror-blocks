import { act, fireEvent, screen } from "@testing-library/react";
import wescheme from "../src/languages/wescheme";
import { mountCMB, teardown } from "../src/toolkit/test-utils";
import { API } from "../src/CodeMirrorBlocks";
import { drag, getNodeLabeled } from "./helpers/dnd";

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
const primitive = (name: string) => {
  const el = primitives().find((e) => e.textContent === name);
  if (!el) {
    throw new Error(`no toolbar primitive named ${name}`);
  }
  return el as HTMLElement;
};
const searchToolbar = (text: string) =>
  fireEvent.change(screen.getByPlaceholderText("Search functions"), {
    target: { value: text },
  });

describe("searching the toolbar, then using the result", () => {
  it("narrows the toolbar to the matching primitives", () => {
    searchToolbar("sqr");
    expect(primitives().map((e) => e.textContent)).toEqual(["sqr", "sqrt"]);
  });

  it("selects a primitive that is clicked (focused) among the results", () => {
    searchToolbar("+");
    const plus = primitive("+");
    act(() => plus.focus());
    expect(plus).toHaveClass("selected");
    expect(cmb.getValue()).toBe("");
  });

  it("drags a found primitive into the editor", () => {
    cmb.setValue("(f x y)");
    searchToolbar("sqrt");
    drag(primitive("sqrt")).dropOnto(getNodeLabeled(/^y,/));
    expect(cmb.getValue()).toBe("(f x sqrt)");
  });

  it("still drags after the search is cleared", () => {
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
  it("does not change the document and leaves the toolbar intact", () => {
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
