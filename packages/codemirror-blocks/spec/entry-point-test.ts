/**
 * `CodeMirrorBlocks(container, options, language)`, the entry point of the
 * editor: the language is a language, or the id of one that has been added.
 */
import { act } from "@testing-library/react";
import CodeMirrorBlocks from "../src/CodeMirrorBlocks";
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

  it("renders again into the editor of a container that has one, and does not make a second", () => {
    const div = container();
    act(() => {
      CodeMirrorBlocks(div, { value: "1" }, "example");
    });
    expect(() =>
      act(() => {
        CodeMirrorBlocks(div, { value: "2" }, "example");
      })
    ).not.toThrow();
    expect(div.querySelectorAll(".CodeMirror").length).toBe(1);
  });
});
