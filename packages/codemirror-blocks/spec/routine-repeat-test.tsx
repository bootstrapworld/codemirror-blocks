import { fireEvent } from "@testing-library/react";
import routine from "@bootstrapworld/routine";
import type { API } from "../src/CodeMirrorBlocks";
import {
  keyDown,
  mountCMB,
  mouseDown,
  teardown,
} from "../src/toolkit/test-utils";
import { setEditableText } from "./helpers/editing";

/**
 * A repeat is the core loop: its count is the one item of a header that keeps
 * its length, so nothing is inserted beside the count, and a step can still be
 * inserted from a step and into a body with no steps.
 */
let cmb!: API;
afterEach(() => teardown());
const mount = (code: string) => {
  cmb = mountCMB(routine).cmb;
  cmb.setValue(code);
  cmb.clearHistory();
};
const loop = () => cmb.getAst().rootNodes[0];
const kids = () => [...loop().children()];
const editing = () => document.activeElement?.getAttribute("contenteditable");

describe("a repeat", () => {
  it("has the count first, then the steps", () => {
    mount('(repeat 2 (show "a") (show "b"))');
    expect(kids().map(String)).toEqual(["2", '(show "a")', '(show "b")']);
  });

  it("opens no insertion beside its count", () => {
    mount('(repeat 2 (show "a"))');
    const count = kids()[0];
    mouseDown(count);
    keyDown("]", { ctrlKey: true }, count);
    expect(editing()).not.toBe("true");
    keyDown("[", { ctrlKey: true }, count);
    expect(editing()).not.toBe("true");
    expect(cmb.getValue()).toBe('(repeat 2 (show "a"))');
  });

  it("leaves a blank when its count is deleted, and undo brings it back", () => {
    mount('(repeat 2 (show "a"))');
    const count = kids()[0];
    mouseDown(count);
    keyDown(" ", {}, count);
    keyDown("Delete");
    // (the count is still there, as a blank, and the steps are where they were)
    expect(cmb.getValue()).toBe('(repeat ...\n  (show "a"))');
    expect(kids()).toHaveLength(2);
    keyDown("Z", { ctrlKey: true });
    expect(cmb.getValue()).toBe('(repeat 2 (show "a"))');
  });

  it("takes a step inserted beside a step", () => {
    mount('(repeat 2 (show "a"))');
    const step = kids()[1];
    mouseDown(step);
    keyDown("]", { ctrlKey: true }, step);
    expect(editing()).toBe("true");
    setEditableText('(show "z")');
    keyDown("Enter");
    expect(kids().map(String)).toEqual(["2", '(show "a")', '(show "z")']);
  });

  it("takes a step into a body with no steps", () => {
    mount("(repeat 2)");
    expect(kids().map(String)).toEqual(["2"]);
    const target = document.querySelector<HTMLElement>(
      `.blocks-drop-target[data-drop-parent="${loop().id}"][data-field="body"]`
    )!;
    expect(target).not.toBeNull();
    fireEvent.click(target);
    expect(editing()).toBe("true");
    setEditableText('(show "a")');
    keyDown("Enter");
    expect(cmb.getValue()).toContain('(show "a")');
    expect(kids().map(String)).toEqual(["2", '(show "a")']);
  });
});
