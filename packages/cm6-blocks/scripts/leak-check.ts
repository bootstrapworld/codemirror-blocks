/*
 * LEAK CHECK: does creating and destroying an editor leave memory behind? (no browser; the DOM is jsdom)
 *
 *   npm run leak:check -- [--lang python] [--cycles 30] [--size 25000] [--fresh-window]
 *
 * Bundles this file with esbuild, runs it with `node --expose-gc`, and prints the heap (after several gc passes) every few cycles: a
 * steady climb of heapUsed is a leak. With --fresh-window each cycle gets a jsdom window of its own (closed after), which separates the
 * editor's leaks from jsdom's own. Also checks with WeakRefs that the editor and its view are collected after `destroy()`.
 * (spec/destroy.test.ts is the cheap regression test of the same: listeners balanced, WeakRef canaries.)
 */
import { installDom, closeDom } from "./parse-fuzz";
import { checkLezerEditor, createLezerBlockEditor } from "../src/lezer-view";
import { LANGS } from "../spec/steps";
import { longProgram, mulberry32, type Lang } from "../spec/soak-gen";

const arg = (k: string, d: string): string => {
  const i = process.argv.indexOf(`--${k}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const lang = arg("lang", "python") as Lang;
const cycles = +arg("cycles", "30");
const size = +arg("size", "25000");
const fresh = process.argv.includes("--fresh-window");
const work = process.argv.includes("--work");
const gc = (globalThis as unknown as { gc?: () => void }).gc;
if (!gc) throw new Error("run with node --expose-gc (npm run leak:check)");
const MB = (n: number): string => (n / 1048576).toFixed(1);
const settle = async (): Promise<void> => {
  for (let i = 0; i < 4; i++) {
    await new Promise((r) => setTimeout(r, 20));
    if (!process.argv.includes("--no-gc")) gc();
  }
};

async function main(): Promise<void> {
  let text = "";
  const rnd = mulberry32(7);
  while (text.length < size) text += longProgram(lang, rnd) + "\n";
  text = text.slice(0, size);
  const L = LANGS[lang];
  const realError = console.error;
  const realWarn = console.warn;
  console.error = console.warn = () => {};
  installDom();
  const canaries: WeakRef<object>[] = [];
  await settle();
  const base = process.memoryUsage();
  const rows: string[] = [];
  for (let c = 1; c <= cycles; c++) {
    if (fresh && c > 1) installDom();
    const host = document.body.appendChild(document.createElement("div"));
    const ed = createLezerBlockEditor(host, text, L.opts);
    const rs = ed.roots();
    if (work) {
      // a workout: edits, a focus, a selection, collapse, a mode switch, the check, a second editor
      ed.view.dispatch({ changes: { from: 10, to: 12, insert: "xy" } });
      ed.view.dispatch({ changes: { from: 100, insert: "\n" } });
      const r = ed.roots();
      if (r[1]) ed.focusNode(r[1]);
      if (r[2]) ed.toggleSelect(r[2]);
      if (r[0]) ed.collapse(r[0], true);
      ed.setBlockMode(false);
      ed.setBlockMode(true);
      ed.remeasureHeights();
      ed.summarizeProgram();
      checkLezerEditor(ed);
      void rs;
      const h2 = document.body.appendChild(document.createElement("div"));
      const e2 = createLezerBlockEditor(h2, text, L.opts);
      canaries.push(new WeakRef(e2));
      e2.destroy();
      h2.remove();
    }
    canaries.push(new WeakRef(ed), new WeakRef(ed.view));
    ed.destroy();
    ed.destroy();
    host.remove();
    if (fresh) closeDom();
    if (c % 5 === 0 || c === cycles) {
      await settle();
      const m = process.memoryUsage();
      rows.push(
        `cycle ${c}: heapUsed ${MB(m.heapUsed)} MB (+${MB(m.heapUsed - base.heapUsed)}), rss ${MB(m.rss)} MB`
      );
    }
  }
  console.error = realError;
  console.warn = realWarn;
  await settle();
  const alive = canaries.filter((w) => w.deref()).length;
  process.stdout.write(rows.join("\n") + "\n");
  const m = process.memoryUsage();
  process.stdout.write(
    `per cycle: heap ${MB((m.heapUsed - base.heapUsed) / cycles)} MB; editors/views still alive: ${alive} of ${canaries.length}\n`
  );
  process.exit(0);
}
main();
