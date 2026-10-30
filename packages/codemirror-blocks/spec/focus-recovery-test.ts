import wescheme from "../src/languages/wescheme";
import {
  cmd_ctrl,
  keyDown,
  mountCMB,
  teardown,
} from "../src/toolkit/test-utils";
import { API } from "../src/CodeMirrorBlocks";
import { pasteAtCursor, select } from "./helpers/gestures";

/**
 * Keyboard focus must never be left where the editor can't hear it. These are
 * the cases the random sequences (and the browser) found, one by one.
 */

let cmb: API;
beforeEach(() => {
  cmb = mountCMB(wescheme).cmb;
});
afterEach(teardown);

const root = (i = 0) => cmb.getAst().rootNodes[i];
const insideEditor = () =>
  cmb.getWrapperElement().contains(document.activeElement);

describe("cancelling a top-level paste in an empty document", () => {
  // (random sequence, seed 532) with nothing left to focus, the box that was
  // being typed into went away and focus fell to the page, so Ctrl-Z did nothing
  beforeEach(() => {
    cmb.setValue("(f x)");
    cmb.clearHistory();
    select(root());
    keyDown("Delete", {}, root());
    expect(cmb.getAst().rootNodes).toEqual([]);
  });

  it("leaves focus in the editor", () => {
    cmb.setCursor({ line: 0, ch: 0 });
    pasteAtCursor(cmb, "zzz");
    expect(document.activeElement).toHaveAttribute("contenteditable", "true");
    keyDown("Escape");
    expect(document.activeElement).not.toBe(document.body);
    expect(insideEditor()).toBe(true);
  });

  it("so that undo still works", () => {
    cmb.setCursor({ line: 0, ch: 0 });
    pasteAtCursor(cmb, "zzz");
    keyDown("Escape");
    keyDown("Z", cmd_ctrl);
    expect(cmb.getValue()).toBe("(f x)");
  });
});

describe("CodeMirror's scroller", () => {
  // (random sequence, seed 11, in a real browser) a press on blank space that
  // turned into a drag left focus on the scroller, where no key is handled
  it("never keeps keyboard focus: it passes it to the editor's input", () => {
    cmb.setValue("(f x)");
    const scroller = cmb.getCM().getScrollerElement();
    scroller.focus();
    expect(document.activeElement).not.toBe(scroller);
    expect(document.activeElement).toBe(cmb.getCM().getInputField());
  });

  it("so that undo works straight after", () => {
    cmb.setValue("(f x)");
    cmb.clearHistory();
    select(root());
    keyDown("Delete", {}, root());
    cmb.getCM().getScrollerElement().focus();
    keyDown("Z", cmd_ctrl);
    expect(cmb.getValue()).toBe("(f x)");
  });
});
