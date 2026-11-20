/** @jest-environment jsdom */
// An insertion box refuses text that does not parse (as the old editor's edit boxes do); the messages.
import { make } from "./helpers";
import { schemeTable, scheme } from "./../src/lang-scheme";
import { javascript } from "./../src/lang-javascript";
import { python } from "./../src/lang-python";
import { refusal, END_MESSAGE } from "../src/explain";

const key = (el: Element, k: string, mods: Partial<KeyboardEventInit> = {}) =>
  el.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: k,
      bubbles: true,
      cancelable: true,
      ...mods,
    })
  );
const SIB: Record<string, [string, string]> = {
  scheme: ["(", "(g 7)"],
  javascript: ["f(", "g(7);"],
  python: ["f(", "g(7)"],
};

describe.each(["scheme", "javascript", "python"])("insertion box: %s", (l) => {
  test("a text that does not parse is refused; a good one commits", () => {
    const ed = make(l);
    const before = ed.view.state.doc.toString();
    const first = ed.roots()[0];
    ed.focusNode(first);
    key(ed.renderer.element(first), "]", { ctrlKey: true });
    const input = ed.view.dom.querySelector(
      "input.blocks-edit"
    ) as HTMLInputElement;
    input.value = SIB[l][0];
    key(input, "Enter");
    expect(ed.view.state.doc.toString()).toBe(before);
    expect(input.isConnected).toBe(true);
    expect(input.classList.contains("blocks-error")).toBe(true);
    expect(input.title).not.toBe("");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    input.value = SIB[l][1];
    input.dispatchEvent(new Event("input"));
    expect(input.classList.contains("blocks-error")).toBe(false);
    key(input, "Enter");
    expect(ed.view.state.doc.toString()).toContain(SIB[l][1]);
  });
});

describe("messages", () => {
  const msg = (lang: typeof scheme, text: string, at: number, ins: string) =>
    refusal(lang, text, { from: at, to: at, insert: ins });
  test("scheme names the bracket", () => {
    expect(msg(scheme, "(a 1)\n", 6, "(b")).toBe(
      'Missing ")" to close the "(" at line 2, column 1'
    );
    expect(msg(scheme, "(a 1)\n", 6, ")")).toBe(
      'Unexpected ")" at line 2, column 1: no bracket is open'
    );
    expect(msg(scheme, "(a 1)\n", 6, "(b]")).toMatch(/^Unexpected "\]"/);
    expect(msg(scheme, "(a 1)\n", 6, '"ab')).toMatch(/closing quote/);
  });
  test("a text that parses is not refused", () => {
    expect(msg(scheme, "(a 1)\n", 6, "(b 2)")).toBeNull();
    expect(msg(javascript, "f(1);\n", 6, "g(2);")).toBeNull();
    expect(msg(python, "f(1)\n", 5, "g(2)")).toBeNull();
  });
  test("javascript and python say it generically", () => {
    for (const lang of [javascript, python]) {
      const m = msg(lang, "f(1)\n", 5, ")");
      expect(m).toMatch(/^Unexpected "\)" at line 2, column 1$/);
      expect(msg(lang, "f(1)\n", 5, "g(")).toBe(END_MESSAGE);
    }
  });
  test("an error that was there before is not blamed on the edit", () => {
    expect(msg(scheme, "(a\n", 3, "1")).toBeNull();
    expect(schemeTable.rules?.some((r) => r.name === "explain")).toBe(true);
  });
});
