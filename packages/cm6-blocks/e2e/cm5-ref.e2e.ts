// Throwaway: screenshots of the existing CodeMirror 5 editor in block mode (run with cm5-ref.config.ts, see there).
import { test } from "@playwright/test";
import * as fs from "fs";

import { SAMPLE } from "./scheme-sample";

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
