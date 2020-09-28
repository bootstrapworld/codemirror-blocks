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
  });

  afterEach(function () { teardown(); });

  // https://github.com/bootstrapworld/codemirror-blocks/issues/315
  it('make sure block and non-block edits can be properly undone', async function () {
    this.cmb.setValue(`A\nB\n`);
    this.cmb.clearHistory();
    await wait(DELAY);
    this.retrieve = () => this.roots = this.cmb.getAst().rootNodes;
    this.retrieve();
    expect(this.cmb.historySize()).toEqual({undo: 0, redo: 0});
    mouseDown(this.roots[0]);
    keyDown(" ", {}, this.roots[0]);
    await wait(DELAY*2);
    keyDown("X", { ctrlKey: true }, this.roots[0]);  // 1) cut the first root
    await wait(DELAY*2);
    console.log('@@After change 1, code is: ', JSON.stringify(this.cmb.getValue()));
    console.log('@changeGeneration # ',this.cmb.changeGeneration(true));
    expect(this.cmb.getValue()).toEqual('\nB\n');
    expect(this.cmb.historySize()).toEqual({undo: 1, redo: 0});
    this.cmb.setCursor({line: 2, ch: 0});
    keyDown("Enter");                                 // 2) insert another empty line
    await wait(DELAY*2);
    console.log('@@After change 2, code is: ', JSON.stringify(this.cmb.getValue()));
    console.log('@changeGeneration # ',this.cmb.changeGeneration(true));
    expect(this.cmb.getValue()).toEqual('\nB\n\n');
    expect(this.cmb.historySize()).toEqual({undo: 2, redo: 0});
    insertText("C");                                  // 3) insert C at the end
    await wait(DELAY*2);
    console.log('@@After change 3, code is: ', JSON.stringify(this.cmb.getValue()));
    console.log('@changeGeneration # ',this.cmb.changeGeneration(true));
    expect(this.cmb.getValue()).toEqual('\nB\n\nC');
    expect(this.cmb.historySize()).toEqual({undo: 3, redo: 0});
    mouseDown(this.roots[1]);                         // focus on the 2nd root (C)
    this.retrieve()
    keyDown("Z", { ctrlKey: true }, this.roots[1]);   // undo (3), leaving \nB\n\n
    await wait(DELAY*2);
    console.log('@@After undoing change 3, code is: ', JSON.stringify(this.cmb.getValue()));
    console.log('@changeGeneration # ',this.cmb.changeGeneration(true));
    expect(this.cmb.getValue()).toEqual('\nB\n\n');
    expect(this.cmb.historySize()).toEqual({undo: 2, redo: 1});
    keyDown("Z", { ctrlKey: true });                  // undo (2), leaving \nB\n
    await wait(DELAY*2);
    console.log('@@After undoing change 2, code is: ', JSON.stringify(this.cmb.getValue()));
    console.log('@changeGeneration # ',this.cmb.changeGeneration(true));
    expect(this.cmb.getValue()).toEqual('\nB\n');
    expect(this.cmb.historySize()).toEqual({undo: 1, redo: 2});
    keyDown("Z", { ctrlKey: true });                  // undo (1), leaving A\nB\n
    await wait(DELAY*2);
    console.log('@@After undoing change 1, code is: ', JSON.stringify(this.cmb.getValue()));
    console.log('@changeGeneration # ',this.cmb.changeGeneration(true));
    expect(this.cmb.getValue()).toEqual('A\nB\n');    
    expect(this.cmb.historySize()).toEqual({undo: 0, redo: 3});
    keyDown("Y", { ctrlKey: true });                  // redo (1), leaving \nB\n
    await wait(DELAY*2);
    expect(this.cmb.getValue()).toEqual('\nB\n');
    expect(this.cmb.historySize()).toEqual({undo: 1, redo: 2});
    keyDown("Y", { ctrlKey: true });                  // redo (2), leaving \nB\n\n
    await wait(DELAY*2);
    expect(this.cmb.getValue()).toEqual('\nB\n\n');
    expect(this.cmb.historySize()).toEqual({undo: 2, redo: 1});
    keyDown("Y", { ctrlKey: true });                  // redo (3), leaving \nB\n\nC
    await wait(DELAY*2);
    expect(this.cmb.getValue()).toEqual('\nB\n\nC');
    expect(this.cmb.historySize()).toEqual({undo: 3, redo: 0});
  });
});