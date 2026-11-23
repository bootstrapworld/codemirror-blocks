// PORTED from packages/codemirror-blocks/e2e/morph.e2e.ts: only the import changed (to ../compat/helpers); see doc/experiments/cm6-direct-tree.md, thirteenth round.
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { openDemo } from "../compat/helpers";

/**
 * Switching between text and blocks: the words of the program float from where
 * they are in the text to where they are in the blocks, and back (see morph.ts).
 * The other tests run with reduced motion, and so without this.
 */
const toggle = (page: Page) => page.locator(".blocks-toggle-btn").click();
const fragments = (page: Page) => page.locator(".cmb-morph");
const editor = (page: Page) => page.locator(".Editor");

// edited: the page is this editor's demo (`openDemo`: the old page's `window.cmb` in place over it); its languages are scheme, javascript and python,
// and every one has a toolbar, so the one test of the toolbar opening and closing opens the page it likes (the bar is above the editor here, not beside it)
async function open(page: Page, lang = "scheme") {
  await openDemo(page, lang, "text"); // (the old page opens as text)
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
    // edited: the mark is "" while the words are measured and "play" once they float, which is a few frames after (the blocks are drawn at once here,
    // so by the time the test looks it may be either)
    await expect(editor(page)).toHaveAttribute("data-morphing", /^(play)?$/);
    const words = await fragments(page).allTextContents();
    expect(words).toContain("define"); // edited: `repeat` was Routine's
    // (and they are gone, with the blocks there, when they have got there)
    await expect(fragments(page)).toHaveCount(0, { timeout: 5000 });
    await expect(editor(page)).not.toHaveAttribute("data-morphing", "");
    await expect(
      page.locator(".cm-content .blocks-node").first()
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
    expect(back.replace(/\s+/g, " ")).toContain("define (square x)"); // edited: Scheme's sample
    expect(text).toContain("define (square x)");
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
    // `define` is at the start of a line in the text, and in the strip of a block (edited: `repeat` was Routine's)
    expect(distances["define"]).toBeGreaterThan(10);
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
      // edited: the browser writes `inset(52px 0px 0px)` for `inset(52px 0px 0px 0px)` when the sides are equal (the editor is as wide as the window
      // here): the one to four values are read as the shorthand they are
      const m = /inset\(([^)]+)\)/.exec(getComputedStyle(layer).clipPath);
      if (!m || !box.width || !box.height) return { box: box.width, shown: 0 };
      const v = m[1].split(/\s+/).map(parseFloat);
      const [top, right, bottom, left] = [
        v[0],
        v[1] ?? v[0],
        v[2] ?? v[0],
        v[3] ?? v[1] ?? v[0],
      ];
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
    // edited: the toolbar is a bar above the editor here, so what opens and closes is its height, and the words are measured below it (not
    // to the right of it: `width` / `wordLeft` / `barRight` of the old test)
    await open(page, "scheme");
    type State = {
      height: number;
      moving: boolean;
      wordTop: number;
      barBottom: number;
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
            height: box.height,
            barBottom: box.bottom,
            wordTop: parseFloat(words[0].style.top),
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
    expect(opening.height).toBeGreaterThan(30);
    expect(opening.moving).toBe(false);
    expect(opening.wordTop).toBeGreaterThanOrEqual(opening.barBottom - 1);
    await expect(fragments(page)).toHaveCount(0, { timeout: 5000 });
    // back to text: the toolbar is held open while the words float, and closes
    // after them
    await toggle(page);
    const closing = await whenFloating();
    expect(closing.height).toBeGreaterThan(30);
    expect(closing.moving).toBe(false);
    await expect(fragments(page)).toHaveCount(0, { timeout: 5000 });
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.querySelector(".toolbar-pane")!.getBoundingClientRect()
              .height
        )
      )
      .toBeLessThan(5);
  });

  test("a click while the toolbar is opening makes the switch at once", async ({
    page,
  }) => {
    await open(page, "scheme");
    await toggle(page);
    // (the toolbar is on its way: nothing is switched yet)
    await expect(page.locator(".Editor")).toHaveClass(/text/);
    await page.mouse.click(5, 5);
    await expect(page.locator(".Editor")).toHaveClass(/blocks/, {
      timeout: 500,
    });
    await expect(fragments(page)).toHaveCount(0);
    await expect(
      page.locator(".cm-content .blocks-node").first()
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
      page.locator(".cm-content .blocks-node").first()
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
      page.locator(".cm-content .blocks-node").first()
    ).toBeVisible();
    await expect(editor(page)).not.toHaveAttribute("data-morphing", "");
  });
});
