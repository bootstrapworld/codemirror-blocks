/*
 * Ninth round, step 2c: the old e2e/helpers.ts names and signatures over this editor's demo page (`demo/index.html`, `window.demo.ed`). Only what the
 * ported files use. Not built: trashCan (this editor has none), dragWithMouse / dragWithEvents, settledCenter (no use yet).
 */
import { expect, Locator, Page } from "@playwright/test";

/* eslint-disable @typescript-eslint/no-explicit-any */
export const MOD = "ControlOrMeta";

/** The old page's `window.cmb`, in the few methods the old helpers call, over `window.demo.ed` */
const SHIM = () => {
  const d = (window as any).demo;
  const ed = d.ed;
  const doc = () => ed.view.state.doc;
  (window as any).cmb = {
    getValue: () => doc().toString(),
    setValue: (t: string) =>
      ed.view.dispatch({ changes: { from: 0, to: doc().length, insert: t } }),
    clearHistory: () => {},
    // (the page cannot read the undo depth: the text the last setValue left is the floor undoAll stops at)
    base: "",
  };
};

/**
 * Open the demo page, put `code` in the editor (the demo is always in blocks mode: there is no toggle to click). `language` is the demo's `?lang=`
 * (default "scheme").
 */
export async function openInBlockMode(
  page: Page,
  code: string,
  language = "scheme"
) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page
    .context()
    .grantPermissions(["clipboard-read", "clipboard-write"])
    .catch(() => undefined); // (the old config grants it)
  await page.goto(`/index.html?lang=${language}`);
  await page
    .waitForFunction(() => !!(window as any).demo, undefined, {
      timeout: 15_000,
    })
    .catch(() => {
      throw new Error(
        `the demo page never created window.demo. Errors on the page: ${errors.join("; ") || "(none)"}`
      );
    });
  await page.evaluate(SHIM);
  await page.evaluate((c) => {
    (window as any).cmb.setValue(c);
    (window as any).cmb.base = (window as any).cmb.getValue();
  }, code);
  await expect(page.getByRole("treeitem").first()).toBeVisible();
}

/** A block, found by the label a screenreader would read out. (This editor's labels are the table's: `call to f with 1 argument`, not `f expression, 1 input`.) */
export const block = (page: Page, label: string | RegExp) =>
  page.getByRole("treeitem", { name: label }).first();
export const trashCan = (page: Page) => page.locator(".TrashCan");

export type Snapshot = {
  text: string;
  roots: string[];
  reparsed: string[] | string;
  scrollTop: number;
  history: { undo: number; redo: number };
  focus: { tag: string; role: string | null; id: string };
};

export const snapshot = (page: Page): Promise<Snapshot> =>
  page.evaluate(() => {
    const ed = (window as any).demo.ed;
    const roots = ed.roots().map((n: any) => ed.copyText(n));
    const active = document.activeElement;
    return {
      text: ed.view.state.doc.toString(),
      roots,
      reparsed: roots, // (the one tree is the parse: `demo.check()` compares the DOM with a fresh drawing and the tree with the text)
      scrollTop: ed.view.scrollDOM.scrollTop,
      history: { undo: 0, redo: 0 }, // (not available from the page)
      focus: {
        tag: active?.tagName ?? "",
        role: active?.getAttribute("role") ?? null,
        id: active?.id ?? "",
      },
    };
  });

const problem = async (page: Page): Promise<string | null> => {
  const s = await snapshot(page);
  const found: string[] = await page.evaluate(() =>
    (window as any).demo.check()
  );
  if (found.length) return `the editor's own checker says: ${found.join("; ")}`;
  if (s.focus.tag === "BODY") return "keyboard focus fell to the page body";
  return null;
};

/** The properties that must hold after any operation: the tree and the page agree with the text (the editor's checker), and keyboard focus is somewhere the editor can hear it. */
export async function expectConsistent(page: Page) {
  await expect.poll(() => problem(page), { timeout: 2000 }).toBeNull();
  return snapshot(page);
}
/** (the old helpers press until the history is empty; the page cannot say, so a fixed number of presses) */
export async function undoAll(page: Page) {
  // only the test's own edits: stop when the text is the one the program was loaded with
  const atBase = () =>
    page.evaluate(
      () => (window as any).cmb.getValue() === (window as any).cmb.base
    );
  // (a template dropped on the page opens its first hole for typing: the keys then go to the box's own undo, so leave the box first, as a user does)
  if (
    await page.evaluate(() => !!document.activeElement?.matches(".blocks-edit"))
  )
    await page.keyboard.press("Escape");
  for (let i = 0; i < 10 && !(await atBase()); i++)
    await page.keyboard.press(`${MOD}+z`);
}
export async function redoAll(page: Page) {
  for (let i = 0; i < 10; i++) await page.keyboard.press(`${MOD}+Shift+z`);
}
export const center = async (l: Locator) => {
  const b = (await l.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

// (thirteenth round: the old helpers, unchanged; the drag layer listens to pointer events, which the mouse makes)
export const settledCenter = async (l: Locator, timeout = 5000) => {
  const deadline = Date.now() + timeout;
  let last = await center(l);
  for (;;) {
    await l.page().waitForTimeout(80);
    const now = await center(l);
    if (now.x === last.x && now.y === last.y) {
      return now;
    }
    if (Date.now() > deadline) {
      throw new Error("element never stopped moving");
    }
    last = now;
  }
};

/**
 * A native drag with the real mouse: press, move a little to start the drag,
 * then move onto the target and release. Chromium's drag emulation under
 * Playwright is reliable for large targets such as the trash can, but not for
 * small blocks, which is why `dragWithEvents` exists.
 */
export async function dragWithMouse(
  page: Page,
  source: Locator,
  target: Locator
) {
  const s = await center(source);
  const d = await center(target);
  await page.mouse.move(s.x, s.y);
  await page.mouse.down();
  await page.mouse.move(s.x + 6, s.y + 6, { steps: 3 });
  // let the browser start the drag before moving on
  await page.waitForTimeout(60);
  await page.mouse.move(d.x, d.y, { steps: 8 });
  await page.mouse.move(d.x + 1, d.y + 1);
  await page.mouse.move(d.x, d.y);
  // Chromium reports "drag over" to the target on a timer, and a drop is only
  // accepted after the target has seen one, so hover before releasing
  await page.waitForTimeout(200);
  await page.mouse.up();
}

/**
 * Drag with the real mouse to `at` (page coordinates; by default the middle of
 * `target`). The app's drag layer listens to pointer events, which the mouse
 * produces, so this runs the real handlers against a real layout.
 */
export async function dragWithEvents(
  page: Page,
  source: Locator,
  target: Locator,
  at?: { x: number; y: number }
) {
  const s = await settledCenter(source);
  await page.mouse.move(s.x, s.y);
  await page.mouse.down();
  await page.mouse.move(s.x + 6, s.y + 6, { steps: 3 });
  const d = at ?? (await settledCenter(target));
  await page.mouse.move(d.x, d.y, { steps: 8 });
  await page.mouse.up();
}
