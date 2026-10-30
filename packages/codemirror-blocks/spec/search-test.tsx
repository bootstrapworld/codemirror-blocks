import { act, fireEvent, screen } from "@testing-library/react";
import wescheme from "../src/languages/wescheme";
import { API } from "../src/CodeMirrorBlocks";
import { keyDown, mountCMB, teardown } from "../src/toolkit/test-utils";
import * as utils from "../src/utils";

/**
 * Search in the editor: F3, Ctrl-F or Cmd-F opens the Search Settings dialog;
 * Enter closes it and goes to the first match; PageDown and PageUp go to the
 * next and previous match, on from the other end of the document at the end.
 */
let cmb: API;
let sounds: unknown[];
const focused = () => cmb.getFocusedNode()?.toString();
const block = (text: string) =>
  [...cmb.getAst().getAllNodes()].find((n) => n.toString() === text)!;
/** Press a key where a user would be: on the block that has the focus */
const press = (key: string, props = {}) =>
  keyDown(key, props, cmb.getFocusedNode() ?? cmb.getAst().rootNodes[0]);
const dialog = () => screen.queryByText("Search Settings");
const searchInput = () => screen.getByLabelText("Search String");

beforeEach(() => {
  ({ cmb } = mountCMB(wescheme));
  cmb.setValue("(f x)\n(g xy x)\nx");
  cmb.setBlockMode(true);
  sounds = [];
  jest.spyOn(utils, "playSound").mockImplementation((s) => {
    sounds.push(s);
  });
  press("Escape"); // (nothing is focused yet: start at the first block)
});
afterEach(() => {
  teardown();
  jest.restoreAllMocks();
});

/** Open the dialog, search for `text`, and close it with Enter */
const searchFor = (text: string) => {
  press("F3");
  fireEvent.change(searchInput(), { target: { value: text } });
  fireEvent.keyUp(searchInput(), { key: "Enter" });
};

describe("the Search Settings dialog", () => {
  it.each([
    ["F3", {}],
    ["F", { ctrlKey: true }],
  ])("opens with %s %j", (key, props) => {
    cmb.setCursor({ line: 0, ch: 0 });
    press(key, props);
    expect(dialog()).toBeTruthy();
    expect(screen.getByText(/What should/)).toBeTruthy();
    // both ways to search are there, with the text search first
    const tabs = screen.getAllByRole("tab").map((t) => t.textContent);
    expect(tabs).toEqual(["Search by string", "Search by block"]);
    expect(searchInput()).toBeTruthy();
  });

  it("is not opened in text mode", () => {
    cmb.setBlockMode(false);
    expect(dialog()).toBeNull();
  });

  it("closes with Escape, and goes nowhere", () => {
    cmb.setCursor({ line: 0, ch: 0 });
    press("F3");
    fireEvent.change(searchInput(), { target: { value: "x" } });
    const before = focused();
    fireEvent.keyUp(searchInput(), { key: "Escape" });
    expect(dialog()).toBeNull();
    expect(focused()).toBe(before);
  });

  it("closes with its Close button, and goes nowhere", () => {
    press("F3");
    fireEvent.click(screen.getByText("Close"));
    expect(dialog()).toBeNull();
  });

  it("keeps what was searched for the next time it opens", () => {
    searchFor("xy");
    press("F3");
    expect((searchInput() as HTMLInputElement).value).toBe("xy");
  });
});

