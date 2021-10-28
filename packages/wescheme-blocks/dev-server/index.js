import "./index.less";
import CodeMirrorBlocks from "codemirror-blocks";
import { WeScheme } from "../src/languages/wescheme";
import bigExampleCode from "./ast-test.rkt";

const smallExampleCode = `(+ 1 2) ;comment\n(+ 3 4)`;

const useBigCode = true;
const exampleCode = useBigCode ? bigExampleCode : smallExampleCode;

const container = document.createElement("div");
document.body.appendChild(container);
container.id = "app";

const editor = CodeMirrorBlocks(
  container,
  {
    collapseAll: false,
    value: exampleCode,
  },
  WeScheme
);

// for debugging purposes
window.editor = editor;
window.cmb = editor;
