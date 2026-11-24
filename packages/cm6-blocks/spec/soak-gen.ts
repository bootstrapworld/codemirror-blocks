/*
 * The soak runner's generator (scripts/soak.js): everything that decides WHAT a sequence does, with no import of the editor, so that the
 * jest worker (spec/soak.test.ts) and the Playwright worker (e2e/soak.e2e.ts) share it.
 *
 * A sequence is a language, a program (text) and a list of steps. A step is plain data: `{op, ...}` whose numbers are FRACTIONS in [0, 1)
 * ("block a of the program in document order" is `floor(a * count)` when the step runs), so any subset of a step list is still a
 * valid list of steps: that is what lets a failing sequence be shrunk and replayed from the record alone.
 *
 * PROGRAM SIZE (forty-sixth round): most sequences start from a small program (a few lines), but a fraction (`longDocs()`, 18% by default;
 * `CMB6_SOAK_LONG_DOCS=0` or `soak.js --long-docs 0` turns it off, `--long-docs 1` makes every program long) is a LONG document of 60 to 400
 * top-level forms, built from the generated programs, the hand-written ones and chunks of real files, with blank lines and comments between
 * them, so that CodeMirror draws only the lines near the viewport. A long document gets fewer steps (`stepsFor`: the invariants read the
 * whole document after each step) and, in Chromium, more `scroll` steps (plus `scrollKey` and `scrollToggle`: a scroll and then a key or the
 * mode toggle). A step's fractions `a` / `b` pick among the blocks that EXIST (jsdom: all of them; Chromium: those that are drawn).
 *
 * WIDER STEPS (same round): `pasteMulti` (several forms pasted at the top level), `brokenText` (text mode, broken syntax typed, back to
 * blocks), `undoRun` (2 to 5 undos or redos in a row), `collapseBurst` and `collapseAllThen` (collapse many, then edit), `multiSelect`
 * (select 2 to 5 blocks, then Delete / cut / copy and paste by key), `commentNear` (a comment next to another comment), and multi-form snippets
 * in the API's insertText, pasteText, replaceText and replaceDoc. All of them are in both engines except `scrollKey` and `scrollToggle`
 * (Chromium only: jsdom has no layout).
 */
import * as fs from "fs";
import * as path from "path";

export type Rnd = () => number;
export type Lang = "scheme" | "javascript" | "python";
export const LANG_NAMES: Lang[] = ["scheme", "javascript", "python"];
export type Step = { op: string } & Record<string, unknown>;
export type Engine = "jsdom" | "chromium";

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const pick = <T>(rnd: Rnd, a: readonly T[]): T =>
  a[Math.floor(rnd() * a.length)];
const int = (rnd: Rnd, lo: number, hi: number): number =>
  lo + Math.floor(rnd() * (hi - lo + 1));
/** the index `f` (a fraction) stands for among `n` things; -1 when there are none */
export const at = (f: unknown, n: number): number =>
  n <= 0 ? -1 : Math.min(n - 1, Math.floor(Number(f) * n));

// ---- small pieces of source, per language ----

