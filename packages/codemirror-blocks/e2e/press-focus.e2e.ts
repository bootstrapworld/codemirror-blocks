import { expect, test, type Page } from "@playwright/test";
import {
  MOD,
  block,
  expectConsistent,
  openInBlockMode,
  snapshot,
} from "./helpers";

/**
 * A press on a block gives it keyboard focus, and CodeMirror, handling the same
 * press, may also take focus for its own keyboard buffer (a textarea): the block
 * must still be the one that has focus a moment after the press. Whether the two
 * collide depends on where the press falls among the browser's frames, and on
 * Preact it showed on the first press after several inserts and a delete had
 * been made above the block. So the same thing is done on a fresh page a few
 * times: one press can fall where the collision does not happen.
 */
const code = Array.from(
  { length: 12 },
  (_, i) => `(define (f${i} x) (+ x ${i + 100}))`
).join("\n");
const TRIES = 5;

const press = (page: Page, label: RegExp) =>
  block(page, label).click({ position: { x: 2, y: 2 } });

const focusLabel = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    return el?.getAttribute("aria-label") ?? `<${el?.tagName.toLowerCase()}>`;
  });

/** Paste a new form after the first one, which moves every block below it */
async function insertAtTop(page: Page) {
  await press(page, /^f0:/);
  await page.evaluate(() => navigator.clipboard.writeText("(inserted 1 2)"));
  await page.keyboard.press(`${MOD}+v`);
  await expect
    .poll(async () => (await snapshot(page)).text)
    .toContain("(inserted 1 2)");
  await expectConsistent(page);
}

for (let attempt = 1; attempt <= TRIES; attempt++) {
  test(`a pressed block has keyboard focus, and keeps it, after inserts and a delete above it (${attempt} of ${TRIES})`, async ({
    page,
  }) => {
    await openInBlockMode(page, code);
    for (let i = 0; i < 3; i++) await insertAtTop(page);
    await press(page, /^f0:/);
    await page.keyboard.press("Space");
    await page.keyboard.press("Delete");
    await expectConsistent(page);

    await press(page, /^f11:/);
    await expect.poll(() => focusLabel(page)).toMatch(/^f11:/);
    // (CodeMirror takes focus for its keyboard buffer a moment after the press)
    await page.waitForTimeout(250);
    expect(await focusLabel(page)).toMatch(/^f11:/);
  });
}
