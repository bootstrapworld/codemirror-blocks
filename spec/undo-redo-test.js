import wescheme from '../src/languages/wescheme';
import 'codemirror/addon/search/searchcursor.js';
import * as testUtils from './support/test-utils';
Object.assign(window, testUtils);

// be sure to call with `apply` or `call`
let setup = function () { activationSetup.call(this, wescheme); };

describe("when testing undo/redo,", function () {
  beforeEach(async function () {
    setup.call(this);
    this.currentFirstRoot = () => this.cmb.getAst().rootNodes[0];
    this.undo = (node) => keyDown("Z", cmd_ctrl, node);
    this.redo = (node) => {
        if(mac) {
          keyDown("Z", { metaKey: true, shiftKey: true }, node);
        } else {
          keyDown("Y", { ctrlKey: true }, node);
        }
    }
    await wait(DELAY);
  });

  afterEach(function () { teardown(); });

  // https://github.com/bootstrapworld/codemirror-blocks/issues/315
  it('make sure edits can be properly undone/redone from an active block', async function () {

    this.cmb.setValue(`A\nB\n`);
    this.cmb.clearHistory();
    await wait(DELAY);
    expect(this.cmb.historySize()).toEqual({undo: 0, redo: 0});
    mouseDown(this.currentFirstRoot());                          // focus on the 1st root
    keyDown(" ", {}, this.currentFirstRoot());
    await wait(DELAY);
    keyDown("X", cmd_ctrl, this.currentFirstRoot());      // change (1): cut first root
    await wait(DELAY);
    expect(this.cmb.getValue()).toEqual('\nB\n');
    expect(this.cmb.historySize()).toEqual({undo: 1, redo: 0});
    this.cmb.setCursor({line: 2, ch: 0});
    keyDown("Enter");                                            // change (2): insert empty line
    await wait(DELAY);
    expect(this.cmb.getValue()).toEqual('\nB\n\n');
    expect(this.cmb.historySize()).toEqual({undo: 2, redo: 0});
    insertText("C");                                             // change (3): insert C at the end
    await wait(DELAY);
    expect(this.cmb.getValue()).toEqual('\nB\n\nC');
    expect(this.cmb.historySize()).toEqual({undo: 3, redo: 0});
    this.undo(this.currentFirstRoot());                          // undo (3), leaving \nB\n\n
    await wait(DELAY);
    expect(this.cmb.getValue()).toEqual('\nB\n\n');
    expect(this.cmb.historySize()).toEqual({undo: 2, redo: 1});
    this.undo(this.currentFirstRoot());                          // undo (2), leaving \nB\n\n
    await wait(DELAY);
    expect(this.cmb.getValue()).toEqual('\nB\n');
    expect(this.cmb.historySize()).toEqual({undo: 1, redo: 2});
    this.undo(this.currentFirstRoot());                          // undo (1), leaving A\nB\n
    await wait(DELAY);
    expect(this.cmb.getValue()).toEqual('A\nB\n');    
    expect(this.cmb.historySize()).toEqual({undo: 0, redo: 3});
    this.redo(this.currentFirstRoot());                          // redo (1), leaving \nB\n
    await wait(DELAY);
    expect(this.cmb.getValue()).toEqual('\nB\n');
    expect(this.cmb.historySize()).toEqual({undo: 1, redo: 2});
    this.redo(this.currentFirstRoot());                          // redo (2), leaving \nB\n\n
    await wait(DELAY);
    expect(this.cmb.getValue()).toEqual('\nB\n\n');
    expect(this.cmb.historySize()).toEqual({undo: 2, redo: 1});
    this.redo(this.currentFirstRoot());                          // redo (3), leaving \nB\n\nC
    await wait(DELAY);
    expect(this.cmb.getValue()).toEqual('\nB\n\nC');
    expect(this.cmb.historySize()).toEqual({undo: 3, redo: 0});
  });

  it('make sure edits can be properly undone/redone from the top level', async function () {

    this.cmb.setValue(`A\nB\n`);
    this.cmb.clearHistory();
    await wait(DELAY);
    expect(this.cmb.historySize()).toEqual({undo: 0, redo: 0});

    mouseDown(this.currentFirstRoot());                          // focus on the 1st root
    keyDown(" ", {}, this.currentFirstRoot());
    await wait(DELAY);
    keyDown("X", cmd_ctrl, this.currentFirstRoot());      // change (1): cut first root
    await wait(DELAY);
    expect(this.cmb.getValue()).toEqual('\nB\n');
    expect(this.cmb.historySize()).toEqual({undo: 1, redo: 0});
    this.cmb.setCursor({line: 1, ch: 0});
    this.undo(); // initiate undo from the top-level
    await wait(DELAY);
    expect(this.cmb.getValue()).toEqual('A\nB\n');
    expect(this.cmb.historySize()).toEqual({undo: 0, redo: 1});
    this.redo(); // initiate redo from the top-level
    expect(this.cmb.getValue()).toEqual('\nB\n');
    expect(this.cmb.historySize()).toEqual({undo: 1, redo: 0});
  });
});