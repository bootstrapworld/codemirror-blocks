// Forty-fifth round: text typed on a line with no block text is written AT the cursor (the three probes), not next to a neighbour.
import { test, expect } from "@playwright/test";

/* eslint-disable @typescript-eslint/no-explicit-any */
for (const lang of ["scheme", "javascript", "python"]) {
  const A = lang === "scheme" ? "(a)" : lang === "javascript" ? "a();" : "a()";
  const B = A.replace("a", "b");
  const C = A.replace("a", "c");
  const probes: [string, number, string][] = [
    [`${A}\n\n\n\n${B}\n`, A.length + 2, `${A}\n\n${C}\n\n${B}\n`],
    [`${A}\n\n\n`, A.length + 1, `${A}\n${C}\n\n`],
    [`\n\n${A}\n`, 0, `${C}\n\n${A}\n`],
  ];
  probes.forEach(([src, at, want], i) => {
    test(`typing on a blank line is written at the cursor: ${lang} ${i + 1}`, async ({
      page,
    }) => {
      await page.goto(`/index.html?lang=${lang}`);
      await page.waitForSelector(".cm-content [role=treeitem]");
      await page.evaluate(
        ([t, pos]) => {
          const d = (window as any).demo;
          d.ed.view.dispatch({
            changes: { from: 0, to: d.ed.view.state.doc.length, insert: t },
          });
          d.ed.view.dispatch({ selection: { anchor: pos } });
          d.ed.view.focus();
        },
        [src, at] as [string, number]
      );
      await page.keyboard.type(C);
      await page.keyboard.press("Enter");
      await expect(page.locator(".blocks-pending .blocks-edit")).toHaveCount(0);
      expect(
        await page.evaluate(() =>
          (window as any).demo.ed.view.state.doc.toString()
        )
      ).toBe(want);
    });
  });
}
