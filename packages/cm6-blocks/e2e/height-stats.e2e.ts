// The counters of the height check (`ed.heightStats()`, read by the soak runner): in a real page the check reads the heights after an edit, the
// re-measure of a collapse is counted, and a page whose heights are right makes no repair.
import { test, expect } from "@playwright/test";

/* eslint-disable @typescript-eslint/no-explicit-any */
test("the height check's counters count in a real page", async ({ page }) => {
  await page.goto("/index.html?lang=scheme");
  await page.waitForFunction(() => !!(window as any).demo);
  await page.evaluate(() => {
    const d = (window as any).demo;
    d.show("(f 1\n   (g 2\n      3)\n   4)\n(h 5)\n(k 6)\n");
  });
  await page.waitForTimeout(300);
  const a = await page.evaluate(() => (window as any).demo.ed.heightStats());
  for (const k of [
    "checks",
    "staleCalls",
    "staleTrue",
    "staleMs",
    "remeasures",
    "repairs",
    "falsePositives",
    "stillStale",
    "capped",
  ])
    expect(typeof a[k]).toBe("number");
  // an edit: one check, which reads the heights; a page that is laid out right needs no repair
  await page.evaluate(() => {
    const v = (window as any).demo.ed.view;
    v.dispatch({ changes: { from: 0, insert: "(z 1)\n" } });
  });
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).demo.ed.heightStats().staleCalls)
    )
    .toBeGreaterThan(a.staleCalls);
  const b = await page.evaluate(() => (window as any).demo.ed.heightStats());
  expect(b.checks).toBeGreaterThan(a.checks);
  expect(b.staleMs).toBeGreaterThanOrEqual(a.staleMs);
  expect(b.repairs).toBe(a.repairs);
  expect(b.staleTrue).toBe(a.staleTrue);
  // a collapse re-measures (counted) without being a repair
  await page.evaluate(() => {
    const ed = (window as any).demo.ed;
    ed.collapseRoot(ed.roots()[1], true);
  });
  const c = await page.evaluate(() => (window as any).demo.ed.heightStats());
  expect(c.remeasures).toBeGreaterThan(b.remeasures);
  expect(c.repairs).toBe(b.repairs);
});
