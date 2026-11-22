import { expect, test } from "@playwright/test";
import * as fs from "fs";

/**
 * The stylesheet was split into core + one sheet per language (twenty-second round). Run with CMB6_OLD_CSS=<the one-piece sheet> to compare:
 * the computed look of one element of each kind (class set), with the sheets as they are and with the one-piece sheet instead.
 */
const OLD = process.env.CMB6_OLD_CSS;
const PROPS = [
  "display",
  "position",
  "color",
  "background-color",
  "border-top-width",
  "border-top-color",
  "border-top-style",
  "border-radius",
  "padding-top",
  "padding-left",
  "margin-top",
  "margin-left",
  "font-size",
  "font-style",
  "font-weight",
  "line-height",
  "white-space",
  "max-width",
  "min-width",
  "width",
  "height",
  "box-sizing",
  "vertical-align",
  "opacity",
  "pointer-events",
  "cursor",
  "outline-style",
  "text-decoration-line",
  "box-shadow",
  "flex-direction",
  "grid-template-columns",
];
for (const lang of ["scheme", "javascript", "python"]) {
  test(`the split sheets look as the one-piece sheet did: ${lang}`, async ({
    page,
  }) => {
    test.skip(!OLD, "set CMB6_OLD_CSS");
    await page.goto(`/index.html?lang=${lang}`);
    await page.waitForFunction(
      () => (window as unknown as { demo?: unknown }).demo
    );
    const measure = () =>
      page.evaluate((props) => {
        const seen = new Map<string, Element>();
        for (const el of document.querySelectorAll(".cm-content *")) {
          const key =
            el.tagName +
            "." +
            [...el.classList]
              .filter((c) => c !== "blocks-selected")
              .sort()
              .join(".");
          if (!seen.has(key)) seen.set(key, el);
          for (const ps of ["::before", "::after"]) {
            const k2 = key + ps;
            if (!seen.has(k2)) seen.set(k2, el);
          }
        }
        const out: Record<string, string> = {};
        for (const [key, el] of seen) {
          const ps = key.endsWith("::before")
            ? "::before"
            : key.endsWith("::after")
              ? "::after"
              : null;
          const cs = getComputedStyle(el, ps);
          out[key] = props.map((p) => cs.getPropertyValue(p)).join("|");
        }
        return out;
      }, PROPS);
    const after = await measure();
    expect(Object.keys(after).length).toBeGreaterThan(20);
    await page.evaluate(
      (css) => {
        document
          .querySelectorAll("style[data-cm6-blocks]")
          .forEach((s) => s.remove());
        const st = document.createElement("style");
        st.textContent = css;
        document.head.appendChild(st);
      },
      fs.readFileSync(OLD!, "utf8")
    );
    const before = await measure();
    const diffs = Object.keys(before)
      .filter((k) => before[k] !== after[k])
      .map((k) => `${k}\n  old ${before[k]}\n  new ${after[k]}`);
    console.log(
      `${lang}: ${Object.keys(before).length} element kinds compared, ${diffs.length} differ`
    );
    expect(diffs).toEqual([]);
  });
}