export const SNIPPETS: Record<Lang, string[]> = {
  scheme: ["7", "(g 1)", "x", '"s"', "(define y 2)", "(f)", "#t", "'(1 2)"],
  javascript: ["1", "g(2)", "x", '"s"', "[1, 2]", "f()", "true", "{a: 1}"],
  python: ["1", "g(2)", "x", '"s"', "[1, 2]", "f()", "True", "{1: 2}"],
};
/** words for text edits: some make a program that does not parse (the editor must live with that) */
export const WORDS: Record<Lang, string[]> = {
  scheme: [
    "(",
    ")",
    " ",
    "\n",
    "x",
    "12",
    "(f ",
    "define",
    '"',
    "[",
    "]",
    "; c\n",
    "if",
    "'",
    "#;",
  ],
  javascript: [
    "(",
    ")",
    " ",
    "\n",
    "x",
    "12",
    "f(",
    ";",
    "{",
    "}",
    '"',
    "/*",
    "if (a) ",
    "//c\n",
    "`",
    "=>",
  ],
  python: [
    "(",
    ")",
    " ",
    "\n",
    "x",
    "12",
    "f(",
    ":",
    "    ",
    "\n    ",
    '"',
    "#c\n",
    "if a:\n    b",
    "lambda",
  ],
};
/** text for an edit box: the first four parse as a block in every language, the others are refused */
export const BOX_TEXTS: string[] = [
  "42",
  "x",
  "y2",
  "foo",
  "(",
  "1 2",
  '"',
  ")",
  "",
  "  ",
  "(((",
  "a b c",
];
/** several forms, one to a line (a multi-line paste or snippet) */
export function multiSnippet(rnd: Rnd, lang: Lang): string {
  return Array.from({ length: int(rnd, 2, 4) }, () =>
    pick(rnd, SNIPPETS[lang])
  ).join("\n");
}
/** a snippet: mostly one form, sometimes 2 to 4 joined by newlines */
const snip = (rnd: Rnd, lang: Lang): string =>
  rnd() < 0.3 ? multiSnippet(rnd, lang) : pick(rnd, SNIPPETS[lang]);
/** text that does not parse (an unclosed bracket or string, a stray token): typed in text mode, then the editor is asked to go back to blocks */
export const BROKEN: Record<Lang, string[]> = {
  scheme: [
    "(define (f x",
    "(f 1 2",
    ")",
    '"unclosed',
    "[1 2)",
    "#;",
    "'",
    "(a . )",
    "(if",
    "#|",
  ],
  javascript: [
    "function f(",
    "if (x) {",
    '"abc',
    "}",
    "let = ;",
    "a +",
    "[1, 2",
    "f(1,",
    "/* open",
    "`tpl ${",
  ],
  python: [
    "def f(:",
    "if x",
    "    y = (",
    '"""abc',
    "x = [1,",
    "else:",
    "f(1,",
    "lambda",
    "  stray",
    "x = 'a",
  ],
};
export const COMMENT_WORDS = ["note", "a b c", "", "TODO: fix", "x; y"];
export const SEARCH_WORDS = ["x", "f", "1", "define", "zzz", "("];

const START: Record<Lang, string[]> = {
  scheme: [
    "(define x 5)\n(f 1 2)\n(if (> x 1) 2 3)",
    "(define (sq x) (* x x))\n(sq 3)\n(cond [(= x 2) 3] [else 4])\n42",
    "(a b c)\n(d)\n(e (f g) (h i))",
    "; a comment\n(define (fact n)\n  (if (<= n 1)\n      1\n      (* n (fact (- n 1)))))\n(fact 5)\n",
    "(let ([a 1] [b 2]) (+ a b))\n(lambda (x) x)\n'(1 2 3)\n",
    "",
  ],
  javascript: [
    "let x = 1 + 2;\nf(x, 3);\nwhile (x < 9) { x = x + 1; g(x); }",
    "function f(a, b) { return a * b; }\nf(1, 2);\nif (x) { f(1, 2); } else { g(); }",
    "a.b(c);\n[1, 2, 3];\nlet y = 5;",
    '// a comment\nfor (const x of [1, 2, 3]) {\n  total = total + x;\n}\nconsole.log(total, "done");\n',
    "class A {\n  m() {\n    return 1;\n  }\n}\nnew A().m();\n",
    "",
  ],
  python: [
    "x = 1 + 2\nf(x, 3)\nwhile x < 9:\n    x = x + 1\n    g(x)\ny = 2",
    "def f(a, b):\n    y = a\n    return y\nf(1, 2)\n",
    "if x:\n    f(1)\nelif y:\n    g()\nelse:\n    h()\n[1, 2]",
    '# a comment\ntotal = 0\nfor x in [1, 2, 3]:\n    total = total + x\nprint(total, "done")\n',
    "class A:\n    def m(self):\n        return 1\nA().m()\n",
    "",
  ],
};

// ---- random programs, per language: valid, with some nesting, comments and blank lines ----

