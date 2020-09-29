import wescheme from '../src/languages/wescheme';
import 'codemirror/addon/search/searchcursor.js';
import { wait, teardown, activationSetup } from './support/test-utils';
import { mouseDown, keyDown, insertText } from './support/simulate';
import {
  dragstart,
  drop,
  dragenter,
  dragleave,
  dragend,
  dragenterSeq,
} from './support/simulate';

const DELAY = 250;

// be sure to call with `apply` or `call`
let setup = function () { activationSetup.call(this, wescheme); };

describe("when testing undo/redo,", function () {
  beforeEach(async function () {
    setup.call(this);
    await wait(DELAY);
  });

  afterEach(function () { teardown(); });

  // https://github.com/bootstrapworld/codemirror-blocks/issues/315
  it('make sure block and non-block edits can be properly undone', async function () {
    const currentFirstRoot = () => this.cmb.getAst().rootNodes[0];

    this.cmb.setValue(`A\nB\n`);
    this.cmb.clearHistory();
    await wait(DELAY);
    expect(this.cmb.historySize()).toEqual({undo: 0, redo: 0});
    mouseDown(currentFirstRoot());                          // focus on the 1st root
    keyDown(" ", {}, currentFirstRoot());
    await wait(DELAY);
    keyDown("X", { ctrlKey: true }, currentFirstRoot());    // change (1): cut first root
    await wait(DELAY);
    expect(this.cmb.getValue()).toEqual('\nB\n');
    expect(this.cmb.historySize()).toEqual({undo: 1, redo: 0});
    this.cmb.setCursor({line: 2, ch: 0});
    keyDown("Enter");                                       // change (2): insert empty line
    await wait(DELAY);
    expect(this.cmb.getValue()).toEqual('\nB\n\n');
    expect(this.cmb.historySize()).toEqual({undo: 2, redo: 0});
    insertText("C");                                        // change (3): insert C at the end
    await wait(DELAY);
    expect(this.cmb.getValue()).toEqual('\nB\n\nC');
    expect(this.cmb.historySize()).toEqual({undo: 3, redo: 0});
    keyDown("Z", { ctrlKey: true }, currentFirstRoot());    // undo (3), leaving \nB\n\n
    await wait(DELAY);
    expect(this.cmb.getValue()).toEqual('\nB\n\n');
    expect(this.cmb.historySize()).toEqual({undo: 2, redo: 1});
    keyDown("Z", { ctrlKey: true });    // undo (2), leaving \nB\n\n
    await wait(DELAY);
    expect(this.cmb.getValue()).toEqual('\nB\n');
    expect(this.cmb.historySize()).toEqual({undo: 1, redo: 2});
    keyDown("Z", { ctrlKey: true }, currentFirstRoot());    // undo (1), leaving A\nB\n
    await wait(DELAY);
    expect(this.cmb.getValue()).toEqual('A\nB\n');    
    expect(this.cmb.historySize()).toEqual({undo: 0, redo: 3});
    keyDown("Y", { ctrlKey: true }, currentFirstRoot());    // redo (1), leaving \nB\n
    await wait(DELAY);
    expect(this.cmb.getValue()).toEqual('\nB\n');
    expect(this.cmb.historySize()).toEqual({undo: 1, redo: 2});
    keyDown("Y", { ctrlKey: true }, currentFirstRoot());    // redo (2), leaving \nB\n\n
    await wait(DELAY);
    expect(this.cmb.getValue()).toEqual('\nB\n\n');
    expect(this.cmb.historySize()).toEqual({undo: 2, redo: 1});
    keyDown("Y", { ctrlKey: true }, currentFirstRoot());    // redo (3), leaving \nB\n\nC
    await wait(DELAY);
    expect(this.cmb.getValue()).toEqual('\nB\n\nC');
    expect(this.cmb.historySize()).toEqual({undo: 3, redo: 0});
  });
});