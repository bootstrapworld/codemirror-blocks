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
    await expect(
      page.locator(".CodeMirror-code .blocks-node").first()
    ).toBeVisible();

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

  test("the words really move: a word ends up away from where it began", async ({
    page,
  }) => {
    await open(page);
    await toggle(page);
    // (the distance each word is moved over: when it is made, the words are
    // matched with the ones that are on the page, and those must be the blocks)
    const moved = async () =>
      page.evaluate(() => {
        const out: Record<string, number> = {};
        for (const el of document.querySelectorAll<HTMLElement>(".cmb-morph")) {
          for (const a of el.getAnimations()) {
            const frames = (a.effect as KeyframeEffect).getKeyframes();
            const last = String(frames[frames.length - 1].transform ?? "");
            const m = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(last);
            if (m) {
              out[el.textContent ?? ""] = Math.max(
                out[el.textContent ?? ""] ?? 0,
                Math.hypot(Number(m[1]), Number(m[2]))
              );
            }
          }
        }
        return out;
      });
    await expect
      .poll(async () => Object.keys(await moved()).length)
      .toBeGreaterThan(0);
    const distances = await moved();
    // `repeat` is at the start of a line in the text, and in the strip of a block
    expect(distances["repeat"]).toBeGreaterThan(10);
    // (most of the words that are in both go somewhere)
    const far = Object.values(distances).filter((d) => d > 10).length;
    expect(far).toBeGreaterThan(Object.keys(distances).length / 2);
  });

  test("the words can be seen: the layer they are on has a size, and they are in what it shows", async ({
    page,
  }) => {
    await open(page);
    await toggle(page);
    await expect(
      page.locator(".cmb-morph-layer .cmb-morph").first()
    ).toBeVisible();
    const seen = await page.evaluate(() => {
      const layer = document.querySelector<HTMLElement>(".cmb-morph-layer")!;
      const box = layer.getBoundingClientRect();
      // (a clip is measured from the box of the element it is on: one with no
      // size shows nothing at all)
      const m = /inset\(([-\d.]+)px ([-\d.]+)px ([-\d.]+)px ([-\d.]+)px\)/.exec(
        getComputedStyle(layer).clipPath
      );
      if (!m || !box.width || !box.height) return { box: box.width, shown: 0 };
      const [top, right, bottom, left] = m.slice(1).map(Number);
      const shown = [
        ...layer.querySelectorAll<HTMLElement>(".cmb-morph"),
      ].filter((el) => {
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        return (
          x >= box.left + left &&
          x <= box.right - right &&
          y >= box.top + top &&
          y <= box.bottom - bottom
        );
      }).length;
      return { box: box.width, shown };
    });
    expect(seen.box).toBeGreaterThan(0);
    expect(seen.shown).toBeGreaterThan(5);
  });

  test("the toolbar opens first, then the words float; going back the words float, then it closes", async ({
    page,
  }) => {
    // (WeScheme has a toolbar; Routine has none)
    await open(page, "wescheme");
    type State = {
      width: number;
      moving: boolean;
      wordLeft: number;
      barRight: number;
    };
    // when a word has an animation: how wide the toolbar is, whether it is itself
    // moving, and where the first word began
    const whenFloating = async () =>
      (await page
        .waitForFunction(() => {
          const words = [
            ...document.querySelectorAll<HTMLElement>(".cmb-morph"),
          ];
          if (!words.some((el) => el.getAnimations().length)) return false;
          const bar = document.querySelector(".toolbar-pane") as HTMLElement;
          const box = bar.getBoundingClientRect();
          return {
            width: box.width,
            barRight: box.right,
            wordLeft: parseFloat(words[0].style.left),
            moving: bar
              .getAnimations()
              .some(
                (a) =>
                  (a.currentTime as number) > 0 && a.playState === "running"
              ),
          };
        })
        .then((h) => h.jsonValue())) as State;
    // to blocks: the toolbar has opened, and is still, when the words float, and
    // they were measured after it opened (to the right of it, not under it)
    await toggle(page);
    const opening = await whenFloating();
    expect(opening.width).toBeGreaterThan(190);
    expect(opening.moving).toBe(false);
    expect(opening.wordLeft).toBeGreaterThan(opening.barRight);
    await expect(fragments(page)).toHaveCount(0, { timeout: 5000 });
    // back to text: the toolbar is held open while the words float, and closes
    // after them
    await toggle(page);
    const closing = await whenFloating();
    expect(closing.width).toBeGreaterThan(190);
    expect(closing.moving).toBe(false);
    await expect(fragments(page)).toHaveCount(0, { timeout: 5000 });
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.querySelector(".toolbar-pane")!.getBoundingClientRect()
              .width
        )
      )
      .toBeLessThan(5);
  });

  test("a click while the toolbar is opening makes the switch at once", async ({
    page,
  }) => {
    await open(page, "wescheme");
    await toggle(page);
    // (the toolbar is on its way: nothing is switched yet)
    await expect(page.locator(".Editor")).toHaveClass(/text/);
    await page.mouse.click(5, 5);
    await expect(page.locator(".Editor")).toHaveClass(/blocks/, {
      timeout: 500,
    });
    await expect(fragments(page)).toHaveCount(0);
    await expect(
      page.locator(".CodeMirror-code .blocks-node").first()
    ).toBeVisible();
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
    await expect(
      page.locator(".CodeMirror-code .blocks-node").first()
    ).toBeVisible();
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
    await expect(
      page.locator(".CodeMirror-code .blocks-node").first()
    ).toBeVisible();
    await expect(editor(page)).not.toHaveAttribute("data-morphing", "");
  });
});
