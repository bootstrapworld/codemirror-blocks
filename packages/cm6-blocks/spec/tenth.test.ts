/** @jest-environment jsdom */
// Tenth round: the differences from the old editor that the owner asked to match (1 to 3, 5, 6)
import { make } from "./helpers";

describe("1. active descendant and ids", () => {
  test("ids are block-node-<id> and unique across two editors on one page", () => {
    const a = make("scheme", "(f 1)\n(g 2)");
    const b = make("scheme", "(f 1)\n(g 2)");
    const ids = [...document.querySelectorAll(".blocks-node")].map((e) => e.id);
    expect(ids.length).toBeGreaterThan(6);
    expect(ids.every((i) => /^block-node-\d+$/.test(i))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(a.view.dom.querySelector("[id^=cmb6-]")).toBeNull();
    expect(b.view.dom.querySelector("[id^=cmb6-]")).toBeNull();
  });
  test("focus on a block sets aria-activedescendant on the role=tree element, and the shim on the scroller; leaving clears", () => {
    const ed = make("scheme", "(f 1)\n(g 2)");
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    const [r0, r1] = ed.roots();
    ed.focusNode(r0);
    const tree = ed.view.dom.querySelector("[role=tree]")!;
    expect(tree.getAttribute("aria-activedescendant")).toBe(`block-node-${r0.id}`);
    expect(ed.view.scrollDOM.getAttribute("aria-activedescendent")).toBe(`block-node-${r0.id}`);
    ed.focusNode(r1);
    expect(tree.getAttribute("aria-activedescendant")).toBe(`block-node-${r1.id}`);
    outside.focus();
    expect(tree.hasAttribute("aria-activedescendant")).toBe(false);
    expect(ed.view.scrollDOM.hasAttribute("aria-activedescendent")).toBe(false);
    outside.remove();
  });
});
