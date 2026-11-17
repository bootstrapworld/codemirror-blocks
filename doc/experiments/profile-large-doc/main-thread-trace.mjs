// Main-thread time per trace event name for edit / undo / redo / arrow-down x50 (no CPU profiler, no polling).
//   node main-thread-trace.mjs [lines=3000] [reps=5]   (dev server on :8201; rebuild lib/ first, see README)
import { createRequire } from "module";
const D = new URL(".", import.meta.url).pathname;
const req = createRequire(D + "x.js");
const { chromium } = req("@playwright/test");
const gen = req("./gen.js");
const LINES = +process.argv[2] || 3000,
  REPS = +process.argv[3] || 3;
const MOD = process.platform === "darwin" ? "Meta" : "Control";
const CATS = "devtools.timeline,v8,disabled-by-default-v8.gc,blink,cc,toplevel";

async function trace(cdp, action, waitMs) {
  const ev = [];
  cdp.removeAllListeners("Tracing.dataCollected");
  cdp.on("Tracing.dataCollected", (d) => ev.push(...d.value));
  const done = new Promise((r) => cdp.once("Tracing.tracingComplete", r));
  await cdp.send("Tracing.start", {
    categories: CATS,
    transferMode: "ReportEvents",
  });
  await action();
  await new Promise((r) => setTimeout(r, waitMs));
  await cdp.send("Tracing.end");
  await done;
  return ev;
}
function selfTimes(ev) {
  const main = ev.find(
    (e) => e.name === "thread_name" && e.args?.name === "CrRendererMain"
  );
  if (!main) return { err: "no main thread" };
  const xs = ev
    .filter(
      (e) =>
        e.pid === main.pid &&
        e.tid === main.tid &&
        e.ph === "X" &&
        e.dur !== undefined
    )
    .sort((a, b) => a.ts - b.ts || b.dur - a.dur);
  const self = {},
    stack = [];
  let total = 0;
  for (const e of xs) {
    while (stack.length && stack[stack.length - 1].end <= e.ts) stack.pop();
    const top = stack[stack.length - 1];
    if (top) self[top.name] = (self[top.name] ?? 0) - e.dur / 1000;
    self[e.name] = (self[e.name] ?? 0) + e.dur / 1000;
    if (!top) total += e.dur / 1000;
    stack.push({ name: e.name, end: e.ts + e.dur });
  }
  return { self, total };
}
const browser = await chromium.launch();
const all = {};
for (let rep = 0; rep < REPS; rep++) {
  const ctx = await browser.newContext({
    viewport: { width: 1200, height: 900 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await ctx.newPage();
  await page.goto("http://localhost:8201/");
  await page.waitForFunction(() => !!window.cmb);
  const cdp = await ctx.newCDPSession(page);
  await page.evaluate((c) => {
    window.cmb.setValue(c);
    window.cmb.clearHistory();
  }, gen(LINES));
  await page.getByRole("button", { name: /switch to blocks mode/i }).click();
  await page.waitForTimeout(4000);
  await page.evaluate(() => {
    const cm = window.cmb.getCM();
    try {
      cm.scrollTo(
        null,
        cm.heightAtLine(Math.floor(cm.lastLine() / 2), "local")
      );
    } catch (e) {
      /* the page may have no such line yet */
    }
  });
  await page.waitForTimeout(1500);
  const rec = async (name, action) => {
    const ev = await trace(cdp, action, 1500);
    const r = selfTimes(ev);
    (all[name] ??= []).push(r);
  };
  await rec("idle 1.5s", async () => {});
  await page
    .getByRole("treeitem", { name: /^\d+,?$/ })
    .nth(2)
    .click();
  await page.keyboard.press("Enter");
  await page.keyboard.press(`${MOD}+a`);
  await page.keyboard.type("12345");
  await rec("edit commit", () => page.keyboard.press("Enter"));
  await page.waitForTimeout(1000);
  await rec("undo", () => page.keyboard.press(`${MOD}+z`));
  await page.waitForTimeout(1000);
  await rec("redo", () => page.keyboard.press(`${MOD}+Shift+z`));
  await page.waitForTimeout(1000);
  await page.getByRole("treeitem").first().click();
  await page.waitForTimeout(500);
  await rec("arrow down x50", async () => {
    for (let i = 0; i < 50; i++) await page.keyboard.press("ArrowDown");
  });
  await ctx.close();
}
const med = (xs) => {
  xs = xs.sort((a, b) => a - b);
  return xs[Math.floor(xs.length / 2)];
};
for (const [name, rs] of Object.entries(all)) {
  const keys = new Set(rs.flatMap((r) => Object.keys(r.self ?? {})));
  const rows = [...keys]
    .map((k) => [k, med(rs.map((r) => r.self[k] ?? 0))])
    .filter((r) => r[1] >= 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 14);
  console.log(
    `\n${name}: top-level main-thread busy ${med(rs.map((r) => r.total)).toFixed(0)} ms`
  );
  for (const [k, v] of rows) console.log("  ", v.toFixed(1).padStart(7), k);
}
await browser.close();
