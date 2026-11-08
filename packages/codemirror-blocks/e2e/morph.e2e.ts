import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Switching between text and blocks: the words of the program float from where
 * they are in the text to where they are in the blocks, and back (see morph.ts).
 * The other tests run with reduced motion, and so without this.
 */
const toggle = (page: Page) => page.locator(".blocks-toggle-btn").click();
const fragments = (page: Page) => page.locator(".cmb-morph");
const editor = (page: Page) => page.locator(".Editor");

async function open(page: Page, lang = "routine") {
  await page.goto(`/?lang=${lang}`);
  await page.waitForFunction(() => !!(window as { cmb?: unknown }).cmb);
  await expect(page.locator(".blocks-toggle-btn")).toBeVisible();
}

test.describe("with motion", () => {
  test.use({ reducedMotion: "no-preference" });

  test("the words of the text float into the blocks, and back", async ({
    page,
  }) => {
    await open(page);
    const text = await page.evaluate(() =>
      (window as unknown as { cmb: { getValue(): string } }).cmb.getValue()
    );
    await toggle(page);
    // (copies of the words are over the editor while it is switching)
    await expect(fragments(page).first()).toBeVisible();
    await expect(editor(page)).toHaveAttribute("data-morphing", "");
    const words = await fragments(page).allTextContents();
    expect(words).toContain("repeat");
    // (and they are gone, with the blocks there, when they have got there)
    await expect(fragments(page)).toHaveCount(0, { timeout: 5000 });
    await expect(editor(page)).not.toHaveAttribute("data-morphing", "");
    await expect(page.locator(".blocks-node").first()).toBeVisible();

    // and back to the text
    await toggle(page);
    await expect(fragments(page).first()).toBeVisible();
    await expect(fragments(page)).toHaveCount(0, { timeout: 5000 });
    await expect(editor(page)).not.toHaveAttribute("data-morphing", "");
    await expect(page.locator(".blocks-node")).toHaveCount(0);
    // (nothing of the program was lost on the way, whatever the layout)
    const back = await page.evaluate(() =>
      (window as unknown as { cmb: { getValue(): string } }).cmb.getValue()
    );
    expect(back.replace(/\s+/g, " ")).toContain("repeat 3");
    expect(text).toContain("repeat 3");
  });

  test("a key pressed in the middle of it ends it at once", async ({
    page,
  }) => {
    await open(page);
    await toggle(page);
    await expect(fragments(page).first()).toBeVisible();
    await page.keyboard.press("Shift");
    await expect(fragments(page)).toHaveCount(0, { timeout: 500 });
    await expect(editor(page)).not.toHaveAttribute("data-morphing", "");
    await expect(page.locator(".blocks-node").first()).toBeVisible();
  });
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("nothing floats: the switch is made at once", async ({ page }) => {
    await open(page);
    const seen = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let most = 0;
          const watch = new MutationObserver(() => {
            most = Math.max(
              most,
              document.querySelectorAll(".cmb-morph").length
            );
          });
          watch.observe(document.body, { childList: true, subtree: true });
          (document.querySelector(".blocks-toggle-btn") as HTMLElement).click();
          setTimeout(() => resolve(most), 1000);
        })
    );
    expect(seen).toBe(0);
    await expect(page.locator(".blocks-node").first()).toBeVisible();
    await expect(editor(page)).not.toHaveAttribute("data-morphing", "");
  });
});
