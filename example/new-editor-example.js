import React from 'react';
import wescheme from '../src/languages/wescheme';
import {ToggleEditor, CodeMirrorBlocks} from '../src/ui/ToggleEditor';
import './example-page.less';
import bigExampleCode from './ast-test.rkt';


const smallExampleCode = `(+ 1 2) ;comment\n(+ 3 4)`;

const useBigCode = true;
const exampleCode = useBigCode ? bigExampleCode : smallExampleCode;

// grab the DOM Node to host the editor, and use it to instantiate
const container = document.getElementById('cmb-editor');
const editor = new CodeMirrorBlocks(container, wescheme, exampleCode);

// for debugging purposes
window.editor = editor
console.log(editor);