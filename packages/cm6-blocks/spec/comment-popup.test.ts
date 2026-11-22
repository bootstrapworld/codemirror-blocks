/** @jest-environment jsdom */
// The popup of an attached comment: a hidden-from-readers span in the block, with the comment's words; it goes with the comment.
import { make } from "./helpers";

describe.each([
  ["scheme", ";", "(f 1)\n"],
  ["javascript", "//", "f(1);\n"],
  ["python", "#", "f(1)\n"],
])("comment popup: %s", (l, mark, call) => {
  test("it has the words, follows an edit of the comment, and goes when the comment does", () => {
    const ed = make(l, `${mark} first\n${call}`);
    const f = () => ed.roots().find((r) => r.kind !== "comment")!;
    const pop = () =>
      ed.renderer.element(f()).querySelector(":scope > .blocks-comment");
    expect(pop()?.textContent).toBe("first");
    expect(pop()?.getAttribute("aria-hidden")).toBe("true");
    const c = ed.commentOf(f())!;
    ed.view.dispatch({
      changes: { from: c.from, to: c.to, insert: `${mark} second` },
    });
    expect(pop()?.textContent).toBe("second");
    const c2 = ed.commentOf(f())!;
    ed.view.dispatch({ changes: { from: c2.from, to: c2.to + 1, insert: "" } });
    expect(pop()).toBeNull();
  });
});
