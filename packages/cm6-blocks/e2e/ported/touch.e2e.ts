// PORTED from packages/codemirror-blocks/e2e/touch.e2e.ts: only the import changed (to ../compat/helpers); see doc/experiments/cm6-direct-tree.md, thirteenth round.
// EDITED (documented, second round D): the labels `f expression`, `g,` are the table's `a f expression `, `symbol g`
import {
  expect,
  test,
  type CDPSession,
  type Locator,
  type Page,
} from "@playwright/test";
import {
  block,
  center,
  expectConsistent,
  openInBlockMode,
  snapshot,
  trashCan,
} from "../compat/helpers";

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

/** Wait until the element has stopped moving (blocks shift as fonts load). */
const settled = async (l: Locator) => {
  let last = "";
  await expect(async () => {
    const prev = last;
    const b = await l.boundingBox();
    last = JSON.stringify(b);
    await l.page().waitForTimeout(100);
    expect(last).toBe(prev);
  }).toPass();
  return center(l);
};

/**
 * A point on the block itself, not on one of its children (the middle of a
 * block lands on a child): just inside its left edge.
 */
const grip = async (l: Locator): Promise<Pt> => {
  await settled(l);
  const b = (await l.boundingBox())!;
  // edited: the block's own padding, at its top left corner (a call's left edge here is covered by its first gap)
  return { x: b.x + 4, y: b.y + 4 };
};

/** Press, wait for the app to start the drag, and slide onto the target. */
const longPressDrag = async (
  page: Page,
  from: Pt,
  to: Pt,
  steps = 10
): Promise<() => Promise<unknown>> => {
  const f = await finger(page);
  await f.down(from);
  // the app starts the drag after its long-press delay (250ms, LONG_PRESS_MS
  // in dnd.ts); wait for it to say so rather than for a guessed time
  // edited: the editor says `blocks-dragging` on itself, not `cmb-dragging` on the body
  await expect(page.locator(".blocks-dragging")).not.toHaveCount(0);
  await f.slide(from, to, steps);
  return f.up;
};

const program = "(f x y)\n(g z)\n(h w)";

test.describe("dragging with a finger", () => {
  test("a long press then a drag moves a block to the trash can", async ({
    page,
  }) => {
    await openInBlockMode(page, program);
    const from = await grip(block(page, /a g expression /));
    const to = await settled(trashCan(page));
    const release = await longPressDrag(page, from, to);
    await expect(page.locator(".blocks-drag-preview")).toHaveCount(1);
    await expect(trashCan(page)).toHaveClass(/blocks-drop-target/);
    await release();
    const s = await expectConsistent(page);
    expect(s.roots).toEqual(["(f x y)", "(h w)"]);
    await expect(page.locator(".blocks-drag-preview")).toHaveCount(0);
  });

  test("a long press then a drag moves a block onto an insertion gap", async ({
    page,
  }) => {
    await openInBlockMode(page, program);
    const from = await grip(block(page, /a h expression /));
    // edited: the first insertion place is the first `.blocks-gap` (the old one was `[id^=block-drop-target-]`)
    const gap = page.locator(".cm-content .blocks-gap").first();
    const to = await settled(gap);
    const release = await longPressDrag(page, from, to, 14);
    await expect(gap).toHaveClass(/blocks-drop-target/);
    await release();
    const s = await expectConsistent(page);
    // (h w) moved into the first gap of (f x y)
    expect(s.roots).toEqual(["(f (h w) x y)", "(g z)"]);
  });

  test("moving before the long press ends scrolls instead of dragging", async ({
    page,
  }) => {
    const lines = Array.from({ length: 120 }, (_, i) => `(f ${i} y)`);
    await openInBlockMode(page, lines.join("\n"));
    const scroller = page.locator(".cm-scroller");
    const before = await scroller.evaluate((e) => e.scrollTop);
    const f = await finger(page);
    const from = await center(block(page, /a f expression /));
    await f.down(from);
    await f.slide(from, { x: from.x, y: from.y - 120 }, 12);
    await expect(page.locator(".blocks-drag-preview")).toHaveCount(0);
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
    const target = block(page, /^g, /);
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
    await expect(page.locator(".cm-editor :focus")).toHaveCount(1);
    await expect(page.locator(".blocks-drag-preview")).toHaveCount(0);
  });
});

