// EXPERIMENT: a page that runs the Lezer block editor in a browser.
import { redo, undo } from "@codemirror/commands";
import { EditorView, lineNumbers } from "@codemirror/view";
import {
  checkLezerEditor,
  createLezerBlockEditor,
  LezerBlockEditor,
} from "../src/lezer-view";
import { mountModeToggle, ModeToggle } from "../src/mode";
import { BIG } from "./samples";
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

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
let ed: LezerBlockEditor | null = null;
let toggle: ModeToggle | null = null;
let lang: LangName = "scheme";

function bigDoc(l: LangName): string {
  const s = LANGS[l].sample;
  const per = s.split("\n").length;
  return s.repeat(Math.ceil(3000 / per));
}

/** the options a page (the soak's Chromium runner) may choose per editor; the defaults are those of the demo */
interface ShowOptions {
  lineNumbers?: boolean;
  lineWrapping?: boolean;
  collapseAll?: boolean;
  fastErrors?: boolean;
  skipRoots?: boolean;
  activityLimit?: number | null;
  freshParseBelow?: number | null;
}

function show(
  text: string,
  reconcile = true,
  anchors = true,
  more: ShowOptions = {}
): void {
  const mode = ed?.mode ?? "blocks"; // (the mode stays across a new document or language)
  toggle?.destroy();
  ed?.destroy();
  $("editor").textContent = "";
  const t0 = performance.now();
  ed = createLezerBlockEditor($("editor"), text, {
    ...LANGS[lang].opts,
    extensions: [
      ...(more.lineNumbers === false ? [] : [lineNumbers()]),
      ...(more.lineWrapping ? [EditorView.lineWrapping] : []),
    ],
    reconcile,
    anchors,
    ...(more.collapseAll ? { collapseAll: true } : {}),
    ...(more.fastErrors === false ? { fastErrors: false } : {}),
    ...(more.skipRoots === false ? { skipRoots: false } : {}),
    ...(more.activityLimit ? { activityLimit: more.activityLimit } : {}),
    ...(more.freshParseBelow !== null && more.freshParseBelow !== undefined
      ? { freshParseBelow: more.freshParseBelow }
      : {}),
    focusToolbar: () =>
      ($("templates").querySelector("button") as HTMLElement | null)?.focus(),
  });
  ed.setMode(mode);
  toggle = mountModeToggle(ed, $("app"));
  const ms = performance.now() - t0;
  const demo = {
    ed,
    lang,
    createMs: ms,
    firstDrawMs: -1,
    paintedMs: -1,
    setLanguage,
    show,
    loadBig,
    loadSample,
    undo: () => undo(ed!.view),
    redo: () => redo(ed!.view),
    check: () => checkLezerEditor(ed!),
  };
  (window as unknown as { demo: unknown }).demo = demo;
  const poll = () => {
    if (
      document.querySelector(".cm-content .blocks-node") ||
      ed?.mode === "text"
    ) {
      demo.firstDrawMs = performance.now();
      requestAnimationFrame(() =>
        setTimeout(() => (demo.paintedMs = performance.now()), 0)
      );
    } else requestAnimationFrame(poll);
  };
  poll();
  const bar = $("templates");
  bar.textContent = "";
  bar.classList.add("blocks-toolbar");
  const lab = document.createElement("span");
  lab.textContent =
    "Tap to insert after the focused block, or press and hold, then drag into the program: ";
  lab.style.cssText =
    "flex: none; align-self: center; font-size: 12px; max-width: 14em;";
  bar.appendChild(lab);
  for (const t of ed.templates()) {
    const b = document.createElement("button");
    b.textContent = t.name;
    b.dataset.template = t.name;
    b.className = "blocks-toolbar-item";
    b.addEventListener("mousedown", (e) => e.preventDefault()); // keep the focus on the block
    b.addEventListener("pointerdown", (e) => ed!.beginTemplateDrag(e, t.name)); // dragging it into the program inserts it there; a plain click inserts it after the focused block
    b.addEventListener("click", () =>
      ed!.insertTemplate(
        t.name,
        (ed!.isBlockMode() ? ed!.focusedNode() : null) ?? ed!.lastFocused()
      )
    );
    bar.appendChild(b);
  }
  // Tab from the last button goes back into the editor, to the block that had the focus
  if (!bar.dataset.tabs)
    bar.addEventListener("keydown", (e) => {
      const last = bar.querySelector("button:last-of-type");
      if (e.key === "Tab" && !e.shiftKey && e.target === last) {
        e.preventDefault();
        ed!.focusEditor();
      }
    });
  bar.dataset.tabs = "1";
  stats();
}

function stats(): void {
  if (!ed) return;
  const s = ed.stats();
  $("stats").textContent =
    `${ed.view.state.doc.lines} lines, ${ed.doc.program.slots[0].nodes.length} roots, ${ed.view.dom.querySelectorAll(".cm-content > .cm-line > .blocks-node").length} drawn, ` +
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

$<HTMLSelectElement>("lang").addEventListener("change", (e) =>
  setLanguage((e.target as HTMLSelectElement).value as LangName)
);
$("big").addEventListener("click", loadBig);
$("constructs").addEventListener("click", () => show(BIG[lang]));
$("small").addEventListener("click", loadSample);
setInterval(stats, 1000);
const q = new URLSearchParams(location.search);
if (q.get("lang") && q.get("lang")! in LANGS) {
  lang = q.get("lang") as LangName;
  $<HTMLSelectElement>("lang").value = lang;
}
if (q.get("big")) loadBig();
else if (q.get("constructs")) show(BIG[lang]);
else loadSample();
