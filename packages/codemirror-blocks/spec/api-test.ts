import wescheme from "../src/languages/wescheme";
import "codemirror/addon/search/searchcursor.js";

/*eslint no-unused-vars: "off"*/
import {
  teardown,
  click,
  mouseDown,
  keyDown,
  finishRender,
  mountCMB,
} from "../src/toolkit/test-utils";
import { API } from "../src/CodeMirrorBlocks";
import CodeMirror from "codemirror";
import { debugLog } from "../src/utils";

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
    cmb = await mountCMB(wescheme);
    cmb.setBlockMode(false);
    await finishRender();
    cmb.setValue(`(+ 1 2)\ny`);
    await finishRender();
  });

  afterEach(teardown);

  it("those unsupported in the BlockEditor should throw errors", async () => {
    cmb.setBlockMode(true);
    await finishRender();
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

  it("those that simply pass through should not throw errors", async () => {
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
    await finishRender();

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
    await finishRender();
    expect(cmb.listSelections().length).toBe(1);
    cmb.addSelection({ line: 0, ch: 0 }, { line: 0, ch: 7 });
    await finishRender();
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
    await finishRender();
    expect(cmb.listSelections().length).toBe(1);
    cmb.addSelection({ line: 0, ch: 0 }, { line: 0, ch: 7 });
    await finishRender();
    expect(cmb.listSelections().length).toBe(2);
    const firstRoot = currentFirstRoot().element;
    expect(firstRoot!.getAttribute("aria-selected")).toBe("true");
  });

  it("getCursor should work as-is for Text", async () => {
    await finishRender();
    cmb.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 7 });
    await finishRender();
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
    await finishRender();
    mouseDown(currentFirstRoot());
    await finishRender();
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
    await finishRender();
    // blockmode API test
    cmb.setSelection({ line: 0, ch: 0 }, { line: 1, ch: 1 });
    expect(cmb.getSelection("MOO")).toBe("(+ 1 2)MOOy");
    cmb.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 0 });
    expect(cmb.getSelection("MOO")).toBe("");
  });

  it("getSelection should work as-expected for blocks", async () => {
    cmb.setBlockMode(true);
    await finishRender();
    // blockmode API test
    click(currentFirstRoot());
    await finishRender();
    keyDown(" ", {}, currentFirstRoot());
    await finishRender();
    const selectedNodes = cmb.getSelectedNodes();
    expect(selectedNodes.length).toBe(4);
    expect(cmb.getSelection("MOO")).toBe("(+ 1 2)MOO");
    await finishRender();
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
    await finishRender();
    cmb.setSelection({ line: 0, ch: 0 }, { line: 1, ch: 1 });
    expect(cmb.getSelections("MOO")).toEqual(["(+ 1 2)MOOy"]);
    cmb.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 0 });
    expect(cmb.listSelections().length).toBe(1);
  });

  it("getSelections should work as-expected for blocks using block selection", async () => {
    cmb.setBlockMode(true);
    await finishRender();
    mouseDown(currentFirstRoot());
    await finishRender();
    keyDown(" ", {}, currentFirstRoot());
    await finishRender();
    const selectedNodes = cmb.getSelectedNodes();
    expect(selectedNodes.length).toBe(4);
    const selections = cmb.getSelections("MOO");
    expect(selections.length).toBe(2);
    expect(selections).toEqual(["(+ 1 2)", ""]);
    expect(currentFirstRoot().element!.getAttribute("aria-selected")).toBe(
      "true"
    );
  });

  it("hasFocus", async () => {
    // textmode API test
    cmb.focus();
    cmb.setCursor({ line: 0, ch: 0 });
    await finishRender();
    expect(cmb.hasFocus()).toBe(true);
    cmb.setBlockMode(true);
    await finishRender();
    // blockmode API test
    cmb.focus();
    click(currentFirstRoot());
    await finishRender();
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
    await finishRender();
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

  it("replaceRange", async () => {
    cmb.setBlockMode(true);
    await finishRender();
    // blockmode API test
    expect(() =>
      cmb.replaceRange("Maya", { line: 0, ch: 2 }, { line: 0, ch: 7 })
    ).toThrow();
    cmb.setBlockMode(false);
    // textmode API test
    cmb.replaceRange("Maya", { line: 0, ch: 2 }, { line: 0, ch: 7 });
    expect(cmb.getValue()).toBe("(+Maya\ny");
  });

  it("replaceSelection", async () => {
    cmb.setBlockMode(true);
    await finishRender();
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
    await finishRender();
    // blockmode API test
    keyDown(" ", {}, currentFirstRoot());
    await finishRender();
    expect(cmb.getSelectedNodes().length).toBe(4);
    mouseDown(currentThirdRoot());
    keyDown(" ", {}, currentThirdRoot());
    await finishRender();
    expect(cmb.getSelectedNodes().length).toBe(8);
    cmb.replaceSelections(["Maya", "Schanzer"]);
    expect(cmb.getValue()).toBe("Maya\nx\nSchanzer");
  });

  it("replaceSelections should work as-is in textmode", async () => {
    cmb.setBlockMode(false);
    await finishRender();
    cmb.setValue("(+ 1 2)\nx\n(+ 3 4)");
    await finishRender();
    // textmode API test
    cmb.setSelections([
      { anchor: { line: 0, ch: 0 }, head: { line: 0, ch: 7 } },
      { anchor: { line: 2, ch: 0 }, head: { line: 2, ch: 7 } },
    ]);
    cmb.replaceSelections(["Maya", "Schanzer"]);
    expect(cmb.getValue()).toBe("Maya\nx\nSchanzer");
  });

  it("setBookmark", async () => {
    const domNode = document.createElement("span");
    cmb.setBlockMode(true);
    await finishRender();
    expect(() =>
      cmb.setBookmark({ line: 0, ch: 2 }, { widget: domNode })
    ).toThrow();
    cmb.setBlockMode(false);
    await finishRender();
    expect(cmb.setBookmark({ line: 0, ch: 2 }, { widget: domNode })).not.toBe(
      null
    );
  });

  // TODO(pcardune): reenable or rewrite this test, which was passing by accident
  // due to activateByNid being async and not waiting for it.
  xit("setCursor should work as-is for text, or activate the containing block", async () => {
    cmb.setBlockMode(true);
    await finishRender();
    cmb.setCursor({ line: 1, ch: 1 });
    expect(simpleCursor(cmb.getCursor())).toEqual({ line: 1, ch: 1 });
    expect(currentFocusNId()).toBe(0);
    cmb.setCursor({ line: 0, ch: 1 });
    expect(currentFocusNId()).toBe(0);
    // activating the first block should return a cursor at its end
    expect(simpleCursor(cmb.getCursor())).toEqual({ line: 0, ch: 7 });
    await finishRender();
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
    await finishRender();
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
    await finishRender();
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

  it("somethingSelected should work for selected blocks and text ranges", async () => {
    cmb.setBlockMode(true);
    await finishRender();
    const firstRoot = currentFirstRoot();
    expect(cmb.somethingSelected()).toBe(false);
    mouseDown(firstRoot);
    await finishRender();
    expect(cmb.getSelectedNodes().length).toBe(0);
    keyDown(" ", {}, firstRoot);
    await finishRender();
    expect(cmb.getSelectedNodes().length).toBe(4);
    expect(cmb.somethingSelected()).toBe(true);
    cmb.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 0 });
    await finishRender();
    expect(cmb.getSelectedNodes().length).toBe(0);
    expect(cmb.somethingSelected()).toBe(false);
    cmb.addSelection({ line: 0, ch: 0 }, { line: 0, ch: 7 });
    expect(cmb.somethingSelected()).toBe(true);
    cmb.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 0 });
    await finishRender();
    expect(cmb.getSelectedNodes().length).toBe(0);
    expect(cmb.somethingSelected()).toBe(false);
    cmb.addSelection({ line: 0, ch: 0 }, { line: 1, ch: 1 });
    expect(cmb.somethingSelected()).toBe(true);
  });
});
