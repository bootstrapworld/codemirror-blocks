// EXPERIMENT: a page that runs the Lezer block editor in a browser.
import css from "../src/style.css";
import { createLezerBlockEditor, LezerBlockEditor } from "../src/lezer-view";
import { schemeParser, schemeTable } from "../src/lang-scheme";
import { javascriptParser, javascriptTable } from "../src/lang-javascript";
import { pythonParser, pythonTable } from "../src/lang-python";

const LANGS = {
  scheme: {
    opts: { parser: schemeParser as never, table: schemeTable },
    sample: `(define (square x) (* x x))
(define (fact n)
  (if (<= n 1)
      1
      (* n (fact (- n 1)))))
(define (grade score)
  (cond [(>= score 90) "A"]
        [(>= score 80) "B"]
        [else "C"]))
(fact 5)
(square (fact 3))
`,
  },
  javascript: {
    opts: { parser: javascriptParser as never, table: javascriptTable },
    sample: `function fact(n) {
  if (n <= 1) {
    return 1;
  } else {
    return n * fact(n - 1);
  }
}
let total = 0;
for (const x of [1, 2, 3]) {
  total = total + fact(x);
}
while (total > 10) {
  total = total - 10;
}
console.log(total, "done");
`,
  },
  python: {
    opts: { parser: pythonParser as never, table: pythonTable },
    sample: `def fact(n):
    if n <= 1:
        return 1
    else:
        return n * fact(n - 1)

total = 0
for x in [1, 2, 3]:
    total = total + fact(x)
while total > 10:
    total = total - 10
print(total, "done")
`,
  },
};
type LangName = keyof typeof LANGS;

const style = document.createElement("style");
style.textContent = css;
document.head.appendChild(style);

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
let ed: LezerBlockEditor | null = null;
let lang: LangName = "scheme";

function bigDoc(l: LangName): string {
  const s = LANGS[l].sample;
  const per = s.split("\n").length;
  return s.repeat(Math.ceil(3000 / per));
}

function show(text: string): void {
  ed?.destroy();
  $("editor").textContent = "";
  const t0 = performance.now();
  ed = createLezerBlockEditor($("editor"), text, LANGS[lang].opts);
  ed.setBlockMode($<HTMLInputElement>("blocks").checked);
  const ms = performance.now() - t0;
  (window as unknown as { demo: unknown }).demo = { ed, lang, createMs: ms, setLanguage, loadBig, loadSample };
  stats();
}

function stats(): void {
  if (!ed) return;
  const s = ed.stats();
  $("stats").textContent =
    `${ed.view.state.doc.lines} lines, ${ed.roots().length} roots, ${ed.view.dom.querySelectorAll(".cm-content > .cm-line > .blocks-node").length} drawn, ` +
    `${s.edits} edits, ${s.rootsRebuilt} roots rebuilt`;
}
function setLanguage(l: LangName): void {
  lang = l;
  $<HTMLSelectElement>("lang").value = l;
  loadSample();
}
function loadSample(): void {
  show(LANGS[lang].sample);
}
function loadBig(): void {
  show(bigDoc(lang));
}

$<HTMLSelectElement>("lang").addEventListener("change", (e) => setLanguage((e.target as HTMLSelectElement).value as LangName));
$<HTMLInputElement>("blocks").addEventListener("change", (e) => ed?.setBlockMode((e.target as HTMLInputElement).checked));
$("big").addEventListener("click", loadBig);
$("small").addEventListener("click", loadSample);
setInterval(stats, 1000);
loadSample();
