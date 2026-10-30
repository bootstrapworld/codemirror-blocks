import wescheme from "../src/languages/wescheme";
import { fireEvent } from "@testing-library/react";
import {
  keyDown,
  mountCMB,
  teardown,
  cmd_ctrl,
} from "../src/toolkit/test-utils";
import { API } from "../src/CodeMirrorBlocks";
import { AppStore } from "../src/state/store";
import { allowConsoleErrors } from "./globalSetup";

let cmb: API;
let store: AppStore;

beforeEach(() => {
  ({ cmb, store } = mountCMB(wescheme));
});
afterEach(teardown);

/**
 * Type one character into the text editor's input, as a user at the top level
 * would. (The API's setCursor() can leave focus on a block, so we target the
 * input directly.)
 */
const typeChar = (char: string, init: object = {}) =>
  fireEvent.keyPress(cmb.getCM().getInputField(), {
    key: char,
    code: `Key${char.toUpperCase()}`,
    charCode: char.charCodeAt(0),
    ...init,
  });

const pasteIntoEditor = (text: string) =>
  fireEvent.paste(cmb.getCM().getInputField(), {
    clipboardData: { getData: () => text },
  });

const quarantine = () => store.getState().quarantine;

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

  // Under jsdom the selection is collapsed to its start by the time the
  // keypress handler runs, so the typed text is inserted instead. Check in a
  // real browser before deciding whether that is a bug or a jsdom artifact.
  it.todo("replaces the selected text when typing over a selection");

  it("stays open (and flags an error) if the text can't be parsed", () => {
    allowConsoleErrors(); // a rejected edit is logged
    cmb.setCursor({ line: 0, ch: 2 });
    typeChar("(");
    keyDown("Enter");
    expect(cmb.getValue()).toBe("42\n11");
    expect(quarantine()).not.toBeNull();
    expect(store.getState().errorId).toBe("editing");
  });
});

describe("pasting at the top level", () => {
  beforeEach(() => {
    cmb.setValue("42\n11");
  });

  it("starts a quarantine holding the pasted text", () => {
    cmb.setCursor({ line: 0, ch: 2 });
    pasteIntoEditor("(f x)");
    expect(quarantine()?.value).toBe("(f x)");
    expect(cmb.getValue()).toBe("42\n11");
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
