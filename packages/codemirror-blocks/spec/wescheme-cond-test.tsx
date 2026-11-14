import { fireEvent } from "@testing-library/react";
import wescheme from "@bootstrapworld/wescheme";
import type { API } from "../src/CodeMirrorBlocks";
import {
  cmd_ctrl,
  keyDown,
  mountCMB,
  teardown,
} from "../src/toolkit/test-utils";
import { setEditableText } from "./helpers/editing";

/** The else row of a WeScheme cond is faded until it has a result, and opens for a block */
let cmb: API;
afterEach(() => teardown());
const mount = (code: string) => {
  cmb = mountCMB(wescheme).cmb;
  cmb.setValue(code);
  cmb.clearHistory();
};
const elseRow = () => document.querySelector(".blocks-cond-else-row")!;
const addElse = () =>
  document.querySelector<HTMLElement>('[aria-label="add an else"]');

describe("the else of a cond", () => {
  it("is drawn faded, with a place to drop a block, when it has none", () => {
    mount("(cond [a 1])");
    expect(elseRow()).toHaveClass("blocks-not-live");
    expect(elseRow().contains(addElse())).toBe(true);
  });

  it("is drawn in full when it has a result", () => {
    mount("(cond [a 1] [else 2])");
    expect(elseRow()).not.toHaveClass("blocks-not-live");
    expect(addElse()).toBeNull();
  });

  it("opens for typing from a click on the place, and undo takes the else away", () => {
    mount("(cond [a 1])");
    fireEvent.click(addElse()!);
    expect(document.activeElement).toHaveAttribute("contenteditable", "true");
    setEditableText("b");
    keyDown("Enter");
    expect(cmb.getValue()).toBe("(cond\n  [a 1]\n  [else b])");
    keyDown("Z", cmd_ctrl);
    expect(cmb.getValue()).toBe("(cond [a 1])");
  });

  it("opens for typing from a click on its keyword, not only its small place", () => {
    mount("(cond [a 1])");
    fireEvent.click(elseRow().querySelector(".blocks-cond-else")!);
    expect(document.activeElement).toHaveAttribute("contenteditable", "true");
    setEditableText("b");
    keyDown("Enter");
    expect(cmb.getValue()).toBe("(cond\n  [a 1]\n  [else b])");
  });
});
