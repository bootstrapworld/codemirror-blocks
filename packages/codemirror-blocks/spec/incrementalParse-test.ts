import type { EditorChange } from "codemirror";
import wescheme from "../src/languages/wescheme";
import { AST, ASTNode } from "../src/ast";
import { incrementalBuildAST } from "../src/edits/incrementalParse";
import { changeEnd } from "../src/utils";

/**
 * The AST built by parsing only the forms around an edit must be the one a full
 * parse gives (apart from the ids, which a full parse makes up new).
 */

const describeNode = (n: ASTNode): unknown => ({
  type: n.type,
  from: n.from,
  to: n.to,
  hash: n.hash,
  nid: n.nid,
  level: n.level,
  setSize: n.ariaSetSize,
  posInset: n.ariaPosInset,
  text: n.toString(),
  label: n.shortDescription(),
  comment: n.options.comment && describeNode(n.options.comment),
  children: [...n.children()].map(describeNode),
});

const describeAst = (ast: AST) => ast.rootNodes.map(describeNode);

/** CodeMirror's text of `text` after `change` */
function apply(text: string, c: EditorChange) {
  const lines = text.split("\n");
  const before = lines
    .slice(0, c.from.line)
    .concat(lines[c.from.line].slice(0, c.from.ch));
  const after = lines[c.to.line].slice(c.to.ch);
  const inserted = c.text.join("\n");
  const head = before.join("\n");
  const tail = [after, ...lines.slice(c.to.line + 1)].join("\n");
  return head + inserted + tail;
}

// a small deterministic generator
const random = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

const generated: (
  lines: number
) => string = require("../../../doc/experiments/profile-large-doc/gen.js");

const COMMENTED = [
  "; heading",
  "(define (f x y) ; a comment",
  "  (cond [(< x 1) (+ x y)]",
  '        [else (string-append "a b" "c")]))',
  "",
  "(check-expect (f 1 2) 3)  ; trailing",
  "#| block",
  "   comment |#",
  "(define k 7) (define j 8)",
  "",
  "(g (h 1 2)",
  "   3)",
  "'(1 2 3)",
  '"a string"',
  "foo",
].join("\n");

const FRAGMENTS = [
  "",
  " ",
  "\n",
  "9",
  "(",
  ")",
  '"',
  "x y",
  " (a b)",
  "\n(z)\n",
  "; c\n",
  "#|",
  "|#",
  "'",
  "[",
  "]",
  "(define (q) 1)",
];

const DOCS = [COMMENTED, generated(60), "(a)\n(b) ; c\n(d)\n\n\n(e (f))"];

describe("parsing only the forms around an edit", () => {
  it("gives the AST a full parse gives, for any single edit", () => {
    const rnd = random(12345);
    let incremental = 0;
    let fallbacks = 0;
    for (let i = 0; i < 1200; i++) {
      const text = DOCS[i % DOCS.length];
      const lines = text.split("\n");
      const pick = () => {
        const line = Math.floor(rnd() * lines.length);
        return { line, ch: Math.floor(rnd() * (lines[line].length + 1)) };
      };
      let from = pick();
      let to = pick();
      if (from.line > to.line || (from.line === to.line && from.ch > to.ch)) {
        [from, to] = [to, from];
      }
      if (rnd() < 0.5) to = from; // a pure insertion half of the time
      const fragment = FRAGMENTS[Math.floor(rnd() * FRAGMENTS.length)];
      const change = {
        from,
        to,
        text: fragment.split("\n"),
        removed: [""],
        origin: "+input",
      } as EditorChange;
      void changeEnd;
      const newText = apply(text, change);

      let expected: AST | undefined;
      try {
        expected = wescheme.buildAST(newText);
      } catch {
        expected = undefined;
      }
      const oldAst = wescheme.buildAST(text);
      const got = incrementalBuildAST(wescheme, oldAst, change, text, newText);
      if (!got) {
        fallbacks++;
        continue;
      }
      incremental++;
      // when it answers, the full parse must succeed and agree
      expect(expected).toBeDefined();
      expect(describeAst(got)).toEqual(describeAst(expected!));
      // and the old AST is untouched
      expect(describeAst(oldAst)).toEqual(describeAst(wescheme.buildAST(text)));
    }
    // (a test that always fell back would prove nothing)
    expect(incremental).toBeGreaterThan(200);
    expect(fallbacks).toBeGreaterThan(0);
  });
});
