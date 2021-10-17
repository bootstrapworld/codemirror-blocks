import {createDebuggingInterface} from "codemirror-blocks/lib/toolkit/debug";

import {WeScheme} from '../src/languages/wescheme';
import bigExampleCode from './ast-test.rkt';

// HACK: expose ALL test utilities, events, etc
// so they can be used from the browser console
import * as t from 'codemirror-blocks/lib/toolkit/test-utils';
Object.assign(window, t);

const smallExampleCode = `(+ 1 2) ;comment\n(+ 3 4)`;

const useBigCode = true;
const exampleCode = useBigCode ? bigExampleCode : smallExampleCode;

const editor = createDebuggingInterface(WeScheme, exampleCode);

// for debugging purposes
window.editor = editor;
window.cmb = editor;