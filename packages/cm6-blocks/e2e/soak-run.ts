/*
 * The soak runner's Chromium engine (scripts/soak.js, e2e/soak.e2e.ts): one sequence of steps (spec/soak-gen.ts) with REAL input (keys, the mouse,
 * the clipboard) in the demo page, the invariants checked after every step. `runChromium` returns the first violation, or null.
 */
import type { Browser, CDPSession, Page } from "@playwright/test";
import { a11yProblems, focusProblem } from "../spec/soak-dom";
import {
  at,
  defaultEditor,
  makeSequence,
  Sequence,
  shrink,
  RESIZE_HEIGHTS,
  RESIZE_WIDTHS,
  Step,
  TOUCH_OPS,
  Violation,
  ZOOM_LEVELS,
} from "../spec/soak-gen";

/* eslint-disable @typescript-eslint/no-explicit-any */
const KEYMAP: Record<string, string> = {
  "Control+[": "Control+BracketLeft",
  "Control+]": "Control+BracketRight",
  "Shift+<": "Shift+Comma",
  "Shift+|": "Shift+Backslash",
};
const keyName = (k: string): string =>
  KEYMAP[k] ??
  k.replace(/^Mod\+/, "ControlOrMeta+").replace("+Mod+", "+ControlOrMeta+");

/** where two texts first differ (the 80-character excerpts of a message may be equal), as ` (they differ from character N: "..." / "...")` */
function firstDifference(a: string, b: string): string {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const from = Math.max(0, i - 10);
  return ` (they differ from character ${i}: ${JSON.stringify(a.slice(from, i + 30))} / ${JSON.stringify(b.slice(from, i + 30))})`;
}

/** a finding of a step itself (the clipboard that does not hold what was copied): its own invariant, not an "exception" */
class Finding extends Error {
  constructor(
    public invariant: string,
    message: string
  ) {
    super(message);
  }
}

export interface ChromiumOptions {
  baseURL: string;
  /** a step that takes longer (ms) is "stuck" (default 30000) */
  stepTimeoutMs?: number;
  /** one click, read or wait (ms; default 5000) */
  actionMs?: number;
  /** invariants not to check (a known finding that hides others) */
  skip?: string[];
  /** called after each step, before the invariants are read (for looking at the page by hand when a failure is being understood) */
  onStep?: (page: Page, i: number) => Promise<void>;
  /** called with the editor's `heightStats()` at the end of the run (the soak's result record carries them: false positives and cost of the height check) */
  onHeightStats?: (stats: Record<string, number>) => void;
}

