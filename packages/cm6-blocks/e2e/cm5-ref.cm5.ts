// Throwaway: screenshots of the existing CodeMirror 5 editor in block mode (run with cm5-ref.config.ts, see there).
import { test } from "@playwright/test";
import * as fs from "fs";

import { SAMPLE, STATES } from "./scheme-sample";

async function shot(page: any, code: string, out: string) {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).cmb, { timeout: 20000 });
  await page.evaluate((c: string) => { (window as any).cmb.setValue(c); (window as any).cmb.clearHistory(); }, code);
  await page.getByRole("button", { name: /switch to blocks mode/i }).click();
  await page.getByRole("treeitem").first().waitFor();
  await page.waitForTimeout(800);
  await page.screenshot({ path: out });
}

test("cm5 reference: sample", async ({ page }) => {
  await shot(page, SAMPLE, "packages/cm6-blocks/e2e/screens/scheme-cm5.png");
});
test("cm5 reference: ast-test.rkt", async ({ page }) => {
  const code = fs.readFileSync("packages/wescheme-blocks/dev-server/ast-test.rkt", "utf8");
  await shot(page, code, "packages/cm6-blocks/e2e/screens/scheme-large-cm5.png");
});

// states: focused (f), selected (g, with Space), collapsed (h, with Left), a blank (k); then the comment of x shown while x has focus; then an edit box
async function states(page: any, prefix: string) {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).cmb, { timeout: 20000 });
  await page.evaluate((c: string) => { (window as any).cmb.setValue(c); (window as any).cmb.clearHistory(); }, STATES);
  await page.getByRole("button", { name: /switch to blocks mode/i }).click();
  await page.getByRole("treeitem").first().waitFor();
  await page.waitForTimeout(500);
  const g = page.locator(".react-container > .blocks-node").filter({ has: page.locator('.blocks-literal-symbol:text-is("g")') }).first();
  await g.evaluate((e: HTMLElement) => e.focus());
  await page.keyboard.press("Space");
  const h = page.locator(".react-container > .blocks-node").filter({ has: page.locator('.blocks-literal-symbol:text-is("h")') }).first();
  await h.evaluate((e: HTMLElement) => e.focus());
  await page.keyboard.press("ArrowLeft");
  const f = page.locator(".react-container > .blocks-node").filter({ has: page.locator('.blocks-literal-symbol:text-is("f")') }).first();
  await f.evaluate((e: HTMLElement) => e.focus());
  await page.waitForTimeout(700);
  await page.screenshot({ path: `packages/cm6-blocks/e2e/screens/${prefix}-states-cm5.png` });
  const x = page.locator(".blocks-variableDefinition").first();
  await x.evaluate((e: HTMLElement) => e.focus());
  await page.waitForTimeout(700);
  await page.screenshot({ path: `packages/cm6-blocks/e2e/screens/${prefix}-comment-cm5.png` });
  const n = page.locator(".react-container > .blocks-node").filter({ has: page.locator('.blocks-literal-number:text-is("2")') }).first().locator(".blocks-literal").first();
  await n.evaluate((e: HTMLElement) => e.focus());
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
  await page.screenshot({ path: `packages/cm6-blocks/e2e/screens/${prefix}-edit-cm5.png` });
}
test("cm5 reference: states", async ({ page }) => {
  await states(page, "scheme");
});
