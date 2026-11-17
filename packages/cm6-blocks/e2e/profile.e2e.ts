// Seventh round, step 4: where the time of one edit goes on a 3000-line document (a CPU profile of many one-character edits; Chromium).
// Prints the functions with the most self time. Results are written to e2e/profile-<lang>.json.
import { test } from "@playwright/test";
import * as fs from "fs";

/* eslint-disable @typescript-eslint/no-explicit-any */
for (const lang of ["scheme", "javascript", "python"]) {
  test(`profile: ${lang}`, async ({ page }) => {
    await page.goto(`/index.html?lang=${lang}&big=1`);
    await page.waitForSelector(".cm-content .blocks-node");
    await page.waitForFunction(() => (window as any).demo.paintedMs > 0);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.setSamplingInterval", { interval: 100 });
    // scroll to the middle so the edited root is drawn
    await page.evaluate(async () => {
      const ed = (window as any).demo.ed;
      ed.view.scrollDOM.scrollTop = ed.view.scrollDOM.scrollHeight / 2;
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 50)));
    });
    await cdp.send("Profiler.start");
    const per = await page.evaluate(async () => {
      const ed = (window as any).demo.ed;
      const vpFrom = ed.view.viewport.from;
      const leaf = (() => {
        let f: any = null;
        const w = (x: any) => { if (!f && x.slots.length === 0 && x.kind === "literal" && x.from > vpFrom + 50) f = x; x.slots.forEach((s: any) => s.nodes.forEach(w)); };
        ed.roots().forEach(w);
        return f;
      })();
      const N = 300;
      const times: number[] = [];
      const pos = leaf.from + 1; // (a character is added and taken away in turn at the same place: no search of the tree in the loop)
      for (let i = 0; i < N; i++) {
        const a = performance.now();
        ed.view.dispatch({ changes: i % 2 ? { from: pos, to: pos + 1, insert: "" } : { from: pos, to: pos, insert: "x" }, userEvent: "input.block" });
        void ed.view.dom.offsetHeight;
        times.push(performance.now() - a);
      }
      times.sort((a, b) => a - b);
      return { median: times[N >> 1], mean: times.reduce((a, b) => a + b, 0) / N, stats: ed.stats() };
    });
    const { profile } = (await cdp.send("Profiler.stop")) as any;
    const self = new Map<string, number>();
    const byId = new Map<number, any>();
    for (const n of profile.nodes) byId.set(n.id, n);
    const dt = profile.timeDeltas as number[];
    profile.samples.forEach((id: number, i: number) => {
      const n = byId.get(id);
      const key = `${n.callFrame.functionName || "(anon)"} ${n.callFrame.url.split("/").pop()}:${n.callFrame.lineNumber}`;
      self.set(key, (self.get(key) ?? 0) + (dt[i] ?? 0));
    });
    // inclusive time of the functions of interest
    const incl = new Map<string, number>();
    const parent = new Map<number, number>();
    for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
    profile.samples.forEach((id: number, i: number) => {
      const seen = new Set<string>();
      for (let x: number | undefined = id; x !== undefined; x = parent.get(x)) {
        const n = byId.get(x);
        const key = `${n.callFrame.functionName || "(anon)"}`;
        if (!seen.has(key)) {
          seen.add(key);
          incl.set(key, (incl.get(key) ?? 0) + (dt[i] ?? 0));
        }
      }
    });
    const top = [...self].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${(v / 1000 / 300).toFixed(3)} ms/edit  ${k}`);
    const inc = [...incl].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => `${(v / 1000 / 300).toFixed(3)} ms/edit  ${k}`);
    const out = { lang, perEdit: per, self: top, inclusive: inc };
    fs.writeFileSync(`packages/cm6-blocks/e2e/profile-${lang}.json`, JSON.stringify(out, null, 1));
    console.log(JSON.stringify({ lang, median: per.median, mean: per.mean, parseMs: per.stats.parseMs / 300, restMs: per.stats.restMs / 300 }));
    console.log(top.join("\n"));
  });
}
