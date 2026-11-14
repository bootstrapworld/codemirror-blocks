import "@bootstrapworld/codemirror-blocks/css/codemirror-blocks.css";
import "@bootstrapworld/wescheme/css/wescheme.css";
import "@bootstrapworld/codemirror-blocks/css/example-page.css";
import "./index.less";
import CodeMirrorBlocks from "@bootstrapworld/codemirror-blocks";
import WeScheme from "@bootstrapworld/wescheme";
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
