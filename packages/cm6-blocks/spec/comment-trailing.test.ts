/** @jest-environment jsdom */
// A comment after a block on its line goes with the block: moved, cut, copied (twenty-second round).
import { undo } from "@codemirror/commands";
import { make } from "./helpers";

const CFG: Record<string, { a: string; b: string; c: string; mark: string }> = {
  scheme: { a: "(a 1)", b: "(b 2)", c: "(c 3)", mark: ";" },
  javascript: { a: "a(1);", b: "b(2);", c: "c(3);", mark: "//" },
  python: { a: "a(1)", b: "b(2)", c: "c(3)", mark: "#" },
};
describe.each(Object.keys(CFG))("trailing comment: %s", (l) => {
  const { a, b, c, mark } = CFG[l];
  const src = `${a} ${mark} t\n${b}\n${c}\n`;
  const calls = (ed: ReturnType<typeof make>) =>
    ed.roots().filter((r) => r.kind !== "comment");
  test("moving the block takes the trailing comment on its line; one undo restores", () => {
    const ed = make(l, src);
    ed.moveNode(calls(ed)[0], { slot: ed.doc.program.slots[0], index: 5 });
    const t = ed.view.state.doc.toString();
    expect(t).toContain(`${a} ${mark} t`);
    expect(t.indexOf(a)).toBeGreaterThan(t.indexOf(c));
    expect(ed.commentOf(calls(ed)[2])?.value).toBe(`${mark} t`);
    undo(ed.view);
    expect(ed.view.state.doc.toString()).toBe(src);
  });
  test("cut takes it, copy has it; paste after the block goes below its comment's line", () => {
    const ed = make(l, src);
    const e = new Event("copy", {
      bubbles: true,
      cancelable: true,
    }) as Event & {
      clipboardData: unknown;
    };
    let out = "";
    e.clipboardData = {
      getData: () => "",
      setData: (_: string, v: string) => (out = v),
    };
    ed.focusNode(calls(ed)[0]);
    ed.renderer.element(calls(ed)[0]).dispatchEvent(e);
    expect(out).toContain(`${mark} t`);
    ed.removeNodes([calls(ed)[0]], true);
    expect(ed.view.state.doc.toString()).not.toContain(" t");
  });
});
