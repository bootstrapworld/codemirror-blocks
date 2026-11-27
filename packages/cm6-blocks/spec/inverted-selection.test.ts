/** @jest-environment jsdom */
// Soak seed 3514237 (WebKit): a block edit that replaces the text under a non-empty selection used to leave the selection INVERTED
// (CodeMirror maps `from` with assoc 1 and `to` with assoc -1: after the new text and before it), and the next paste (changeByRange)
// threw "Invalid change range". The selection is now a cursor where the replaced text begins.
import { make } from "./helpers";

describe.each([
  ["scheme", "(f 1 (g 2) 3)\n(h 4)", "(g 2)"],
  ["javascript", "f(1, g(2), 3);\nh(4);", "g(2)"],
  ["python", "f(1, g(2), 3)\nh(4)", "g(2)"],
])("a replaced selection stays ordered: %s", (l, src, call) => {
  test("replacing a block that holds the selection leaves a cursor, and a paste at it works", () => {
    const ed = make(l, src);
    const v = ed.view;
    const at = src.indexOf(call);
    const two = src.indexOf("2");
    v.dispatch({ selection: { anchor: two + 1, head: two } });
    v.dispatch({
      changes: { from: at, to: at + call.length, insert: "wwwwwwwwwwwwwww" },
    });
    for (const r of v.state.selection.ranges)
      expect(r.from).toBeLessThanOrEqual(r.to);
    expect(() =>
      v.dispatch(
        v.state.changeByRange((r) => ({
          changes: { from: r.from, to: r.to, insert: "x" },
          range: r,
        }))
      )
    ).not.toThrow();
  });
});
