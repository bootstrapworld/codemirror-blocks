/* eslint-disable @typescript-eslint/no-unused-vars */
import wescheme from "../lib/languages/wescheme";
import routine from "../lib/languages/routine";
import bigExampleCode from "./ast-test.rkt";
import hugeExampleCode from "./huge-code.rkt";
const smallExampleCode = `(collapse me)\n(+ 1 2)`;
import { createDebuggingInterface } from "../lib/toolkit/debug";

// HACK: expose ALL test utilities, events, etc
// so they can be used from the browser console
import * as t from "../lib/toolkit/test-utils";
Object.assign(window, t);

//const exampleCode = smallExampleCode;
const exampleCode = bigExampleCode;
//const exampleCode = hugeExampleCode;

// ?lang=routine shows Routine, a small language that tries the editor's API
const routineCode = `; Start the day
(let minutes 10)
(let spare)
(show "Good morning")

#| steps that repeat |#
(repeat 3
  ; the longer the later
  (show (+ minutes 1))
  (let minutes (+ minutes 5))
  (if (> minutes 20)
    (show "late")))

(if (< minutes 30)
  (show "on time")
  (show "late"))
`;
const useRoutine =
  new URLSearchParams(window.location.search).get("lang") === "routine";
const editor = useRoutine
  ? createDebuggingInterface(routine, routineCode)
  : createDebuggingInterface(wescheme, bigExampleCode);

// for debugging purposes
window.editor = editor;
window.cmb = editor;
