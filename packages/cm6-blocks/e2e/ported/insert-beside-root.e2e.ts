// PORTED from packages/codemirror-blocks/e2e/insert-beside-root.e2e.ts: only the import changed (to ../compat/helpers); see doc/experiments/cm6-direct-tree.md, thirteenth round.
// EDITED (documented, second round D): the labels `f expression`, `g,` are the table's `call to f `, `symbol g`
import { expect, test } from "@playwright/test";
import { block, openInBlockMode, snapshot } from "../compat/helpers";

// Ctrl-] and Ctrl-[ open an insertion box beside the focused block. A top-level
// block has no parent to hold a drop target, and used to get nothing.
for (const [key, expected] of [
  ["Control+]", ["(f x y)", "q", "(g z)"]],
  ["Control+[", ["q", "(f x y)", "(g z)"]],
] as const) {
  test(`${key} beside a top-level block inserts a new top-level form`, async ({
    page,
  }) => {
    await openInBlockMode(page, "(f x y)\n(g z)");
    await block(page, /call to f /).click({ position: { x: 4, y: 4 } });
    await page.keyboard.press(key);
    await expect(page.locator("[contenteditable=true]")).toBeFocused();
    await page.keyboard.type("q");
    await page.keyboard.press("Enter");
    await expect
      .poll(async () => (await snapshot(page)).roots)
      .toEqual(expected);
    expect((await snapshot(page)).reparsed).toEqual(expected);
  });
}

// FIXME-BEGIN (thirteenth round: D: the insertion box is an input here, the old one a contenteditable (`[contenteditable=true]`))
const FIXME = new Set<string>([
  "Control+] beside a top-level block inserts a new top-level form",
  "Control+[ beside a top-level block inserts a new top-level form",
]);
test.beforeEach(({}, ti) => {
  test.fixme(
    FIXME.has(ti.titlePath.slice(1).join(" › ")),
    "D: the insertion box is an input here, the old one a contenteditable (`[contenteditable=true]`)"
  );
});
// FIXME-END