/** Tap the middle of an element once it holds still. */
const tap = async (page: Page, l: Locator) => {
  const p = await settled(l);
  await page.touchscreen.tap(p.x, p.y);
};
// edited: the edit box is an input (`.blocks-edit`), not a contenteditable; the answer keeps the old "true"
const editing = (page: Page) =>
  page.evaluate(() =>
    document.activeElement?.matches(".blocks-edit") ? "true" : "false"
  );
const text = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { cmb: { getValue(): string } }).cmb.getValue()
  );

test.describe("editing with a finger", () => {
  test("a tap on an insertion gap opens it for typing, and Enter adds the block", async ({
    page,
  }) => {
    await openInBlockMode(page, program);
    // edited: the first insertion place is the first `.blocks-gap` (the old one was `[id^=block-drop-target-]`)
    const gap = page.locator(".cm-content .blocks-gap").first();
    await tap(page, gap);
    await expect.poll(() => editing(page)).toBe("true");
    await page.keyboard.type("z");
    await page.keyboard.press("Enter");
    const s = await expectConsistent(page);
    expect(s.roots).toEqual(["(f z x y)", "(g z)", "(h w)"]);
  });

  test("a tap on the faded else of a lambda if opens it for typing", async ({
    page,
  }) => {
    await openInBlockMode(page, "if c then a", "lambda");
    const elseArea = page.locator(".blocks-if-else");
    await expect(elseArea).toHaveClass(/blocks-not-live/);
    await tap(page, elseArea.locator(".blocks-operator"));
    await expect.poll(() => editing(page)).toBe("true");
    await page.keyboard.type("b");
    await page.keyboard.press("Enter");
    await expect.poll(() => text(page)).toMatch(/else \{?\s*b/);
    await expect(elseArea).not.toHaveClass(/blocks-not-live/);
  });

  test("a tap on a gap far down a long program opens it, without the page jumping", async ({
    page,
  }) => {
    const lines = Array.from({ length: 100 }, (_, i) => `f${i}(a, b)`);
    await openInBlockMode(page, lines.join(";\n"), "lambda");
    const scroller = page.locator(".cm-scroller");
    await scroller.evaluate((e) => (e.scrollTop = e.scrollHeight * 0.8));
    await page.waitForTimeout(300);
    const gap = page
      .locator(".blocks-prog > .blocks-statements > .blocks-drop-target")
      .nth(80);
    await gap.scrollIntoViewIfNeeded();
    const before = await scroller.evaluate((e) => e.scrollTop);
    await tap(page, gap);
    await expect.poll(() => editing(page)).toBe("true");
    expect(
      Math.abs((await scroller.evaluate((e) => e.scrollTop)) - before)
    ).toBeLessThan(200);
    await page.keyboard.type("q(1)");
    await page.keyboard.press("Enter");
    await expect.poll(() => text(page)).toMatch(/q\(1\)/);
  });

  test("a tap on a leaf opens it for typing, and Enter replaces it", async ({
    page,
  }) => {
    await openInBlockMode(page, program);
    await tap(page, block(page, /^g, /));
    await expect.poll(() => editing(page)).toBe("true");
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("k");
    await page.keyboard.press("Enter");
    const s = await expectConsistent(page);
    expect(s.roots).toEqual(["(f x y)", "(k z)", "(h w)"]);
  });
});

// FIXME-BEGIN (twenty-seventh round: D: three tests are about parts of the old editor, or a rule of it, that this one does not have)
const FIXME = new Map<string, string>([
  [
    "editing with a finger › a tap on the faded else of a lambda if opens it for typing",
    "D: there is no `lambda` language and no faded (not live) else of an if here",
  ],
  [
    "editing with a finger › a tap on a gap far down a long program opens it, without the page jumping",
    "D: there is no `lambda` language, and the places between the statements of a whole program are bare whitespace here, not gap elements (the gaps of a long function body are tested in drop-target-scroll.e2e.ts)",
  ],
  [
    "editing with a finger › a tap on a leaf opens it for typing, and Enter replaces it",
    "D: a first tap on a block only focuses it here, and a second tap on the focused block edits it (a finger has no Enter key; tested in e2e/touch.e2e.ts and jsdom); the old editor opened a leaf at once",
  ],
]);
test.beforeEach(({}, ti) => {
  const why = FIXME.get(ti.titlePath.slice(1).join(" › "));
  test.fixme(!!why, why ?? "");
});
// FIXME-END
