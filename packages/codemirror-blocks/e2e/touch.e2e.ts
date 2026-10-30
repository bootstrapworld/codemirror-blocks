import { expect, test, type CDPSession, type Page } from "@playwright/test";
import {
  block,
  center,
  expectConsistent,
  openInBlockMode,
  snapshot,
  trashCan,
} from "./helpers";

// A finger, driven through the Chrome DevTools Protocol so that the page gets
// real touch events (and so pointer events with pointerType "touch").
test.use({ hasTouch: true });

type Pt = { x: number; y: number };

const finger = async (page: Page) => {
  const cdp: CDPSession = await page.context().newCDPSession(page);
  const send = (
    type: "touchStart" | "touchMove" | "touchEnd",
    p?: Pt
  ): Promise<unknown> =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: p ? [{ x: p.x, y: p.y, id: 1 }] : [],
    });
  return {
    down: (p: Pt) => send("touchStart", p),
    move: (p: Pt) => send("touchMove", p),
    up: () => send("touchEnd"),
    /** move in small steps, as a finger does */
    async slide(from: Pt, to: Pt, steps = 10) {
      for (let i = 1; i <= steps; i++) {
        await send("touchMove", {
          x: from.x + ((to.x - from.x) * i) / steps,
          y: from.y + ((to.y - from.y) * i) / steps,
        });
        await page.waitForTimeout(16);
      }
    },
  };
};

const program = "(f x y)\n(g z)\n(h w)";
const LONG_PRESS = 450; // longer than the 250ms the app waits

test.describe("dragging with a finger", () => {
  test("a long press then a drag moves a block to the trash can", async ({
    page,
  }) => {
    await openInBlockMode(page, program);
    const f = await finger(page);
    const from = await center(block(page, /g expression/));
    const to = await center(trashCan(page));
    await f.down(from);
    await page.waitForTimeout(LONG_PRESS);
    await f.slide(from, to);
    await expect(page.locator(".cmb-drag-preview")).toHaveCount(1);
    await expect(trashCan(page)).toHaveClass(/over/);
    await f.up();
    const s = await expectConsistent(page);
    expect(s.roots).toEqual(["(f x y)", "(h w)"]);
    await expect(page.locator(".cmb-drag-preview")).toHaveCount(0);
  });

  test("a long press then a drag moves a block onto an insertion gap", async ({
    page,
  }) => {
    await openInBlockMode(page, program);
    const f = await finger(page);
    const from = await center(block(page, /h expression/));
    const gap = page
      .locator("[id^=block-drop-target-]", { hasNot: page.locator("*") })
      .first();
    const to = await center(gap);
    await f.down(from);
    await page.waitForTimeout(LONG_PRESS);
    await f.slide(from, to, 14);
    await f.up();
    const s = await expectConsistent(page);
    expect(s.roots).toContain("(h w)");
    expect(s.roots).toHaveLength(3);
    expect(s.text).not.toBe(program);
  });

  test("moving before the long press ends scrolls instead of dragging", async ({
    page,
  }) => {
    const lines = Array.from({ length: 120 }, (_, i) => `(f ${i} y)`);
    await openInBlockMode(page, lines.join("\n"));
    const scroller = page.locator(".CodeMirror-scroll");
    const before = await scroller.evaluate((e) => e.scrollTop);
    const f = await finger(page);
    const from = await center(block(page, /f expression/));
    await f.down(from);
    await f.slide(from, { x: from.x, y: from.y - 120 }, 12);
    await expect(page.locator(".cmb-drag-preview")).toHaveCount(0);
    await f.up();
    // (the page or the editor scrolled, and nothing was dropped anywhere)
    const after = await scroller.evaluate((e) => e.scrollTop);
    const pageY = await page.evaluate(() => window.scrollY);
    expect(after + pageY).toBeGreaterThan(before);
    expect((await snapshot(page)).text).toBe(lines.join("\n"));
  });

  test("a quick tap still activates a block, as a click does", async ({
    page,
  }) => {
    await openInBlockMode(page, program);
    // a leaf: tapping the middle of a bigger block lands on a child
    const target = block(page, /^g,/);
    // the blocks shift sideways while the page's fonts load, so tap only once
    // the block holds still
    let x = -1;
    await expect(async () => {
      const prev = x;
      x = (await target.boundingBox())?.x ?? -2;
      await page.waitForTimeout(150);
      expect(x).toBe(prev);
    }).toPass();
    const p = await center(target);
    await page.touchscreen.tap(p.x, p.y);
    // (a leaf opens for editing when clicked, so focus is inside the editor
    // rather than on the block itself)
    await expect(page.locator(".CodeMirror :focus")).toHaveCount(1);
    await expect(page.locator(".cmb-drag-preview")).toHaveCount(0);
  });
});
