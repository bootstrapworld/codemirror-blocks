import { expect, Page, test } from "@playwright/test";
import {
  MOD,
  dragWithMouse,
  expectConsistent,
  openInBlockMode,
  snapshot,
  trashCan,
} from "./helpers";

/**
 * A short random sequence of real user operations (spec/random-sequences-test.ts
 * is the long jsdom version). After every step the text must still parse to the
 * AST and keyboard focus must be somewhere the editor hears it; at the end,
 * undoing everything must give back the starting text and redoing everything
 * the final text. A failure names the seed and lists the steps so far.
 *
 * Set CMB_E2E_SEEDS (a comma-separated list) to try other seeds.
 */

const SEEDS = (process.env.CMB_E2E_SEEDS ?? "1,2,3,4,5,6,7")
  .split(",")
  .map((s) => Number(s.trim()));
// (each step makes at most one undo step, and undoAll() presses undo ten times)
const STEPS = 9;
const PROGRAM = "(f x y)\n(g (h 1 2) z)\nw";
const TEXTS = ["zzz", "7", "(k 1)", "foo bar"];

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

const setClipboard = (page: Page, text: string) =>
  page.evaluate((t) => navigator.clipboard.writeText(t), text);

/** The blocks a user can see and click right now */
const blocks = (page: Page) => page.getByRole("treeitem");

/** Click a block's own padding (selects it without editing its text) */
const pick = async (page: Page, index: number) => {
  const b = blocks(page).nth(index);
  // (the label has to be read first: the click can change the blocks)
  const label =
    (await b.getAttribute("aria-label", { timeout: 5000 })) ?? "a block";
  await b.click({ position: { x: 4, y: 4 }, timeout: 5000 });
  return label;
};

const isEditing = (page: Page) =>
  page.evaluate(
    () => document.activeElement?.getAttribute("contenteditable") === "true"
  );

type Step = (page: Page, n: number[]) => Promise<string>;
const steps: Record<string, Step> = {
  "expand everything": async (page, n) => {
    const label = await pick(page, n[0] % (await blocks(page).count()));
    await page.keyboard.press("Shift+ArrowRight");
    return `expand all from ${label}`;
  },
  delete: async (page, n) => {
    const label = await pick(page, n[0] % (await blocks(page).count()));
    await page.keyboard.press("Space");
    await page.keyboard.press("Delete");
    return `select and delete ${label}`;
  },
  cut: async (page, n) => {
    const label = await pick(page, n[0] % (await blocks(page).count()));
    await page.keyboard.press("Space");
    await page.keyboard.press(`${MOD}+x`);
    return `select and cut ${label}`;
  },
  "paste over": async (page, n) => {
    const text = TEXTS[n[1] % TEXTS.length];
    await setClipboard(page, text);
    const label = await pick(page, n[0] % (await blocks(page).count()));
    await page.keyboard.press("Space");
    await page.keyboard.press(`${MOD}+v`);
    return `paste "${text}" over ${label}`;
  },
  "paste beside": async (page, n) => {
    const text = TEXTS[n[1] % TEXTS.length];
    await setClipboard(page, text);
    const label = await pick(page, n[0] % (await blocks(page).count()));
    await page.keyboard.press(`${MOD}+v`);
    return `paste "${text}" after ${label}`;
  },
  "edit in place": async (page, n) => {
    const label = await pick(page, n[0] % (await blocks(page).count()));
    await page.keyboard.press("Enter");
    if (!(await isEditing(page))) return `Enter on ${label} (not editable)`;
    const text = TEXTS[n[1] % TEXTS.length];
    await page.keyboard.press(`${MOD}+a`);
    await page.keyboard.type(text);
    await page.keyboard.press("Enter");
    return `edit ${label} to "${text}"`;
  },
  "insert beside": async (page, n) => {
    const label = await pick(page, n[0] % (await blocks(page).count()));
    await page.keyboard.press("Control+]");
    if (!(await isEditing(page))) return `Ctrl-] on ${label} (no gap)`;
    const text = TEXTS[n[1] % TEXTS.length];
    await page.keyboard.type(text);
    await page.keyboard.press("Enter");
    return `insert "${text}" after ${label}`;
  },
  "type at the top level": async (page, n) => {
    const first = blocks(page).first();
    const box = await first.boundingBox();
    if (!box) return "no block to click beside";
    await page.mouse.click(box.x + box.width + 80, box.y + box.height / 2);
    await page.keyboard.type("9");
    await page.keyboard.press(n[0] % 2 ? "Enter" : "Escape");
    return `type 9 beside the first block, ${n[0] % 2 ? "commit" : "cancel"}`;
  },
  "drag to the trash can": async (page, n) => {
    const index = n[0] % (await blocks(page).count());
    const b = blocks(page).nth(index);
    const label =
      (await b.getAttribute("aria-label", { timeout: 5000 })) ?? "a block";
    await dragWithMouse(page, b, trashCan(page));
    return `drag ${label} to the trash can`;
  },
  undo: async (page) => {
    await page.keyboard.press(`${MOD}+z`);
    return "undo";
  },
  redo: async (page) => {
    await page.keyboard.press(`${MOD}+y`);
    return "redo";
  },
};
const names = Object.keys(steps);

