/* eslint-disable @typescript-eslint/no-unused-vars */
// The stylesheets are plain CSS, made by `npm run build` (see scripts/build-css.js)
import "codemirror/lib/codemirror.css";
import "../lib/css/codemirror-blocks.css";
import "@bootstrapworld/wescheme/css/wescheme.css";
import "@bootstrapworld/routine/css/routine.css";
import "@bootstrapworld/lambda/css/lambda.css";
import "@bootstrapworld/example/css/example.css";
import "../lib/css/debug-page.css";
// (a language adds itself to the editor when it is imported)
import "@bootstrapworld/wescheme";
import "@bootstrapworld/routine";
import "@bootstrapworld/lambda";
import "@bootstrapworld/example";
import { getLanguages, getLanguage } from "../lib/languages";
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

// `?lang=<id>` shows any language that has been added (WeScheme if none is
// given), with its `exampleCode`. WeScheme's is a larger program of our own.
const programs = { wescheme: bigExampleCode };

// A language that has another look (see its style.less) lists them here
const looksOf = {
  routine: ["classic", "storyboard"],
  lambda: ["classic", "maths"],
};
const params = new URLSearchParams(window.location.search);
const id = params.get("lang") ?? "wescheme";
const language = getLanguage(id);
if (!language) {
  document.body.textContent = `There is no language "${id}": try ${getLanguages()
    .map((l) => `?lang=${l.id}`)
    .join(", ")}`;
  throw new Error(`no language ${id}`);
}
const chosen = {
  language,
  code: programs[id] ?? language.exampleCode ?? "",
  looks: looksOf[id] ?? ["classic"],
};
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