describe("searching by text", () => {
  it("Enter closes the dialog and goes to the first match after the focus", () => {
    searchFor("x");
    expect(dialog()).toBeNull();
    expect(focused()).toBe("x");
    expect(cmb.getFocusedNode()?.from).toEqual({ line: 0, ch: 3 });
  });

  it("PageDown and PageUp step through the matches", () => {
    searchFor("x");
    const at = () => {
      const { line, ch } = cmb.getFocusedNode()!.from;
      return `${line}:${ch}`;
    };
    expect(at()).toBe("0:3");
    press("PageDown");
    expect(at()).toBe("1:3"); // x in xy is the text xy, a different block
    press("PageDown");
    expect(at()).toBe("1:6");
    press("PageDown");
    expect(at()).toBe("2:0");
    press("PageUp");
    expect(at()).toBe("1:6");
    press("PageUp");
    expect(at()).toBe("1:3");
  });

  it("goes on from the other end at the end, with a sound", () => {
    searchFor("x");
    press("PageDown");
    press("PageDown");
    press("PageDown");
    expect(cmb.getFocusedNode()?.from).toEqual({ line: 2, ch: 0 });
    expect(sounds).toEqual([]);
    press("PageDown"); // past the last match: back to the first
    expect(cmb.getFocusedNode()?.from).toEqual({ line: 0, ch: 3 });
    expect(sounds).toEqual([utils.WRAP]);
    press("PageUp"); // before the first: the last
    expect(cmb.getFocusedNode()?.from).toEqual({ line: 2, ch: 0 });
    expect(sounds).toEqual([utils.WRAP, utils.WRAP]);
  });

  it("beeps when there is nothing to find, and stays where it is", () => {
    searchFor("zzz");
    expect(sounds).toEqual([utils.BEEP]);
    expect(focused()).toBe("(f x)");
  });

  it("beeps when the only match is the block that has the focus", () => {
    searchFor("g");
    expect(focused()).toBe("g");
    sounds.length = 0;
    press("PageDown");
    expect(sounds).toEqual([utils.BEEP]);
    expect(focused()).toBe("g");
  });

  it("can ignore case, match a whole word, and use a regular expression", () => {
    press("F3");
    fireEvent.change(searchInput(), { target: { value: "X" } });
    fireEvent.click(screen.getByLabelText("Ignore case"));
    fireEvent.keyUp(searchInput(), { key: "Enter" });
    expect(cmb.getFocusedNode()?.from).toEqual({ line: 0, ch: 3 });

    press("F3");
    fireEvent.change(searchInput(), { target: { value: "x" } });
    fireEvent.click(screen.getByLabelText("Exact match"));
    fireEvent.keyUp(searchInput(), { key: "Enter" });
    // "xy" is skipped: it is not the word x
    expect(cmb.getFocusedNode()?.from).toEqual({ line: 1, ch: 6 });

    press("F3");
    fireEvent.change(searchInput(), { target: { value: "[fg]" } });
    fireEvent.click(screen.getByLabelText("Regex"));
    fireEvent.keyUp(searchInput(), { key: "Enter" });
    // nothing after the x at 1:6, so on from the start of the document: f
    expect(focused()).toBe("f");
  });

  it("with nothing typed, steps through the blocks one by one", () => {
    press("F3");
    fireEvent.click(screen.getByLabelText("Ignore case")); // chooses this search
    fireEvent.keyUp(searchInput(), { key: "Enter" });
    expect(focused()).toBe("f");
    press("PageDown");
    expect(focused()).toBe("x");
  });
});

describe("searching by block type", () => {
  const chooseBlockType = (type: string) => {
    press("F3");
    fireEvent.click(screen.getByRole("tab", { name: "Search by block" }));
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    fireEvent.change(select, { target: { name: "blockType", value: type } });
    fireEvent.keyUp(select, { key: "Enter" });
  };

  it("lists the types of block there are", () => {
    press("F3");
    fireEvent.click(screen.getByRole("tab", { name: "Search by block" }));
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).toEqual([
      "functionApp",
      "literal",
    ]);
  });

  it("goes to the next block of the type, and on from the end", () => {
    chooseBlockType("functionApp");
    expect(focused()).toBe("(g xy x)");
    press("PageDown"); // no more calls: back to the first
    expect(focused()).toBe("(f x)");
    expect(sounds).toEqual([utils.WRAP]);
    press("PageUp");
    expect(focused()).toBe("(g xy x)");
  });
});

describe("before anything is chosen", () => {
  it("PageDown and PageUp do nothing", () => {
    cmb.setCursor({ line: 0, ch: 0 });
    const before = focused();
    press("PageDown");
    press("PageUp");
    expect(focused()).toBe(before);
    expect(sounds).toEqual([utils.BEEP, utils.BEEP]);
  });
});

it("leaves the rest of the page alone while the dialog is open", () => {
  press("F3");
  // the editor is hidden from screenreaders behind the dialog
  expect(screen.getByRole("dialog")).toBeTruthy();
  act(() => {
    fireEvent.keyUp(searchInput(), { key: "Escape" });
  });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(block("x")).toBeTruthy();
});
