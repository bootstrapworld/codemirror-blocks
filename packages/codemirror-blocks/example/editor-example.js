/* eslint-disable @typescript-eslint/no-unused-vars */
// The stylesheets are plain CSS, made by `npm run build` (see scripts/build-css.js)
import "codemirror/lib/codemirror.css";
import "../lib/css/codemirror-blocks.css";
import "../lib/css/languages/wescheme.css";
import "../lib/css/languages/routine.css";
import "../lib/css/languages/lambda.css";
import "../lib/css/languages/example.css";
import "../lib/css/debug-page.css";
import wescheme from "../lib/languages/wescheme";
import routine from "../lib/languages/routine";
import lambda from "../lib/languages/lambda";
import exampleLanguage from "../lib/languages/example";
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

// ?lang=lambda shows lambda, and ?lang=example the example language
const lambdaCode = `# Some functions
double = lambda (x) x * 2;
area = lambda (w, h) w * h;

# a conditional, and a call
answer = if double(21) > 40 then area(6, 7) else 0;
let loop (i = 0) if i < 3 then loop(i + 1) else i
`;
const exampleLanguageCode = `; numbers and calls
(+ 1 2)
(* (+ 3 4) (- 10 5))
`;

const languages = {
  wescheme: { language: wescheme, code: bigExampleCode, looks: ["classic"] },
  routine: {
    language: routine,
    code: routineCode,
    looks: ["classic", "storyboard"],
  },
  lambda: { language: lambda, code: lambdaCode, looks: ["classic", "maths"] },
  example: {
    language: exampleLanguage,
    code: exampleLanguageCode,
    looks: ["classic"],
  },
};
const params = new URLSearchParams(window.location.search);
const chosen = languages[params.get("lang")] ?? languages.wescheme;
const editor = createDebuggingInterface(chosen.language, chosen.code);

// ?look=<name> draws the language another way: the page has the class
// `look-<name>`, and a language's alternate style is under it (see the
// `look-` rules in the language's style.less). Routine and lambda have one.
const LOOKS = ["classic", "storyboard", "maths"];
const setLook = (look) => {
  for (const l of LOOKS)
    document.body.classList.toggle(`look-${l}`, l === look);
};
// (only the looks the language has: `?look=` for another is the classic one)
const look = chosen.looks.includes(params.get("look"))
  ? params.get("look")
  : "classic";
const picker = document.createElement("label");
picker.className = "look-picker";
picker.innerHTML = `Look <select id="look">${chosen.looks
  .map(
    (l) => `<option value="${l}"${l === look ? " selected" : ""}>${l}</option>`
  )
  .join("")}</select>`;
if (chosen.looks.length > 1) {
  document.querySelector(".page-header")?.appendChild(picker);
}
picker.querySelector("select").addEventListener("change", (e) => {
  setLook(e.target.value);
  const url = new URL(window.location.href);
  url.searchParams.set("look", e.target.value);
  window.history.replaceState(null, "", url);
});
setLook(look);

// for debugging purposes
window.editor = editor;
window.cmb = editor;
