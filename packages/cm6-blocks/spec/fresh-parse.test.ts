/** @jest-environment jsdom */
import { createLezerBlockEditor } from "../src/lezer-view";
import { LANGS } from "./steps";

const host = (): HTMLElement =>
  document.body.appendChild(document.createElement("div"));

// a document shorter than `freshParseBelow` is read from nothing after an edit; a longer one incrementally
it("a small document is parsed fresh after an edit, a large one incrementally", () => {
  const small = "x = 1\ny = 2\n";
  const ed = createLezerBlockEditor(host(), small, { ...LANGS.python.opts });
  ed.view.dispatch({ changes: { from: 0, insert: "z = 3\n" } });
  expect(ed.stats().freshParses).toBe(1);
  const ref = createLezerBlockEditor(host(), "z = 3\n" + small, {
    ...LANGS.python.opts,
  });
  expect(ed.roots().length).toBe(ref.roots().length);

  const big = "x = 1\n".repeat(2000); // (12000 characters)
  const ed2 = createLezerBlockEditor(host(), big, { ...LANGS.python.opts });
  ed2.view.dispatch({ changes: { from: 0, insert: "z = 3\n" } });
  expect(ed2.stats().freshParses).toBe(0);

  // (the option: 0 is always incremental, a larger limit makes the large document fresh)
  const off = createLezerBlockEditor(host(), small, {
    ...LANGS.python.opts,
    freshParseBelow: 0,
  });
  off.view.dispatch({ changes: { from: 0, insert: "z = 3\n" } });
  expect(off.stats().freshParses).toBe(0);
  const wide = createLezerBlockEditor(host(), big, {
    ...LANGS.python.opts,
    freshParseBelow: 100_000,
  });
  wide.view.dispatch({ changes: { from: 0, insert: "z = 3\n" } });
  expect(wide.stats().freshParses).toBe(1);
});
