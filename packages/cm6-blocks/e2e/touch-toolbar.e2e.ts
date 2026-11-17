// Eighth round, step 4: a finger dragging a template out of the toolbar, in Chromium with a touch screen (`hasTouch`, a phone-sized mobile context),
// driven with CDP `Input.dispatchTouchEvent` as touch.e2e.ts does. This is emulation: there is no real touch device here (see the notes).
import { test, expect } from "@playwright/test";

/* eslint-disable @typescript-eslint/no-explicit-any */
test.use({
  hasTouch: true,
  isMobile: true,
  viewport: { width: 520, height: 800 },
});

const SMALL: Record<string, string> = {
  scheme: "(f 1 (g 2) 3)\n(h 4)\n",
  javascript: "f(1, g(2), 3);\nh(4);\n",
  python: "f(1, g(2), 3)\nh(4)\n",
};
const WITH_HOLE: Record<string, string> = {
  scheme: "(f 1 2)\n(if x 1 2)\n",
  javascript: "f(1, 2);\nif (x) { f(1); } else { f(2); }\n",
  python: "f(1, 2)\nif x:\n    f(1)\nelse:\n    f(2)\n",
};
const MIN = 43.5; // (44 px, a finger: the usual minimum for a touch target)

for (const lang of Object.keys(SMALL)) {
  test.describe(`touch, toolbar drag: ${lang}`, () => {
    const load = async (page: any, src: string) => {
      await page.goto(`/index.html?lang=${lang}`);
      await page.waitForSelector(".cm-content .blocks-node");
      await page.evaluate((t: string) => {
        const d = (window as any).demo;
        d.ed.view.dispatch({
          changes: { from: 0, to: d.ed.view.state.doc.length, insert: t },
        });
        (window as any).ctxPrevented = [];
        document.addEventListener("contextmenu", (e) =>
          (window as any).ctxPrevented.push(e.defaultPrevented)
        );
      }, src);
    };
    const text = (page: any): Promise<string> =>
      page.evaluate(() => (window as any).demo.ed.view.state.doc.toString());
    const centre = async (loc: any) => {
      const b = (await loc.boundingBox())!;
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    };
    const button = (page: any, name: string) =>
      page.locator(`#templates button[data-template="${name}"]`);
    const touch = (cdp: any, type: string, p?: { x: number; y: number }) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: p ? [{ x: p.x, y: p.y }] : [],
      });
    /** long-press the button, let the drag start, then call `where` for the point to move to (the gaps have grown by then) and move there */
    async function dragTo(
      page: any,
      cdp: any,
      name: string,
      where: () => Promise<{ x: number; y: number }>
    ) {
      await button(page, name).scrollIntoViewIfNeeded();
      const from = await centre(button(page, name));
      await touch(cdp, "touchStart", from);
      await page.waitForTimeout(500); // the long press
      await page.waitForSelector(".blocks-dragging");
      const to = await where();
      for (let i = 1; i <= 10; i++) {
        await touch(cdp, "touchMove", {
          x: from.x + ((to.x - from.x) * i) / 10,
          y: from.y + ((to.y - from.y) * i) / 10,
        });
        await page.waitForTimeout(16);
      }
      return to;
    }
    const gap = (page: any) =>
      page
        .locator(
          `.cm-content .blocks-args[data-slot="args"] > .blocks-gap[data-index="1"]`
        )
        .first();

    test("the toolbar items are finger-sized and have the touch settings", async ({
      page,
    }) => {
      await load(page, SMALL[lang]);
      const boxes = await page
        .locator("#templates button")
        .evaluateAll((bs: HTMLElement[]) =>
          bs.map((b) => ({
            ...b.getBoundingClientRect().toJSON(),
            ta: getComputedStyle(b).touchAction,
            us: getComputedStyle(b).userSelect,
          }))
        );
      expect(boxes.length).toBeGreaterThan(5);
      for (const b of boxes) {
        expect(b.height).toBeGreaterThanOrEqual(MIN);
        expect(b.width).toBeGreaterThanOrEqual(MIN);
        expect(b.ta).toBe("pan-x");
        expect(b.us).toBe("none");
      }
      expect(
        await page.evaluate(
          () =>
            getComputedStyle(document.getElementById("templates")!).touchAction
        )
      ).toBe("pan-x");
      console.log(
        `${lang}: ${boxes.length} toolbar items, smallest ${Math.min(...boxes.map((b: any) => b.width)).toFixed(0)} x ${Math.min(...boxes.map((b: any) => b.height)).toFixed(0)} px`
      );
    });

    test("a long press, then a drag onto a gap writes the template there; a gap is finger-sized while dragging; the ghost does not swallow the drop point", async ({
      page,
      context,
    }) => {
      await load(page, SMALL[lang]);
      const cdp = await context.newCDPSession(page);
      const smallGap = (await gap(page).boundingBox())!;
      await button(page, "number").scrollIntoViewIfNeeded(); // (the toolbar is wider than the screen)
      const scroll0 = await page.evaluate(() => ({
        y: window.scrollY,
        bar: document.getElementById("templates")!.scrollLeft,
        ed: (window as any).demo.ed.view.scrollDOM.scrollTop,
        scale: window.visualViewport!.scale,
      }));
      const to = await dragTo(page, cdp, "number", async () => {
        const g = (await gap(page).boundingBox())!;
        // the gap has grown to a target a finger can hit
        expect(g.width).toBeGreaterThanOrEqual(MIN);
        expect(g.height).toBeGreaterThanOrEqual(MIN);
        console.log(
          `${lang}: a gap is ${smallGap.width.toFixed(0)} x ${smallGap.height.toFixed(0)} px at rest and ${g.width.toFixed(0)} x ${g.height.toFixed(0)} px while a finger drags`
        );
        return { x: g.x + g.width / 2, y: g.y + g.height / 2 };
      });
      expect(await page.locator(".blocks-drop-target").count()).toBe(1);
      // under the finger is the gap, not the ghost; the ghost is there, above the finger, and takes no pointer events
      const probe = await page.evaluate(({ x, y }: any) => {
        const under = document.elementFromPoint(x, y);
        const ghost = document.querySelector(
          ".blocks-drag-ghost"
        ) as HTMLElement | null;
        const gr = ghost?.getBoundingClientRect();
        const atGhost = gr
          ? document.elementFromPoint(gr.x + gr.width / 2, gr.y + gr.height / 2)
          : null;
        return {
          under: under?.className,
          ghost: !!ghost,
          ghostPE: ghost && getComputedStyle(ghost).pointerEvents,
          ghostAbove: gr ? gr.bottom <= y : null,
          atGhostIsGhost: !!atGhost?.closest(".blocks-drag-ghost"),
        };
      }, to);
      expect(probe.under).toContain("blocks-gap");
      expect(probe.ghost).toBe(true);
      expect(probe.ghostPE).toBe("none");
      expect(probe.ghostAbove).toBe(true);
      expect(probe.atGhostIsGhost).toBe(false);
      // the page did not scroll or zoom, the toolbar did not scroll, no text is selected, no context menu got through
      const scroll1 = await page.evaluate(() => ({
        y: window.scrollY,
        bar: document.getElementById("templates")!.scrollLeft,
        ed: (window as any).demo.ed.view.scrollDOM.scrollTop,
        scale: window.visualViewport!.scale,
        sel: String(getSelection()),
      }));
      expect(scroll1).toMatchObject({
        y: scroll0.y,
        bar: scroll0.bar,
        ed: scroll0.ed,
        scale: scroll0.scale,
        sel: "",
      });
      await touch(cdp, "touchEnd");
      await page.waitForTimeout(80);
      expect((await text(page)).split("\n")[0]).toMatch(/1[, ]+0[, ]+[(]?g/);
      expect(
        await page
          .locator(".blocks-dragging, .blocks-touch-drag, .blocks-drag-ghost")
          .count()
      ).toBe(0);
      expect(await page.locator("input.blocks-edit").count()).toBe(1); // (the number's box is open)
      expect(
        await page.evaluate(() => (window as any).ctxPrevented.every(Boolean))
      ).toBe(true);
      expect(
        await page.evaluate(() => (window as any).demo.ed.lastError)
      ).toBeNull();
      await page.keyboard.type("77");
      await page.keyboard.press("Enter");
      expect((await text(page)).split("\n")[0]).toMatch(/1[, ]+77[, ]+[(]?g/);
      expect(await page.evaluate(() => (window as any).demo.check())).toEqual(
        []
      );
      // the log says it was a finger
      expect(
        await page.evaluate(
          () =>
            (window as any).demo.ed
              .activityLog()
              .find((e: any) => e.action === "templateDrop")?.detail.touch
        )
      ).toBe(true);
    });

    test("a long press, then a drag onto a hole fills it; the hole is finger-sized while dragging", async ({
      page,
      context,
    }) => {
      await load(page, WITH_HOLE[lang]);
      await page.evaluate(() => {
        const ed = (window as any).demo.ed;
        const stack = [...ed.roots()];
        let one: any = null;
        while (stack.length) {
          const n = stack.pop();
          if (
            n.slot &&
            n.slot.kind === "one" &&
            n.slots.length === 0 &&
            n.parent &&
            n.parent.kind !== "program" &&
            !one
          )
            one = n;
          for (const s of n.slots) stack.push(...s.nodes);
        }
        ed.removeNode(one);
      });
      const cdp = await context.newCDPSession(page);
      const before = await text(page);
      await dragTo(page, cdp, "number", async () => {
        const r = await page.evaluate(() => {
          const ed = (window as any).demo.ed;
          const stack = [...ed.roots()];
          while (stack.length) {
            const n = stack.pop();
            if (ed.isBlank(n) && n.slots.length === 0) {
              const b = ed.renderer.element(n).getBoundingClientRect();
              return { x: b.x, y: b.y, w: b.width, h: b.height };
            }
            for (const s of n.slots) stack.push(...s.nodes);
          }
          return null;
        });
        expect(r).not.toBeNull();
        console.log(
          `${lang}: a hole is ${r!.w.toFixed(0)} x ${r!.h.toFixed(0)} px while a finger drags`
        );
        expect(r!.h).toBeGreaterThanOrEqual(MIN);
        return { x: r!.x + r!.w / 2, y: r!.y + r!.h / 2 };
      });
      expect(await page.locator(".blocks-drop-target").count()).toBe(1);
      await touch(cdp, "touchEnd");
      await page.waitForTimeout(80);
      expect(await text(page)).not.toBe(before);
      expect(await text(page)).toContain("0");
      expect(
        await page.evaluate(() => (window as any).demo.ed.lastError)
      ).toBeNull();
      await page.keyboard.press("Escape"); // (the number's box is open)
      expect(await page.locator(".blocks-hole").count()).toBe(0);
      expect(await page.evaluate(() => (window as any).demo.check())).toEqual(
        []
      );
    });

    test("a short swipe on the toolbar scrolls the toolbar and does not start a drag", async ({
      page,
      context,
    }) => {
      await load(page, SMALL[lang]);
      const cdp = await context.newCDPSession(page);
      const before = await text(page);
      const bar = await page.evaluate(() => {
        const b = document.getElementById("templates")!;
        return { sw: b.scrollWidth, cw: b.clientWidth, sl: b.scrollLeft };
      });
      expect(bar.sw).toBeGreaterThan(bar.cw); // (there is something to scroll)
      const first = page.locator("#templates button").first(); // (one that is on the screen: the toolbar is wider than it)
      const p = await centre(first);
      await touch(cdp, "touchStart", p);
      for (let i = 1; i <= 10; i++) {
        await touch(cdp, "touchMove", { x: p.x - i * 18, y: p.y });
        await page.waitForTimeout(8);
      }
      await touch(cdp, "touchEnd");
      await page.waitForTimeout(150);
      expect(
        await page.locator(".blocks-dragging, .blocks-drag-ghost").count()
      ).toBe(0);
      expect(
        await page.evaluate(
          () => document.getElementById("templates")!.scrollLeft
        )
      ).toBeGreaterThan(bar.sl);
      expect(await text(page)).toBe(before);
      expect(await page.locator("input.blocks-edit").count()).toBe(0);
    });

    test("a tap on a template still inserts it after the focused block; a long press that goes nowhere writes nothing", async ({
      page,
      context,
    }) => {
      await load(page, SMALL[lang]);
      await page
        .locator(".cm-content .blocks-literal", { hasText: /^4$/ })
        .first()
        .click({ modifiers: ["Shift"] });
      await button(page, "number").scrollIntoViewIfNeeded();
      const p = await centre(button(page, "number"));
      await page.touchscreen.tap(p.x, p.y);
      expect(await page.locator("input.blocks-edit").count()).toBe(1);
      expect((await text(page)).split("\n").length).toBeGreaterThan(2);
      await page.keyboard.press("Escape");
      await page.evaluate((t: string) => {
        const d = (window as any).demo;
        d.ed.view.dispatch({
          changes: { from: 0, to: d.ed.view.state.doc.length, insert: t },
        });
      }, SMALL[lang]);
      // press and hold on the button and let go on it (no drag happened): nothing is inserted, and the click is not taken for a tap
      const cdp = await context.newCDPSession(page);
      await touch(cdp, "touchStart", p);
      await page.waitForTimeout(600);
      await touch(cdp, "touchEnd");
      await page.waitForTimeout(100);
      expect(await text(page)).toBe(SMALL[lang]);
      expect(await page.evaluate(() => String(getSelection()))).toBe("");
      expect(
        await page.evaluate(() => (window as any).ctxPrevented.every(Boolean))
      ).toBe(true);
    });
  });
}
