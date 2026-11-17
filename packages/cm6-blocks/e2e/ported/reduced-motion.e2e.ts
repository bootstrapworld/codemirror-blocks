// PORTED from packages/codemirror-blocks/e2e/reduced-motion.e2e.ts: only the import changed (to ../compat/helpers); see doc/experiments/cm6-direct-tree.md, thirteenth round.
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { openInBlockMode } from "../compat/helpers";
test.fixme(true, "M: the morph and its motion are not built");

/**
 * A block's size and place are not animated (its colors may be), and nothing
 * animates for someone who asks their system for less motion.
 */
const PROGRAM = "(f x y)\n(g 1)";

const styleOf = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        transitionProperty: s.transitionProperty,
        transitionDuration: s.transitionDuration,
        animationName: s.animationName,
      };
    });

test.describe("motion", () => {
  test("a block's size and place are not animated", async ({ page }) => {
    await openInBlockMode(page, PROGRAM);
    for (const selector of [".blocks-functionApp", ".blocks-literal"]) {
      const { transitionProperty } = await styleOf(page, selector);
      expect(transitionProperty).not.toBe("all");
      expect(transitionProperty).not.toMatch(
        /width|height|margin|padding|top|left/
      );
    }
  });

  test("nothing animates when less motion is asked for", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openInBlockMode(page, PROGRAM);
    for (const selector of [
      ".blocks-functionApp",
      ".blocks-literal",
      ".blocks-drop-target",
    ]) {
      const s = await styleOf(page, selector);
      expect(s.transitionDuration, selector).toMatch(/^0s(, 0s)*$/);
      expect(s.animationName, selector).toBe("none");
    }
  });
});
