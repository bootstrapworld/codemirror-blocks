import { expect, Page, test } from "@playwright/test";
import { expectConsistent } from "./helpers";

/**
 * The animated switch between text and blocks (see ui/morph.ts), in sequences
 * made at random: the toggle button is pressed, again, in the middle of it, and
 * with a key pressed, a click, a scroll or a resize in the middle of it, in each
 * of the languages. (The other random sequences switch the mode in code, and with
 * reduced motion, and never see it.) After each burst of these, once things have
 * settled, nothing is left of the animation (the words, the layer they were on,
 * what holds the toolbar open), the editor is in one mode and looks like it
 * (blocks, or none; the toolbar open, or closed), and the program is the same
 * one. A failure names the seed and lists the steps.
 *
 * Set CMB_MOTION_SEEDS (a comma-separated list) to try other seeds; the soak does
 * (`npm run soak -- --e2e --motion`).
 */
test.use({ reducedMotion: "no-preference" });

const SEEDS = (process.env.CMB_MOTION_SEEDS ?? "1,2,3")
  .split(",")
  .map((s) => Number(s.trim()));
const LANGUAGES = ["wescheme", "routine", "lambda", "example"];
const BURSTS = 4;

/** mulberry32: the same sequence for the same seed */
const seededRandom = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const toggle = (page: Page) => page.locator(".blocks-toggle-btn").click();

type Step = (page: Page, r: () => number) => Promise<string>;
const steps: Record<string, Step> = {
  toggle: async (page) => {
    await toggle(page);
    return "press the toggle button";
  },
  "toggle again at once": async (page) => {
    await toggle(page);
    await toggle(page);
    return "press the toggle button twice";
  },
  wait: async (page, r) => {
    const ms = Math.floor(r() * 1100);
    await page.waitForTimeout(ms);
    return `wait ${ms}ms`;
  },
  "press a key": async (page) => {
    await page.keyboard.press("Shift");
    return "press a key";
  },
  "click the page": async (page) => {
    await page.mouse.click(5, 5);
    return "click beside the editor";
  },
  "scroll the editor": async (page) => {
    const box = await page.locator(".CodeMirror-scroll").boundingBox();
    if (!box) return "no editor to scroll";
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 150);
    return "scroll the editor";
  },
  resize: async (page, r) => {
    const width = 1000 + Math.floor(r() * 200);
    await page.setViewportSize({ width, height: 720 });
    return `resize the window to ${width} wide`;
  },
};
const names = Object.keys(steps);

/** Waits for the animation to be over, and checks what must be true then */
async function settled(page: Page, memory: { text?: string; blocks: boolean }) {
  // (the words, their layer, and what holds the toolbar open are all gone)
  await expect(page.locator(".cmb-morph-layer")).toHaveCount(0, {
    timeout: 8000,
  });
  await expect(page.locator(".Editor[data-morphing]")).toHaveCount(0, {
    timeout: 8000,
  });
  await expect(page.locator(".Editor[data-morph-toolbar]")).toHaveCount(0, {
    timeout: 8000,
  });
  // (the editor is in one mode, and looks like it)
  const mode = await page.evaluate(() => {
    const cls = document.querySelector(".Editor")!.className;
    return /\bblocks\b/.test(cls)
      ? "blocks"
      : /\btext\b/.test(cls)
        ? "text"
        : cls;
  });
  expect(["blocks", "text"], "the mode of the editor").toContain(mode);
  const inLines = page.locator(".CodeMirror-code .blocks-node");
  const bar = page.locator(".toolbar-pane");
  const hasBar = (await bar.count()) > 0;
  const barWidth = () => bar.evaluate((el) => el.getBoundingClientRect().width);
  if (mode === "blocks") {
    memory.blocks = true;
    await expect
      .poll(() => inLines.count(), { timeout: 5000 })
      .toBeGreaterThan(0);
    if (hasBar)
      await expect.poll(barWidth, { timeout: 5000 }).toBeGreaterThan(190);
    await expectConsistent(page);
  } else {
    await expect.poll(() => inLines.count(), { timeout: 5000 }).toBe(0);
    if (hasBar) await expect.poll(barWidth, { timeout: 5000 }).toBeLessThan(5);
    // (once it has been blocks, the text is the program printed: it stays the same)
    if (memory.blocks) {
      const text = (
        await page.evaluate(() =>
          (window as unknown as { cmb: { getValue(): string } }).cmb.getValue()
        )
      ).replace(/\s+/g, " ");
      if (memory.text === undefined) memory.text = text;
      expect(text, "the program, as text").toBe(memory.text);
    }
  }
}

async function runSequence(page: Page, seed: number) {
  const random = seededRandom(seed);
  const language = LANGUAGES[Math.floor(random() * LANGUAGES.length)];
  const log: string[] = [`open ${language}`];
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(String(error.stack)));
  await page.goto(`/?lang=${language}`);
  await page.waitForFunction(() => !!(window as { cmb?: unknown }).cmb);
  await expect(page.locator(".blocks-toggle-btn")).toBeVisible();
  const memory: { text?: string; blocks: boolean } = { blocks: false };
  try {
    for (let burst = 0; burst < BURSTS; burst++) {
      // always one switch, with up to two other things in the middle of it
      await toggle(page);
      log.push("press the toggle button");
      const extra = Math.floor(random() * 3);
      for (let i = 0; i < extra; i++) {
        const name = names[Math.floor(random() * names.length)];
        log.push(await steps[name](page, random));
        expect(pageErrors, "uncaught errors in the page").toEqual([]);
      }
      await settled(page, memory);
      log.push("(settled)");
    }
  } catch (e) {
    throw new Error(
      `seed ${seed} failed after ${log.length} steps:\n  ${log.join("\n  ")}\n\n${e}`,
      { cause: e }
    );
  }
}

for (const seed of SEEDS) {
  test(`motion sequence, seed ${seed}`, ({ page }) => runSequence(page, seed));
}
