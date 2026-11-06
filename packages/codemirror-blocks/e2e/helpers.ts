import { expect, Locator, Page } from "@playwright/test";

/** The part of the example page's `window.cmb` these tests use. */
type Node = { toString(): string };
type Cmb = {
  getValue(): string;
  setValue(text: string): void;
  setCursor(pos: { line: number; ch: number }): void;
  setSelection(
    from: { line: number; ch: number },
    to: { line: number; ch: number }
  ): void;
  getAst(): {
    rootNodes: Node[];
    language: { parse(text: string): Node[] };
  };
  historySize(): { undo: number; redo: number };
  clearHistory(): void;
  lastLine(): number;
  getLine(n: number): string;
  getCM(): {
    scrollTo(x: number | null, y: number | null): void;
    getScrollInfo(): { top: number };
    getWrapperElement(): HTMLElement;
    getAllMarks(): { replacedWith?: HTMLElement }[];
  };
};

/** `Control` everywhere but macOS, where the app listens for `Meta`. */
export const MOD = "ControlOrMeta";

/**
 * Open the example page, put `code` in the editor, and switch to block mode the
 * way a user would (by clicking the toggle button).
 */
export async function openInBlockMode(
  page: Page,
  code: string,
  // (the example page shows another language for `?lang=<id>`)
  language?: string
) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(language ? `/?lang=${language}` : "/");
  // If the example page cannot start (a broken build, say), say so at once
  // and show why, rather than letting every test wait out its own timeout.
  await page
    .waitForFunction(() => !!(window as unknown as { cmb?: unknown }).cmb, {
      timeout: 15_000,
    })
    .catch(() => {
      throw new Error(
        `the example page never created window.cmb. Errors on the page: ${
          errors.join("; ") || "(none)"
        }`
      );
    });
  await page.evaluate((c) => {
    const api = (window as unknown as { cmb: Cmb }).cmb;
    api.setValue(c);
    api.clearHistory();
  }, code);
  await page.getByRole("button", { name: /switch to blocks mode/i }).click();
  await expect(page.getByRole("treeitem").first()).toBeVisible();
}

/** A block, found by the label a screenreader would read out. */
export const block = (page: Page, label: string | RegExp) =>
  page.getByRole("treeitem", { name: label }).first();

export const trashCan = (page: Page) => page.locator(".TrashCan");

export type Snapshot = {
  text: string;
  /** what the editor's AST says the program is */
  roots: string[];
  /** what the text parses to *now*: must equal `roots` */
  reparsed: string[] | string;
  scrollTop: number;
  history: { undo: number; redo: number };
  /** the element that has keyboard focus */
  focus: { tag: string; role: string | null; id: string };
};

export const snapshot = (page: Page): Promise<Snapshot> =>
  page.evaluate(() => {
    const api = (window as unknown as { cmb: Cmb }).cmb;
    const ast = api.getAst();
    let reparsed: string[] | string;
    try {
      reparsed = ast.language.parse(api.getValue()).map((n) => n.toString());
    } catch (e) {
      reparsed = `does not parse: ${e}`;
    }
    const active = document.activeElement;
    return {
      text: api.getValue(),
      roots: ast.rootNodes.map((n) => n.toString()),
      reparsed,
      scrollTop: api.getCM().getScrollInfo().top,
      history: api.historySize(),
      focus: {
        tag: active?.tagName ?? "",
        role: active?.getAttribute("role") ?? null,
        id: active?.id ?? "",
      },
    };
  });

/** Why `s` breaks the properties below, or `null` if it doesn't. */
const problem = (s: Snapshot): string | null => {
  if (JSON.stringify(s.reparsed) !== JSON.stringify(s.roots)) {
    return `the text parses to ${JSON.stringify(s.reparsed)} but the AST is ${JSON.stringify(s.roots)}`;
  }
  if (s.focus.id === "cmb-focus-placeholder") {
    return "keyboard focus is stranded on cmb-focus-placeholder";
  }
  if (s.focus.tag === "BODY") {
    return "keyboard focus fell to the page body";
  }
  return null;
};

/**
 * The properties that must hold after any operation: the AST matches the text,
 * and keyboard focus is somewhere the editor can hear it. React and CodeMirror
 * finish a moment after the key press, so this retries for a short while.
 */
export async function expectConsistent(page: Page) {
  await expect
    .poll(async () => problem(await snapshot(page)), { timeout: 2000 })
    .toBeNull();
  return snapshot(page);
}

/** Press undo (or redo) until the history is empty, like a user mashing the key. */
export async function undoAll(page: Page) {
  for (let i = 0; i < 10; i++) {
    if ((await snapshot(page)).history.undo === 0) return;
    await page.keyboard.press(`${MOD}+z`);
  }
}
export async function redoAll(page: Page) {
  for (let i = 0; i < 10; i++) {
    if ((await snapshot(page)).history.redo === 0) return;
    await page.keyboard.press(`${MOD}+y`);
  }
}

export const center = async (l: Locator) => {
  const b = await l.boundingBox();
  if (!b) throw new Error("element is not visible");
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

/**
 * The center of an element once it has stopped moving. The editor lays itself
 * out for a while after the mode switch (gutters, fonts, re-rendered blocks),
 * and on a slow machine such as a CI runner a target measured too early is
 * somewhere else by the time the mouse gets there.
 */
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
