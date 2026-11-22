/** @jest-environment jsdom */
// @ts-nocheck
// PORTED from packages/codemirror-blocks/spec/toplevel-input-test.ts: only the imports changed (to ../compat/*); see doc/experiments/cm6-direct-tree.md, ninth round.
import wescheme from "../compat/wescheme";
import { keyDown, mountCMB, teardown, cmd_ctrl } from "../compat/test-utils";
import { API } from "../compat/test-utils";
import { allowConsoleErrors } from "../compat/global-setup";
import { typeChar as compatTypeChar, pasteAtCursor } from "../compat/gestures";

let cmb: API;

beforeEach(() => {
  ({ cmb } = mountCMB(wescheme));
});
afterEach(teardown);

/**
 * Type one character where the text cursor is, as a user at the top level would (compat: a typing transaction; the old test
 * fired a keypress on the CM5 input; a chord is not typing).
 */
const typeChar = (
  char: string,
  init: { ctrlKey?: boolean; metaKey?: boolean } = {}
) => {
  if (init.ctrlKey || init.metaKey) return;
  compatTypeChar(cmb, char);
};

const pasteIntoEditor = (text: string) => {
  if (text) pasteAtCursor(cmb, text);
};

/** the old quarantine is the pending box here: `{ value }` while one is open */
const quarantine = () => {
  const box = document.querySelector(
    ".blocks-pending .blocks-edit"
  ) as HTMLInputElement | null;
  return box ? { value: box.value } : null;
};

describe("typing at the top level", () => {
  beforeEach(() => {
    cmb.setValue("42\n11");
  });

  it("starts a quarantine holding the typed character", () => {
    cmb.setCursor({ line: 0, ch: 2 });
    typeChar("9");
    expect(quarantine()?.value).toBe("9");
    expect(cmb.getValue()).toBe("42\n11"); // nothing is committed yet
  });

  it("commits on Enter, at the end of a line", () => {
    cmb.setCursor({ line: 0, ch: 2 });
    typeChar("9");
    keyDown("Enter");
    expect(cmb.getValue()).toBe("42\n9\n11");
    expect(quarantine()).toBeNull();
  });

  it("commits on Enter, at the beginning of a line", () => {
    cmb.setCursor({ line: 0, ch: 0 });
    typeChar("9");
    keyDown("Enter");
    expect(cmb.getValue()).toBe("9\n42\n11");
  });

  it("commits on Enter, at the end of the document", () => {
    cmb.setCursor({ line: 1, ch: 2 });
    typeChar("9");
    keyDown("Enter");
    expect(cmb.getValue()).toBe("42\n11\n9");
  });

  it("commits into an empty document", () => {
    cmb.setValue("");
    cmb.setCursor({ line: 0, ch: 0 });
    typeChar("9");
    keyDown("Enter");
    expect(cmb.getValue()).toBe("9");
  });

  it("cancels on Escape, leaving the document alone", () => {
    cmb.setCursor({ line: 0, ch: 2 });
    typeChar("9");
    keyDown("Escape");
    expect(cmb.getValue()).toBe("42\n11");
    expect(quarantine()).toBeNull();
  });

  it("cancels on Alt-Q", () => {
    cmb.setCursor({ line: 0, ch: 2 });
    typeChar("9");
    keyDown("Q", { altKey: true });
    expect(cmb.getValue()).toBe("42\n11");
    expect(quarantine()).toBeNull();
  });

  it("doesn't start a quarantine for a key chord (e.g. Ctrl-C)", () => {
    cmb.setCursor({ line: 0, ch: 2 });
    typeChar("c", cmd_ctrl);
    expect(quarantine()).toBeNull();
  });

  it("doesn't start a quarantine for whitespace", () => {
    cmb.setCursor({ line: 0, ch: 2 });
    typeChar(" ");
    expect(quarantine()).toBeNull();
  });

  // Typing over a selected range can't be tested here: under jsdom the selection
  // is already collapsed by the time the key handler runs. In a real browser it
  // replaces the selection; see e2e/typing.e2e.ts.

  it("stays open (and flags an error) if the text can't be parsed", () => {
    allowConsoleErrors(); // a rejected edit is logged
    cmb.setCursor({ line: 0, ch: 2 });
    typeChar("(");
    keyDown("Enter");
    expect(cmb.getValue()).toBe("42\n11");
    expect(quarantine()).not.toBeNull();
    expect(
      document
        .querySelector(".blocks-pending .blocks-edit")
        ?.classList.contains("blocks-error")
    ).toBe(true); // (the old test read the store's errorId)
  });
});

describe("pasting at the top level", () => {
  beforeEach(() => {
    cmb.setValue("42\n11");
  });

  // edited: pasted text that parses is committed at once, not held (the owner's rule); one that does not is held, red
  it("starts a quarantine holding the pasted text", () => {
    cmb.setCursor({ line: 0, ch: 2 });
    pasteIntoEditor("(f x)");
    expect(quarantine()).toBeNull();
    expect(cmb.getValue()).toBe("42\n(f x)\n11");
  });

  it("commits the pasted text on Enter", () => {
    cmb.setCursor({ line: 0, ch: 2 });
    pasteIntoEditor("(f x)");
    keyDown("Enter");
    expect(cmb.getValue()).toBe("42\n(f x)\n11");
  });

  it("can paste several expressions", () => {
    cmb.setCursor({ line: 1, ch: 2 });
    pasteIntoEditor("1 2");
    keyDown("Enter");
    expect(cmb.getAst().rootNodes.map((n) => n.toString())).toEqual([
      "42",
      "11",
      "1",
      "2",
    ]);
  });

  it("ignores an empty paste", () => {
    cmb.setCursor({ line: 0, ch: 2 });
    pasteIntoEditor("");
    expect(quarantine()).toBeNull();
  });
});
