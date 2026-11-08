import { expect, test } from "@playwright/test";
import { openInBlockMode } from "./helpers";

/**
 * The popup with the comment of a block is what you see on top, wherever the
 * block is: not under the badge of a comment on a block below it (CodeMirror
 * gives each line a layer of its own, and a later one is drawn over an earlier
 * one), and not cut off at the frame of the block it is in.
 */
const PROGRAM = [
  "42 ; a number",
  '"hello" ; a string',
  "#t ; a boolean",
  "quuz ; a symbol",
  "(+",
  "  1 ; a nested comment, in a frame",
  "  2)",
].join("\n");

test("the popup of the comment of a focused block is on top, and whole", async ({
  page,
}) => {
  await openInBlockMode(page, PROGRAM);
  const problems = await page.evaluate(() => {
    // (the editor's blocks do not take the pointer, so `elementsFromPoint` does
    // not see them: let everything take it, to see what is on top)
    const style = document.createElement("style");
    style.textContent =
      ".blocks-node *, .blocks-comment-badge, .blocks-comment { pointer-events: auto !important; }";
    document.head.appendChild(style);
    const found: string[] = [];
    const nodes = [
      ...document.querySelectorAll<HTMLElement>(
        ".blocks-comment-wrap > .blocks-node"
      ),
    ];
    for (const node of nodes) {
      node.focus();
      const popup = node.querySelector(":scope > .blocks-comment");
      const box = popup?.getBoundingClientRect();
      if (!popup || !box || !box.width) continue;
      // the corners and the middle of the popup: each is the popup (or in it)
      const spots = [
        [box.left + 3, box.top + 3],
        [box.right - 3, box.top + 3],
        [box.left + 3, box.bottom - 3],
        [box.right - 3, box.bottom - 3],
        [box.left + box.width / 2, box.top + box.height / 2],
      ];
      for (const [x, y] of spots) {
        const top = document.elementFromPoint(x, y);
        if (!top || !popup.contains(top)) {
          found.push(
            `${popup.textContent}: ${top?.className.toString().slice(0, 30)} is over it at ${Math.round(x)},${Math.round(y)}`
          );
          break;
        }
      }
    }
    style.remove();
    return found;
  });
  expect(problems).toEqual([]);
});
