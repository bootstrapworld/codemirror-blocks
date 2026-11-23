/** @jest-environment jsdom */
/*
 * Twenty-ninth round: the text/blocks toggle. `ed.setMode` and `ed.mode` (lezer-view.ts), the button and the dialog (mode.ts). The animation is
 * morph.ts (Playwright: e2e/ported/morph.e2e.ts); jsdom has no `Element.animate`, so every switch here is at once, as with reduced motion.
 */
import { undoDepth } from "@codemirror/commands";
import { make } from "./helpers";
import { mountModeToggle } from "../src/mode";

const SRC = "(a 1)\n(b 2)\n";
const press = (el: Element) =>
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));

describe("the mode of the editor", () => {
  test("starts as blocks; setMode switches, and says so to who listens", () => {
    const ed = make("scheme", SRC);
    const seen: string[] = [];
    const stop = ed.onModeChange((m) => seen.push(m));
    expect(ed.mode).toBe("blocks");
    expect(ed.setMode("text")).toBeNull();
    expect(ed.mode).toBe("text");
    expect(ed.view.dom.querySelector(".blocks-node")).toBeNull();
    expect(ed.setMode("blocks")).toBeNull();
    expect(ed.view.dom.querySelector(".blocks-node")).not.toBeNull();
    stop();
    ed.setMode("text");
    expect(seen).toEqual(["text", "blocks"]);
  });

  test("text that does not parse stays text, and the answer says why; it switches once the text is fixed", () => {
    const ed = make("scheme", SRC);
    ed.setMode("text");
    ed.view.dispatch({ changes: { from: 0, to: SRC.length, insert: "(((" } });
    expect(ed.modeProblem()).toMatch(/Missing|Unexpected/);
    expect(ed.setMode("blocks")).toMatch(/Missing|Unexpected/);
    expect(ed.mode).toBe("text");
    ed.setBlockMode(true); // (the old name: silent, and still refused)
    expect(ed.mode).toBe("text");
    ed.view.dispatch({ changes: { from: 0, to: 3, insert: "(f x)" } });
    expect(ed.modeProblem()).toBeNull();
    expect(ed.setMode("blocks")).toBeNull();
    expect(ed.mode).toBe("blocks");
  });

  test("the history is kept over a switch, and starts over when the text was edited in text mode", () => {
    const ed = make("scheme", SRC);
    ed.removeNode(ed.roots()[0]);
    expect(undoDepth(ed.view.state)).toBe(1);
    ed.setMode("text");
    ed.setMode("blocks");
    expect(undoDepth(ed.view.state)).toBe(1);
    ed.setMode("text");
    ed.view.dispatch({ changes: { from: 0, insert: "(z 0)\n" } });
    ed.setMode("blocks");
    expect(undoDepth(ed.view.state)).toBe(0);
  });

  test("a block that has the focus leaves it with the text cursor at its start; the focus stays in the editor", () => {
    const ed = make("scheme", SRC);
    const b = ed.roots()[1];
    ed.focusNode(b);
    ed.setMode("text");
    expect(ed.view.state.selection.main.head).toBe(b.from);
    expect(ed.view.contentDOM.contains(document.activeElement)).toBe(true);
  });

  test("the keys of the blocks do nothing in text mode", () => {
    const ed = make("scheme", SRC);
    ed.setMode("text");
    ed.view.contentDOM.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "F3",
        bubbles: true,
        cancelable: true,
      })
    );
    expect(document.querySelector(".blocks-search")).toBeNull();
    expect(ed.view.contentDOM.getAttribute("role")).toBe("textbox");
  });
});

describe("the toggle button", () => {
  const mount = () => {
    const ed = make("scheme", SRC);
    const root = ed.view.dom.parentElement as HTMLElement;
    return { ed, root, toggle: mountModeToggle(ed, root) };
  };

  test("says which mode a press leads to, and the root's classes follow the mode, also when it is switched in code", () => {
    const { ed, root, toggle } = mount();
    expect(toggle.button.textContent).toContain("Switch to text mode");
    expect(root.className).toContain("blocks");
    press(toggle.button);
    expect(ed.mode).toBe("text");
    expect(toggle.button.textContent).toContain("Switch to blocks mode");
    expect(root.classList.contains("text")).toBe(true);
    ed.setMode("blocks");
    expect(root.classList.contains("blocks")).toBe(true);
    expect(toggle.button.textContent).toContain("Switch to text mode");
    toggle.destroy();
    expect(root.querySelector(".blocks-toggle-btn")).toBeNull();
  });

  test("a press with text that does not parse opens the dialog with the message; Escape closes it and the focus goes back to the button", () => {
    const { ed, root, toggle } = mount();
    ed.setMode("text");
    ed.view.dispatch({ changes: { from: 0, to: SRC.length, insert: "(((" } });
    toggle.button.focus();
    press(toggle.button);
    const dialog = root.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain("Could not convert to Blocks");
    expect(ed.mode).toBe("text");
    dialog.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      })
    );
    expect(root.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(toggle.button);
  });
});