const NAMES = ["x", "y", "f", "g", "h", "total", "n", "acc", "lst", "fact"];
const gen = {
  scheme(rnd: Rnd): string {
    const atom = (): string =>
      pick(rnd, [
        String(int(rnd, 0, 99)),
        pick(rnd, NAMES),
        '"s' + int(rnd, 0, 9) + '"',
        "#t",
        "#f",
        "'a",
      ]);
    const expr = (d: number): string => {
      if (d <= 0 || rnd() < 0.3) return atom();
      const r = rnd();
      const args = (k: number) =>
        Array.from({ length: k }, () => expr(d - 1)).join(" ");
      if (r < 0.45)
        return `(${pick(rnd, NAMES)} ${args(int(rnd, 0, 3))})`.replace(
          " )",
          ")"
        );
      if (r < 0.55) return `(if ${args(3)})`;
      if (r < 0.62)
        return `(cond [${expr(d - 1)} ${expr(d - 1)}] [else ${expr(d - 1)}])`;
      if (r < 0.7) return `(lambda (${pick(rnd, NAMES)}) ${expr(d - 1)})`;
      if (r < 0.78)
        return `(let ([${pick(rnd, NAMES)} ${expr(d - 1)}]) ${expr(d - 1)})`;
      if (r < 0.84) return `'(${args(int(rnd, 1, 3))})`;
      return `(${pick(rnd, ["+", "-", "*", "<", "="])} ${args(2)})`;
    };
    const forms: string[] = [];
    for (let i = int(rnd, 1, 8); i > 0; i--) {
      if (rnd() < 0.2) forms.push(`; ${pick(rnd, ["note", "TODO", "a b c"])}`);
      forms.push(
        rnd() < 0.35
          ? `(define ${pick(rnd, NAMES)} ${expr(3)})`
          : rnd() < 0.5
            ? `(define (${pick(rnd, NAMES)} ${pick(rnd, NAMES)}) ${expr(3)})`
            : expr(4)
      );
      if (rnd() < 0.15) forms.push("");
    }
    return forms.join("\n") + (rnd() < 0.7 ? "\n" : "");
  },
  javascript(rnd: Rnd): string {
    const atom = (): string =>
      pick(rnd, [
        String(int(rnd, 0, 99)),
        pick(rnd, NAMES),
        '"s' + int(rnd, 0, 9) + '"',
        "true",
        "null",
      ]);
    const expr = (d: number): string => {
      if (d <= 0 || rnd() < 0.3) return atom();
      const r = rnd();
      const args = (k: number) =>
        Array.from({ length: k }, () => expr(d - 1)).join(", ");
      if (r < 0.4) return `${pick(rnd, NAMES)}(${args(int(rnd, 0, 3))})`;
      if (r < 0.55)
        return `${expr(d - 1)} ${pick(rnd, ["+", "-", "*", "<", "==="])} ${expr(d - 1)}`;
      if (r < 0.65) return `[${args(int(rnd, 0, 3))}]`;
      if (r < 0.72) return `{a: ${expr(d - 1)}, b: ${expr(d - 1)}}`;
      if (r < 0.8)
        return `${pick(rnd, NAMES)}.${pick(rnd, NAMES)}(${args(int(rnd, 0, 2))})`;
      if (r < 0.88) return `(${pick(rnd, NAMES)}) => ${expr(d - 1)}`;
      return `${expr(d - 1)} ? ${expr(d - 1)} : ${expr(d - 1)}`;
    };
    const stmt = (d: number, inFn: boolean): string => {
      const r = rnd();
      const body = (): string =>
        `{\n${Array.from({ length: int(rnd, 1, 3) }, () => "  " + stmt(d - 1, inFn).replace(/\n/g, "\n  ")).join("\n")}\n}`;
      if (d > 0 && r < 0.12)
        return `if (${expr(2)}) ${body()}${rnd() < 0.4 ? ` else ${body()}` : ""}`;
      if (d > 0 && r < 0.2) return `while (${expr(2)}) ${body()}`;
      if (d > 0 && r < 0.27)
        return `for (const ${pick(rnd, NAMES)} of ${expr(1)}) ${body()}`;
      if (d > 0 && r < 0.35)
        return `function ${pick(rnd, NAMES)}(${pick(rnd, NAMES)}, ${pick(rnd, NAMES)}) ${bodyFn(d - 1)}`;
      if (inFn && r < 0.42) return `return ${expr(2)};`;
      if (r < 0.62)
        return `${pick(rnd, ["let", "const", "var"])} ${pick(rnd, NAMES)} = ${expr(3)};`;
      if (r < 0.7) return `${pick(rnd, NAMES)} = ${expr(2)};`;
      return `${expr(3)};`;
    };
    const bodyFn = (d: number): string =>
      `{\n${Array.from({ length: int(rnd, 1, 3) }, () => "  " + stmt(d, true).replace(/\n/g, "\n  ")).join("\n")}\n}`;
    const out: string[] = [];
    for (let i = int(rnd, 1, 8); i > 0; i--) {
      if (rnd() < 0.2) out.push(`// ${pick(rnd, ["note", "TODO", "a b c"])}`);
      out.push(stmt(2, false));
      if (rnd() < 0.15) out.push("");
    }
    return out.join("\n") + (rnd() < 0.7 ? "\n" : "");
  },
  python(rnd: Rnd): string {
    const atom = (): string =>
      pick(rnd, [
        String(int(rnd, 0, 99)),
        pick(rnd, NAMES),
        '"s' + int(rnd, 0, 9) + '"',
        "True",
        "None",
      ]);
    const expr = (d: number): string => {
      if (d <= 0 || rnd() < 0.3) return atom();
      const r = rnd();
      const args = (k: number) =>
        Array.from({ length: k }, () => expr(d - 1)).join(", ");
      if (r < 0.4) return `${pick(rnd, NAMES)}(${args(int(rnd, 0, 3))})`;
      if (r < 0.58)
        return `${expr(d - 1)} ${pick(rnd, ["+", "-", "*", "<", "=="])} ${expr(d - 1)}`;
      if (r < 0.7) return `[${args(int(rnd, 0, 3))}]`;
      if (r < 0.78) return `{${expr(d - 1)}: ${expr(d - 1)}}`;
      if (r < 0.86)
        return `${pick(rnd, NAMES)}.${pick(rnd, NAMES)}(${args(int(rnd, 0, 2))})`;
      return `lambda ${pick(rnd, NAMES)}: ${expr(d - 1)}`;
    };
    const block = (d: number, inFn: boolean): string[] =>
      Array.from({ length: int(rnd, 1, 3) }, () => stmt(d, inFn))
        .flat()
        .map((l) => "    " + l);
    const stmt = (d: number, inFn: boolean): string[] => {
      const r = rnd();
      if (d > 0 && r < 0.12) {
        const o = [`if ${expr(2)}:`, ...block(d - 1, inFn)];
        if (rnd() < 0.4) o.push("else:", ...block(d - 1, inFn));
        return o;
      }
      if (d > 0 && r < 0.2) return [`while ${expr(2)}:`, ...block(d - 1, inFn)];
      if (d > 0 && r < 0.27)
        return [
          `for ${pick(rnd, NAMES)} in ${expr(1)}:`,
          ...block(d - 1, inFn),
        ];
      if (d > 0 && r < 0.35)
        return [
          `def ${pick(rnd, NAMES)}(${pick(rnd, NAMES)}, ${pick(rnd, NAMES)}):`,
          ...block(d - 1, true),
        ];
      if (inFn && r < 0.42) return [`return ${expr(2)}`];
      if (r < 0.65) return [`${pick(rnd, NAMES)} = ${expr(3)}`];
      return [expr(3)];
    };
    const out: string[] = [];
    for (let i = int(rnd, 1, 8); i > 0; i--) {
      if (rnd() < 0.2) out.push(`# ${pick(rnd, ["note", "TODO", "a b c"])}`);
      out.push(...stmt(2, false));
      if (rnd() < 0.15) out.push("");
    }
    return out.join("\n") + (rnd() < 0.7 ? "\n" : "");
  },
};

