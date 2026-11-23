/** @jest-environment jsdom */
// @ts-nocheck
// PORTED from packages/codemirror-blocks/spec/api-test.ts: only the imports changed (to ../compat/*); see doc/experiments/cm6-direct-tree.md, ninth round.
// REPLACEMENT: class N: the behaviours (selection and focus read, text change from code, undo/redo from code) are tested by spec/cm6-api.test.ts; cursor, bookmarks and the passthroughs have no counterpart
import wescheme from "../compat/wescheme";

/*eslint no-unused-vars: "off"*/
import {
  teardown,
  click,
  mouseDown,
  keyDown,
  mountCMB,
} from "../compat/test-utils";
import { API } from "../compat/test-utils";
import CodeMirror from "../compat/codemirror";
import { debugLog } from "../compat/utils";

debugLog("Doing api-test.js");

function simpleCursor(cur: CodeMirror.Position) {
  const { line, ch } = cur;
  return { line, ch };
}

describe("when testing CM apis,", () => {
  let cmb!: API;
  const currentFocusNId = () => cmb.getFocusedNode()!.nid;
  const roots = () => cmb.getAst().rootNodes;
  const currentFirstRoot = () => roots()[0];
  const currentThirdRoot = () => roots()[2];

  beforeEach(async () => {
    cmb = mountCMB(wescheme).cmb;
    cmb.setBlockMode(false);
    cmb.setValue(`(+ 1 2)\ny`);
  });

  afterEach(teardown);

  it("those unsupported in the BlockEditor should throw errors", async () => {
    cmb.setBlockMode(true);
    expect(() => cmb.cursorCoords(true, "page")).toThrow();
    expect(() => cmb.addKeyMap("foo")).toThrow();
    expect(() => cmb.addOverlay(true)).toThrow();
    expect(() => cmb.charCoords({ line: 0, ch: 0 })).toThrow();
    expect(() => cmb.coordsChar({ left: 0, top: 0 })).toThrow();
    expect(() => cmb.endOperation()).toThrow();
    expect(() => cmb.findPosH({ line: 0, ch: 0 }, 0, "", true)).toThrow();
    expect(() => cmb.findPosV({ line: 0, ch: 0 }, 0, "")).toThrow();
    expect(() => cmb.getExtending()).toThrow();
    expect(() => cmb.indentLine(0)).toThrow();
    //expect(()=>cmb.off(true)).toThrow();
    //expect(()=>cmb.on(true)).toThrow();
    expect(() => cmb.redoSelection()).toThrow();
    expect(() => cmb.removeKeyMap("foo")).toThrow();
    expect(() => cmb.removeOverlay(true)).toThrow();
    expect(() => cmb.setExtending(true)).toThrow();
    expect(() => cmb.startOperation()).toThrow();
    expect(() => cmb.toggleOverwrite(true)).toThrow();
    expect(() => cmb.undoSelection()).toThrow();
  });

  it("those unsupported in the TextEditor should throw errors", async () => {
    expect(() => cmb.startOperation()).toThrow();
    expect(() => cmb.endOperation()).toThrow();
    expect(() => cmb.operation(() => {})).toThrow();
    //expect(()=>cmb.on()).toThrow();
    //expect(()=>cmb.off()).toThrow();
  });

  // SKIPPED (D): by decision (user, 2026-11-23): the CM5 API is not supported; the CM6 equivalent is `ed.state.doc.line(n)`, a value (CM6 has no line handles) (test: lines are read with doc.line (getLineHandle, getLine, lineCount), spec/cm6-api.test.ts)

  // first error (sweep): Error: not in the compat layer: cmb.getLineHandle (CM5 line handles)
  it.skip("those that simply pass through should not throw errors", async () => {
    const domNode = document.createElement("span");
    const pos = { line: 0, ch: 0 };
    const f = () => true;
    const code = "someCode";
    const className = "aClass";
    const marker = "aMarker";
    const lineHandle = cmb.getLineHandle(0);
    const lineNumber = 0;

    expect(() => cmb.setValue(code)).not.toThrow();
    expect(() => cmb.addLineClass(0, "text", className)).not.toThrow();
    expect(() => cmb.addLineWidget(lineNumber, domNode)).not.toThrow();
    expect(() => cmb.addWidget(pos, domNode, true)).not.toThrow();
    expect(() => cmb.changeGeneration()).not.toThrow();
    expect(() => cmb.clearGutter("gutter id")).not.toThrow();
    expect(() => cmb.clearHistory()).not.toThrow();
    expect(() => cmb.defaultCharWidth()).not.toThrow();
    expect(() => cmb.defaultTextHeight()).not.toThrow();
    expect(() => cmb.eachLine(f)).not.toThrow();
    expect(() => cmb.execCommand("goLineEnd")).not.toThrow();
    expect(() => cmb.findWordAt(pos)).not.toThrow();
    expect(() => cmb.firstLine()).not.toThrow();
    expect(() => cmb.focus()).not.toThrow();
    expect(() => cmb.getGutterElement()).not.toThrow();
    expect(() => cmb.getHistory()).not.toThrow();
    expect(() => cmb.getInputField()).not.toThrow();
    expect(() => cmb.getLine(2)).not.toThrow();
    expect(() => cmb.getLineHandle(lineNumber)).not.toThrow();
    expect(() => cmb.getLineNumber(lineHandle)).not.toThrow();
    expect(() => cmb.getRange(pos, pos)).not.toThrow();
    expect(() => cmb.getScrollerElement()).not.toThrow();
    expect(() => cmb.getScrollInfo()).not.toThrow();
    expect(() => cmb.getValue()).not.toThrow();
    expect(() => cmb.getViewport()).not.toThrow();
    expect(() => cmb.getWrapperElement()).not.toThrow();
    expect(() => cmb.heightAtLine(lineNumber)).not.toThrow();
    expect(() => cmb.historySize()).not.toThrow();
    expect(() => cmb.indexFromPos(pos)).not.toThrow();
    expect(() => cmb.isClean()).not.toThrow();
    expect(() => cmb.isReadOnly()).not.toThrow();
    expect(() => cmb.lastLine()).not.toThrow();
    expect(() => cmb.lineAtHeight(1)).not.toThrow();
    expect(() => cmb.lineCount()).not.toThrow();
    expect(() => cmb.lineInfo(lineNumber)).not.toThrow();
    expect(() => cmb.lineSeparator()).not.toThrow();
    expect(() => cmb.markClean()).not.toThrow();
    expect(() => cmb.phrase("text")).not.toThrow();
    expect(() => cmb.posFromIndex(1)).not.toThrow();
    expect(() => cmb.redo()).not.toThrow();
    expect(() => cmb.refresh()).not.toThrow();
    expect(() =>
      cmb.removeLineClass(lineNumber, code, className)
    ).not.toThrow();
    expect(() => cmb.scrollIntoView({ line: 0, ch: 0 })).not.toThrow();
    expect(() => cmb.scrollTo()).not.toThrow();
    expect(() =>
      cmb.setGutterMarker(lineNumber, marker, domNode)
    ).not.toThrow();
    expect(() => cmb.setHistory(cmb.getHistory())).not.toThrow();
    expect(() => cmb.setSize(lineNumber, 0)).not.toThrow();
    expect(() => cmb.undo()).not.toThrow();
    cmb.setBlockMode(true);

    expect(() => cmb.setValue(code)).not.toThrow();
    expect(() => cmb.addLineClass(0, "text", className)).not.toThrow();
    expect(() => cmb.addLineWidget(0, domNode)).not.toThrow();
    expect(() => cmb.addWidget(pos, domNode, true)).not.toThrow();
    expect(() => cmb.changeGeneration()).not.toThrow();
    expect(() => cmb.clearGutter("gutter id")).not.toThrow();
    expect(() => cmb.clearHistory()).not.toThrow();
    expect(() => cmb.defaultCharWidth()).not.toThrow();
    expect(() => cmb.defaultTextHeight()).not.toThrow();
    expect(() => cmb.eachLine(f)).not.toThrow();
    expect(() => cmb.execCommand("goLineLeft")).not.toThrow();
    expect(() => cmb.findWordAt(pos)).not.toThrow();
    expect(() => cmb.firstLine()).not.toThrow();
    expect(() => cmb.focus()).not.toThrow();
    expect(() => cmb.getGutterElement()).not.toThrow();
    expect(() => cmb.getHistory()).not.toThrow();
    expect(() => cmb.getInputField()).not.toThrow();
    expect(() => cmb.getLine(3)).not.toThrow();
    expect(() => cmb.getLineHandle(0)).not.toThrow();
    expect(() => cmb.getLineNumber(lineHandle)).not.toThrow();
    expect(() => cmb.getRange(pos, pos)).not.toThrow();
    expect(() => cmb.getScrollerElement()).not.toThrow();
    expect(() => cmb.getScrollInfo()).not.toThrow();
    expect(() => cmb.getValue()).not.toThrow();
    expect(() => cmb.getViewport()).not.toThrow();
    expect(() => cmb.getWrapperElement()).not.toThrow();
    expect(() => cmb.heightAtLine(0)).not.toThrow();
    expect(() => cmb.historySize()).not.toThrow();
    expect(() => cmb.indexFromPos(pos)).not.toThrow();
    expect(() => cmb.isClean()).not.toThrow();
    expect(() => cmb.isReadOnly()).not.toThrow();
    expect(() => cmb.lastLine()).not.toThrow();
    expect(() => cmb.lineAtHeight(0)).not.toThrow();
    expect(() => cmb.lineCount()).not.toThrow();
    expect(() => cmb.lineInfo(0)).not.toThrow();
    expect(() => cmb.lineSeparator()).not.toThrow();
    expect(() => cmb.markClean()).not.toThrow();
    expect(() => cmb.phrase("text")).not.toThrow();
    expect(() => cmb.posFromIndex(0)).not.toThrow();
    expect(() => cmb.redo()).not.toThrow();
    expect(() => cmb.refresh()).not.toThrow();
    expect(() => cmb.removeLineClass(0, code, className)).not.toThrow();
    expect(() => cmb.scrollIntoView({ line: 0, ch: 0 })).not.toThrow();
    expect(() => cmb.scrollTo()).not.toThrow();
    expect(() => cmb.setGutterMarker(0, marker, domNode)).not.toThrow();
    expect(() => cmb.setHistory(cmb.getHistory())).not.toThrow();
    expect(() => cmb.setSize(0, 0)).not.toThrow();
    expect(() => cmb.undo()).not.toThrow();
  });

  it("addSelection should work as-is for text mode", async () => {
    expect(cmb.listSelections().length).toBe(1);
    cmb.addSelection({ line: 0, ch: 0 }, { line: 0, ch: 7 });
    // strip out the first selection, build a simple from/to Object
    const r = cmb.listSelections()[0];
    const simpleRange = { from: r.anchor, to: r.head };
    expect(simpleRange).toEqual({
      from: { line: 0, ch: 0 },
      to: { line: 0, ch: 7 },
    });
  });

  it("addSelection should work as-expected for block mode", async () => {
    cmb.setBlockMode(true);
    expect(cmb.listSelections().length).toBe(1);
    cmb.addSelection({ line: 0, ch: 0 }, { line: 0, ch: 7 });
    // the block is the selection: the cursor that was there is not one too
    expect(cmb.listSelections().length).toBe(1);
    const firstRoot = currentFirstRoot().element;
    expect(firstRoot!.getAttribute("aria-selected")).toBe("true");
  });

  // SKIPPED (D): by decision (user, 2026-11-23): the CM5 API is not supported; the CM6 equivalent is `ed.state.selection.main` (offsets; `doc.lineAt` for the line) (test: the selection is offsets: extending, replacing and reading it (extendSelection, replaceRange, replaceSelection, somethingSelected), spec/cm6-api.test.ts)

  // first error (sweep): Error: expect(received).toBe(expected) // Object.is equality
  it.skip("getCursor should work as-is for Text", async () => {
    cmb.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 7 });
    expect(cmb.getBlockMode()).toBe(false);
    expect(cmb.listSelections().length).toBe(1);
    expect(simpleCursor(cmb.getCursor())).toEqual({ line: 0, ch: 7 });
    expect(simpleCursor(cmb.getCursor("head"))).toEqual({
      line: 0,
      ch: 7,
    });
    expect(simpleCursor(cmb.getCursor("anchor"))).toEqual({
      line: 0,
      ch: 0,
    });
    expect(simpleCursor(cmb.getCursor("from"))).toEqual({
      line: 0,
      ch: 0,
    });
    expect(simpleCursor(cmb.getCursor("to"))).toEqual({ line: 0, ch: 7 });
  });

  it("getCursor should only work with head/to for Blocks", async () => {
    cmb.setBlockMode(true);
    mouseDown(currentFirstRoot());
    expect(simpleCursor(cmb.getCursor())).toEqual({ line: 0, ch: 0 });
    expect(() => cmb.getCursor("head")).toThrow();
    expect(() => cmb.getCursor("anchor")).toThrow();
    expect(cmb.getCursor("from")).toEqual({ line: 0, ch: 0 });
    expect(cmb.getCursor("to")).toEqual({ line: 0, ch: 7 });
  });

  it("getSelection should work as-is for text", async () => {
    cmb.setValue(`(+ 1 2)\ny`);
    cmb.setSelection({ line: 0, ch: 0 }, { line: 1, ch: 1 });
    expect(cmb.getSelection("MOO")).toBe("(+ 1 2)MOOy");
  });

  it("getSelection should work as-expected for blocks selected programmatically", async () => {
    cmb.setValue(`(+ 1 2)\ny`);
    cmb.setBlockMode(true);
    // blockmode API test
    cmb.setSelection({ line: 0, ch: 0 }, { line: 1, ch: 1 });
    expect(cmb.getSelection("MOO")).toBe("(+ 1 2)MOOy");
    cmb.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 0 });
    expect(cmb.getSelection("MOO")).toBe("");
  });

  it("getSelection should work as-expected for blocks", async () => {
    cmb.setBlockMode(true);
    // blockmode API test
    click(currentFirstRoot());
    keyDown(" ", {}, currentFirstRoot());
    const selectedNodes = cmb.getSelectedNodes();
    expect(selectedNodes.length).toBe(4);
    expect(cmb.getSelection("MOO")).toBe("(+ 1 2)");
    expect(currentFirstRoot().element!.getAttribute("aria-selected")).toBe(
      "true"
    );
  });

  it("getSelections should work as-is for text", async () => {
    cmb.setValue(`x\ny`);
    cmb.setSelection({ line: 0, ch: 0 }, { line: 1, ch: 1 });
    // textmode API test
    expect(cmb.getSelections("MOO")).toEqual(["xMOOy"]);
  });

  it("getSelections should work as-expected for blocks selected programmatically", async () => {
    cmb.setBlockMode(true);
    cmb.setSelection({ line: 0, ch: 0 }, { line: 1, ch: 1 });
    expect(cmb.getSelections("MOO")).toEqual(["(+ 1 2)MOOy"]);
    cmb.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 0 });
    expect(cmb.listSelections().length).toBe(1);
  });

  it("getSelections should work as-expected for blocks using block selection", async () => {
    cmb.setBlockMode(true);
    mouseDown(currentFirstRoot());
    keyDown(" ", {}, currentFirstRoot());
    const selectedNodes = cmb.getSelectedNodes();
    expect(selectedNodes.length).toBe(4);
    const selections = cmb.getSelections("MOO");
    expect(selections).toEqual(["(+ 1 2)"]);
    expect(currentFirstRoot().element!.getAttribute("aria-selected")).toBe(
      "true"
    );
  });

  it("hasFocus", async () => {
    // textmode API test
    cmb.focus();
    cmb.setCursor({ line: 0, ch: 0 });
    expect(cmb.hasFocus()).toBe(true);
    cmb.setBlockMode(true);
    // blockmode API test
    cmb.focus();
    click(currentFirstRoot());
    expect(cmb.hasFocus()).toBe(true);
  });

  it("listSelections", async () => {
    cmb.setValue(`(+ 1 2)\n\n(- 3 4)`);
    // textmode API test
    cmb.setSelections([
      { anchor: { line: 0, ch: 0 }, head: { line: 0, ch: 7 } },
      { anchor: { line: 2, ch: 0 }, head: { line: 2, ch: 7 } },
    ]);
    const selections = cmb.listSelections().map((s) => {
      return { anchor: simpleCursor(s.anchor), head: simpleCursor(s.head) };
    });
    expect(selections).toEqual([
      { anchor: { line: 0, ch: 0 }, head: { line: 0, ch: 7 } },
      { anchor: { line: 2, ch: 0 }, head: { line: 2, ch: 7 } },
    ]);
    cmb.setBlockMode(true);
    // blockmode API test
    cmb.setSelections([
      { anchor: { line: 0, ch: 0 }, head: { line: 0, ch: 7 } },
      { anchor: { line: 2, ch: 0 }, head: { line: 2, ch: 7 } },
    ]);
    expect(
      cmb.listSelections().map((s) => ({ anchor: s.anchor, head: s.head }))
    ).toEqual([
      { anchor: { line: 0, ch: 0 }, head: { line: 0, ch: 7 } },
      { anchor: { line: 2, ch: 0 }, head: { line: 2, ch: 7 } },
    ]);
  });

  // SKIPPED (D): by decision (user, 2026-11-23): the CM5 API is not supported; the CM6 equivalent is `ed.dispatch({changes})` (test: the selection is offsets: extending, replacing and reading it (extendSelection, replaceRange, replaceSelection, somethingSelected), spec/cm6-api.test.ts)

  // first error (sweep): Error: expect(received).toThrow()
  it.skip("replaceRange", async () => {
    cmb.setBlockMode(true);
    // blockmode API test
    expect(() =>
      cmb.replaceRange("Maya", { line: 0, ch: 2 }, { line: 0, ch: 7 })
    ).toThrow();
    cmb.setBlockMode(false);
    // textmode API test
    cmb.replaceRange("Maya", { line: 0, ch: 2 }, { line: 0, ch: 7 });
    expect(cmb.getValue()).toBe("(+Maya\ny");
  });

  // SKIPPED (D): by decision (user, 2026-11-23): the CM5 API is not supported; the CM6 equivalent is `ed.dispatch(ed.state.replaceSelection(text))` (test: the selection is offsets: extending, replacing and reading it (extendSelection, replaceRange, replaceSelection, somethingSelected), spec/cm6-api.test.ts)

  // first error (sweep): Error: expect(received).toThrow()
  it.skip("replaceSelection", async () => {
    cmb.setBlockMode(true);
    // blockmode API test
    expect(() =>
      cmb.replaceRange("Maya", { line: 0, ch: 2 }, { line: 0, ch: 7 })
    ).toThrow();
    cmb.setBlockMode(false);
    // textmode API test
    cmb.replaceRange("Maya", { line: 0, ch: 2 }, { line: 0, ch: 7 });
    expect(cmb.getValue()).toBe("(+Maya\ny");
  });

  it("replaceSelections should work as-expected in blockmode", async () => {
    cmb.setValue("(+ 1 2)\nx\n(+ 3 4)");
    cmb.setBlockMode(true);
    // blockmode API test
    keyDown(" ", {}, currentFirstRoot());
    expect(cmb.getSelectedNodes().length).toBe(4);
    mouseDown(currentThirdRoot());
    keyDown(" ", {}, currentThirdRoot());
    expect(cmb.getSelectedNodes().length).toBe(8);
    cmb.replaceSelections(["Maya", "Schanzer"]);
    expect(cmb.getValue()).toBe("Maya\nx\nSchanzer");
  });

  it("replaceSelections should work as-is in textmode", async () => {
    cmb.setBlockMode(false);
    cmb.setValue("(+ 1 2)\nx\n(+ 3 4)");
    // textmode API test
    cmb.setSelections([
      { anchor: { line: 0, ch: 0 }, head: { line: 0, ch: 7 } },
      { anchor: { line: 2, ch: 0 }, head: { line: 2, ch: 7 } },
    ]);
    cmb.replaceSelections(["Maya", "Schanzer"]);
    expect(cmb.getValue()).toBe("Maya\nx\nSchanzer");
  });

  // SKIPPED (D): by decision (user, 2026-11-23): the CM5 API is not supported; the CM6 equivalent is a `Decoration.widget` in an extension (test: widgets, line decorations and gutters of the page work as in CodeMirror 6, spec/cm6-api.test.ts)

  // first error (sweep): Error: not in the compat layer: cmb.setBookmark (CM5 bookmarks)
  it.skip("setBookmark", async () => {
    const domNode = document.createElement("span");
    cmb.setBlockMode(true);
    expect(() =>
      cmb.setBookmark({ line: 0, ch: 2 }, { widget: domNode })
    ).toThrow();
    cmb.setBlockMode(false);
    expect(cmb.setBookmark({ line: 0, ch: 2 }, { widget: domNode })).not.toBe(
      null
    );
  });

  // SKIPPED (D): by decision (user, 2026-11-23): the CM5 API is not supported; the CM6 equivalent is `ed.dispatch({selection})` (test: the selection is offsets: extending, replacing and reading it (extendSelection, replaceRange, replaceSelection, somethingSelected), spec/cm6-api.test.ts)

  // first error (sweep): TypeError: Cannot read properties of undefined (reading 'nid')
  it.skip("setCursor should work as-is for text, or activate the containing block", async () => {
    // first test setCursor in text mode
    cmb.setCursor({ line: 1, ch: 1 });
    expect(simpleCursor(cmb.getCursor())).toEqual({ line: 1, ch: 1 });

    // now test setCursor in block mode
    cmb.setBlockMode(true);

    expect(currentFocusNId()).toBe(0);
    cmb.setCursor({ line: 0, ch: 1 });
    expect(cmb.getFocusedNode()!.nid).toBe(1);
    // once the activation has settled, the active block holds the focus, and
    // the cursor of a focused block is the start of that block
    expect(simpleCursor(cmb.getCursor())).toEqual({ line: 0, ch: 1 });
  });

  it("setSelection", async () => {
    cmb.setValue(`(+ 1 2)\n\n(- 3 4)`);
    // textmode API test
    cmb.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 7 });
    const selections = cmb.listSelections().map((s) => {
      return { anchor: simpleCursor(s.anchor), head: simpleCursor(s.head) };
    });
    expect(selections).toEqual([
      { anchor: { line: 0, ch: 0 }, head: { line: 0, ch: 7 } },
    ]);
    cmb.setBlockMode(true);
    // blockmode API test
    expect(() =>
      cmb.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 3 })
    ).toThrow();
    cmb.setSelection({ line: 0, ch: 0 });
    expect(cmb.listSelections().length).toBe(1);
    expect(
      cmb.listSelections().map((r) => ({
        anchor: simpleCursor(r.anchor),
        head: simpleCursor(r.head),
      }))
    ).toEqual([
      {
        anchor: { line: 0, ch: 0 },
        head: { line: 0, ch: 0 },
      },
    ]);
  });

  it("setSelections", async () => {
    cmb.setValue(`(+ 1 2)\n\n(- 3 4)`);
    // textmode API test
    cmb.setSelections([
      { anchor: { line: 0, ch: 0 }, head: { line: 0, ch: 7 } },
      { anchor: { line: 2, ch: 0 }, head: { line: 2, ch: 7 } },
    ]);
    const selections = cmb.listSelections().map((s) => {
      return { anchor: simpleCursor(s.anchor), head: simpleCursor(s.head) };
    });
    expect(selections).toEqual([
      { anchor: { line: 0, ch: 0 }, head: { line: 0, ch: 7 } },
      { anchor: { line: 2, ch: 0 }, head: { line: 2, ch: 7 } },
    ]);
    cmb.setBlockMode(true);
    // blockmode API test
    expect(() =>
      cmb.setSelections([
        { anchor: { line: 0, ch: 0 }, head: { line: 0, ch: 3 } },
        { anchor: { line: 2, ch: 0 }, head: { line: 2, ch: 7 } },
      ])
    ).toThrow();
    cmb.setSelections([
      { anchor: { line: 0, ch: 0 }, head: { line: 0, ch: 7 } },
      { anchor: { line: 2, ch: 0 }, head: { line: 2, ch: 7 } },
    ]);
    expect(
      cmb.listSelections().map((s) => ({ anchor: s.anchor, head: s.head }))
    ).toEqual([
      { anchor: { line: 0, ch: 0 }, head: { line: 0, ch: 7 } },
      { anchor: { line: 2, ch: 0 }, head: { line: 2, ch: 7 } },
    ]);
  });

  // SKIPPED (D): by decision (user, 2026-11-23): the CM5 API is not supported; the CM6 equivalent is `!ed.state.selection.main.empty` (test: the selection is offsets: extending, replacing and reading it (extendSelection, replaceRange, replaceSelection, somethingSelected), spec/cm6-api.test.ts)

  // first error (sweep): Error: expect(received).toBe(expected) // Object.is equality
  it.skip("somethingSelected should work for selected blocks and text ranges", async () => {
    cmb.setBlockMode(true);
    const firstRoot = currentFirstRoot();
    expect(cmb.somethingSelected()).toBe(false);
    mouseDown(firstRoot);
    expect(cmb.getSelectedNodes().length).toBe(0);
    keyDown(" ", {}, firstRoot);
    expect(cmb.getSelectedNodes().length).toBe(4);
    expect(cmb.somethingSelected()).toBe(true);
    cmb.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 0 });
    expect(cmb.getSelectedNodes().length).toBe(0);
    expect(cmb.somethingSelected()).toBe(false);
    cmb.addSelection({ line: 0, ch: 0 }, { line: 0, ch: 7 });
    expect(cmb.somethingSelected()).toBe(true);
    cmb.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 0 });
    expect(cmb.getSelectedNodes().length).toBe(0);
    expect(cmb.somethingSelected()).toBe(false);
    cmb.addSelection({ line: 0, ch: 0 }, { line: 1, ch: 1 });
    expect(cmb.somethingSelected()).toBe(true);
  });
});
