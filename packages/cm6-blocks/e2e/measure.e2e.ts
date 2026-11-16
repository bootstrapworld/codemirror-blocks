// Measurements in a real browser (Chromium) on a ~3000-line document, per language.
// Results are printed and written to e2e/results.json.
import { test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

/* eslint-disable @typescript-eslint/no-explicit-any */
const results: Record<string, any> = {};

for (const lang of ["scheme", "javascript", "python"]) {
  test(`measure: ${lang}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    const t0 = Date.now();
    await page.goto(`/index.html?lang=${lang}&big=1`);
    await page.waitForSelector(".cm-content .blocks-node");
    const waitMs = Date.now() - t0;
    await page.waitForFunction(() => (window as any).demo.paintedMs > 0);

    const r = await page.evaluate(async () => {
      const demo = (window as any).demo;
      const ed = demo.ed;
      const raf = () => new Promise<void>((res) => requestAnimationFrame(() => setTimeout(() => res(), 0)));
      const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
      const count = () => ed.view.dom.querySelectorAll(".cm-content > .cm-line > .blocks-node").length;
      const out: any = {
        lines: ed.view.state.doc.lines,
        roots: ed.roots().length,
        nodes: (() => { let n = 0; const w = (x: any) => { n++; x.slots.forEach((s: any) => s.nodes.forEach(w)); }; ed.roots().forEach(w); return n; })(),
        firstDrawMs: demo.firstDrawMs,
        paintedMs: demo.paintedMs,
        createMs: demo.createMs,
        widgetsAtLoad: ed.stats().widgetsBuilt,
        rootsInDomAtLoad: count(),
        viewport: { from: ed.view.viewport.from, to: ed.view.viewport.to, docLength: ed.view.state.doc.length },
      };

      // a removable node (an element of a list with several) inside root i
      const target = (i: number) => {
        const found: any[] = [];
        const w = (x: any) => { x.slots.forEach((s: any) => { if (s.kind === "list" && s.nodes.length >= 2) found.push(s.nodes[0]); s.nodes.forEach(w); }); };
        let k = i;
        for (; k < ed.roots().length; k++) { w(ed.roots()[k]); if (found.length) break; }
        return found[0];
      };

      // edit timings: remove one block, then undo it; 7 repetitions each
      const edit = async (where: string, rootIndex: number) => {
        const sync: number[] = [], toPaint: number[] = [], undoPaint: number[] = [];
        for (let rep = 0; rep < 7; rep++) {
          const node = target(rootIndex + rep * 2);
          const a = performance.now();
          ed.removeNode(node);
          void ed.view.dom.offsetHeight; // force layout
          sync.push(performance.now() - a);
          await raf();
          toPaint.push(performance.now() - a);
          const b = performance.now();
          demo.undo();
          await raf();
          undoPaint.push(performance.now() - b);
        }
        out["edit_" + where] = { syncWithLayoutMs: median(sync), toPaintMs: median(toPaint), undoToPaintMs: median(undoPaint), all: toPaint.map((x) => +x.toFixed(1)) };
      };
      await edit("near_top", 5);
      // scroll to the middle, then edit a root that is in view
      const mid = Math.floor(ed.roots().length / 2);
      ed.view.scrollDOM.scrollTop = ed.view.scrollDOM.scrollHeight / 2;
      await raf(); await raf();
      const vpFrom = ed.view.viewport.from;
      let ri = ed.roots().findIndex((r: any) => r.from >= vpFrom);
      await edit("near_middle", Math.max(ri, mid > ri ? ri : ri));
      out.middleRootIndex = ri;

      // scroll to the bottom in steps; count roots in the DOM at once and widgets built
      ed.view.scrollDOM.scrollTop = 0;
      await raf(); await raf();
      const built0 = ed.stats().widgetsBuilt;
      let maxInDom = count(), steps = 0;
      const sc = ed.view.scrollDOM;
      let last = -1;
      while (steps < 600) {
        sc.scrollTop = sc.scrollTop + sc.clientHeight * 0.8;
        await raf();
        maxInDom = Math.max(maxInDom, count());
        steps++;
        if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2 && sc.scrollTop === last) break;
        last = sc.scrollTop;
      }
      out.scroll = { steps, widgetsBuiltWhileScrolling: ed.stats().widgetsBuilt - built0, maxRootsInDomAtOnce: maxInDom, rootsInDomAtBottom: count(), scrollHeight: sc.scrollHeight };
      sc.scrollTop = 0;
      await raf(); await raf();

      // focus: focus a block in a root in view, edit elsewhere, see where the focus is
      const inView = () => ed.roots().filter((r: any) => ed.renderer.has(r) && ed.renderer.element(r).isConnected);
      const list = (r: any) => { const o: any[] = []; const w = (x: any) => { x.slots.forEach((s: any) => { if (s.kind === "list" && s.nodes.length >= 2) o.push(s); s.nodes.forEach(w); }); }; w(r); return o; };
      const withList = () => inView().filter((r: any) => list(r).length);
      const focusCases: any = {};
      const textAt = (n: any) => (n ? ed.view.state.doc.sliceString(n.from, n.to).slice(0, 30) : null);
      const idxs = ed.roots().map((_: any, i: number) => i).filter((i: number) => ed.renderer.has(ed.roots()[i]) && ed.renderer.element(ed.roots()[i]).isConnected && list(ed.roots()[i]).length);
      const midRoot = idxs[Math.floor(idxs.length / 2)], earlier = idxs[0], later = idxs[idxs.length - 1];
      out.focusRoots = { inViewWithLists: idxs.length, midRoot, earlier, later };
      // nodes are looked up by root index each time: a root that an edit rebuilt is a new object
      const slotFrom = (i: number): any => { for (let k = i; k < ed.roots().length; k++) { const l = list(ed.roots()[k]); if (l.length) return l[0]; } return null; };
      const at = (i: number, k: number) => slotFrom(i).nodes[k];
      const run = async (name: string, focus: () => any, act: () => void) => {
        const f0 = focus();
        ed.focusNode(f0);
        await raf();
        const before = ed.stats().focusRestores;
        const was = textAt(f0);
        act();
        await raf();
        const f = ed.focusedNode();
        focusCases[name] = { focusedBefore: was, focusedAfter: textAt(f), stillTheSameBlock: f === f0, focusOnABlock: !!f, restores: ed.stats().focusRestores - before, activeIsBody: document.activeElement === document.body };
      };
      await run("edit_in_the_focused_blocks_parent", () => at(midRoot, 0), () => ed.removeNode(at(midRoot, 1)));
      await run("edit_in_a_later_root", () => at(midRoot, 0), () => ed.removeNode(at(later, 1)));
      await run("edit_in_an_earlier_root", () => at(midRoot, 0), () => ed.removeNode(at(earlier, 1)));
      await run("undo_of_an_edit_in_an_earlier_root", () => at(midRoot, 0), () => demo.undo());
      await run("undo_of_an_edit_in_a_later_root", () => at(midRoot, 0), () => demo.undo());
      await run("edit_the_focused_block_itself", () => at(midRoot, 0), () => ed.removeNode(at(midRoot, 0)));
      out.focus = focusCases;
      out.stats = ed.stats();
      return out;
    });
    results[lang] = { waitForSelectorMs: waitMs, ...r, errors };
    fs.writeFileSync(path.join(__dirname, "results.json"), JSON.stringify(results, null, 2));
    // eslint-disable-next-line no-console
    console.log(lang, JSON.stringify(r, null, 1));
    await page.screenshot({ path: path.join(__dirname, "screens", `${lang}.png`) });
  });
}
