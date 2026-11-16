/** @jest-environment jsdom */
/*
 * Real programs (step 3 of the third round). Gated: `CMB_CORPUS=coverage npx jest packages/cm6-blocks/spec/corpus`
 * measures coverage only; `CMB_CORPUS=full` also runs the oracle on sampled files and times edits.
 * `CMB_STEP=<label>` names the row written to e2e/corpus-results.json.
 */
import * as fs from "fs";
import * as path from "path";
import { parser as sp } from "cm6-lezer-scheme-common-lang";
import { parser as jp } from "@lezer/javascript";
import { parser as pp } from "@lezer/python";
import { schemeTable } from "../src/lang-scheme";
import { javascriptTable } from "../src/lang-javascript";
import { pythonTable } from "../src/lang-python";
import { createLezerBlockEditor, checkLezerEditor } from "../src/lezer-view";
import { corpora, emptyCoverage, measure, sample, tableLines, mulberry32, Corpus } from "../scripts/corpus-lib";
import type { BNode } from "../src/types";

const mode = process.env.CMB_CORPUS;
const MODES: Record<string, [any, any]> = { scheme: [sp, schemeTable], javascript: [jp, javascriptTable], python: [pp, pythonTable] };
const OUT = path.join(__dirname, "..", "e2e", "corpus-results.json");

const zeroRect = { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}) };
if (!Range.prototype.getClientRects) Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
if (!Range.prototype.getBoundingClientRect) Range.prototype.getBoundingClientRect = () => zeroRect as DOMRect;

const top = (m: Record<string, { chars: number; n: number }>, k = 25) =>
  Object.entries(m).sort((a, b) => b[1].chars - a[1].chars).slice(0, k).map(([type, v]) => ({ type, chars: v.chars, n: v.n }));

const WORDS: Record<string, string[]> = { scheme: ["(", ")", " ", "x", "12", "; c\n"], javascript: ["(", ")", " ", "x", "12", ";", "{", "}", "//c\n"], python: ["(", ")", " ", "x", "12", ":", "\n    ", "#c\n"] };

(mode ? describe : describe.skip)("corpus", () => {
  const all = mode ? corpora() : [];
  const results: Record<string, any> = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
  const step = process.env.CMB_STEP ?? "current";
  const row: Record<string, any> = (results[step] ??= {});
  afterAll(() => {
    fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
  });

  test.each(all.map((c) => [c.name, c] as [string, Corpus]))("%s", (_n, c) => {
    const [parser, table] = MODES[c.language];
    const cov = emptyCoverage();
    for (const f of c.files) measure(c.language, parser, table, f.text, cov);
    const tl = tableLines(c.language);
    const r: Record<string, any> = {
      note: c.note, language: c.language, files: cov.files, lines: cov.lines, chars: cov.chars,
      coverage: { real: +(cov.real / cov.chars * 100).toFixed(1), opaque: +(cov.opaque / cov.chars * 100).toFixed(1), fallback: +(cov.fallback / cov.chars * 100).toFixed(1) },
      topStatements: cov.top, allStatements: cov.all, errorNodes: cov.errorNodes, filesWithErrors: cov.filesWithErrors,
      parseBuildMsPer1000Lines: +(cov.parseBuildMs / (cov.lines / 1000)).toFixed(1),
      tableLines: tl, missingTop25: top(cov.missing).map((m) => ({ ...m, examples: cov.examples[m.type] })), opaqueTop10: top(cov.opaqueTypes, 10),
    };
    if (mode === "full") {
      const rnd = mulberry32(99);
      const sampled = sample(c.files.filter((f) => f.text.split("\n").length <= 1500), 30, 3);
      let failures = 0, refused = 0, edits = 0;
      const detail: string[] = [];
      for (const f of sampled) {
        const parent = document.createElement("div");
        document.body.appendChild(parent);
        let log: string[] = [];
        try {
          const ed = createLezerBlockEditor(parent, f.text, { parser, table });
          const check = (what: string) => {
            const p = checkLezerEditor(ed);
            if (p.length) {
              failures++;
              if (detail.length < 6) detail.push(`${f.name}: after ${what}: ${p[0]}`);
              return false;
            }
            return true;
          };
          if (check("construct")) {
            for (let i = 0; i < 20; i++) {
              const nodes: BNode[] = [];
              const w = (x: BNode) => { nodes.push(x); x.slots.forEach((s) => s.nodes.forEach(w)); };
              ed.roots().forEach(w);
              const r = rnd();
              let what = "";
              try {
                if (r < 0.35 && nodes.length) {
                  const cands = nodes.filter((x) => x.slot && x.kind !== "blank");
                  const x = cands[Math.floor(rnd() * cands.length)];
                  what = `delete ${x.kind}[${x.from},${x.to})`;
                  ed.removeNode(x);
                } else if (r < 0.65 && nodes.length) {
                  const names = ed.templates().map((t) => t.name);
                  const name = names[Math.floor(rnd() * names.length)];
                  const x = nodes[Math.floor(rnd() * nodes.length)];
                  what = `template ${name} after ${x.kind}[${x.from},${x.to})`;
                  ed.insertTemplate(name, x);
                  parent.querySelectorAll("input.blocks-edit").forEach((el) => el.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
                } else {
                  const len = ed.view.state.doc.length;
                  const at = Math.floor(rnd() * (len + 1));
                  const wd = WORDS[c.language][Math.floor(rnd() * WORDS[c.language].length)];
                  what = `type ${JSON.stringify(wd)} at ${at}`;
                  ed.view.dispatch({ changes: { from: at, insert: wd } });
                }
                edits++;
              } catch (e) {
                refused++;
                continue;
              }
              log.push(what);
              if (!check(what)) break;
            }
          }
          ed.destroy();
        } catch (e) {
          failures++;
          detail.push(`${f.name}: threw ${(e as Error).message.slice(0, 100)} after ${log.slice(-3).join("; ")}`);
        }
        parent.remove();
      }
      r.correctness = { files: sampled.length, edits, refusedByTheApi: refused, oracleFailures: failures, examples: detail };
      // the time of one edit on the largest sampled file (jsdom, not a browser)
      const big = [...c.files].sort((a, b) => b.text.length - a.text.length).find((f) => f.text.split("\n").length <= 6000);
      if (big) {
        const parent = document.createElement("div");
        document.body.appendChild(parent);
        const ed = createLezerBlockEditor(parent, big.text, { parser, table });
        const times: number[] = [];
        for (let i = 0; i < 9; i++) {
          const at = Math.floor(ed.view.state.doc.length / 2);
          const a = performance.now();
          ed.view.dispatch({ changes: { from: at, insert: " " } });
          times.push(performance.now() - a);
        }
        times.sort((x, y) => x - y);
        r.largestFile = { name: big.name, lines: big.text.split("\n").length, typedEditMedianMs: +times[4].toFixed(2) };
        ed.destroy();
        parent.remove();
      }
    }
    row[c.name] = r;
    // eslint-disable-next-line no-console
    console.log(c.name, JSON.stringify({ files: r.files, lines: r.lines, coverage: r.coverage, top: r.topStatements, all: r.allStatements, errors: r.errorNodes, correctness: r.correctness }));
  });
});
