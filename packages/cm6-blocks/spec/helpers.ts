// shared by the jsdom specs of the Lezer editor
import { createLezerBlockEditor, LezerBlockEditor, LezerOptions } from "../src/lezer-view";
import { schemeParser, schemeTable } from "../src/lang-scheme";
import { javascriptParser, javascriptTable } from "../src/lang-javascript";
import { pythonParser, pythonTable } from "../src/lang-python";

const zeroRect = { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}) };
if (!Range.prototype.getClientRects) Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
if (!Range.prototype.getBoundingClientRect) Range.prototype.getBoundingClientRect = () => zeroRect as DOMRect;

export const OPTS: Record<string, LezerOptions> = {
  scheme: { parser: schemeParser as never, table: schemeTable },
  javascript: { parser: javascriptParser as never, table: javascriptTable },
  python: { parser: pythonParser as never, table: pythonTable },
};
export const TEXT: Record<string, string> = {
  scheme: "(f 1 (g 2) 3)\n(h 4)\n(k 5)",
  javascript: "f(1, g(2), 3);\nh(4);\nk(5);",
  python: "f(1, g(2), 3)\nh(4)\nk(5)",
};
const made: LezerBlockEditor[] = [];
export function make(l: string, text?: string): LezerBlockEditor {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const ed = createLezerBlockEditor(parent, text ?? TEXT[l], OPTS[l]);
  made.push(ed);
  return ed;
}
afterEach(() => {
  while (made.length) {
    const ed = made.pop() as LezerBlockEditor;
    const parent = ed.view.dom.parentElement;
    ed.destroy();
    parent?.remove();
  }
});
