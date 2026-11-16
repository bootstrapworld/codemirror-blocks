// scratch: print computed styles of the selectors in PROBE (separated by |) on the demo page
import { test } from "@playwright/test";
import { SAMPLE } from "./scheme-sample";
test("probe", async ({ page }) => {
  await page.goto("/index.html?lang=scheme");
  await page.waitForSelector(".cm-content .blocks-node");
  await page.evaluate((c: string) => (window as any).demo.show(c), SAMPLE);
  await page.waitForSelector(".cm-content .blocks-node");
  const props = ["display","fontSize","fontWeight","lineHeight","color","backgroundColor","borderTop","borderLeft","borderRadius","padding","margin","width","height","transform","boxShadow"];
  const out = await page.evaluate(({ sels, props }) => sels.map((s: string) => { const e = document.querySelector(s); if (!e) return s + " : MISSING"; const cs = getComputedStyle(e) as any; const r = e.getBoundingClientRect(); return s + " :: " + Math.round(r.width) + "x" + Math.round(r.height) + " @" + Math.round(r.x) + "," + Math.round(r.y) + " :: " + props.map((p: string) => p + "=" + cs[p]).join("; "); }), { sels: (process.env.PROBE ?? "").split("|"), props });
  console.log(out.join("\n"));
});
