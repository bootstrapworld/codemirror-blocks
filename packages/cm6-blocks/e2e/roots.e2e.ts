// scratch: sizes of the root blocks in the demo page (cm6) and the existing editor (cm5, port 8190)
import { test } from "@playwright/test";
import { SAMPLE } from "./scheme-sample";
import * as fs from "fs";
test("roots", async ({ page }) => {
  await page.goto("/index.html?lang=scheme");
  await page.waitForSelector(".cm-content .blocks-node");
  await page.evaluate((c: string) => (window as any).demo.show(c), SAMPLE);
  await page.waitForSelector(".cm-content .blocks-node");
  const six = await page.evaluate(() => Array.from(document.querySelectorAll(".cm-content > .cm-line > .blocks-node")).map((e) => { const r = e.getBoundingClientRect(); return Math.round(r.width * 10) / 10 + "x" + Math.round(r.height * 10) / 10; }));
  await page.goto("http://localhost:8190/");
  await page.waitForFunction(() => !!(window as any).cmb);
  await page.evaluate((c: string) => { (window as any).cmb.setValue(c); }, SAMPLE);
  await page.getByRole("button", { name: /switch to blocks mode/i }).click();
  await page.getByRole("treeitem").first().waitFor();
  await page.waitForTimeout(500);
  const five = await page.evaluate(() => Array.from(document.querySelectorAll(".react-container > .blocks-node, .react-container > .blocks-comment-wrap > .blocks-node")).map((e) => { const r = e.getBoundingClientRect(); return Math.round(r.width * 10) / 10 + "x" + Math.round(r.height * 10) / 10; }));
  fs.writeFileSync("/private/tmp/claude-503/roots.txt", "cm5 " + five.join(" ") + "\ncm6 " + six.join(" ") + "\n");
});
