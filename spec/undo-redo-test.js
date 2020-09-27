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
    this.retrieve = () => this.firstRoot = this.cmb.getAst().rootNodes[0];
    this.retrieve();
    mouseDown(this.firstRoot);
    keyDown(" ", {}, this.firstRoot);
    await wait(DELAY*2);
    keyDown("X", { ctrlKey: true }, this.firstRoot);  // 1) cut the first root
    await wait(DELAY*2);
    console.log('@@After change 1, code is: ', JSON.stringify(this.cmb.getValue()));
    console.log('@changeGeneration # ',this.cmb.changeGeneration(true));
    expect(this.cmb.getValue()).toEqual('\nB\n');
    this.cmb.setCursor({line: 2, ch: 0});
    keyDown("Enter");                                 // 2) insert another empty line
    await wait(DELAY*5);
    console.log('@@After change 2, code is: ', JSON.stringify(this.cmb.getValue()));
    console.log('@changeGeneration # ',this.cmb.changeGeneration(true));
    expect(this.cmb.getValue()).toEqual('\nB\n\n');
    insertText("C");                                  // 3) insert C at the end
    await wait(DELAY*2);
    console.log('@@After change 3, code is: ', JSON.stringify(this.cmb.getValue()));
    console.log('@changeGeneration # ',this.cmb.changeGeneration(true));
    expect(this.cmb.getValue()).toEqual('\nB\n\nC');
    this.retrieve()
    keyDown("Z", { ctrlKey: true });                  // undo (3), leaving \nB\n\n
    await wait(DELAY*2);
    console.log('@@After undoing change 3, code is: ', JSON.stringify(this.cmb.getValue()));
    console.log('@changeGeneration # ',this.cmb.changeGeneration(true));
    expect(this.cmb.getValue()).toEqual('\nB\n\n');
    keyDown("Z", { ctrlKey: true });                  // undo (2), leaving \nB\n
    await wait(DELAY*2);
    console.log('@@After undoing change 2, code is: ', JSON.stringify(this.cmb.getValue()));
    console.log('@changeGeneration # ',this.cmb.changeGeneration(true));
    expect(this.cmb.getValue()).toEqual('\nB\n');
    keyDown("Z", { ctrlKey: true });                  // undo (1), leaving A\nB\n
    await wait(DELAY*2);
    console.log('@@After undoing change 1, code is: ', JSON.stringify(this.cmb.getValue()));
    console.log('@changeGeneration # ',this.cmb.changeGeneration(true));
    expect(this.cmb.getValue()).toEqual('A\nB\n');    
    keyDown("Y", { ctrlKey: true });                  // redo (1), leaving \nB\n
    await wait(DELAY*2);
    expect(this.cmb.getValue()).toEqual('\nB\n');
    keyDown("Y", { ctrlKey: true });                  // redo (2), leaving \nB\n\n
    await wait(DELAY*2);
    expect(this.cmb.getValue()).toEqual('\nB\n\n');
    keyDown("Y", { ctrlKey: true });                  // redo (3), leaving \nB\n\nC
    await wait(DELAY*2);
    expect(this.cmb.getValue()).toEqual('\nB\n\nC');  
  });
});