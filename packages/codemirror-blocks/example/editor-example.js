/* eslint-disable @typescript-eslint/no-unused-vars */
import wescheme from "../lib/languages/wescheme";
import bigExampleCode from "./ast-test.rkt"; // eslint-disable-line no-unused-vars
import hugeExampleCode from "./huge-code.rkt"; // eslint-disable-line no-unused-vars
const smallExampleCode = `(collapse me)\n(+ 1 2)`; // eslint-disable-line no-unused-vars
import { createDebuggingInterface } from "../lib/toolkit/debug";

// HACK: expose ALL test utilities, events, etc
// so they can be used from the browser console
import * as t from "../lib/toolkit/test-utils";
Object.assign(window, t);

//const exampleCode = smallExampleCode;
const exampleCode = bigExampleCode;
//const exampleCode = hugeExampleCode;

const editor = createDebuggingInterface(wescheme, bigExampleCode);

// for debugging purposes
window.editor = editor;
window.cmb = editor;
