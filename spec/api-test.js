import wescheme from '../src/languages/wescheme';
import 'codemirror/addon/search/searchcursor.js';

/*eslint no-unused-vars: "off"*/
import {
  mac, cmd_ctrl, DELAY, wait, removeEventListeners, teardown, activationSetup,
  click, mouseDown, mouseenter, mouseover, mouseleave, doubleClick, blur, 
  paste, cut, copy, dragstart, dragover, drop, dragenter, dragenterSeq, 
  dragend, dragleave, keyDown, keyPress, insertText
} from '../spec/support/test-utils';

console.log('Doing api-test.js')

// be sure to call with `apply` or `call`
let setup = function () { activationSetup.call(this, wescheme); };
function simpleCursor(cur) {
  const {line, ch} = cur;
  return {line, ch};
}

describe("when testing CM apis,", function () {
  beforeEach(async function () {
    setup.call(this);
    this.cmb.setBlockMode(false);
    this.cmb.setValue(`(+ 1 2)\ny`);
    await wait(DELAY);
    this.currentFocusNId = () => this.cmb.getFocusedNode().nid;
    this.roots = () => this.cmb.getAst().rootNodes;
    this.currentFirstRoot = () => this.roots()[0];
    this.currentSecondRoot = () => this.roots()[1];
    this.currentThirdRoot = () => this.roots()[2];
  });

  afterEach(function () { teardown(); });

  it('those unsupported in the BlockEditor should throw errors', async function () {
    this.cmb.setBlockMode(true);
    await wait(DELAY);
    expect(()=>this.cmb.cursorCoords(true,"page")).toThrow();
    expect(()=>this.cmb.addKeyMap(true)).toThrow();
    expect(()=>this.cmb.addOverlay(true)).toThrow();
    expect(()=>this.cmb.charCoords(true)).toThrow();
    expect(()=>this.cmb.coordsChar(true)).toThrow();
    expect(()=>this.cmb.endOperation(()=>true)).toThrow();
    expect(()=>this.cmb.findPosH(true)).toThrow();
    expect(()=>this.cmb.findPosV(true)).toThrow();
    expect(()=>this.cmb.getExtending(true)).toThrow();
    expect(()=>this.cmb.indentLine(true)).toThrow();
    //expect(()=>this.cmb.off(true)).toThrow();
    //expect(()=>this.cmb.on(true)).toThrow();
    expect(()=>this.cmb.redoSelection()).toThrow();
    expect(()=>this.cmb.removeKeyMap(true)).toThrow();
    expect(()=>this.cmb.removeOverlay(true)).toThrow();
    expect(()=>this.cmb.setExtending(true)).toThrow();
    expect(()=>this.cmb.startOperation(()=>true)).toThrow();
    expect(()=>this.cmb.toggleOverwrite(true)).toThrow();
    expect(()=>this.cmb.undoSelection(true)).toThrow();
    expect(()=>this.cmb.extendSelection(true)).toThrow();
    expect(()=>this.cmb.extendSelections(true)).toThrow();
    expect(()=>this.cmb.extendSelectionsBy(true)).toThrow();
  });

  it('those unsupported in the TextEditor should throw errors', async function () {
    expect(()=>this.cmb.startOperation()).toThrow();
    expect(()=>this.cmb.endOperation()).toThrow();
    expect(()=>this.cmb.operation()).toThrow();
    //expect(()=>this.cmb.on()).toThrow();
    //expect(()=>this.cmb.off()).toThrow();
  });

  it('those that simply pass through should not throw errors', async function () {
    const domNode = document.createElement('span');
    const pos = {line: 0, ch: 0};
    const f = () => true;
    const code = 'someCode';
    const className = 'aClass';
    const marker = 'aMarker';
    const lineHandle = this.cmb.getLineHandle(0);
    const lineNumber = 0;

    expect(()=>this.cmb.setValue(code)).not.toThrow();
    expect(()=>this.cmb.addLineClass(className)).not.toThrow();
    expect(()=>this.cmb.addLineWidget(lineNumber, domNode)).not.toThrow();
    expect(()=>this.cmb.addWidget(pos, domNode, true)).not.toThrow();
    expect(()=>this.cmb.changeGeneration()).not.toThrow();
    expect(()=>this.cmb.clearGutter()).not.toThrow();
    expect(()=>this.cmb.clearHistory()).not.toThrow();
    expect(()=>this.cmb.defaultCharWidth()).not.toThrow();
    expect(()=>this.cmb.defaultTextHeight()).not.toThrow();
    expect(()=>this.cmb.eachLine(f)).not.toThrow();
    expect(()=>this.cmb.execCommand()).not.toThrow();
    expect(()=>this.cmb.findWordAt(pos)).not.toThrow();
    expect(()=>this.cmb.firstLine()).not.toThrow();
    expect(()=>this.cmb.focus()).not.toThrow();
    expect(()=>this.cmb.getGutterElement()).not.toThrow();
    expect(()=>this.cmb.getHistory()).not.toThrow();
    expect(()=>this.cmb.getInputField()).not.toThrow();
    expect(()=>this.cmb.getLine()).not.toThrow();
    expect(()=>this.cmb.getLineHandle(lineNumber)).not.toThrow();
    expect(()=>this.cmb.getLineNumber(lineHandle)).not.toThrow();
    expect(()=>this.cmb.getRange(pos,pos)).not.toThrow();
    expect(()=>this.cmb.getScrollerElement()).not.toThrow();
    expect(()=>this.cmb.getScrollInfo()).not.toThrow();
    expect(()=>this.cmb.getValue()).not.toThrow();
    expect(()=>this.cmb.getViewport()).not.toThrow();
    expect(()=>this.cmb.getWrapperElement()).not.toThrow();
    expect(()=>this.cmb.heightAtLine(lineNumber)).not.toThrow();
    expect(()=>this.cmb.historySize()).not.toThrow();
    expect(()=>this.cmb.indexFromPos(pos)).not.toThrow();
    expect(()=>this.cmb.isClean()).not.toThrow();
    expect(()=>this.cmb.isReadOnly()).not.toThrow();
    expect(()=>this.cmb.lastLine()).not.toThrow();
    expect(()=>this.cmb.lineAtHeight()).not.toThrow();
    expect(()=>this.cmb.lineCount()).not.toThrow();
    expect(()=>this.cmb.lineInfo(lineNumber)).not.toThrow();
    expect(()=>this.cmb.lineSeparator()).not.toThrow();
    expect(()=>this.cmb.markClean()).not.toThrow();
    expect(()=>this.cmb.phrase()).not.toThrow();
    expect(()=>this.cmb.posFromIndex()).not.toThrow();
    expect(()=>this.cmb.redo()).not.toThrow();
    expect(()=>this.cmb.refresh()).not.toThrow();
    expect(()=>this.cmb.removeLineClass(lineNumber, code, className)).not.toThrow();
    expect(()=>this.cmb.scrollIntoView()).not.toThrow();
    expect(()=>this.cmb.scrollTo()).not.toThrow();
    expect(()=>this.cmb.setGutterMarker(lineNumber, marker, domNode)).not.toThrow();
    expect(()=>this.cmb.setHistory(this.cmb.getHistory())).not.toThrow();
    expect(()=>this.cmb.setSize(lineNumber)).not.toThrow();
    expect(()=>this.cmb.undo()).not.toThrow();
    this.cmb.setBlockMode(true);
    await wait(DELAY);

    expect(()=>this.cmb.setValue(code)).not.toThrow();
    expect(()=>this.cmb.addLineClass(className)).not.toThrow();
    expect(()=>this.cmb.addLineWidget(0, domNode)).not.toThrow();
    expect(()=>this.cmb.addWidget(pos, domNode, true)).not.toThrow();
    expect(()=>this.cmb.changeGeneration()).not.toThrow();
    expect(()=>this.cmb.clearGutter()).not.toThrow();
    expect(()=>this.cmb.clearHistory()).not.toThrow();
    expect(()=>this.cmb.defaultCharWidth()).not.toThrow();
    expect(()=>this.cmb.defaultTextHeight()).not.toThrow();
    expect(()=>this.cmb.eachLine(f)).not.toThrow();
    expect(()=>this.cmb.execCommand()).not.toThrow();
    expect(()=>this.cmb.findWordAt(pos)).not.toThrow();
    expect(()=>this.cmb.firstLine()).not.toThrow();
    expect(()=>this.cmb.focus()).not.toThrow();
    expect(()=>this.cmb.getGutterElement()).not.toThrow();
    expect(()=>this.cmb.getHistory()).not.toThrow();
    expect(()=>this.cmb.getInputField()).not.toThrow();
    expect(()=>this.cmb.getLine()).not.toThrow();
    expect(()=>this.cmb.getLineHandle(0)).not.toThrow();
    expect(()=>this.cmb.getLineNumber(lineHandle)).not.toThrow();
    expect(()=>this.cmb.getRange(pos,pos)).not.toThrow();
    expect(()=>this.cmb.getScrollerElement()).not.toThrow();
    expect(()=>this.cmb.getScrollInfo()).not.toThrow();
    expect(()=>this.cmb.getValue()).not.toThrow();
    expect(()=>this.cmb.getViewport()).not.toThrow();
    expect(()=>this.cmb.getWrapperElement()).not.toThrow();
    expect(()=>this.cmb.heightAtLine(0)).not.toThrow();
    expect(()=>this.cmb.historySize()).not.toThrow();
    expect(()=>this.cmb.indexFromPos(pos)).not.toThrow();
    expect(()=>this.cmb.isClean()).not.toThrow();
    expect(()=>this.cmb.isReadOnly()).not.toThrow();
    expect(()=>this.cmb.lastLine()).not.toThrow();
    expect(()=>this.cmb.lineAtHeight()).not.toThrow();
    expect(()=>this.cmb.lineCount()).not.toThrow();
    expect(()=>this.cmb.lineInfo(0)).not.toThrow();
    expect(()=>this.cmb.lineSeparator()).not.toThrow();
    expect(()=>this.cmb.markClean()).not.toThrow();
    expect(()=>this.cmb.phrase()).not.toThrow();
    expect(()=>this.cmb.posFromIndex()).not.toThrow();
    expect(()=>this.cmb.redo()).not.toThrow();
    expect(()=>this.cmb.refresh()).not.toThrow();
    expect(()=>this.cmb.removeLineClass(0, code, className)).not.toThrow();
    expect(()=>this.cmb.scrollIntoView()).not.toThrow();
    expect(()=>this.cmb.scrollTo()).not.toThrow();
    expect(()=>this.cmb.setGutterMarker(0, marker, domNode)).not.toThrow();
    expect(()=>this.cmb.setHistory(this.cmb.getHistory())).not.toThrow();
    expect(()=>this.cmb.setSize(0)).not.toThrow();
    expect(()=>this.cmb.undo()).not.toThrow();
  });

  it('addSelection should work as-is for text mode', async function () {
    await wait(DELAY);
    expect(this.cmb.listSelections().length).toBe(1);
    this.cmb.addSelection({line:0, ch:0}, {line:0, ch:7});
    await wait(DELAY);
    // strip out the first selection, build a simple from/to Object
    const r = this.cmb.listSelections()[0];
    const simpleRange = {from: r.anchor, to: r.head};
    expect(simpleRange).toEqual({from: {line:0,ch:0}, to: {line:0,ch:7}});
  });

  it('addSelection should work as-expected for block mode', async function () {
    this.cmb.setBlockMode(true);
    await wait(DELAY);
    expect(this.cmb.listSelections().length).toBe(1);
    this.cmb.addSelection({line:0, ch:0}, {line:0, ch:7});
    await wait(DELAY);
    expect(this.cmb.listSelections().length).toBe(2);
    const firstRoot = this.currentFirstRoot().element;
    expect(firstRoot.getAttribute('aria-selected')).toBe("true");
  });

  it('getCursor should work as-is for Text', async function () {
    await wait(DELAY);
    this.cmb.setSelection({line: 0, ch: 0}, {line: 0, ch: 7});
    await wait(DELAY);
    expect(this.cmb.getBlockMode()).toBe(false);
    expect(this.cmb.listSelections().length).toBe(1);
    expect(simpleCursor(this.cmb.getCursor())).toEqual({line: 0, ch: 7});
    expect(simpleCursor(this.cmb.getCursor("head"))).toEqual({line: 0, ch: 7});
    expect(simpleCursor(this.cmb.getCursor("anchor"))).toEqual({line: 0, ch: 0});
    expect(simpleCursor(this.cmb.getCursor("from"))).toEqual({line: 0, ch: 0});
    expect(simpleCursor(this.cmb.getCursor("to"))).toEqual({line: 0, ch: 7});
  });

  it('getCursor should only work with head/to for Blocks', async function () {
    this.cmb.setBlockMode(true);
    await wait(DELAY);
    mouseDown(this.currentFirstRoot());
    await wait(DELAY);
    expect(simpleCursor(this.cmb.getCursor())).toEqual({line: 0, ch: 0});
    expect(() => this.cmb.getCursor("head")).toThrow();
    expect(() => this.cmb.getCursor("anchor")).toThrow();
    expect(this.cmb.getCursor("from")).toEqual({line: 0, ch: 0});
    expect(this.cmb.getCursor("to")).toEqual({line: 0, ch: 7});
  });

  it('getSelection should work as-is for text', async function () {
    this.cmb.setValue(`(+ 1 2)\ny`);
    this.cmb.setSelection({line: 0, ch: 0}, {line: 1, ch: 1});
    expect(this.cmb.getSelection("MOO")).toBe("(+ 1 2)MOOy");
  });

  it('getSelection should work as-expected for blocks selected programmatically', async function () {
    this.cmb.setValue(`(+ 1 2)\ny`);
    this.cmb.setBlockMode(true);
    await wait(DELAY);
    // blockmode API test
    this.cmb.setSelection({line: 0, ch: 0}, {line: 1, ch: 1});
    expect(this.cmb.getSelection("MOO")).toBe("(+ 1 2)MOOy");
    this.cmb.setSelection({line: 0, ch: 0}, {line: 0, ch: 0});
    expect(this.cmb.getSelection("MOO")).toBe("");
  });

  it('getSelection should work as-expected for blocks', async function () {
    this.cmb.setBlockMode(true);
    await wait(DELAY);
    // blockmode API test
    click(this.currentFirstRoot());
    await wait(DELAY);
    keyDown(" ", {}, this.currentFirstRoot());
    await wait(DELAY);
    const selectedNodes = this.cmb.getSelectedNodes();
    expect(selectedNodes.length).toBe(4);
    expect(this.cmb.getSelection("MOO")).toBe("(+ 1 2)MOO");
    await wait(DELAY);
    expect(this.currentFirstRoot().element.getAttribute("aria-selected"))
      .toBe("true");
  });

  it('getSelections should work as-is for text', async function () {
    this.cmb.setValue(`x\ny`);
    this.cmb.setSelection({line: 0, ch: 0}, {line: 1, ch: 1});
    // textmode API test
    expect(this.cmb.getSelections("MOO")).toEqual(["xMOOy"]);
  });

  it('getSelections should work as-expected for blocks selected programmatically', async function () {
    this.cmb.setBlockMode(true);
    await wait(DELAY);
    this.cmb.setSelection({line: 0, ch: 0}, {line: 1, ch: 1});
    expect(this.cmb.getSelections("MOO")).toEqual(["(+ 1 2)MOOy"]);
    this.cmb.setSelection({line: 0, ch: 0}, {line: 0, ch: 0});
    expect(this.cmb.listSelections().length).toBe(1);
  });

  it('getSelections should work as-expected for blocks using block selection', async function () {
    this.cmb.setBlockMode(true);
    await wait(DELAY);
    mouseDown(this.currentFirstRoot());
    await wait(DELAY);
    keyDown(" ", {}, this.currentFirstRoot());
    await wait(DELAY);
    const selectedNodes = this.cmb.getSelectedNodes();
    expect(selectedNodes.length).toBe(4);
    const selections = this.cmb.getSelections("MOO");
    expect(selections.length).toBe(2);
    expect(selections).toEqual(["(+ 1 2)",""]);
    expect(this.currentFirstRoot().element.getAttribute("aria-selected"))
      .toBe('true');
  });

  it('hasFocus', async function () {
    // textmode API test
    this.cmb.focus();
    this.cmb.setCursor({line: 0, ch: 0});
    await wait(DELAY);
    expect(this.cmb.hasFocus()).toBe(true);
    this.cmb.setBlockMode(true);
    await wait(DELAY);
    // blockmode API test
    this.cmb.focus();
    click(this.currentFirstRoot());
    await wait(DELAY);
    expect(this.cmb.hasFocus()).toBe(true);
  });

  it('listSelections', async function () {
    this.cmb.setValue(`(+ 1 2)\n\n(- 3 4)`);
    // textmode API test
    this.cmb.setSelections([{anchor: {line: 0, ch: 0}, head: {line: 0, ch: 7}}, 
      {anchor: {line: 2, ch: 0}, head: {line: 2, ch: 7}}]);
    const selections = this.cmb.listSelections().map(s => {
      return {anchor: simpleCursor(s.anchor), head: simpleCursor(s.head)};
    });
    expect(selections).toEqual([
      {anchor: {line: 0, ch: 0}, head: {line: 0, ch: 7}}, 
      {anchor: {line: 2, ch: 0}, head: {line: 2, ch: 7}}
    ]);
    this.cmb.setBlockMode(true);
    await wait(DELAY);
    // blockmode API test
    this.cmb.setSelections([{anchor: {line: 0, ch: 0}, head: {line: 0, ch: 7}}, 
      {anchor: {line: 2, ch: 0}, head: {line: 2, ch: 7}}]);
    expect(this.cmb.listSelections().map(s=>Object.assign({},s))).toEqual([
      {anchor: {line: 0, ch: 0}, head: {line: 0, ch: 7}}, 
      {anchor: {line: 2, ch: 0}, head: {line: 2, ch: 7}}
    ]);
  });

  it('replaceRange', async function () {
    this.cmb.setBlockMode(true);
    await wait(DELAY);
    // blockmode API test
    expect(() => this.cmb.replaceRange("Maya", {line: 0, ch: 2}, {line: 0, ch: 7}))
      .toThrow();
    this.cmb.setBlockMode(false);
    // textmode API test
    this.cmb.replaceRange("Maya", {line: 0, ch: 2}, {line: 0, ch: 7});
    expect(this.cmb.getValue()).toBe("(+Maya\ny");
    
  });

  it('replaceSelection', async function () {
    this.cmb.setBlockMode(true);
    await wait(DELAY);
    // blockmode API test
    expect(() => this.cmb.replaceRange("Maya", {line: 0, ch: 2}, {line: 0, ch: 7}))
      .toThrow();
    this.cmb.setBlockMode(false);
    // textmode API test
    this.cmb.replaceRange("Maya", {line: 0, ch: 2}, {line: 0, ch: 7});
    expect(this.cmb.getValue()).toBe("(+Maya\ny");
  });

  it('replaceSelections should work as-expected in blockmode', async function () {
    this.cmb.setValue('(+ 1 2)\nx\n(+ 3 4)');
    this.cmb.setBlockMode(true);
    await wait(DELAY);
    // blockmode API test
    keyDown(" ", {}, this.currentFirstRoot());
    await wait(DELAY);
    expect(this.cmb.getSelectedNodes().length).toBe(4);
    mouseDown(this.currentThirdRoot());
    keyDown(" ", {}, this.currentThirdRoot());
    await wait(DELAY);
    expect(this.cmb.getSelectedNodes().length).toBe(8);
    this.cmb.replaceSelections(["Maya", "Schanzer"]);
    expect(this.cmb.getValue()).toBe("Maya\nx\nSchanzer");
  });

  it('replaceSelections should work as-is in textmode', async function () {
    this.cmb.setBlockMode(false);
    await wait(DELAY);
    this.cmb.setValue('(+ 1 2)\nx\n(+ 3 4)');
    await wait(DELAY);
    // textmode API test
    this.cmb.setSelections([{anchor:{line:0,ch:0}, head:{line:0,ch:7}},
      {anchor:{line:2,ch:0}, head:{line:2,ch:7}}]);
    this.cmb.replaceSelections(["Maya", "Schanzer"]);    
    expect(this.cmb.getValue()).toBe("Maya\nx\nSchanzer");
  });  

  it('setBookmark', async function () {
    const domNode = document.createElement('span');
    this.cmb.setBlockMode(true);
    await wait(DELAY);
    expect(()=>this.cmb.setBookmark({line:0,ch:2}, {widget: domNode})).toThrow();
    this.cmb.setBlockMode(false);
    await wait(DELAY);
    expect(this.cmb.setBookmark({line:0,ch:2}, {widget: domNode})).not.toBe(null);
  });

  it('setCursor should work as-is for text, or activate the containing block', async function () {
    this.cmb.setBlockMode(true);
    await wait(DELAY);
    this.cmb.setCursor({line:1,ch:1});
    expect(simpleCursor(this.cmb.getCursor())).toEqual({line:1,ch:1});
    expect(this.currentFocusNId()).toBe(0);
    this.cmb.setCursor({line:0,ch:1});
    expect(this.currentFocusNId()).toBe(0);
    // activating the first block should return a cursor at its end
    expect(simpleCursor(this.cmb.getCursor())).toEqual({line:0,ch:7});
  });

  it('setSelection', async function () {
    this.cmb.setValue(`(+ 1 2)\n\n(- 3 4)`);
    // textmode API test
    this.cmb.setSelection({line: 0, ch: 0}, {line: 0, ch: 7});
    const selections = this.cmb.listSelections().map(s => {
      return {anchor: simpleCursor(s.anchor), head: simpleCursor(s.head)};
    });
    expect(selections).toEqual([
      {anchor: {line: 0, ch: 0}, head: {line: 0, ch: 7}}
    ]);
    this.cmb.setBlockMode(true);
    await wait(DELAY);
    // blockmode API test
    expect(() => this.cmb.setSelection(
      {anchor: {line: 0, ch: 0}, head: {line: 0, ch: 3}})
    ).toThrow();
    this.cmb.setSelection({line: 0, ch: 0});
    expect(this.cmb.listSelections().length).toBe(1);
    expect(this.cmb.listSelections().map(r => ({
      anchor: simpleCursor(r.anchor),
      head: simpleCursor(r.head)
    }))).toEqual([{
      anchor: {line: 0, ch: 0},
      head: {line: 0, ch: 0},
    }]);
  });

  it('setSelections', async function () {
    this.cmb.setValue(`(+ 1 2)\n\n(- 3 4)`);
    // textmode API test
    this.cmb.setSelections([{anchor: {line: 0, ch: 0}, head: {line: 0, ch: 7}}, 
      {anchor: {line: 2, ch: 0}, head: {line: 2, ch: 7}}]);
    const selections = this.cmb.listSelections().map(s => {
      return {anchor: simpleCursor(s.anchor), head: simpleCursor(s.head)};
    });
    expect(selections).toEqual([
      {anchor: {line: 0, ch: 0}, head: {line: 0, ch: 7}}, 
      {anchor: {line: 2, ch: 0}, head: {line: 2, ch: 7}}
    ]);
    this.cmb.setBlockMode(true);
    await wait(DELAY);
    // blockmode API test
    expect(() => this.cmb.setSelections([
      {anchor: {line: 0, ch: 0}, head: {line: 0, ch: 3}}, 
      {anchor: {line: 2, ch: 0}, head: {line: 2, ch: 7}}]))
      .toThrow();
    this.cmb.setSelections([{anchor: {line: 0, ch: 0}, head: {line: 0, ch: 7}}, 
      {anchor: {line: 2, ch: 0}, head: {line: 2, ch: 7}}]);
    expect(this.cmb.listSelections().map(s=>Object.assign({},s))).toEqual([
      {anchor: {line: 0, ch: 0}, head: {line: 0, ch: 7}}, 
      {anchor: {line: 2, ch: 0}, head: {line: 2, ch: 7}}
    ]);
  });

  it('somethingSelected should work for selected blocks and text ranges', async function () {
    this.cmb.setBlockMode(true);
    await wait(DELAY);
    const firstRoot = this.currentFirstRoot();
    expect(this.cmb.somethingSelected()).toBe(false);
    mouseDown(firstRoot);
    await wait(DELAY);
    expect(this.cmb.getSelectedNodes().length).toBe(0);
    keyDown(" ", {}, firstRoot);
    await wait(DELAY);
    expect(this.cmb.getSelectedNodes().length).toBe(4);
    expect(this.cmb.somethingSelected()).toBe(true);
    this.cmb.setSelection({line:0,ch:0}, {line:0,ch:0});
    await wait(DELAY);
    expect(this.cmb.getSelectedNodes().length).toBe(0);
    expect(this.cmb.somethingSelected()).toBe(false);
    this.cmb.addSelection({line:0,ch:0},{line:0,ch:7});
    expect(this.cmb.somethingSelected()).toBe(true);
    this.cmb.setSelection({line:0,ch:0}, {line:0,ch:0});
    await wait(DELAY);
    expect(this.cmb.getSelectedNodes().length).toBe(0);
    expect(this.cmb.somethingSelected()).toBe(false);
    this.cmb.addSelection({line:0,ch:0},{line:1,ch:1});
    expect(this.cmb.somethingSelected()).toBe(true);
  });

});
