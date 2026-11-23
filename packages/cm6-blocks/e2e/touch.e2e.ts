// Fifth round, step 6: touch, in Chromium with a touch screen (`hasTouch`, a phone-sized mobile context). The drag is driven with CDP
// `Input.dispatchTouchEvent` (Playwright's touchscreen can only tap). One language (JavaScript), plus the page's own scrolling.
import { test, expect } from "@playwright/test";

/* eslint-disable @typescript-eslint/no-explicit-any */
test.use({
  hasTouch: true,
  isMobile: true,
  viewport: { width: 520, height: 800 },
});

const SRC = "f(1, g(2), 3);\nh(4);\n";

test.describe("touch (JavaScript)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/index.html?lang=javascript`);
    await page.waitForSelector(".cm-content [role=treeitem]");
    await page.evaluate((t) => {
      const d = (window as any).demo;
      d.ed.view.dispatch({
        changes: { from: 0, to: d.ed.view.state.doc.length, insert: t },
      });
    }, SRC);
  });
  const text = (page: any) =>
    page.evaluate(() => (window as any).demo.ed.view.state.doc.toString());
  const lit = (page: any, t: string) =>
    page
      .locator(".cm-content .blocks-node.blocks-literal", {
        hasText: new RegExp(`^${t}$`),
      })
      .first();
  const centre = async (loc: any) => {
    const b = (await loc.boundingBox())!;
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };

  test("blocks say touch-action: manipulation (taps are taps, panning is the page's)", async ({
    page,
  }) => {
    expect(
      await lit(page, "2").evaluate(
        (e: Element) => getComputedStyle(e).touchAction
      )
    ).toBe("manipulation");
  });

  test("a tap focuses a block, a second tap on the focused leaf opens its box, Enter commits", async ({
    page,
  }) => {
    const p = await centre(lit(page, "2"));
    await page.touchscreen.tap(p.x, p.y);
    expect(
      await page.evaluate(() => (window as any).demo.ed.focusedNode()?.value)
    ).toBe("2");
    expect(await page.locator("input.blocks-edit").count()).toBe(0);
    await page.touchscreen.tap(p.x, p.y);
    expect(await page.locator("input.blocks-edit").count()).toBe(1);
    await page.keyboard.type("5");
    await page.keyboard.press("Enter");
    expect(await text(page)).toContain("g(5)");
    // (a tap on a call block's own area, not on a child, was taken by Chromium's touch adjustment for a neighbouring gap and opened an
    // insertion box instead: the second-tap-edits-the-whole-block case is tested in jsdom only, spec/touch.test.ts)
  });

  test("a long press then a drag moves a block onto a gap; one undo takes it back", async ({
    page,
    context,
  }) => {
    const cdp = await context.newCDPSession(page);
    const three = await centre(lit(page, "3"));
    const gap = page
      .locator(
        `.cm-content .blocks-args[data-slot="args"] > .blocks-gap[data-index="0"]`
      )
      .first();
    const g = await centre(gap);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: three.x, y: three.y }],
    });
    await page.waitForTimeout(500); // the long press
    expect(await page.locator(".blocks-dragging").count()).toBeGreaterThan(0);
    for (let i = 1; i <= 8; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          {
            x: three.x + ((g.x - three.x) * i) / 8,
            y: three.y + ((g.y - three.y) * i) / 8,
          },
        ],
      });
      await page.waitForTimeout(16);
    }
    expect(await page.locator(".blocks-drop-target").count()).toBe(1);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await page.waitForTimeout(50);
    expect((await text(page)).split("\n")[0]).toMatch(/f\(3, 1, g\(2\)\)/);
    expect(await page.locator(".blocks-dragging").count()).toBe(0);
    expect(await page.evaluate(() => (window as any).demo.check())).toEqual([]);
    expect(
      await page.evaluate(() => (window as any).demo.ed.lastError)
    ).toBeNull();
    await page.keyboard.press("ControlOrMeta+z");
    expect(await text(page)).toBe(SRC);
  });

  test("a quick swipe on a block scrolls the page and does not drag", async ({
    page,
    context,
  }) => {
    // a long document, so there is something to scroll
    await page.evaluate(() => (window as any).demo.loadBig());
    await page.waitForSelector(".cm-content [role=treeitem]");
    const before = await page.evaluate(
      () => (window as any).demo.ed.view.scrollDOM.scrollTop
    );
    const text0 = await text(page);
    const cdp = await context.newCDPSession(page);
    const p = await centre(
      page.locator(".cm-content .blocks-node.blocks-literal").first()
    );
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: p.x, y: p.y + 300 }],
    });
    for (let i = 1; i <= 10; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: p.x, y: p.y + 300 - i * 25 }],
      });
      await page.waitForTimeout(8);
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await page.waitForTimeout(100);
    const after = await page.evaluate(
      () => (window as any).demo.ed.view.scrollDOM.scrollTop
    );
    expect(after).toBeGreaterThan(before);
    expect(await page.locator(".blocks-dragging").count()).toBe(0);
    expect(await text(page)).toBe(text0);
  });
});
