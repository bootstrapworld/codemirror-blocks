/** @jest-environment jsdom */
// @ts-nocheck
// PORTED from packages/codemirror-blocks/spec/entry-point-test.ts: only the imports changed (to ../compat/*); see doc/experiments/cm6-direct-tree.md, ninth round.
// REPLACEMENT: class N: the entry point and its API object are not built; block mode on/off is tested by spec/cm6-api.test.ts and spec/counterparts.test.ts
/**
 * `CodeMirrorBlocks(container, options, language)`, the entry point of the
 * editor: the language is a language, or the id of one that has been added.
 */
import { act } from "../compat/testing-library";
import CodeMirror from "../compat/codemirror";
import CodeMirrorBlocks, { Languages } from "../compat/internals";
import { blockModeOnlyMethods, buildAPI } from "../compat/internals";
import * as actions from "../compat/actions";
import { createAppStore } from "../compat/internals";

const container = () => {
  const div = document.createElement("div");
  document.body.appendChild(div);
  return div;
};

describe("CodeMirrorBlocks()", () => {
  // SKIPPED (D): by decision (user, 2026-11-23): the CM5 API is not supported; the CM6 equivalent is `createLezerBlockEditor({parent, doc, parser, table})`: a language is its parser and table, there is no registry by id (test: CodeMirror 6's own configuration: parent and doc replace the host and the text, spec/cm6-api.test.ts)
  // first error (sweep): Error: not in the compat layer: CodeMirrorBlocks (the entry point and its constructor options)
  it.skip("opens an editor for a language said by its id", () => {
    let editor: ReturnType<typeof CodeMirrorBlocks>;
    act(() => {
      editor = CodeMirrorBlocks(container(), { value: "(+ 1 2)" }, "example");
    });
    expect(editor!.getValue()).toBe("(+ 1 2)");
  });

  // SKIPPED (D): by decision (user, 2026-11-23): the CM5 API is not supported; the CM6 equivalent is `createLezerBlockEditor({parent, doc, parser, table})`: a language is its parser and table, there is no registry by id (test: CodeMirror 6's own configuration: parent and doc replace the host and the text, spec/cm6-api.test.ts)

  // first error (sweep): Error: expect(received).toThrow(expected)
  it.skip("says which languages there are when the id is not one of them", () => {
    expect(() => CodeMirrorBlocks(container(), {}, "no-such-language")).toThrow(
      /There is no language "no-such-language".*example/
    );
  });

  // SKIPPED (D): by decision (user, 2026-11-23): the CM5 API is not supported; the CM6 equivalent is `createLezerBlockEditor({parent, doc, parser, table})`: a language is its parser and table, there is no registry by id (test: CodeMirror 6's own configuration: parent and doc replace the host and the text, spec/cm6-api.test.ts)

  // first error (sweep): Error: Hooks cannot be defined inside tests. Hook of type "afterEach" is nested within "says that none have been added, when none have".
  it.skip("says that none have been added, when none have", () => {
    jest.isolateModules(() => {
      const fresh = require("../compat/test-utils").default;
      expect(() => fresh(container(), {}, "example")).toThrow(
        /none have been added/
      );
    });
  });

  // SKIPPED (D): by decision (user, 2026-11-23): the CM5 API is not supported; the CM6 equivalent is a new `createLezerBlockEditor({parent, ...})` per editor: there is no per-container singleton (test: CodeMirror 6's own configuration: parent and doc replace the host and the text, spec/cm6-api.test.ts)

  // first error (sweep): Error: not in the compat layer: CodeMirrorBlocks (the entry point and its constructor options)
  it.skip("returns the editor that a container has when it is called again, and does not make a second", () => {
    const div = container();
    let first!: ReturnType<typeof CodeMirrorBlocks>;
    let second!: ReturnType<typeof CodeMirrorBlocks>;
    act(() => {
      first = CodeMirrorBlocks(div, { value: "1" }, "example");
    });
    act(() => {
      second = CodeMirrorBlocks(div, { value: "2" }, "example");
    });
    expect(second).toBe(first);
    expect(second.getValue()).toBe("1");
    expect(div.querySelectorAll(".CodeMirror").length).toBe(1);
    act(() => second.setValue("3"));
    expect(first.getValue()).toBe("3");
  });
});

