/**
 * `CodeMirrorBlocks(container, options, language)`, the entry point of the
 * editor: the language is a language, or the id of one that has been added.
 */
import { act } from "@testing-library/react";
import CodeMirror from "codemirror";
import CodeMirrorBlocks, { Languages } from "../src/CodeMirrorBlocks";
import { blockModeOnlyMethods, buildAPI } from "../src/CodeMirror-api";
import * as actions from "../src/state/actions";
import { createAppStore } from "../src/state/store";
import "@bootstrapworld/example";

const container = () => {
  const div = document.createElement("div");
  document.body.appendChild(div);
  return div;
};

describe("CodeMirrorBlocks()", () => {
  it("opens an editor for a language said by its id", () => {
    let editor: ReturnType<typeof CodeMirrorBlocks>;
    act(() => {
      editor = CodeMirrorBlocks(container(), { value: "(+ 1 2)" }, "example");
    });
    expect(editor!.getValue()).toBe("(+ 1 2)");
  });

  it("says which languages there are when the id is not one of them", () => {
    expect(() => CodeMirrorBlocks(container(), {}, "no-such-language")).toThrow(
      /There is no language "no-such-language".*example/
    );
  });

  it("says that none have been added, when none have", () => {
    jest.isolateModules(() => {
      const fresh = require("../src/CodeMirrorBlocks").default;
      expect(() => fresh(container(), {}, "example")).toThrow(
        /none have been added/
      );
    });
  });

  it("returns the editor that a container has when it is called again, and does not make a second", () => {
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

  it("has every method in text mode, and is in text mode at first", () => {
    const editor = open();
    expect(editor.getBlockMode()).toBe(false);
    for (const name of blockModeOnlyMethods) {
      expect(typeof editor[name]).toBe("function");
    }
    expect(typeof editor.getValue).toBe("function");
  });

  it.each(blockModeOnlyMethods)(
    "%s() throws an Error that says it needs block mode, in text mode",
    (name) => {
      const editor = open();
      expect(() => (editor[name] as () => unknown)()).toThrow(
        new Error(`${name}() is only available in block mode`)
      );
    }
  );

  it("has a method for each one that block mode has", () => {
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

  it("is the same object in block mode and back, and answers for the mode that shows", () => {
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

  it("keeps the methods that block mode restricts restricted, and those that text mode does, in the mode that shows", () => {
    const editor = open();
    // (not supported in the block editor)
    act(() => editor.setBlockMode(true));
    expect(() => editor.setOption("readOnly", true)).toThrow(/not supported/);
    act(() => editor.setBlockMode(false));
    expect(() => editor.operation(() => 1)).toThrow(/not supported/);
  });
});
