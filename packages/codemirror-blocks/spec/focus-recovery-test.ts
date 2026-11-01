import wescheme from "../src/languages/wescheme";
import {
  cmd_ctrl,
  keyDown,
  mountCMB,
  mouseDown,
  teardown,
} from "../src/toolkit/test-utils";
import { API } from "../src/CodeMirrorBlocks";
import { pasteAtCursor, select, typeChar } from "./helpers/gestures";
import { expectInvariants } from "./helpers/invariants";

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

describe("committing a top-level paste in a document with no blocks", () => {
  // (random sequence, seeds 310005, 310037) a paste into a comment, committed
  // with Enter, left focus on the page body, so Ctrl-Z did nothing
  it("leaves focus in the editor, so that undo works", () => {
    cmb.setValue("; only a comment\n#| and another |#");
    cmb.clearHistory();
    cmb.setCursor({ line: 0, ch: 15 });
    pasteAtCursor(cmb, "(g w)");
    keyDown("Enter");
    expect(insideEditor()).toBe(true);
    keyDown("Z", cmd_ctrl);
    expect(cmb.getValue()).toBe("; only a comment\n#| and another |#");
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

describe("changing the text through the API while a block is being edited", () => {
  // (random sequences, seeds 20329, 17540, 20155) the box was left open with
  // keyboard focus gone from it: the editor was stranded on the placeholder
  beforeEach(() => {
    cmb.setValue("a b c");
    mouseDown(root(1));
    keyDown("Enter", {}, root(1));
    expect(document.activeElement).toHaveAttribute("contenteditable", "true");
    cmb.replaceRange("\n(g w)", { line: 0, ch: 5 });
  });

  it("does not leave an editing box open that nothing can type into", () => {
    expect(document.activeElement?.id).not.toBe("SR_fix_for_slow_dom");
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).not.toHaveAttribute("contenteditable");
    expect(document.querySelectorAll("[contenteditable=true]")).toHaveLength(0);
  });

  it("so that the block can be moved on from", () => {
    keyDown("ArrowDown", {}, root(0));
    expect(document.activeElement?.id).toBe(`block-node-${root(1).id}`);
  });
});

describe("switching modes with a top-level edit box open", () => {
  // (random sequence, soak seed 300079) the text is printed again, a long form
  // on several lines, and the box was left at its old position, inside it
  it("closes the box, so that no block loses its marker", () => {
    cmb.setValue(`(${"long-name ".repeat(25)}end) ${"word ".repeat(10)}`);
    cmb.setCursor({ line: 0, ch: 267 });
    typeChar(cmb, "q");
    cmb.setBlockMode(false);
    cmb.setBlockMode(true);
    expectInvariants();
  });
});