describe("the API that CodeMirrorBlocks() returns", () => {
  const open = (value = "(+ 1 2)") => {
    let editor!: ReturnType<typeof CodeMirrorBlocks>;
    act(() => {
      editor = CodeMirrorBlocks(container(), { value }, "example");
    });
    return editor;
  };

  // SKIPPED (D): by decision (user, 2026-11-23): the CM5 API is not supported; the CM6 equivalent is `ed` is an EditorView with every method, in both modes (test: the editor object is the same object in both modes, with every method, spec/cm6-api.test.ts)

  // first error (sweep): Error: not in the compat layer: CodeMirrorBlocks (the entry point and its constructor options)
  it.skip("has every method in text mode, and is in text mode at first", () => {
    const editor = open();
    expect(editor.getBlockMode()).toBe(false);
    for (const name of blockModeOnlyMethods) {
      expect(typeof editor[name]).toBe("function");
    }
    expect(typeof editor.getValue).toBe("function");
  });

  // SKIPPED (D): by decision (user, 2026-11-23): the CM5 API is not supported; the CM6 equivalent is `ed.roots()` and the other block-only methods throw in text mode (test: block-only methods in text mode (entry-point tests; by decision: they throw), spec/cm6-api.test.ts)
  // first error (sweep): Error: not in the compat layer: CodeMirrorBlocks (the entry point and its constructor options)
  it.skip.each(["x"])(
    "%s() throws an Error that says it needs block mode, in text mode",
    (name) => {
      const editor = open();
      expect(() => (editor[name] as () => unknown)()).toThrow(
        new Error(`${name}() is only available in block mode`)
      );
    }
  );

  // SKIPPED (D): by decision (user, 2026-11-23): the CM5 API is not supported; the CM6 equivalent is every public member of `EditorView` is on `ed` (test: every public member of EditorView is on the editor, and is the view's, spec/cm6-api.test.ts)

  // first error (sweep): TypeError: Cannot read properties of undefined (reading 'example')
  it.skip("has a method for each one that block mode has", () => {
    const language = Languages.LANGUAGES["example"];
    const store = createAppStore("(+ 1 2)");
    store.dispatch(actions.setBlockMode(true, "(+ 1 2)", language));
    const built = buildAPI(
      CodeMirror(document.createElement("div"), { value: "(+ 1 2)" }),
      store,
      language
    );
    const editor = open();
    for (const name of Object.keys(built)) {
      expect(typeof (editor as Record<string, unknown>)[name]).toBe("function");
    }
  });

  // SKIPPED (D): by decision (user, 2026-11-23): the CM5 API is not supported; the CM6 equivalent is one `ed` object in both modes (test: the editor object is the same object in both modes, with every method, spec/cm6-api.test.ts)

  // first error (sweep): Error: not in the compat layer: CodeMirrorBlocks (the entry point and its constructor options)
  it.skip("is the same object in block mode and back, and answers for the mode that shows", () => {
    const editor = open();
    const methods = Object.keys(editor);
    act(() => editor.setBlockMode(true));
    expect(editor.getBlockMode()).toBe(true);
    expect(editor.getAst().rootNodes).toHaveLength(1);
    expect(() => editor.getFocusedNode()).not.toThrow();
    expect(editor.getSelectedNodes()).toEqual([]);
    expect(Object.keys(editor)).toEqual(methods);

    act(() => editor.setBlockMode(false));
    expect(editor.getBlockMode()).toBe(false);
    expect(() => editor.getAst()).toThrow(
      "getAst() is only available in block mode"
    );
    expect(editor.getValue()).toBe("(+ 1 2)");
    expect(Object.keys(editor)).toEqual(methods);

    act(() => editor.setBlockMode(true));
    expect(editor.getAst().rootNodes).toHaveLength(1);
  });

  // SKIPPED (D): by decision (user, 2026-11-23): the CM5 API is not supported; the CM6 equivalent is block-only methods throw in text mode, the rest keep working (test: block-only methods in text mode (entry-point tests; by decision: they throw), spec/cm6-api.test.ts)

  // first error (sweep): Error: not in the compat layer: CodeMirrorBlocks (the entry point and its constructor options)
  it.skip("keeps the methods that block mode restricts restricted, and those that text mode does, in the mode that shows", () => {
    const editor = open();
    // (not supported in the block editor)
    act(() => editor.setBlockMode(true));
    expect(() => editor.setOption("readOnly", true)).toThrow(/not supported/);
    act(() => editor.setBlockMode(false));
    expect(() => editor.operation(() => 1)).toThrow(/not supported/);
  });
});
