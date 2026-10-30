import wescheme from "../src/languages/wescheme";
import { click, mountCMB, teardown } from "../src/toolkit/test-utils";
import { API } from "../src/CodeMirrorBlocks";
import { allowConsoleErrors } from "./globalSetup";

/**
 * The CodeMirror API as the block editor offers it: selections that may only
 * hold whole blocks, marks that may only go on blocks, and what is not
 * supported.
 */
const pos = (line: number, ch: number) => ({ line, ch });
const simple = (p: { line: number; ch: number }) => pos(p.line, p.ch);
const ranges = (cmb: API) =>
  cmb
    .listSelections()
    .map((r) => ({ anchor: simple(r.anchor), head: simple(r.head) }));
const selected = (cmb: API) => cmb.getSelectedNodes().map(String);

let cmb: API;
beforeEach(() => {
  cmb = mountCMB(wescheme).cmb;
  cmb.setValue("(+ 1 2)\n\n(- 3 4)\nx");
  cmb.setBlockMode(true);
});
afterEach(teardown);

describe("things the editor does not support", () => {
  it("runMode is refused in both modes", () => {
    expect(() => cmb.runMode()).toThrow("runMode is not supported");
    cmb.setBlockMode(false);
    expect(() => cmb.runMode()).toThrow("runMode is not supported");
  });
});

describe("marking text", () => {
  it("only on a block, and only with the options a block supports", () => {
    allowConsoleErrors(); // the refusals are logged
    // 0:1 to 0:4 is "+ 1", which is not a block
    expect(() => cmb.markText(pos(0, 1), pos(0, 4))).toThrow(/no AST node at/);
    expect(() =>
      cmb.markText(pos(0, 0), pos(0, 7), { readOnly: true })
    ).toThrow('option "readOnly" is not supported in block mode');
    const mark = cmb.markText(pos(0, 0), pos(0, 7), {
      className: "flagged",
      title: "a note",
    });
    expect(mark.options).toEqual({ className: "flagged", title: "a note" });
    expect(cmb.findMarks(pos(0, 0), pos(0, 7))).toContain(mark);
  });
});

// (a block selection in this editor also keeps a cursor, at the end of the
// document, so these tests look at the block and not at how many ranges there are)
describe("extending a selection", () => {
  beforeEach(() => {
    cmb.setValue("(+ 1 2)\n\n(- 3 4)");
    cmb.setSelection(pos(0, 0), pos(0, 7));
    // a second range: the block selection often comes with a cursor
    cmb.addSelection(pos(2, 7));
  });

  it("extendSelection moves the head to a block boundary, without failing", () => {
    // it once threw a TypeError from inside CodeMirror whenever the selection
    // had more than one range
    expect(cmb.listSelections()).toHaveLength(2);
    cmb.extendSelection(pos(2, 7));
    expect(ranges(cmb)).toEqual([{ anchor: pos(2, 7), head: pos(2, 7) }]);
  });

  it("extendSelection refuses to end in the middle of a block", () => {
    allowConsoleErrors();
    expect(() => cmb.extendSelection(pos(2, 3))).toThrow(
      /partially covers a node/
    );
  });

  it("extendSelections and extendSelectionsBy do the same", () => {
    cmb.extendSelections([pos(2, 7)]);
    expect(ranges(cmb)).toEqual([{ anchor: pos(2, 7), head: pos(2, 7) }]);

    cmb.setSelection(pos(0, 0), pos(0, 7));
    cmb.addSelection(pos(2, 7));
    cmb.extendSelectionsBy(() => pos(2, 7));
    expect(ranges(cmb)).toEqual([{ anchor: pos(2, 7), head: pos(2, 7) }]);

    allowConsoleErrors();
    cmb.setSelection(pos(0, 0), pos(0, 7));
    expect(() => cmb.extendSelections([pos(2, 3)])).toThrow(
      /partially covers a node/
    );
    expect(() => cmb.extendSelectionsBy(() => pos(2, 3))).toThrow(
      /partially covers a node/
    );
  });
});

describe("what is selected", () => {
  it("somethingSelected is true once a block is selected", () => {
    expect(cmb.somethingSelected()).toBe(false);
    cmb.setSelection(pos(0, 0), pos(0, 7));
    expect(cmb.somethingSelected()).toBe(true);
  });

  it("getSelections reads the text of the selected block", () => {
    cmb.setSelection(pos(0, 0), pos(0, 7));
    expect(cmb.getSelections()[0]).toBe("(+ 1 2)");
    expect(cmb.getSelections("|")[0]).toBe("(+ 1 2)");
  });

  it("hasFocus is true while a block has the focus", () => {
    click(cmb.getAst().rootNodes[0]);
    const focused = document.activeElement;
    expect(focused?.id).toMatch(/block-node/);
    expect(cmb.hasFocus()).toBe(true);
    (focused as HTMLElement).blur();
    expect(cmb.hasFocus()).toBe(false);
  });
});

describe("replacing the selection", () => {
  const first = () => cmb.getValue().split("\n")[0];

  it("replaces the selected block, and selects the new one with 'around'", () => {
    cmb.setSelection(pos(0, 0), pos(0, 7));
    cmb.replaceSelection("(* 5 6)", "around");
    expect(first()).toBe("(* 5 6)");
    expect(selected(cmb)).toContain("(* 5 6)");
    expect(ranges(cmb)[0]).toEqual({ anchor: pos(0, 0), head: pos(0, 7) });
  });

  it("replaces the selected block with 'start' and with no mode", () => {
    cmb.setSelection(pos(0, 0), pos(0, 7));
    cmb.replaceSelection("(* 5 6)", "start");
    expect(first()).toBe("(* 5 6)");

    cmb.setSelection(pos(0, 0), pos(0, 7));
    cmb.replaceSelection("(/ 8 2)");
    expect(first()).toBe("(/ 8 2)");
  });

  it("refuses new text that is not whole blocks", () => {
    allowConsoleErrors();
    cmb.setSelection(pos(0, 0), pos(0, 7));
    expect(() => cmb.replaceSelection("(* 5", "around")).toThrow();
  });
});
