// Ninth round, step 1: auto-scroll while dragging, in Chromium, on a long document: a block (and a toolbar template) is dragged from the top
// to a gap that starts off screen at the bottom, and back; with the mouse and with a finger (touch emulation, CDP touches, long press).
import { test, expect } from "@playwright/test";

/* eslint-disable @typescript-eslint/no-explicit-any */
const N = 150; // (a JavaScript statement is about 80 px tall in the demo: 150 of them are 12,000 px, 11 s of scrolling at full speed)
const LONG: Record<string, () => string> = {
  scheme: () => ["(first 777 2)", ...Array.from({ length: N }, (_, i) => `(f ${i} 2)`), "(last 3 4)", ""].join("\n"),
  javascript: () => ["first(777, 2);", ...Array.from({ length: N }, (_, i) => `f(${i}, 2);`), "last(3, 4);", ""].join("\n"),
  python: () => ["first(777, 2)", ...Array.from({ length: N }, (_, i) => `f(${i}, 2)`), "last(3, 4)", ""].join("\n"),
};
const ARGS_GAP = (i: number) => `.blocks-args[data-slot="args"] > .blocks-gap[data-index="${i}"]`;

async function load(page: any, lang: string) {
  await page.goto(`/index.html?lang=${lang}`);
  await page.waitForSelector(".cm-content .blocks-node");
  const text = LONG[lang]();
  await page.evaluate((t: string) => {
    const d = (window as any).demo;
    d.ed.view.dispatch({ changes: { from: 0, to: d.ed.view.state.doc.length, insert: t } });
    d.ed.view.scrollDOM.scrollTop = 0;
  }, text);
  return text;
}
const doc = (page: any): Promise<string> => page.evaluate(() => (window as any).demo.ed.view.state.doc.toString());
const scrollTop = (page: any): Promise<number> => page.evaluate(() => (window as any).demo.ed.view.scrollDOM.scrollTop);
const atEnd = (page: any, end: "top" | "bottom") =>
  page.waitForFunction((e: string) => {
    const s = (window as any).demo.ed.view.scrollDOM;
    return e === "top" ? s.scrollTop === 0 : s.scrollTop >= s.scrollHeight - s.clientHeight - 2;
  }, end, { timeout: 30000 });
/** to the bottom, by the wheel (setting scrollTop does not stick after an undo: the editor scrolls the selection into view when it next measures) */
const toEnd = async (page: any) => {
  const box = (await page.locator(".cm-scroller").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 40; i++) {
    await page.mouse.wheel(0, 4000);
    await page.waitForTimeout(60);
    if (await page.evaluate(() => { const s = (window as any).demo.ed.view.scrollDOM; return s.scrollTop >= s.scrollHeight - s.clientHeight - 2; })) break;
  }
  await page.waitForTimeout(150);
};
/** where the finger or pointer goes to reach a gap that moves as the editor measures what it has drawn (growing gaps shift the content): aim again until the gap is the drop target */
async function aim(page: any, which: "first" | "last", index: number, moveTo: (p: { x: number; y: number }) => Promise<void>) {
  for (let i = 0; i < 8; i++) {
    const g = await gapBox(page, which, index);
    if (g) await moveTo(g);
    await page.waitForTimeout(120);
    if ((await page.locator(".blocks-drop-target").count()) === 1) return;
  }
  throw new Error("the gap never became the drop target");
}
const scrollerBox = async (page: any) => (await page.locator(".cm-scroller").boundingBox())!;
/** the centre of the first gap with this index of the root that is the first (`which` = "first") or the last statement; null when it is not drawn */
const gapBox = (page: any, which: "first" | "last", index: number) =>
  page.evaluate(({ which, sel }: any) => {
    const ed = (window as any).demo.ed;
    const roots = ed.roots();
    const r = which === "first" ? roots[0] : roots[roots.length - 1];
    if (!ed.renderer.has(r)) return null;
    const g = ed.renderer.element(r).querySelector(sel) as HTMLElement | null;
    if (!g) return null;
    const b = g.getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  }, { which, sel: ARGS_GAP(index) });
const literal = (page: any, t: string) => page.locator(".cm-content .blocks-node", { hasText: new RegExp(`^${t}$`) }).first();

