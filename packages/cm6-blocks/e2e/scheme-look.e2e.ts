// Screenshots of this package's Scheme blocks for the look comparison with the existing editor (scheme-cm5.png: see cm5-ref.e2e.ts).
import { test } from "@playwright/test";
import * as fs from "fs";
import { SAMPLE } from "./scheme-sample";

test.use({ viewport: { width: 1100, height: 1300 } });

async function shot(page: import("@playwright/test").Page, code: string, out: string) {
  await page.goto("/index.html?lang=scheme");
  await page.waitForSelector(".cm-content .blocks-node");
  await page.evaluate((c: string) => (window as any).demo.show(c), code);
  await page.waitForSelector(".cm-content .blocks-node");
  await page.waitForTimeout(500);
  await page.screenshot({ path: out });
}

test("scheme look: sample", async ({ page }) => {
  await shot(page, SAMPLE, "packages/cm6-blocks/e2e/screens/scheme-cm6.png");
});
test("scheme look: ast-test.rkt", async ({ page }) => {
  await shot(page, fs.readFileSync("packages/wescheme-blocks/dev-server/ast-test.rkt", "utf8"), "packages/cm6-blocks/e2e/screens/scheme-large-cm6.png");
});