// ---- chunks of real files (the corpora of scripts/corpus-lib.ts), cached in a file so that parallel workers do not each scan the repository ----

let chunkCache: Record<string, string[]> | null = null;
function corpusChunks(lang: Lang): string[] {
  if (!chunkCache) {
    const file =
      process.env.CMB6_SOAK_CORPUS ||
      path.join(__dirname, "..", "soak-results", "corpus-chunks.json");
    try {
      chunkCache = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (_) {
      chunkCache = {};
      try {
        const lib =
          require("../scripts/corpus-lib") as typeof import("../scripts/corpus-lib");
        const rnd = mulberry32(5);
        for (const c of lib.corpora()) {
          const out = (chunkCache[c.language] ??= []);
          for (const f of c.files) {
            if (out.length > 600 || f.text.length < 20) continue;
            if (rnd() > 0.3 && c.files.length > 40) continue;
            const lines = f.text.split("\n");
            const starts = lines
              .map((l, i) =>
                /^[^\s)\]}*/#;]/.test(l) ||
                (c.language === "scheme" && l.startsWith("("))
                  ? i
                  : -1
              )
              .filter((i) => i >= 0);
            if (!starts.length) continue;
            const s = starts[Math.floor(rnd() * starts.length)];
            const e = starts.find((i) => i >= s + 4) ?? lines.length;
            const chunk = lines.slice(s, Math.min(e, s + 40)).join("\n") + "\n";
            if (chunk.length < 4000) out.push(chunk);
          }
        }
        fs.mkdirSync(path.dirname(file), { recursive: true });
        const tmp = `${file}.${process.pid}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(chunkCache));
        fs.renameSync(tmp, file);
      } catch (_2) {
        /* no corpora here: the other sources do */
      }
    }
  }
  return chunkCache?.[lang] ?? [];
}

/** the fraction of sequences that start from a LONG document (default 0.18; `CMB6_SOAK_LONG_DOCS`, set by `soak.js --long-docs`, 0 turns it off) */
export function longDocs(): number {
  const v = Number(process.env.CMB6_SOAK_LONG_DOCS);
  return process.env.CMB6_SOAK_LONG_DOCS === undefined ||
    process.env.CMB6_SOAK_LONG_DOCS === "" ||
    !Number.isFinite(v)
    ? 0.18
    : Math.max(0, Math.min(1, v));
}
const LONG_MIN = 60;
const LONG_MAX = 400;
const COMMENT_LINE: Record<Lang, string> = {
  scheme: ";",
  javascript: "//",
  python: "#",
};
/** the number of top-level forms (lines that start at column 0 with something that is not a closer or a comment) */
export function topLevelForms(code: string): number {
  let n = 0;
  for (const l of code.split("\n"))
    if (/^[^\s)\]}]/.test(l) && !/^(;|\/\/|#(?![;|!]))/.test(l)) n++;
  return n;
}
/**
 * A long document of 60 to 400 top-level forms: generated programs, hand-written ones and chunks of real files, one after the other, with
 * blank lines and comments between them. Every piece starts at column 0 and ends with a newline, so the pieces stay separate forms.
 */
export function longProgram(lang: Lang, rnd: Rnd): string {
  const want = int(rnd, LONG_MIN, LONG_MAX);
  const chunks = corpusChunks(lang);
  const out: string[] = [];
  let forms = 0;
  let chars = 0;
  while (forms < want && chars < 120_000) {
    const r = rnd();
    let piece: string;
    if (r < 0.6) piece = gen[lang](rnd);
    else if (r < 0.8 && chunks.length) piece = pick(rnd, chunks);
    else piece = pick(rnd, START[lang]);
    if (piece.trim() === "") continue;
    if (!piece.endsWith("\n")) piece += "\n";
    out.push(piece);
    forms += topLevelForms(piece);
    chars += piece.length;
    if (rnd() < 0.2) out.push("\n");
    if (rnd() < 0.1)
      out.push(
        `${COMMENT_LINE[lang]} ${pick(rnd, ["note", "TODO", "a b c"])}\n`
      );
  }
  return out.join("");
}

/** a program for `lang`: mostly a small one (a hand-written one, a generated one or a piece of a real file), sometimes a long document */
export function randomProgram(lang: Lang, rnd: Rnd): string {
  if (rnd() < longDocs()) return longProgram(lang, rnd);
  const r = rnd();
  if (r < 0.25) return pick(rnd, START[lang]);
  if (r < 0.75) return gen[lang](rnd);
  const chunks = corpusChunks(lang);
  return chunks.length ? pick(rnd, chunks) : gen[lang](rnd);
}

// ---- steps ----

type Table = [number, (rnd: Rnd, lang: Lang) => Step][];
const f = (rnd: Rnd): number => rnd();
const KEYS: string[] = [
  "ArrowDown",
  "ArrowDown",
  "ArrowUp",
  "ArrowUp",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "Enter",
  "Space",
  "Space",
  "Escape",
  "Delete",
  "Backspace",
  "Shift+ArrowLeft",
  "Shift+ArrowRight",
  "Shift+Alt+ArrowLeft",
  "Shift+Alt+ArrowRight",
  "Control+[",
  "Control+]",
  "Shift+<",
  "Shift+|",
  "Mod+z",
  "Mod+Shift+z",
  "Mod+y",
  "Mod+Enter",
];

/** operations both engines run (jsdom through the editor's API and key events, Chromium through the real input) */
const COMMON: Table = [
  [10, (r) => ({ op: "focus", a: f(r) })],
  [14, (r) => ({ op: "key", key: pick(r, KEYS), a: f(r) })],
  [
    5,
    (r) => ({
      op: "editBox",
      a: f(r),
      text: pick(r, BOX_TEXTS),
      accept: r() < 0.7,
    }),
  ],
  [
    3,
    (r) => ({
      op: "typeIntoBlock",
      a: f(r),
      text: pick(r, ["7", "x", "(", "ab"]),
      accept: r() < 0.6,
    }),
  ],
  [
    3,
    (r) => ({
      op: "comment",
      a: f(r),
      text: pick(r, COMMENT_WORDS),
      accept: r() < 0.8,
    }),
  ],
  [4, (r) => ({ op: "collapse", a: f(r), on: r() < 0.6 })],
  [1, (r) => ({ op: "collapseAll", on: r() < 0.6 })],
  [4, (r) => ({ op: "toggleMode", a: f(r) })],
  [4, () => ({ op: "undo" })],
  [2, () => ({ op: "redo" })],
  [3, (r) => ({ op: "search", text: pick(r, SEARCH_WORDS), next: r() < 0.5 })],
  [
    6,
    (r, l) => ({
      op: "textEdit",
      a: f(r),
      len: Math.floor(r() * 4),
      w: r() < 0.3 ? "" : pick(r, WORDS[l]),
    }),
  ],
  [3, (r) => ({ op: "select", a: f(r) })],
  [2, () => ({ op: "clearSelection" })],
  [
    4,
    (r) => ({
      op: "topLevelType",
      a: f(r),
      text: pick(r, ["x", "(f 1)", "42", "(", "foo bar"]),
      accept: r() < 0.6,
      how: r() < 0.7 ? "type" : "paste",
    }),
  ],
];
/** wider operations (forty-sixth round) that both engines run */
const WIDE: Table = [
  // several forms pasted at the top level (a multi-line paste)
  [
    3,
    (r, l) => ({
      op: "pasteMulti",
      a: f(r),
      text: multiSnippet(r, l),
      accept: r() < 0.6,
    }),
  ],
  // broken syntax typed in text mode, then back to blocks (refused while it does not parse: the error-recovery path)
  [
    4,
    (r, l) => ({
      op: "brokenText",
      a: f(r),
      w: pick(r, BROKEN[l]),
      nl: r() < 0.5,
      back: r() < 0.7,
    }),
  ],
  [3, (r) => ({ op: "undoRun", n: 2 + int(r, 0, 3), redo: r() < 0.35 })],
  [
    2,
    (r) => ({
      op: "collapseBurst",
      a: f(r),
      n: 3 + int(r, 0, 5),
      on: r() < 0.7,
    }),
  ],
  [
    2,
    (r) => ({
      op: "collapseAllThen",
      on: r() < 0.8,
      a: f(r),
      text: pick(r, BOX_TEXTS),
      accept: r() < 0.7,
    }),
  ],
  [
    4,
    (r) => ({
      op: "multiSelect",
      a: f(r),
      n: 2 + int(r, 0, 3),
      then: pick(r, ["delete", "cut", "cutPaste", "copyPaste", "cutPaste"]),
      b: f(r),
    }),
  ],
  [
    3,
    (r) => ({
      op: "commentNear",
      a: f(r),
      dir: r() < 0.5 ? -1 : 1,
      text: pick(r, COMMENT_WORDS),
      accept: r() < 0.8,
    }),
  ],
];
/** the editor's API (a program or a tool calls these; a person does not press them) */
const API: Table = [
  [
    6,
    (r, l) => ({
      op: "insertText",
      a: f(r),
      b: f(r),
      text: snip(r, l),
    }),
  ],
  [5, (r) => ({ op: "removeNode", a: f(r), b: f(r) })],
  [2, () => ({ op: "removeSelection" })],
  [3, (r) => ({ op: "moveNode", a: f(r), b: f(r) })],
  [2, (r) => ({ op: "moveSelection", a: f(r) })],
  [
    3,
    (r, l) => ({
      op: "pasteText",
      a: f(r),
      text: snip(r, l),
      before: r() < 0.3,
    }),
  ],
  [2, (r, l) => ({ op: "replaceText", a: f(r), text: snip(r, l) })],
  [
    1,
    (r, l) => ({
      op: "replaceWithTexts",
      a: f(r),
      texts: [pick(r, SNIPPETS[l]), pick(r, SNIPPETS[l])].slice(
        0,
        1 + int(r, 0, 1)
      ),
    }),
  ],
  [2, (r) => ({ op: "insertTemplate", t: f(r), a: f(r) })],
  [2, (r) => ({ op: "insertTemplateAt", t: f(r), a: f(r), b: f(r) })],
  [2, (r) => ({ op: "setComment", a: f(r), text: pick(r, COMMENT_WORDS) })],
  [
    2,
    (r, l) => ({
      op: "replaceDoc",
      text:
        r() < 0.15
          ? multiSnippet(r, l) + "\n"
          : r() < 0.5
            ? pick(r, START[l])
            : gen[l](r),
    }),
  ],
];
/** the real mouse (Chromium only) */
const MOUSE: Table = [
  [8, (r) => ({ op: "click", a: f(r), shift: r() < 0.2 })],
  [
    6,
    (r) => ({
      op: "dragBlock",
      a: f(r),
      b: f(r),
      where: pick(r, ["gap", "gap", "block", "whitespace", "end", "trash"]),
    }),
  ],
  [
    5,
    (r) => ({
      op: "dragTemplate",
      t: f(r),
      b: f(r),
      where: pick(r, ["gap", "block", "whitespace", "end"]),
    }),
  ],
  [3, (r) => ({ op: "dragSelection", a: f(r), b: f(r), n: 2 + int(r, 0, 2) })],
  [2, (r) => ({ op: "clickTemplate", t: f(r) })],
  [2, (r) => ({ op: "scroll", a: f(r) })],
];

/** the keys pressed right after a scroll (the focused block may now be outside the drawn part of the document) */
const SCROLL_KEYS = [
  "ArrowDown",
  "ArrowUp",
  "ArrowLeft",
  "ArrowRight",
  "Enter",
  "Space",
  "Shift+ArrowRight",
  "Home",
  "End",
];

/** a long document gets fewer steps: the invariants read the whole document after each step (60 forms or fewer: all of them) */
export function stepsFor(code: string, nSteps: number): number {
  const forms = topLevelForms(code);
  return forms <= 60
    ? nSteps
    : Math.min(nSteps, Math.max(12, Math.round((nSteps * 60) / forms) + 10));
}

/**
 * one random step. `engine` decides which tables are used; `motion` shifts them (the `--motion` runs favour the toggle); `long`: the document
 * is long (Chromium: more scrolling, and a key or the toggle right after it)
 */
export function genStep(
  rnd: Rnd,
  lang: Lang,
  engine: Engine,
  motion = false,
  long = false
): Step {
  // (Chromium runs the few API calls that a page's own code would make: an insert, a removal, a replaced document)
  const all: Table =
    engine === "jsdom"
      ? [...COMMON, ...WIDE, ...API]
      : [...COMMON, ...WIDE, ...MOUSE, API[0], API[1], API[API.length - 1]];
  if (motion) all.push([40, (r) => ({ op: "toggleMode", a: f(r) })]);
  if (long && engine === "chromium") {
    all.push([14, (r) => ({ op: "scroll", a: f(r) })]);
    all.push([
      5,
      (r) => ({ op: "scrollKey", a: f(r), key: pick(r, SCROLL_KEYS) }),
    ]);
    all.push([3, (r) => ({ op: "scrollToggle", a: f(r) })]);
  }
  let total = 0;
  for (const [w] of all) total += w;
  let x = rnd() * total;
  for (const [w, g] of all) {
    x -= w;
    if (x < 0) return g(rnd, lang);
  }
  return all[0][1](rnd, lang);
}

export interface Sequence {
  engine: Engine;
  seed: number;
  language: Lang;
  code: string;
  steps: Step[];
  /** Chromium: "full" motion (the morph on) or "reduced" */
  motion?: "full" | "reduced";
}

/** the whole sequence of `seed`: its language, program, motion setting and steps. The same seed always gives the same sequence. */
export function makeSequence(
  engine: Engine,
  seed: number,
  nSteps: number,
  opts: { language?: Lang; motion?: boolean } = {}
): Sequence {
  const rnd = mulberry32(seed * 7919 + (engine === "jsdom" ? 1 : 2));
  const language = opts.language ?? pick(rnd, LANG_NAMES);
  const code = randomProgram(language, rnd);
  const motion = rnd() < (opts.motion ? 0.8 : 0.35) ? "full" : "reduced";
  const long = topLevelForms(code) > 60;
  const steps = Array.from({ length: stepsFor(code, nSteps) }, () =>
    genStep(rnd, language, engine, !!opts.motion, long)
  );
  return { engine, seed, language, code, steps, motion };
}

/**
 * Remove steps while the failure stays (`stillFails` runs a candidate and says whether it fails the same way). Halves, then single steps;
 * at most `maxRuns` runs. The steps after the failing one are dropped first by the caller.
 */
export async function shrink(
  steps: Step[],
  stillFails: (candidate: Step[]) => Promise<boolean>,
  maxRuns: number
): Promise<Step[]> {
  let cur = steps;
  let runs = 0;
  let chunk = Math.ceil(cur.length / 2);
  while (chunk >= 1 && runs < maxRuns) {
    let removed = false;
    for (let i = 0; i < cur.length && runs < maxRuns;) {
      const cand = [...cur.slice(0, i), ...cur.slice(i + chunk)];
      if (cand.length === cur.length || !cand.length) {
        i += chunk;
        continue;
      }
      runs++;
      if (await stillFails(cand)) {
        cur = cand;
        removed = true;
      } else i += chunk;
    }
    if (!removed || chunk === 1) chunk = Math.floor(chunk / 2);
  }
  return cur;
}

/** what a worker reports for one violated invariant */
export interface Violation {
  invariant: string;
  message: string;
  /** index of the step after which it was found (-1: before any, `steps.length`: at the end) */
  step: number;
  op: string;
}