for (const lang of Object.keys(LONG)) {
  test.describe(`auto-scroll with the mouse: ${lang}`, () => {
    test("a block dragged from the top to a gap off screen at the bottom, and back; one undo restores", async ({ page }) => {
      const original = await load(page, lang);
      const box = await scrollerBox(page);
      expect(await gapBox(page, "last", 1)).toBeNull(); // (off screen: not even drawn)
      const lit = (await literal(page, "777").boundingBox())!;
      await page.mouse.move(lit.x + lit.width / 2, lit.y + lit.height / 2);
      await page.mouse.down();
      await page.mouse.move(lit.x + 20, lit.y + 10, { steps: 4 });
      await page.mouse.move(box.x + box.width / 2, box.y + box.height - 8, { steps: 10 });
      await atEnd(page, "bottom");
      await aim(page, "last", 1, (g) => page.mouse.move(g.x, g.y, { steps: 6 }));
      await page.mouse.up();
      const moved = await doc(page);
      expect(moved).not.toBe(original);
      expect(moved.split("\n")[0]).toMatch(/^[(]?first[ (]+2/);
      expect(moved.split("\n").slice(-2)[0]).toMatch(/last.*3.*777.*4|last.*777.*3.*4/);
      expect(await page.evaluate(() => (window as any).demo.check())).toEqual([]);
      // one undo
      await page.evaluate(() => (window as any).demo.ed.view.focus());
      await page.keyboard.press("ControlOrMeta+z");
      expect(await doc(page)).toBe(original);
      await page.keyboard.press("ControlOrMeta+Shift+z");
      expect(await doc(page)).toBe(moved);
      // and back to the top
      await toEnd(page);
      const lit2 = (await literal(page, "777").boundingBox())!;
      await page.mouse.move(lit2.x + lit2.width / 2, lit2.y + lit2.height / 2);
      await page.mouse.down();
      await page.mouse.move(lit2.x + 20, lit2.y - 10, { steps: 4 });
      await page.mouse.move(box.x + box.width / 2, box.y + 8, { steps: 10 });
      await atEnd(page, "top");
      await aim(page, "first", 0, (g) => page.mouse.move(g.x, g.y, { steps: 6 }));
      await page.mouse.up();
      expect((await doc(page)).split("\n")[0]).toMatch(/777/);
      expect(await page.evaluate(() => (window as any).demo.check())).toEqual([]);
    });

    test("it stops when the pointer leaves the zone, at the end of the document, and on Escape (nothing is written)", async ({ page }) => {
      const original = await load(page, lang);
      const box = await scrollerBox(page);
      const lit = (await literal(page, "777").boundingBox())!;
      await page.mouse.move(lit.x + lit.width / 2, lit.y + lit.height / 2);
      await page.mouse.down();
      await page.mouse.move(lit.x + 20, lit.y + 10, { steps: 4 });
      await page.mouse.move(box.x + box.width / 2, box.y + box.height - 6, { steps: 6 });
      await page.waitForTimeout(400);
      const a = await scrollTop(page);
      expect(a).toBeGreaterThan(100);
      // leaves the zone: it stops
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
      await page.waitForTimeout(100);
      const b = await scrollTop(page);
      await page.waitForTimeout(300);
      expect(await scrollTop(page)).toBe(b);
      // back in the zone, then Escape
      await page.mouse.move(box.x + box.width / 2, box.y + box.height - 6, { steps: 4 });
      await page.waitForTimeout(200);
      expect(await scrollTop(page)).toBeGreaterThan(b);
      await page.keyboard.press("Escape");
      const c = await scrollTop(page);
      await page.waitForTimeout(300);
      expect(await scrollTop(page)).toBe(c);
      expect(await page.locator(".blocks-dragging").count()).toBe(0);
      await page.mouse.up();
      expect(await doc(page)).toBe(original);
      // the end of the document: the scroll stops there (the height of what is not drawn is an estimate that is corrected as it is drawn, so wait for it to settle)
      await page.evaluate(() => ((window as any).demo.ed.view.scrollDOM.scrollTop = 1e9));
      await page.waitForTimeout(300);
      const lit2 = (await page.locator(".cm-content .blocks-node").last().boundingBox())!;
      await page.mouse.move(lit2.x + 2, lit2.y + 2);
      await page.mouse.down();
      await page.mouse.move(lit2.x + 30, lit2.y - 10, { steps: 4 });
      await page.mouse.move(box.x + box.width / 2, box.y + box.height - 2, { steps: 4 });
      await page.waitForTimeout(800);
      const e1 = await scrollTop(page);
      await page.waitForTimeout(400);
      const e2 = await scrollTop(page);
      expect(e2).toBe(e1);
      expect(await page.evaluate(() => { const s = (window as any).demo.ed.view.scrollDOM; return s.scrollHeight - s.clientHeight - s.scrollTop; })).toBeLessThanOrEqual(2);
      await page.mouse.up();
    });

    test("a template dragged from the toolbar to a gap off screen at the bottom; one undo restores", async ({ page }) => {
      const original = await load(page, lang);
      const box = await scrollerBox(page);
      const btn = (await page.locator('#templates button[data-template="number"]').boundingBox())!;
      await page.mouse.move(btn.x + btn.width / 2, btn.y + btn.height / 2);
      await page.mouse.down();
      await page.mouse.move(btn.x + btn.width / 2 + 10, btn.y + btn.height / 2 + 40, { steps: 4 });
      await page.mouse.move(box.x + box.width / 2, box.y + box.height - 8, { steps: 10 });
      await atEnd(page, "bottom");
      await aim(page, "last", 1, (g) => page.mouse.move(g.x, g.y, { steps: 6 }));
      await page.mouse.up();
      const after = await doc(page);
      expect(after.split("\n").slice(-2)[0]).toMatch(/last.*3.*0.*4/);
      await page.keyboard.press("Escape"); // (the number's box)
      expect(await page.evaluate(() => (window as any).demo.check())).toEqual([]);
      await page.evaluate(() => (window as any).demo.ed.view.focus());
      await page.keyboard.press("ControlOrMeta+z");
      expect(await doc(page)).toBe(original);
    });
  });

  test.describe(`auto-scroll with a finger: ${lang}`, () => {
    test.use({ hasTouch: true, isMobile: true, viewport: { width: 520, height: 800 } });
    const touch = (cdp: any, type: string, p?: { x: number; y: number }) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: p ? [{ x: p.x, y: p.y }] : [] });
    async function glide(page: any, cdp: any, from: { x: number; y: number }, to: { x: number; y: number }, steps = 8) {
      for (let i = 1; i <= steps; i++) {
        await touch(cdp, "touchMove", { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps });
        await page.waitForTimeout(16);
      }
    }
    const centre = async (loc: any) => {
      const b = (await loc.boundingBox())!;
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    };

    for (const kind of ["block", "template"]) {
      test(`a ${kind} dragged with a finger to a gap off screen at the bottom, and a block back; the page does not scroll; one undo restores`, async ({ page, context }) => {
        const original = await load(page, lang);
        const cdp = await context.newCDPSession(page);
        const box = await scrollerBox(page);
        const info0 = await page.evaluate(() => ({ h: (window as any).demo.ed.view.scrollDOM.scrollHeight, y: window.scrollY }));
        if (kind === "template") await page.locator('#templates button[data-template="number"]').scrollIntoViewIfNeeded(); // (the toolbar is wider than the screen)
        const from = kind === "block" ? await centre(literal(page, "777")) : await centre(page.locator('#templates button[data-template="number"]'));
        await touch(cdp, "touchStart", from);
        await page.waitForTimeout(500);
        await page.waitForSelector(".blocks-dragging");
        const info1 = await page.evaluate(() => ({ h: (window as any).demo.ed.view.scrollDOM.scrollHeight, top: (window as any).demo.ed.view.scrollDOM.scrollTop }));
        const bottom = { x: box.x + box.width / 2, y: box.y + box.height - 8 };
        await glide(page, cdp, from, bottom, 10);
        // (the finger stays in the zone; the editor scrolls while it is still)
        await atEnd(page, "bottom");
        let cur = bottom;
        await aim(page, "last", 1, async (g) => {
          await glide(page, cdp, cur, g, 4);
          cur = g;
        });
        const info2 = await page.evaluate(() => ({ y: window.scrollY, scale: window.visualViewport!.scale, sel: String(getSelection()) }));
        expect(info2).toMatchObject({ y: info0.y, scale: 1, sel: "" });
        const gb = (await page.locator(".blocks-drop-target").first().boundingBox())!;
        console.log(`${lang} ${kind}: scrollHeight ${info0.h} at rest, ${info1.h} when the long press began (the gaps grew; scrollTop ${info1.top}), target gap ${gb.width.toFixed(0)} x ${gb.height.toFixed(0)}`);
        await touch(cdp, "touchEnd");
        await page.waitForTimeout(100);
        const after = await doc(page);
        expect(after.split("\n").slice(-2)[0]).toMatch(kind === "block" ? /last.*(3.*777|777.*3).*4/ : /last.*3.*0.*4/);
        if (kind === "template") await page.keyboard.press("Escape"); // (the number's box)
        expect(await page.evaluate(() => (window as any).demo.check())).toEqual([]);
        await page.evaluate(() => (window as any).demo.ed.view.focus());
        await page.keyboard.press("ControlOrMeta+z");
        expect(await doc(page)).toBe(original);
        await page.keyboard.press("ControlOrMeta+Shift+z");
        if (kind === "block") {
          // and back to the top, with a finger
          await toEnd(page);
          const f2 = await centre(literal(page, "777"));
          await touch(cdp, "touchStart", f2);
          await page.waitForTimeout(500);
          await page.waitForSelector(".blocks-dragging");
          const top = { x: box.x + box.width / 2, y: box.y + 8 };
          await glide(page, cdp, f2, top, 10);
          await atEnd(page, "top");
          let cur2 = top;
          await aim(page, "first", 0, async (g) => {
            await glide(page, cdp, cur2, g, 4);
            cur2 = g;
          });
          await touch(cdp, "touchEnd");
          await page.waitForTimeout(100);
          expect((await doc(page)).split("\n")[0]).toMatch(/777/);
          expect(await page.evaluate(() => (window as any).demo.check())).toEqual([]);
        }
      });
    }
  });
}