/** the sequence's step `s` as a function of the page; returns when the step has been made (the page may still be settling) */
export async function runChromium(
  browser: Browser,
  seq: Sequence,
  o: ChromiumOptions
): Promise<Violation | null> {
  const actionMs = o.actionMs ?? 5000;
  const stepMs = o.stepTimeoutMs ?? 30000;
  const skip = new Set(o.skip ?? []);
  // (CMB6_SOAK_BROWSER=firefox|webkit: the steps that need Chromium's DevTools protocol (a finger's long press and drag, the composition of an
  // IME, the page zoom, the accessibility tree) and its clipboard permissions are left out; see e2e/soak.config.ts)
  const isChromium = browser.browserType().name() === "chromium";
  const context = await browser.newContext({
    baseURL: o.baseURL,
    viewport: { width: 1100, height: 800 },
    reducedMotion: seq.motion === "reduced" ? "reduce" : "no-preference",
    ...(isChromium
      ? { permissions: ["clipboard-read", "clipboard-write"] }
      : {}),
    // (a touch screen only for a sequence with a finger's steps: the mouse sequences are what they were)
    hasTouch: seq.steps.some((s) => TOUCH_OPS.includes(s.op)),
  });
  const page = await context.newPage();
  page.setDefaultTimeout(actionMs);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`uncaught: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text()))
      errors.push(`console.error: ${m.text().slice(0, 300)}`);
  });
  let cdp: CDPSession | null = null;
  // (the options the editor is created with: a `resize` that switches line wrapping makes it again)
  let choice = seq.editor ?? defaultEditor("chromium");
  const close = async (v: Violation | null): Promise<Violation | null> => {
    if (o.onHeightStats)
      o.onHeightStats(
        await page
          .evaluate(() => (window as any).demo.ed.heightStats())
          .catch(() => null)
      );
    await context.close().catch(() => undefined);
    return v;
  };
  const evaluate = <T, A = undefined>(fn: (a: A) => T, arg?: A): Promise<T> =>
    page.evaluate(fn as any, arg) as Promise<T>;
  const frozen = async (): Promise<boolean> =>
    (await Promise.race([
      page.evaluate(() => 1).then(() => false),
      new Promise<boolean>((r) => setTimeout(() => r(true), actionMs)),
    ])) as boolean;

  try {
    await page.goto(`/index.html?lang=${seq.language}`);
    await page.waitForFunction(() => !!(window as any).demo);
    // (the demo's own program is replaced by the sequence's: that replacement is not a step to undo)
    await evaluate(
      (a: { code: string; c: any }) => {
        (window as any).demo.show(a.code, a.c.reconcile, a.c.anchors, a.c);
        (window as any).demo.ed.clearHistory?.();
      },
      { code: seq.code, c: choice }
    );
    if (isChromium) {
      cdp = await context.newCDPSession(page);
      await cdp.send("Accessibility.enable");
    }
  } catch (e) {
    return close({
      invariant: "exception",
      message: `opening the page: ${(e as Error).message.split("\n")[0]}`,
      step: -1,
      op: "open",
    });
  }

  const settle = async (): Promise<void> => {
    await page
      .waitForFunction(
        () =>
          !document.querySelector(".cmb-morph-layer") &&
          document.getAnimations().length === 0,
        undefined,
        { timeout: 8000 }
      )
      .catch(() => undefined);
    await evaluate(
      () =>
        new Promise<void>((r) =>
          requestAnimationFrame(() => requestAnimationFrame(() => r()))
        )
    );
  };
  const text = (): Promise<string> =>
    evaluate(() => (window as any).demo.ed.view.state.doc.toString());
  const mode = (): Promise<"blocks" | "text"> =>
    evaluate(() => (window as any).demo.ed.mode);
  const items = () => page.locator(".cm-content [role=treeitem]");
  /** the box of block `a` (a fraction) among those drawn, scrolled into view; null if there is none or it has no size */
  const blockBox = async (a: unknown) => {
    const n = await items().count();
    const i = at(a, n);
    if (i < 0) return null;
    const el = items().nth(i);
    // (a block inside a collapsed one is in the DOM but not shown: scrolling to it would wait out the whole action timeout, and a burst of
    // presses on such blocks then outlasts the step's limit)
    if (!(await el.isVisible().catch(() => false))) return null;
    await el.scrollIntoViewIfNeeded().catch(() => undefined);
    const b = await el.boundingBox();
    return b && b.width > 1 && b.height > 1 ? { el, box: b } : null;
  };
  /**
   * A point on block `t` that is in the editor and that nothing covers: near its left edge (a click in the middle may land on a block inside
   * it), moved into the window when the block is wider than it (its left edge can be scrolled out of view) and down when its top is under the
   * demo's own toolbar (a click there hits the toolbar and the page loses the editor's focus). Null when there is none.
   */
  // (`edge`: the least x. A finger is given 12: with the editor scrolled sideways, Chromium sends a touch that lands within 4 px of the left edge of the
  // window to the page (<html>) although `elementFromPoint` finds the block there, and a press on the page takes the focus away: not a thing the editor does)
  const grabPoint = async (
    t: {
      box: { x: number; y: number; width: number; height: number };
    },
    edge = 4
  ): Promise<{ x: number; y: number } | null> => {
    const x = Math.max(t.box.x + 3, edge);
    if (x > t.box.x + t.box.width - 2) return null;
    const ys = [8, 20, 60, t.box.height / 2, t.box.height - 6]
      .filter((d) => d > 0 && d < t.box.height)
      .map((d) => t.box.y + d);
    for (const y of ys) {
      // (a finger (`edge` of 12: the touch steps) presses an area, not a point: Chromium's touch adjustment sends the press to a clickable
      // element near the point, such as the toolbar below a block that is half out of the window, and that is not the block's press: so
      // the area around the point must be the editor's too. Seed 807877)
      const around = edge >= 12 ? [0, 10, -10] : [0];
      const ok = await evaluate(
        ([px, py, ds]: any) =>
          ds.every((dx: number) =>
            ds.every(
              (dy: number) =>
                !!document
                  .elementFromPoint(px + dx, py + dy)
                  ?.closest(".cm-content")
            )
          ),
        [x, y, around]
      );
      if (ok) return { x, y };
    }
    return null;
  };
  const clickBlock = async (a: unknown, modifiers: "Shift"[] = []) => {
    const t = await blockBox(a);
    if (!t) return false;
    const p = await grabPoint(t);
    if (!p) return false;
    if (modifiers.length) await page.keyboard.down("Shift");
    await page.mouse.click(p.x, p.y);
    if (modifiers.length) await page.keyboard.up("Shift");
    return true;
  };
  const press = (k: string) => page.keyboard.press(keyName(k));
  const boxOpen = () => page.locator(".blocks-edit").first();
  const fillBox = async (t: string, accept: boolean) => {
    const b = boxOpen();
    if (!(await b.count())) return;
    await page.keyboard.press("ControlOrMeta+a");
    if (t === "") await page.keyboard.press("Backspace");
    else await page.keyboard.type(t);
    await page.keyboard.press(accept ? "Enter" : "Escape");
  };
  const drag = async (
    from: { x: number; y: number },
    to: { x: number; y: number }
  ) => {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 6, from.y + 6, { steps: 3 });
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
  };
  const LONG_PRESS_WAIT = 480; // (the editor's long press is 350 ms)
  const touch = (
    type: "touchStart" | "touchMove" | "touchEnd",
    pts: { x: number; y: number }[]
  ) =>
    cdp!.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: pts.map((p) => ({ x: p.x, y: p.y })),
    });
  /** where a drag `where` ends, for the fraction b */
  const target = async (
    where: string,
    b: unknown
  ): Promise<{ x: number; y: number } | null> => {
    if (where === "trash") {
      const t = await page.locator(".TrashCan").boundingBox();
      return t ? { x: t.x + t.width / 2, y: t.y + t.height / 2 } : null;
    }
    const sc = await page.locator(".cm-scroller").first().boundingBox();
    if (!sc) return null;
    if (where === "end") return { x: sc.x + 60, y: sc.y + sc.height - 6 };
    if (where === "whitespace")
      return {
        x: sc.x + 8,
        y: sc.y + 10 + Number(b) * Math.max(10, sc.height - 20),
      };
    if (where === "block") {
      const t = await blockBox(b);
      return t
        ? { x: t.box.x + t.box.width / 2, y: t.box.y + t.box.height / 2 }
        : null;
    }
    const gaps = page.locator(".cm-content .blocks-gap");
    const n = await gaps.count();
    const i = at(b, n);
    if (i < 0) return null;
    await gaps
      .nth(i)
      .scrollIntoViewIfNeeded()
      .catch(() => undefined);
    const gb = await gaps.nth(i).boundingBox();
    return gb && gb.height > 0
      ? { x: gb.x + gb.width / 2, y: gb.y + gb.height / 2 }
      : null;
  };

  const scrollTo = (a: number): Promise<void> =>
    evaluate((a: number) => {
      const sd = (window as any).demo.ed.view.scrollDOM as HTMLElement;
      sd.scrollTop = a * sd.scrollHeight;
    }, a);
  /** press the mode button and wait for the morph to end */
  const toggleAndSettle = async (): Promise<void> => {
    await page.locator(".blocks-toggle-btn").click();
    await settle();
  };

  /** text mode back to blocks (refused while the text does not parse: the dialog is closed, the step is over) */
  const returnToBlocks = async (): Promise<void> => {
    await toggleAndSettle();
    toolbarOk = true; // (the focus stays on the mode button: the step went there on purpose)
    for (
      let k = 0;
      k < 3 && (await page.locator("[role=dialog]").count());
      k++
    ) {
      await page
        .locator("[role=dialog] .closeDialog")
        .first()
        .click()
        .catch(() => undefined);
      await page.waitForTimeout(50);
    }
    if ((await mode()) === "blocks") {
      // (the editor's rule: back to blocks after text edits starts the history over)
      historyReset = true;
      textEditedInText = false;
    }
  };
  /** the text mode's caret at the place of the text that the fraction `a` stands for */
  const caretAt = (a: unknown): Promise<void> =>
    evaluate(
      (a: any) => {
        const v = (window as any).demo.ed.view;
        const len = v.state.doc.length;
        const from = Math.min(len, Math.floor(a * (len + 1)));
        v.focus();
        v.dispatch({ selection: { anchor: from } });
      },
      Number(a) as any
    );
  /** the viewport and page zoom of the page, in CSS pixels of the window at zoom 1 (a `resize` or `zoom` changes them) */
  const screen = { w: 1100, h: 800, z: 1 };
  /**
   * Apply the window size and the zoom. A browser's page zoom shows fewer CSS pixels in the same window and more device pixels per CSS pixel
   * (and `devicePixelRatio` changes with it): that is what the DevTools override does, with the window's size divided by the zoom level and
   * the device scale factor set to it (the levels are fractional, so heights round off differently from 1). Without the protocol (Firefox,
   * WebKit) only the window size changes.
   */
  const applyScreen = async (): Promise<void> => {
    const width = Math.max(200, Math.round(screen.w / screen.z));
    const height = Math.max(200, Math.round(screen.h / screen.z));
    if (cdp)
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: screen.z,
        mobile: false,
      });
    else await page.setViewportSize({ width, height });
    await settle();
    // (the observers of the editor and of CodeMirror get their notice a frame later)
    await page.waitForTimeout(60);
  };
  /** the system clipboard's text, null where the page may not read it */
  const readClip = (): Promise<string | null> =>
    page.evaluate(() =>
      navigator.clipboard.readText().then(
        (t) => t,
        () => null
      )
    );
  const writeClip = (t: string): Promise<boolean> =>
    page.evaluate(
      (t: string) =>
        navigator.clipboard.writeText(t).then(
          () => true,
          () => false
        ),
      t
    );

  let armed = false;
  let toolbarOk = false;
  let textEditedInText = false;
  let historyReset = false;
  let editsMade = 0;
  let rushed = false;

  const exec = async (s: Step): Promise<void> => {
    const m = await mode();
    const blocks = m === "blocks";
    // (focus that is already on a toolbar button, or the mode button, stays there until a step moves it; one that is in a dialog (the
    // message of a refused switch to blocks) goes back to the button that opened it when the dialog closes)
    toolbarOk = await evaluate(
      () =>
        !!document.activeElement?.closest(
          "#templates, .blocks-toolbar, .blocks-toggle-btn, .blocks-search, .blocks-help, [role=dialog], dialog"
        )
    );
    rushed = false;
    switch (s.op) {
      case "focus":
      case "click":
        if (blocks) await clickBlock(s.a, s.shift ? ["Shift"] : []);
        return;
      case "key":
        if (!blocks && !/^Mod\+/.test(String(s.key))) return;
        await press(String(s.key));
        return;
      case "editBox":
      case "typeIntoBlock": {
        if (!blocks || !(await clickBlock(s.a))) return;
        await press(s.op === "editBox" ? "Enter" : String(s.text)[0]);
        if (s.op === "typeIntoBlock" && (await boxOpen().count())) {
          await page.keyboard.type(String(s.text).slice(1));
          await page.keyboard.press(s.accept ? "Enter" : "Escape");
        } else await fillBox(String(s.text), !!s.accept);
        editsMade++;
        return;
      }
      case "comment": {
        if (!blocks || !(await clickBlock(s.a))) return;
        await page.keyboard.press("Control+Shift+BracketRight");
        await fillBox(String(s.text), !!s.accept);
        editsMade++;
        return;
      }
      case "collapse":
        if (blocks && (await clickBlock(s.a)))
          await press(s.on ? "ArrowLeft" : "ArrowRight");
        return;
      case "collapseAll":
        if (blocks) await press(s.on ? "Shift+ArrowLeft" : "Shift+ArrowRight");
        return;
      case "toggleMode": {
        const rush = rushedFor(s);
        await page.locator(".blocks-toggle-btn").click();
        toolbarOk = true;
        if (rush) {
          rushed = true;
          await page.waitForTimeout(40 + Math.floor(Number(s.a) * 200));
        }
        return;
      }
      case "undo":
        await press("Mod+z");
        return;
      case "redo":
        await press("Mod+Shift+z");
        return;
      case "search": {
        if (!blocks) return;
        await press("F3");
        const input = page.locator(".blocks-search input[type=text]").first();
        if (await input.count()) {
          await input.fill(String(s.text));
          await page.keyboard.press("Enter");
          if (s.next) await page.keyboard.press("PageDown");
          await page.keyboard.press("Escape");
        }
        return;
      }
      case "textEdit": {
        if (blocks) {
          // (an API edit: a page's own code, or another tab)
          await evaluate((a: any) => {
            const v = (window as any).demo.ed.view;
            const len = v.state.doc.length;
            const from = Math.min(len, Math.floor(a.a * (len + 1)));
            v.dispatch({
              changes: { from, to: Math.min(len, from + a.len), insert: a.w },
            });
          }, s as any);
        } else {
          // text mode: the caret and real typing
          await evaluate((a: any) => {
            const v = (window as any).demo.ed.view;
            const len = v.state.doc.length;
            const from = Math.min(len, Math.floor(a.a * (len + 1)));
            v.focus();
            v.dispatch({
              selection: { anchor: from, head: Math.min(len, from + a.len) },
            });
          }, s as any);
          if (s.w === "") await page.keyboard.press("Backspace");
          else await page.keyboard.type(String(s.w));
          textEditedInText = true;
        }
        editsMade++;
        return;
      }
      case "select":
        if (blocks && (await clickBlock(s.a)))
          await page.keyboard.press("Space");
        return;
      case "clearSelection":
        if (blocks) await page.keyboard.press("Escape");
        return;
      case "topLevelType": {
        if (!blocks) return;
        const placed = await evaluate((a: any) => {
          const ed = (window as any).demo.ed;
          // (focusing the editor may close an open box, which writes its text: read the length after that)
          ed.view.focus();
          const len = ed.view.state.doc.length;
          let pos = Math.min(len, Math.floor(a.a * (len + 1)));
          while (pos <= len && !ed.isWhitespaceAt(pos)) pos++;
          if (pos > len) return false;
          ed.view.dispatch({ selection: { anchor: pos } });
          return true;
        }, s as any);
        if (!placed) return;
        if (s.how === "paste") {
          // (Firefox and WebKit do not let a page write the clipboard without a gesture: no paste then)
          if (!(await writeClip(String(s.text)))) return;
          await press("Mod+v");
        } else await page.keyboard.type(String(s.text));
        await page.waitForTimeout(30);
        if (await page.locator(".blocks-pending .blocks-edit").count()) {
          await page.keyboard.press(s.accept ? "Enter" : "Escape");
        }
        editsMade++;
        return;
      }
      case "dragBlock": {
        if (!blocks) return;
        const src = await blockBox(s.a);
        const dst = await target(String(s.where), s.b);
        const from = src && (await grabPoint(src));
        if (!from || !dst) return;
        await drag(from, dst);
        editsMade++;
        return;
      }
      // ---- a finger: real touch events (CDP Input.dispatchTouchEvent: Playwright's touchscreen can only tap), so that the page gets
      // pointerType "touch" (src/interact.ts: the long press of 350 ms starts a drag; a finger that moves earlier is scrolling) ----
      case "tap": {
        if (!blocks) return;
        const t = await blockBox(s.a);
        const p = t && (await grabPoint(t, 12));
        if (!p) return;
        await page.touchscreen.tap(p.x, p.y);
        if (s.twice) {
          // (a second tap, after the time of a double tap, on the focused block: a leaf opens its box, any other block its whole text)
          await page.waitForTimeout(450);
          await page.touchscreen.tap(p.x, p.y);
          editsMade++;
        }
        return;
      }
      case "longPress": {
        // (the finger lets go where it pressed: the drag has begun, and ends over the block itself)
        if (!blocks || !cdp) return;
        const t = await blockBox(s.a);
        const p = t && (await grabPoint(t, 12));
        if (!p) return;
        await touch("touchStart", [p]);
        await page.waitForTimeout(LONG_PRESS_WAIT);
        await touch("touchEnd", []);
        await page.waitForTimeout(50);
        editsMade++;
        return;
      }
      case "touchDrag": {
        if (!blocks || !cdp) return;
        const src = await blockBox(s.a);
        const dst = await target(String(s.where), s.b);
        const from = src && (await grabPoint(src, 12));
        if (!from || !dst) return;
        await touch("touchStart", [from]);
        await page.waitForTimeout(LONG_PRESS_WAIT);
        for (let k = 1; k <= 8; k++) {
          await touch("touchMove", [
            {
              x: from.x + ((dst.x - from.x) * k) / 8,
              y: from.y + ((dst.y - from.y) * k) / 8,
            },
          ]);
          await page.waitForTimeout(16);
        }
        await touch("touchEnd", []);
        await page.waitForTimeout(50);
        editsMade++;
        return;
      }
      case "swipe": {
        // a finger that moves before the long press is over is scrolling the page: the program must not change
        if (!blocks || !cdp) return;
        // (an edit box that is still open, left by an earlier step such as a refused paste, takes the finger's press as a click elsewhere: it
        // loses the focus and writes its text, as for a mouse. That is the box's doing, not a drag: it is closed first. Seed 73955)
        if (await boxOpen().count()) {
          await boxOpen().press("Escape");
          await page.waitForTimeout(50);
        }
        const t = await blockBox(s.a);
        const p = t && (await grabPoint(t, 12));
        if (!p) return;
        const before = await text();
        const dy = s.dir === "up" ? -14 : 14;
        await touch("touchStart", [p]);
        for (let k = 1; k <= 4; k++) {
          await touch("touchMove", [{ x: p.x, y: p.y + dy * k }]);
          await page.waitForTimeout(16);
        }
        await touch("touchEnd", []);
        await page.waitForTimeout(50);
        if ((await text()) !== before)
          throw new Error(
            `a quick swipe on a block changed the program: it was taken for a drag`
          );
        return;
      }
      case "dragTemplate": {
        if (!blocks) return;
        const btns = page.locator("#templates button[data-template]");
        const i = at(s.t, await btns.count());
        const dst = await target(String(s.where), s.b);
        // (in a narrow window the toolbar is wider than it: a button scrolled out of sight is brought into view, and one that is still out of
        // the window cannot be pressed: a press there is a press on the page, which takes the focus away. Seed 222 of the round-49 smoke)
        if (i >= 0)
          await btns
            .nth(i)
            .scrollIntoViewIfNeeded()
            .catch(() => undefined);
        const bb = i >= 0 ? await btns.nth(i).boundingBox() : null;
        const win = await evaluate(() => ({
          width: innerWidth,
          height: innerHeight,
        }));
        if (
          !bb ||
          !dst ||
          (win &&
            (bb.x < 0 ||
              bb.y < 0 ||
              bb.x + bb.width > win.width ||
              bb.y + bb.height > win.height))
        )
          return;
        // (a press that lands on the page and not on the button (a zoomed or narrow window leaves the box where nothing is) is a press on
        // the page, which takes the focus away: not a thing the editor does. Seeds 5667 and 4299 of round 8)
        const from = { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 };
        const onButton = await evaluate(
          (p: { x: number; y: number }) =>
            !!document
              .elementFromPoint(p.x, p.y)
              ?.closest("#templates button[data-template]"),
          from
        );
        if (!onButton) return;
        await drag(from, dst);
        editsMade++;
        return;
      }
      case "dragSelection": {
        if (!blocks) return;
        let first: { x: number; y: number } | null = null;
        for (let k = 0; k < Number(s.n); k++) {
          const a = (Number(s.a) + k * 0.137) % 1;
          if (await clickBlock(a)) {
            await page.keyboard.press("Space");
            const t = await blockBox(a);
            if (t && !first) first = await grabPoint(t);
          }
        }
        const dst = await target("gap", s.b);
        if (first && dst) await drag(first, dst);
        editsMade++;
        return;
      }
      case "clickTemplate": {
        if (!blocks) return;
        const btns = page.locator("#templates button[data-template]");
        const i = at(s.t, await btns.count());
        if (i >= 0) await btns.nth(i).click();
        editsMade++;
        return;
      }
      case "scroll":
        await scrollTo(Number(s.a));
        return;
      case "scrollKey":
        // (the focused block may now be outside the drawn part of a long document: a key must still be heard, and the focus kept)
        await scrollTo(Number(s.a));
        await settle();
        await press(String(s.key));
        return;
      case "scrollToggle":
        await scrollTo(Number(s.a));
        await settle();
        await page.locator(".blocks-toggle-btn").click();
        toolbarOk = true;
        return;
      case "brokenText": {
        // text mode, broken syntax typed at a place of the text, then back to blocks (refused while it does not parse)
        if (blocks) await toggleAndSettle();
        await evaluate((a: any) => {
          const v = (window as any).demo.ed.view;
          const len = v.state.doc.length;
          const from = Math.min(len, Math.floor(a.a * (len + 1)));
          v.focus();
          v.dispatch({ selection: { anchor: from } });
        }, s as any);
        if (s.nl) await page.keyboard.press("Enter");
        await page.keyboard.type(String(s.w));
        textEditedInText = true;
        editsMade++;
        if (s.back) await returnToBlocks();
        return;
      }
      // ---- the browser's own (spec/soak-gen.ts `browserStep`) ----
      case "resize":
      case "zoom": {
        if (s.op === "resize") {
          screen.w = RESIZE_WIDTHS[at(s.w, RESIZE_WIDTHS.length)];
          screen.h = RESIZE_HEIGHTS[at(s.h, RESIZE_HEIGHTS.length)];
        } else if (cdp) screen.z = ZOOM_LEVELS[at(s.z, ZOOM_LEVELS.length)];
        await applyScreen();
        if (s.op === "resize" && s.wrap !== "keep") {
          // (line wrapping is a choice of the page's own, made when the editor is created: the same text, a new editor, an empty history)
          const wrap = s.wrap === "on";
          if (wrap !== choice.lineWrapping) {
            choice = { ...choice, lineWrapping: wrap, collapseAll: false };
            await evaluate(
              (a: { code: string; c: any }) => {
                (window as any).demo.show(
                  a.code,
                  a.c.reconcile,
                  a.c.anchors,
                  a.c
                );
                (window as any).demo.ed.clearHistory?.();
              },
              { code: await text(), c: choice }
            );
            historyReset = true;
            armed = false; // (the focus was in the editor that is gone)
            await settle();
          }
        }
        return;
      }
      case "ime": {
        // a composition through the input method events (the text grows underlined, then is committed or cancelled), into the edit box of a
        // block or into the text
        if (!cdp) return;
        const parts = (s.parts as string[]) ?? [];
        let before: string | null = null;
        if (s.target === "box") {
          if (!blocks || !(await clickBlock(s.a))) return;
          // (a click on a leaf opens its box at once; Enter opens the box of the others, or none)
          if (!(await boxOpen().count())) await press("Enter");
          if (!(await boxOpen().count())) return;
          await page.keyboard.press("ControlOrMeta+a");
          // (the scroll that the click on the block set going ends first: a scroll update of the editor in the middle of the composition
          // takes the focus from the box, and the next parts of the composition reach the editor's own text, which then never sees it end.
          // A real input method keeps its element. Seed 5561 of round 8)
          await settle();
          await page.waitForTimeout(150);
          if (!(await boxOpen().count())) return;
        } else {
          if (blocks) await toggleAndSettle();
          if ((await mode()) !== "text") return;
          await caretAt(s.a);
          before = await text();
        }
        for (const p of parts) {
          // (the composition goes to the element that has the focus: if the box lost it, there is no composition to go on with)
          if (
            s.target === "box" &&
            !(await evaluate(() =>
              document.activeElement?.classList.contains("blocks-edit")
            ))
          )
            break;
          await cdp.send("Input.imeSetComposition", {
            text: p,
            selectionStart: p.length,
            selectionEnd: p.length,
          });
        }
        if (s.cancel)
          await cdp.send("Input.imeSetComposition", {
            text: "",
            selectionStart: 0,
            selectionEnd: 0,
          });
        else {
          await cdp.send("Input.insertText", { text: String(s.final) });
          // (Chrome does not end the composition when the committed text is the text that is being composed ("12" after "12"): no
          // compositionend comes, and CodeMirror goes on composing, keeps the lines under it as they are and draws no block over them, whatever
          // comes next. A real input method always ends it: the step does what it does. Seed 604858 of round 12)
          await evaluate(() => {
            const ed = (window as any).demo.ed;
            if (ed.view.composing)
              (document.activeElement ?? ed.view.contentDOM).dispatchEvent(
                new CompositionEvent("compositionend", {
                  data: "",
                  bubbles: true,
                })
              );
          });
        }
        if (s.target === "box") {
          if (await boxOpen().count())
            await page.keyboard.press(s.accept ? "Enter" : "Escape");
        } else {
          // (a composition in the text is an edit even when it ends where it began: CodeMirror writes the composed text and takes it out again,
          // and the editor drops the history when the text that was edited comes back to blocks. Seed 3429 of round 8)
          if (before !== null) textEditedInText = true;
          if (s.back) await returnToBlocks();
        }
        editsMade++;
        return;
      }
      case "clipboard": {
        // the real clipboard: a copy or cut by key of the focused block or of selected blocks, what the system clipboard then holds, and a
        // paste by key
        // (a click on a leaf opens its edit box: Escape closes it, the block keeps the focus, and the keys go to the block again)
        const focusBlock = async (a: number): Promise<boolean> => {
          if (!(await clickBlock(a))) return false;
          if (await boxOpen().count()) await page.keyboard.press("Escape");
          return true;
        };
        if (!blocks || !(await focusBlock(Number(s.a)))) return;
        const n = Number(s.n);
        if (n > 1) {
          await page.keyboard.press("Space");
          for (let k = 1; k < n; k++)
            if (await focusBlock((Number(s.a) + k * 0.137) % 1))
              await page.keyboard.press("Space");
        }
        const sentinel = "\u0001soak";
        const canRead =
          (await writeClip(sentinel)) && (await readClip()) === sentinel;
        // (what a copy takes: the selected blocks, else the focused one; a cut takes only the selected ones)
        const expected: string | null = await evaluate((cut: boolean) => {
          const ed = (window as any).demo.ed;
          const sel = ed.selectedBlocks();
          const f = ed.focusedNode();
          const nodes = sel.length ? sel : f && f.slot && !cut ? [f] : [];
          return nodes.length ? ed.copyTexts(nodes).join("\n") : null;
        }, s.how === "cut");
        const before = await text();
        await press(s.how === "cut" ? "Mod+x" : "Mod+c");
        await page.waitForTimeout(30);
        // (with no block selected, and none focused for a copy, the blocks layer does nothing and the browser's own line-wise copy and cut run, as
        // in the old editor and CodeMirror 5: the clipboard then holds the caret's line, whatever it is, and a cut removes that line: only the
        // blocks' own copies are checked)
        if (canRead && expected !== null && !skip.has("clipboard")) {
          const got = await readClip();
          const want = expected;
          if (got !== want)
            throw new Finding(
              "clipboard",
              `${s.how} left ${JSON.stringify(String(got).slice(0, 60))} on the clipboard, not ${JSON.stringify(want.slice(0, 60))}`
            );
        }
        if (
          s.how === "copy" &&
          !skip.has("clipboard") &&
          (await text()) !== before
        )
          throw new Finding("clipboard", "a copy changed the program");
        if (s.how === "cut" && (expected !== null || (await text()) !== before))
          editsMade++;
        if (!canRead && !expected) return;
        if (s.to === "gap") {
          const placed = await evaluate((a: any) => {
            const ed = (window as any).demo.ed;
            ed.view.focus();
            const len = ed.view.state.doc.length;
            let pos = Math.min(len, Math.floor(a.b * (len + 1)));
            while (pos <= len && !ed.isWhitespaceAt(pos)) pos++;
            if (pos > len) return false;
            ed.view.dispatch({ selection: { anchor: pos } });
            return true;
          }, s as any);
          if (!placed) return;
        } else {
          if (!(await clickBlock(s.b))) return;
          if (s.to === "over") await page.keyboard.press("Space");
        }
        await press("Mod+v");
        await page.waitForTimeout(30);
        if (await page.locator(".blocks-pending .blocks-edit").count())
          await page.keyboard.press(s.accept ? "Enter" : "Escape");
        editsMade++;
        return;
      }
      case "undoRun":
        for (let k = 0; k < Number(s.n); k++)
          await press(s.redo ? "Mod+Shift+z" : "Mod+z");
        return;
      case "collapseBurst": {
        if (!blocks) return;
        for (let k = 0; k < Number(s.n); k++)
          if (await clickBlock((Number(s.a) + k * 0.137) % 1))
            await press(s.on ? "ArrowLeft" : "ArrowRight");
        return;
      }
      case "collapseAllThen":
        if (!blocks) return;
        await press(s.on ? "Shift+ArrowLeft" : "Shift+ArrowRight");
        await exec({
          op: "editBox",
          a: s.a,
          text: s.text,
          accept: s.accept,
        });
        return;
      case "multiSelect": {
        if (!blocks) return;
        let n = 0;
        for (let k = 0; k < Number(s.n); k++)
          if (await clickBlock((Number(s.a) + k * 0.137) % 1)) {
            await page.keyboard.press("Space");
            n++;
          }
        if (!n) return;
        if (s.then === "delete") await press("Delete");
        else {
          await press(s.then === "copyPaste" ? "Mod+c" : "Mod+x");
          if (await clickBlock(s.b)) await press("Mod+v");
        }
        editsMade++;
        return;
      }
      case "commentNear": {
        if (!blocks) return;
        // (the block next to a comment: the fraction that picks it among the drawn blocks)
        const f2: number = await evaluate((a: any) => {
          const its = Array.from(
            document.querySelectorAll(".cm-content [role=treeitem]")
          );
          const cs = its
            .map((e, i) => (e.classList.contains("blocks-comment") ? i : -1))
            .filter((i) => i >= 0);
          if (!cs.length) return a.a;
          const c = cs[Math.min(cs.length - 1, Math.floor(a.a * cs.length))];
          const i = Math.max(0, Math.min(its.length - 1, c + a.dir));
          return (i + 0.5) / its.length;
        }, s as any);
        if (!(await clickBlock(f2))) return;
        await page.keyboard.press("Control+Shift+BracketRight");
        await fillBox(String(s.text), !!s.accept);
        editsMade++;
        return;
      }
      case "pasteMulti":
        await exec({ ...s, op: "topLevelType", how: "paste" });
        return;
      case "insertText":
        if (blocks)
          await evaluate((a: any) => {
            const ed = (window as any).demo.ed;
            const slots: any[] = [];
            const walk = (n: any) => {
              n.slots.forEach((q: any) => {
                if (q.kind === "list" && !q.pieces) slots.push(q);
                q.nodes.forEach(walk);
              });
            };
            ed.roots().forEach(walk);
            if (!slots.length) return;
            const q =
              slots[Math.min(slots.length - 1, Math.floor(a.a * slots.length))];
            try {
              ed.insertText(q, Math.floor(a.b * (q.nodes.length + 1)), a.text);
            } catch (e) {
              if (!/cannot|closing bracket|refus|inside/i.test(String(e)))
                throw e;
            }
          }, s as any);
        editsMade++;
        return;
      case "removeNode":
        if (blocks)
          await evaluate((a: any) => {
            const ed = (window as any).demo.ed;
            const lists: any[] = [];
            const walk = (n: any) => {
              n.slots.forEach((q: any) => {
                if (q.kind === "list" && q.nodes.length) lists.push(q);
                q.nodes.forEach(walk);
              });
            };
            ed.roots().forEach(walk);
            if (!lists.length) return;
            const q =
              lists[Math.min(lists.length - 1, Math.floor(a.a * lists.length))];
            ed.removeNode(
              q.nodes[
                Math.min(q.nodes.length - 1, Math.floor(a.b * q.nodes.length))
              ]
            );
          }, s as any);
        editsMade++;
        return;
      case "replaceDoc":
        await evaluate((t: string) => {
          const v = (window as any).demo.ed.view;
          v.dispatch({
            changes: { from: 0, to: v.state.doc.length, insert: t },
            // (CodeMirror maps a selection that lies inside the replaced text to a range that ends before it starts, and the editor's own
            // Delete then throws: a host that replaces the document sets the selection, as the jsdom runner does)
            selection: { anchor: 0 },
          });
        }, String(s.text));
        editsMade++;
        return;
      default:
        throw new Error(`unknown step ${s.op}`);
    }
  };
  const rushedFor = (s: Step): boolean =>
    seq.motion === "full" && Number(s.rush ?? 1) < 0.35;

  // ---- the invariants ----
  const axProblems = async (): Promise<string[]> => {
    const { nodes } = (await cdp!.send("Accessibility.getFullAXTree")) as {
      nodes: any[];
    };
    const byId = new Map(nodes.map((n) => [n.nodeId, n]));
    const prop = (n: any, k: string) =>
      n.properties?.find((p: any) => p.name === k)?.value.value;
    const tree = nodes.find((n) => n.role?.value === "tree");
    const out: string[] = [];
    if (!tree) return ["no tree in the accessibility tree"];
    const walk = (n: any, depth: number): void => {
      if (!n) return;
      let d = depth;
      if (!n.ignored && n.role?.value === "treeitem") {
        d = depth + 1;
        if (!n.name?.value) out.push("a treeitem has no name");
        if (prop(n, "level") !== d)
          out.push(
            `treeitem level ${prop(n, "level")} but nesting depth ${d} @ ${n.name?.value}`
          );
      }
      for (const c of n.childIds ?? []) walk(byId.get(c), d);
    };
    for (const c of tree.childIds ?? []) walk(byId.get(c), 0);
    return out.slice(0, 5);
  };
  const heightProblems = (): Promise<string[]> =>
    evaluate(() => {
      const view = (window as any).demo.ed.view;
      const out: string[] = [];
      // (an editor with no visible area, a zoomed window whose toolbar fills it: CodeMirror does not measure what nobody sees, and measures it
      // when it is seen again; nothing to compare)
      if (!view.inView) return out;
      for (const el of Array.from(
        view.contentDOM.querySelectorAll(":scope > .cm-line")
      ) as HTMLElement[]) {
        let pos: number;
        try {
          pos = view.posAtDOM(el, 0);
        } catch (_) {
          continue;
        }
        const b = view.lineBlockAt(pos);
        if (b.height === 0) continue;
        const h = el.getBoundingClientRect().height;
        if (Math.abs(h - b.height) > 1.5)
          out.push(
            `the line at ${pos} is ${h.toFixed(1)} px high, CodeMirror holds ${b.height.toFixed(1)}`
          );
      }
      return out.slice(0, 3);
    });
  const lineNumberProblems = (): Promise<string[]> =>
    evaluate(() => {
      const ed = (window as any).demo.ed;
      const view = ed.view;
      const out: string[] = [];
      // (an editor with no visible area, a zoomed window whose toolbar fills it: CodeMirror does not measure what nobody sees, and measures it
      // when it is seen again; nothing to compare)
      if (!view.inView) return out;
      const els = Array.from(
        view.dom.querySelectorAll(".cm-lineNumbers .cm-gutterElement")
      ) as HTMLElement[];
      for (const e of els) {
        if (!/^\d+$/.test(e.textContent ?? "") || e.offsetHeight <= 0) continue;
        const n = Number(e.textContent);
        if (n > view.state.doc.lines) {
          out.push(
            `line number ${n} but the document has ${view.state.doc.lines} lines`
          );
          continue;
        }
        const g = e.getBoundingClientRect();
        const line = view.state.doc.line(n);
        let dom: any;
        try {
          dom = view.domAtPos(line.from);
        } catch (_) {
          continue;
        }
        const lineEl = (
          dom.node.nodeType === 3 ? dom.node.parentElement : dom.node
        )?.closest?.(".cm-line") as HTMLElement | null;
        let first = lineEl?.querySelector(
          ".blocks-node, .blocks-comment, .blocks-edit"
        ) as HTMLElement | null;
        // (a line that starts with text, such as the `else` of a Python `else:` whose body is a block, or the indentation of a root that
        // the parser read after a bad dedent, has its number beside that text, not beside the block, which a block-level widget puts on the
        // line below it: the checker measures the line then)
        if (lineEl && first) {
          const r = document.createRange();
          r.setStart(lineEl, 0);
          r.setEndBefore(first);
          if (r.toString() !== "") first = null;
        }
        const box = (first ?? lineEl)?.getBoundingClientRect();
        if (!box || !box.height) continue;
        if (Math.abs(g.top - box.top) > 2)
          out.push(
            `line ${n}: its number is ${Math.round(g.top)} px from the top, its first block ${Math.round(box.top)}`
          );
      }
      return out.slice(0, 3);
    });

  const check = async (
    stepIndex: number,
    op: string
  ): Promise<Violation | null> => {
    const v = (invariant: string, message: string): Violation | null =>
      skip.has(invariant) ? null : { invariant, message, step: stepIndex, op };
    if (errors.length) {
      const hit = v("exception", errors.splice(0).join(" | "));
      if (hit) return hit;
    }
    const m = await mode();
    if (m === "blocks") {
      const problems: string[] = await evaluate(() =>
        (window as any).demo.check()
      );
      if (problems.length) {
        const hit = v("consistency", problems.slice(0, 3).join(" | "));
        if (hit) return hit;
      }
      const sel: string | null = await evaluate(() => {
        const ed = (window as any).demo.ed;
        const live = new Set<any>();
        const walk = (n: any) => {
          live.add(n);
          n.slots.forEach((q: any) => q.nodes.forEach(walk));
        };
        ed.roots().forEach(walk);
        const bad = ed.selection().find((n: any) => !live.has(n));
        if (bad)
          return `a selected ${bad.kind} [${bad.from},${bad.to}) is not in the tree`;
        const f = ed.focusedNode();
        return f && !live.has(f)
          ? `the focused ${f.kind} [${f.from},${f.to}) is not in the tree`
          : null;
      });
      if (sel) {
        const hit = v("selection", sel);
        if (hit) return hit;
      }
      const a11y = await evaluate(a11yProblems);
      if (a11y.length) {
        const hit = v("a11y", a11y.join(" | "));
        if (hit) return hit;
      }
      if (stepIndex % 3 === 0 && cdp) {
        const ax = await axProblems();
        if (ax.length) {
          const hit = v("a11y", `accessibility tree: ${ax.join(" | ")}`);
          if (hit) return hit;
        }
      }
    }
    // (CodeMirror measures the gutter a frame after a change: look again a few times before calling it wrong)
    let ln = await lineNumberProblems();
    for (let k = 0; k < 5 && ln.length; k++) {
      await page.waitForTimeout(120);
      await settle();
      ln = await lineNumberProblems();
    }
    if (ln.length) {
      const hit = v("line-numbers", ln.join(" | "));
      if (hit) return hit;
    }
    // (the heights CodeMirror holds for the lines it draws are the page's: a wrapped line, a zoom or a window of another width that it
    // has not measured again leaves it scrolling and drawing from numbers that are wrong, with the gutter still beside the lines)
    let hp = await heightProblems();
    for (let k = 0; k < 5 && hp.length; k++) {
      await page.waitForTimeout(120);
      await settle();
      hp = await heightProblems();
    }
    if (hp.length) {
      const hit = v("heights", hp.join(" | "));
      if (hit) return hit;
    }
    if (await evaluate(() => !!document.activeElement?.closest(".cm-editor")))
      armed = true;
    if (armed) {
      const fp = await evaluate(focusProblem as any, toolbarOk);
      if (fp) {
        const hit = v("focus", String(fp));
        if (hit) return hit;
      }
    }
    return null;
  };

  /** one step with its timeout; the exceptions that are not the editor's become "stuck" only when the page does not answer */
  const guarded = async (s: Step, i: number): Promise<Violation | null> => {
    const timer = new Promise<"timeout">((r) =>
      setTimeout(() => r("timeout"), stepMs)
    );
    try {
      const r = await Promise.race([exec(s).then(() => "ok" as const), timer]);
      if (r === "timeout")
        return {
          invariant: "stuck",
          message: `the step took more than ${stepMs} ms`,
          step: i,
          op: s.op,
        };
    } catch (e) {
      const msg = String((e as Error).message ?? e).split("\n")[0];
      if (e instanceof Finding)
        return { invariant: e.invariant, message: msg, step: i, op: s.op };
      if (await frozen())
        return {
          invariant: "stuck",
          message: `the page does not answer (${msg})`,
          step: i,
          op: s.op,
        };
      if (
        !/Timeout|not visible|detached|intercepts|not attached|outside of the viewport|Target page|Execution context|navigat/i.test(
          msg
        )
      )
        return { invariant: "exception", message: msg, step: i, op: s.op };
    }
    return null;
  };

  try {
    await settle();
    let lastMode = await mode();
    const noteReturnToBlocks = async (): Promise<void> => {
      const m = await mode();
      if (m === "blocks" && lastMode === "text" && textEditedInText) {
        historyReset = true;
        textEditedInText = false;
      }
      lastMode = m;
    };
    const initial = await text();
    const first = await check(-1, "initial");
    if (first) return close(first);
    for (let i = 0; i < seq.steps.length; i++) {
      const s = seq.steps[i];
      // (the editor's rule: going back to blocks after the text was edited in text mode starts the undo history over, and ONLY then. A
      // step that begins in text mode and leaves another text is an edit made as text, whatever it was (typing, a replaced document, an
      // undo, a paste); the return to blocks may come after the step (a switch in the middle of the morph): the mode is read after each
      // step, rushed or not, and at the end)
      const m0 = await mode();
      const t0 = m0 === "text" ? await text() : "";
      const g = await guarded(s, i);
      if (g) return close(g);
      if (m0 === "text" && (await text()) !== t0) textEditedInText = true;
      await noteReturnToBlocks();
      if (!rushed) await settle();
      await noteReturnToBlocks();
      if (rushed) continue; // (the next step is made in the middle of the morph; the invariants are read after that one)
      await o.onStep?.(page, i);
      const v = await check(i, s.op);
      if (v) return close(v);
    }
    await settle();
    await noteReturnToBlocks();
    // ---- undo everything, redo everything (not after a return to blocks that cleared the history: textEditedInText says so) ----
    if (
      editsMade > 0 &&
      editsMade < 90 &&
      !historyReset &&
      !textEditedInText &&
      !skip.has("undo-all")
    ) {
      const final = await text();
      if (await boxOpen().count()) await page.keyboard.press("Escape");
      // (the message of a refused switch to blocks is a modal dialog: the page is inert, the keys of the undo would go nowhere. It is
      // the step's own state, not the editor's: close it first)
      for (
        let k = 0;
        k < 3 && (await page.locator("[role=dialog]").count());
        k++
      ) {
        await page.locator("[role=dialog] .closeDialog").first().click();
        await page.waitForTimeout(50);
      }
      await evaluate(() => {
        const ed = (window as any).demo.ed;
        if (ed.mode === "blocks") ed.focusEditor();
        else ed.view.focus();
        // (a program with no block to focus, such as one that is only text that did not parse: the keys go to the text)
        if (!document.activeElement?.closest(".cm-editor")) ed.view.focus();
      });
      let presses = 0;
      let same = 0;
      let last = final;
      while (presses < 150 && same < 4) {
        await page.keyboard.press("ControlOrMeta+z");
        presses++;
        const t = await text();
        same = t === last ? same + 1 : 0;
        last = t;
        if (t === initial) break;
      }
      if (last !== initial)
        return close({
          invariant: "undo-all",
          message: `undoing every step left ${JSON.stringify(last.slice(0, 80))}, not the start ${JSON.stringify(initial.slice(0, 80))}${firstDifference(last, initial)}`,
          step: seq.steps.length,
          op: "undo-all",
        });
      for (let k = 0; k < presses; k++)
        await page.keyboard.press("ControlOrMeta+Shift+z");
      const after = await text();
      // (a sequence that undid something itself has a redo history of its own: redoing as many as were pressed then reaches another state)
      const ownUndo = seq.steps.some(
        (s) =>
          s.op === "undo" ||
          s.op === "redo" ||
          s.op === "undoRun" ||
          /^Mod\+(z|y|Shift\+z)$/i.test(String(s.key ?? ""))
      );
      if (!ownUndo && after !== final)
        return close({
          invariant: "redo-all",
          message: `redoing everything left ${JSON.stringify(after.slice(0, 80))}, not ${JSON.stringify(final.slice(0, 80))}${firstDifference(after, final)}`,
          step: seq.steps.length,
          op: "redo-all",
        });
      const v = await check(seq.steps.length, "after undo/redo");
      if (v) return close(v);
    }
    return close(null);
  } catch (e) {
    return close({
      invariant: "exception",
      message: `the harness: ${String((e as Error).message).split("\n")[0]}`,
      step: -1,
      op: "harness",
    });
  }
}

export interface ChromiumRecord extends Sequence {
  invariant: string;
  message: string;
  step: number;
  op: string;
  originalSteps: number;
  browser?: string;
}

/** run seed `seed`; on a violation, shrink the steps (same invariant, a few tries: each is a browser session) and return the record */
export async function soakSeedChromium(
  browser: Browser,
  seed: number,
  nSteps: number,
  o: ChromiumOptions & {
    language?: Sequence["language"];
    shrinkRuns?: number;
    motion?: boolean;
  }
): Promise<ChromiumRecord | null> {
  const seq = makeSequence("chromium", seed, nSteps, o);
  // (a step that rushes the morph needs the fraction `rush`: make it from the seed's own numbers)
  seq.steps.forEach((s, i) => {
    if (s.op === "toggleMode" && s.rush === undefined)
      s.rush = ((seed * 31 + i * 17) % 100) / 100;
  });
  const v = await runChromium(browser, seq, o);
  if (!v) return null;
  let steps =
    v.step >= 0 && v.step < seq.steps.length
      ? seq.steps.slice(0, v.step + 1)
      : seq.steps;
  let found = v;
  steps = await shrink(
    steps,
    async (cand) => {
      const c = await runChromium(browser, { ...seq, steps: cand }, o);
      if (c && c.invariant === v.invariant) found = c;
      return !!c && c.invariant === v.invariant;
    },
    o.shrinkRuns ?? 12
  );
  return {
    ...seq,
    steps,
    ...found,
    originalSteps: seq.steps.length,
    // (the browser the failure was found in: a replay needs CMB6_SOAK_BROWSER to be the same)
    browser: browser.browserType().name(),
  };
}
