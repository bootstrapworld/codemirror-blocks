/** @jest-environment jsdom */
/*
 * Escapes of the parse-level fuzzer (npm run fuzz:parse, seed 1 and 2): JavaScript, no error node, ONE statement (an unclosed `({...` or
 * `s={...`) that runs to the end of the document and holds a ~10k-char block comment. An edit near the start makes Lezer's incremental tree
 * place nested comments differently from a fresh parse, before the edit; the top level is a single node, so a top-level comparison cannot see it.
 * The documents are fixtures (spec/fixtures/escaped-js-incremental.json: name, before, edit; the edited text is derived).
 */
import { TreeFragment } from "@lezer/common";
import { checkLezerEditor, createLezerBlockEditor } from "../src/lezer-view";
import { javascriptParser } from "../src/lang-javascript";
import { LANGS, shape } from "./steps";
import fixtures from "./fixtures/escaped-js-incremental.json";

const host = (): HTMLElement =>
  document.body.appendChild(document.createElement("div"));
const opts = { ...LANGS.javascript.opts, freshParseBelow: 0 };

describe.each(fixtures)("fuzz escape $name", ({ before, edit }) => {
  const after =
    before.slice(0, edit.from) + edit.insert + before.slice(edit.to);
  it("plain Lezer reads the edited text differently from a fresh parse (Lezer's fault)", () => {
    const incremental = javascriptParser.parse(
      after,
      TreeFragment.applyChanges(
        TreeFragment.addTree(javascriptParser.parse(before)),
        [
          {
            fromA: edit.from,
            toA: edit.to,
            fromB: edit.from,
            toB: edit.from + edit.insert.length,
          },
        ]
      )
    );
    expect(incremental.toString()).not.toBe(
      javascriptParser.parse(after).toString()
    );
  });

  it("the editor given the edit has the blocks of a fresh editor", () => {
    const ed = createLezerBlockEditor(host(), before, opts);
    ed.view.dispatch({ changes: edit });
    expect(ed.view.state.doc.toString()).toBe(after);
    expect(checkLezerEditor(ed)).toEqual([]);
    const ref = createLezerBlockEditor(host(), after, opts);
    expect(ed.roots().length).toBe(ref.roots().length);
    expect(ed.roots().map((r) => shape(r, new Set()))).toEqual(
      ref.roots().map((r) => shape(r, new Set()))
    );
  });
});
