// stands for `import CodeMirror from "codemirror"` in a ported test: what the old tests use of it, as plain values (no CodeMirror 5 here)
const CodeMirror = {
  Pos: (line: number, ch = 0) => ({ line, ch }),
  version: "compat",
};
export default CodeMirror;
export type MarkerRange = {
  from: { line: number; ch: number };
  to: { line: number; ch: number };
};
export type TextMarker = unknown;