async function runSequence(page: Page, seed: number) {
  await openInBlockMode(page, PROGRAM);
  const start = (await snapshot(page)).text;
  const random = seededRandom(seed);
  const log: string[] = [];
  // an uncaught exception in the page (the dev server then covers it with an
  // overlay that takes keyboard focus)
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(String(error.stack)));

  try {
    for (let i = 0; i < STEPS; i++) {
      await page.waitForTimeout(150); // let React and CodeMirror finish
      if ((await blocks(page).count()) === 0) break; // nothing left to do
      const name = names[Math.floor(random() * names.length)];
      const n = [0, 1, 2].map(() => Math.floor(random() * 1_000_000));
      const what = await steps[name](page, n);
      log.push(what);
      expect(pageErrors, "uncaught errors in the page").toEqual([]);
      const now = await expectConsistent(page);
      log[log.length - 1] =
        `${what}\n       text: ${JSON.stringify(now.text)} (undo ${now.history.undo}, redo ${now.history.redo})`;
    }
    // a quarantine or edit left open would make undo type into it
    await page.keyboard.press("Escape");
    // walk the history one way, a step at a time, letting each one settle
    const walk = async (which: "undo" | "redo") => {
      for (let i = 0; i < 20; i++) {
        if ((await snapshot(page)).history[which] === 0) return;
        await page.keyboard.press(`${MOD}+${which === "undo" ? "z" : "y"}`);
        await page.waitForTimeout(150);
        expect(pageErrors, "uncaught errors in the page").toEqual([]);
        const now = await expectConsistent(page);
        const { tag, role, id } = now.focus;
        log.push(
          `${which}\n       text: ${JSON.stringify(now.text)} (undo ${now.history.undo}, redo ${now.history.redo}; focus on <${tag.toLowerCase()}${role ? ` role=${role}` : ""}${id ? ` id=${id}` : ""}>)`
        );
      }
    };
    await walk("redo");
    const end = (await expectConsistent(page)).text;
    await walk("undo");
    expect((await expectConsistent(page)).text).toBe(start);
    await walk("redo");
    expect((await expectConsistent(page)).text).toBe(end);
  } catch (e) {
    throw new Error(
      `seed ${seed} failed after ${log.length} steps:\n  ${log.join("\n  ")}\n\n${e}`
    );
  }
}

for (const seed of SEEDS) {
  test(`random sequence, seed ${seed}`, ({ page }) => runSequence(page, seed));
}

// KNOWN BUG, found by this seed (and present before the fixes made alongside
// this suite): after a real-mouse drag of a block to the trash can, keyboard
// focus is left on CodeMirror's scroller (<div role="presentation">), so every
// later Ctrl-Z is ignored and the history can't be walked back. Playwright
// reports this test as failing once the bug is fixed.
test("random sequence, seed 11 (known bug: focus left on the scroller)", async ({
  page,
}) => {
  test.fail();
  await runSequence(page, 11);
});
