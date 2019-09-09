import pyret from '../src/languages/pyret';
import CodeMirrorBlocks from '../src/CodeMirrorBlocks';
import './example-page.less';
import dsExampleCode from './bootstrap-ds.arr';
//import bigExampleCode from './ast-test.rkt';

/// DEBUGGING STUFF
import { wait, teardown } from '../spec/support/test-utils';
import {
  click,
  keyDown,
  _keyPress,
  _insertText,
} from '../spec/support/simulate';

const DELAY = 250;



//const smallExampleCode = `(+ 1 2) ;comment\n(+ 3 4)`;
const smallExampleCode = `load-spreadsheet("14er5Mh443Lb5SIFxXZHdAnLCuQZaA8O6qtgGlibQuEg")`;

const useBigCode = false;
//const exampleCode = useBigCode ? bigExampleCode : smallExampleCode;
const exampleCode = useBigCode? dsExampleCode : smallExampleCode;

// grab the DOM Node to host the editor, and use it to instantiate
const container = document.getElementById('cmb-editor');
const editor = new CodeMirrorBlocks(container, {value: exampleCode, collapseAll: false}, pyret);
editor.setBlockMode(true);

// for debugging purposes
window.editor = editor
console.log(editor);

document.getElementById('testButton').onclick = runTestEvent;

async function runTestEvent(){
	let ast = editor.getAst();
    this.literal1 = ast.rootNodes[0];
	console.log('before anything, activeElement is', document.activeElement);
	click(this.literal1);
    await wait(DELAY);
    console.log('after clicking, activeElement is', document.activeElement)
    keyDown("ArrowDown");
    await wait(DELAY);
    console.log('after ArrowDown, activeElement is', document.activeElement)
}