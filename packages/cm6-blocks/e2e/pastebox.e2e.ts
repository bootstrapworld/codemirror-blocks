// Twentieth round: a real paste that does not parse opens a red box with the message visible under it.
import { test, expect } from "@playwright/test";

/* eslint-disable @typescript-eslint/no-explicit-any */
const MOD = process.platform === "darwin" ? "Meta" : "Control";

test("pasting text that does not parse shows a red box and its message", async ({
  page,
  context,
}) => {
  await context
    .grantPermissions(["clipboard-read", "clipboard-write"])
    .catch(() => {});
  await page.goto("/index.html?lang=scheme");
  await page.waitForSelector(".cm-content .blocks-node");
  await page.evaluate(() => {
    const d = (window as any).demo;
    d.ed.view.dispatch({
      changes: { from: 0, to: d.ed.view.state.doc.length, insert: "(f 1)\n" },
    });
  });
  await page.waitForSelector(".cm-content .blocks-node");
  await page.evaluate(() => navigator.clipboard.writeText("(h 3"));
  await page.evaluate(() => {
    const d = (window as any).demo;
    d.ed.focusNode(d.ed.roots()[0]);
  });
  await page.keyboard.press(`${MOD}+v`);
  const box = page.locator("input.blocks-edit.blocks-error");
  await expect(box).toHaveValue("(h 3");
  const msg = page.locator(".blocks-error-message");
  await expect(msg).toBeVisible();
  await expect(msg).toHaveText(/\S/);
  const color = await msg.evaluate((e) => getComputedStyle(e).color);
  expect(color).toMatch(/^rgb\((1\d\d|2\d\d), \d{1,2}, \d{1,2}\)$/);
  expect(
    await page.evaluate(() => (window as any).demo.ed.view.state.doc.toString())
  ).toBe("(f 1)\n");
  await page.keyboard.press("Escape");
  await expect(box).toHaveCount(0);
});
