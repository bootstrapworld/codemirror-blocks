import pyret from '../src/languages/pyret';
import {CodeMirrorBlocks} from '../src/CodeMirrorBlocks-pyret';
import './example-page.less';
//import bigExampleCode from './ast-test.rkt';


//const smallExampleCode = `(+ 1 2) ;comment\n(+ 3 4)`;
const smallExampleCode = `1 + 2`;

const useBigCode = true;
//const exampleCode = useBigCode ? bigExampleCode : smallExampleCode;
const exampleCode = smallExampleCode;

// grab the DOM Node to host the editor, and use it to instantiate
const container = document.getElementById('cmb-editor');
const editor = new CodeMirrorBlocks(container, pyret, exampleCode);

// for debugging purposes
window.editor = editor
console.log(editor);
