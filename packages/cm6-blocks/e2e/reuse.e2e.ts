// Fourth round, step 2 in real Chromium (with layout): the cost of an edit inside ONE big root, with and without
// node-level reuse (`reconcile: false` is the old rebuild-the-root path). The 618-line class is a JavaScript file from
// node_modules (the largest of the corpus's sample); the Python one is a standard-library file's biggest class.
// Writes e2e/reuse-chromium.json.
import { test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { corpora } from "../scripts/corpus-lib";

/* eslint-disable @typescript-eslint/no-explicit-any */
const results: Record<string, any> = {};
const biggest = (name: string) =>
  [...corpora().find((c) => c.name === name)!.files]
    .sort((a, b) => b.text.length - a.text.length)
    .find((f) => f.text.split("\n").length <= 6000)!;

const cases: [string, string, () => string][] = [
  [
    "javascript",
    "js 618-line class",
    () => biggest("js-node_modules-library").text,
  ],
  ["python", "py 4006-line file", () => biggest("py-stdlib-library").text],
];

for (const [lang, label, text] of cases) {
  test(`reuse: ${label}`, async ({ page }) => {
    await page.goto(`/index.html?lang=${lang}`);
    await page.waitForSelector(".cm-content [role=treeitem]");
    const src = text();
    const out: any = { lines: src.split("\n").length };
    for (const mode of ["rebuild", "reconcile", "anchors"] as const) {
      const r = await page.evaluate(
        async ({ src, mode }) => {
          const demo = (window as any).demo;
          demo.show(src, mode !== "rebuild", mode === "anchors");
          const ed = (window as any).demo.ed;
          const raf = () =>
            new Promise<void>((res) =>
              requestAnimationFrame(() => setTimeout(() => res(), 0))
            );
          await raf();
          await raf();
          const median = (a: number[]) =>
            [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
          const roots = ed.roots().filter((r: any) => r.kind !== "error");
          const count = (n: any) => {
            let c = 1;
            n.slots.forEach((s: any) =>
              s.nodes.forEach((k: any) => (c += count(k)))
            );
            return c;
          };
          // the biggest root of the document, scrolled into view
          const big = roots.reduce((a: any, b: any) =>
            count(b) > count(a) ? b : a
          );
          ed.view.dispatch({
            selection: { anchor: big.from },
            scrollIntoView: true,
          });
          await raf();
          await raf();
          await raf();
          const leafIn = (r: any) => {
            const ls: any[] = [];
            const w = (n: any) => {
              if (!n.slots.length && n.kind === "literal" && n.to > n.from)
                ls.push(n);
              n.slots.forEach((s: any) => s.nodes.forEach(w));
            };
            w(r);
            return ls[ls.length >> 1];
          };
          const o: any = {
            rootNodes: count(big),
            rootsInDom: ed.view.dom.querySelectorAll(
              ".cm-content > .cm-line > .blocks-node"
            ).length,
            rootInView:
              ed.renderer.has(big) && ed.renderer.element(big).isConnected,
          };
          const kinds: Record<string, () => void> = {
            typedSpace: () => {
              const r = ed.roots().find((x: any) => x.from === big.from);
              const at = Math.floor((r.from + r.to) / 2);
              ed.view.dispatch({ changes: { from: at, insert: " " } });
            },
            typedCharInLeaf: () => {
              const r = ed.roots().find((x: any) => x.from === big.from);
              const l = leafIn(r);
              ed.view.dispatch({ changes: { from: l.to, insert: "1" } });
            },
          };
          for (const [k, f] of Object.entries(kinds)) {
            const sync: number[] = [],
              paint: number[] = [];
            const s0 = ed.stats();
            for (let i = 0; i < 9; i++) {
              const a = performance.now();
              f();
              void ed.view.dom.offsetHeight;
              sync.push(performance.now() - a);
              await raf();
              paint.push(performance.now() - a);
            }
            const s1 = ed.stats();
            o[k] = {
              syncWithLayoutMs: +median(sync).toFixed(2),
              toPaintMs: +median(paint).toFixed(1),
              nodesRebuiltPerEdit: +(
                (s1.nodesRebuilt - s0.nodesRebuilt) /
                9
              ).toFixed(1),
              nodesComparedPerEdit: +(
                (s1.nodesCompared - s0.nodesCompared) /
                9
              ).toFixed(1),
              nodesAnchoredPerEdit: +(
                (s1.nodesAnchored - s0.nodesAnchored) /
                9
              ).toFixed(1),
              anchorBails: s1.anchorBails - s0.anchorBails,
            };
          }
          // focus: a block elsewhere in the same root keeps focus when something else in it is typed
          const leaves: any[] = [];
          const w = (n: any) => {
            if (!n.slots.length && n.kind === "literal") leaves.push(n);
            n.slots.forEach((s: any) => s.nodes.forEach(w));
          };
          const r0 = ed.roots().find((x: any) => x.from === big.from);
          w(r0);
          const keep = leaves[leaves.length - 1];
          ed.focusNode(keep);
          const el = ed.renderer.element(keep);
          const before = ed.stats().focusRestores;
          const l2 = leaves[leaves.length >> 2];
          ed.view.dispatch({ changes: { from: l2.to, insert: "2" } });
          await raf();
          o.focusElsewhereInTheSameRoot = {
            focusRestores: ed.stats().focusRestores - before,
            sameElement:
              ed.renderer.has(ed.focusedNode()) &&
              ed.focusedNode() === keep &&
              ed.renderer.element(keep) === el,
            activeIsBody: document.activeElement === document.body,
          };
          return o;
        },
        { src, mode }
      );
      out[mode] = r;
    }
    results[label] = out;
    fs.writeFileSync(
      path.join(__dirname, "reuse-chromium.json"),
      JSON.stringify(results, null, 1)
    );
    // eslint-disable-next-line no-console
    console.log(label, JSON.stringify(out));
  });
}
