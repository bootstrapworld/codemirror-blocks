// Screenshots of this package's Scheme blocks for the look comparison with the existing editor (scheme-cm5.png: see cm5-ref.e2e.ts).
import { test } from "@playwright/test";
import * as fs from "fs";
import { SAMPLE, STATES } from "./scheme-sample";

test.use({ viewport: { width: 1100, height: 1300 } });

async function shot(
  page: import("@playwright/test").Page,
  code: string,
  out: string
) {
  await page.goto("/index.html?lang=scheme");
  await page.waitForSelector(".cm-content [role=treeitem]");
  await page.evaluate(
    (c: string) =>
      (window as unknown as { demo: { show(c: string): void } }).demo.show(c),
    code
  );
  await page.waitForSelector(".cm-content [role=treeitem]");
  await page.waitForTimeout(500);
  await page.screenshot({ path: out });
}

test("scheme look: sample", async ({ page }) => {
  await shot(page, SAMPLE, "packages/cm6-blocks/e2e/screens/scheme-cm6.png");
});
test("scheme look: ast-test.rkt", async ({ page }) => {
  await shot(
    page,
    fs.readFileSync("packages/wescheme-blocks/dev-server/ast-test.rkt", "utf8"),
    "packages/cm6-blocks/e2e/screens/scheme-large-cm6.png"
  );
});

// the same states as cm5-ref.cm5.ts: focused (f), selected (g, with Space), collapsed (h, with Left), a blank (k); the comment of x while it has focus; an edit box
test("scheme look: states", async ({ page }) => {
  await page.goto("/index.html?lang=scheme");
  await page.waitForSelector(".cm-content [role=treeitem]");
  await page.evaluate(
    (c: string) =>
      (window as unknown as { demo: { show(c: string): void } }).demo.show(c),
    STATES
  );
  await page.waitForSelector(".cm-content [role=treeitem]");
  const root = (head: string) =>
    page
      .locator(".cm-content > .cm-line > .blocks-node", {
        has: page.locator(`.blocks-literal-symbol:text-is("${head}")`),
      })
      .first();
  await root("g").evaluate((e: HTMLElement) => e.focus());
  await page.keyboard.press("Space");
  await root("h").evaluate((e: HTMLElement) => e.focus());
  await page.keyboard.press("ArrowLeft");
  await root("f").evaluate((e: HTMLElement) => e.focus());
  await page.waitForTimeout(700);
  await page.screenshot({
    path: "packages/cm6-blocks/e2e/screens/scheme-states-cm6.png",
  });
  await page
    .locator(".cm-content > .cm-line > .blocks-define")
    .first()
    .evaluate((e: HTMLElement) => e.focus());
  await page.waitForTimeout(700);
  await page.screenshot({
    path: "packages/cm6-blocks/e2e/screens/scheme-comment-cm6.png",
  });
  await root("g")
    .locator(".blocks-operator .blocks-node")
    .first()
    .evaluate((e: HTMLElement) => e.focus());
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
  await page.screenshot({
    path: "packages/cm6-blocks/e2e/screens/scheme-edit-cm6.png",
  });
});
