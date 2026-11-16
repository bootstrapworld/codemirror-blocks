/** @jest-environment jsdom */
import { parser as jsParser } from "@lezer/javascript";
import { parser as pyParser } from "@lezer/python";
import { parser as scParser } from "cm6-lezer-scheme-common-lang";
import { NodeWeakMap, Tree, TreeFragment } from "@lezer/common";
import type { Parser } from "@lezer/common";
import { scheme } from "../src/lang-scheme";
import { javascript } from "../src/lang-javascript";
import { python } from "../src/lang-python";
import { insertChange, removeChange, LezerLanguage } from "../src/lezer";
import { wescheme } from "../src/wescheme";
import { applyText } from "../src/doc";
import { Renderer } from "../src/render";
import type { BNode, Slot } from "../src/types";

const outline = (n: BNode, d = 0): string => {
  const head =
    "  ".repeat(d) +
    n.kind +
    (n.value !== undefined ? ` ${JSON.stringify(n.value)}` : "") +
    ` [${n.from},${n.to})`;
  const kids = n.slots
    .map(
      (s) =>
        "  ".repeat(d + 1) +
        s.name +
        (s.kind === "list" ? "*" : "") +
        "\n" +
        s.nodes.map((c) => outline(c, d + 2)).join("\n")
    )
    .join("\n");
  return kids ? head + "\n" + kids.replace(/\n$/, "") : head;
};
const shape = (n: BNode): string =>
  `${n.kind}[${n.from},${n.to}]${n.value ?? ""}{${n.slots.map((s) => s.name + ":" + s.kind + "(" + s.nodes.map(shape).join(" ") + ")").join(" ")}}`;

function rawTree(p: Parser, src: string): string {
  const out: string[] = [];
  let d = 0;
  p.parse(src).iterate({
    enter(n) {
      out.push("  ".repeat(d++) + n.name + " " + n.from + "-" + n.to);
    },
    leave() {
      d--;
    },
  });
  return out.join("\n");
}

/** characters the table does not carry into any leaf block, minus punctuation and the table's keywords */
function lost(
  lang: LezerLanguage,
  p: Parser,
  text: string,
  roots: BNode[]
): string[] {
  const leaves: [number, number][] = [];
  const walk = (n: BNode) => {
    if (!n.slots.length) leaves.push([n.from, n.to]);
    n.slots.forEach((s) => s.nodes.forEach(walk));
  };
  roots.forEach(walk);
  const kws = new Set(
    Object.values(lang.table.nodes)
      .map((r) => r.keyword)
      .filter(Boolean)
  );
  const out: string[] = [];
  p.parse(text).iterate({
    enter(n) {
      if (n.node.firstChild || n.type.isError) return;
      const t = text.slice(n.from, n.to);
      if (
        leaves.some(([a, b]) => a <= n.from && n.to <= b) ||
        /^[()[\]{},;:.=\s]*$/.test(t) ||
        kws.has(t) ||
        t === n.name
      )
        return;
      out.push(`${n.name} ${JSON.stringify(t)}`);
    },
  });
  return out;
}

/** every non-blank block spans exactly some Lezer node */
function rangesAreLezer(p: Parser, text: string, roots: BNode[]): string[] {
  const r = new Set<string>();
  p.parse(text).iterate({
    enter(n) {
      r.add(n.from + "-" + n.to);
    },
  });
  const bad: string[] = [];
  const walk = (n: BNode) => {
    if (n.kind !== "blank" && !r.has(n.from + "-" + n.to))
      bad.push(n.kind + " " + n.from + "-" + n.to);
    n.slots.forEach((s) => s.nodes.forEach(walk));
  };
  roots.forEach(walk);
  return bad;
}

function report(lang: LezerLanguage, p: Parser, programs: string[]): string {
  return programs
    .map((text) => {
      const roots = lang.parse(text);
      expect(rangesAreLezer(p, text, roots)).toEqual([]);
      return (
        `== ${JSON.stringify(text)}\n` +
        roots.map((r) => outline(r)).join("\n") +
        `\nLOST: ${JSON.stringify(lost(lang, p, text, roots))}`
      );
    })
    .join("\n");
}

const SCHEME = [
  "42",
  `"hi" #t x`,
  "(f 1 2)",
  "(define x 5)",
  "(define (f x) (* x 2))",
  "(lambda (a) a)",
  "(if (> x 1) 2 3)",
  "(cond [(= x 2) 3] [else 4])",
  "(f (g 1) (h (i 2)))",
  '(define (f x) (if (> x 1) "a" (cond [(= x 2) 3] [else 4])))',
  "(if 1 2)",
  "; hi\n(f ; c\n 1)",
];
const JS = [
  "let x = 1 + 2;",
  "function f(a, b) { return a * b; }",
  "if (x) { f(1, 2); } else { g(); }",
  "while (i < 10) { i = i + 1; }",
  "for (const x of xs) { f(x); }",
  "a.b(c);",
  "[1, 2];",
  "({a: 1});",
];
const PY = [
  "x = 1 + 2",
  "def f(a, b):\n    y = a\n    return y",
  "if x:\n    f(1)\nelif y:\n    g()\nelse:\n    h()",
  "while i < 3:\n    i = i + 1",
  "for x in xs:\n    f(x)",
  "f(1, 2)",
  "[1, 2]",
];

describe("raw trees (what the grammars produce)", () => {
  test("JavaScript and Python, abbreviated", () => {
    expect(
      rawTree(jsParser, "let x = 1 + 2;\nf(a.b, [1]);") +
        "\n---\n" +
        rawTree(pyParser, "def f(a):\n    y = a\n")
    ).toMatchInlineSnapshot(`
     "Script 0-27
       VariableDeclaration 0-14
         let 0-3
         VariableDefinition 4-5
         Equals 6-7
         BinaryExpression 8-13
           Number 8-9
           ArithOp 10-11
           Number 12-13
         ; 13-14
       ExpressionStatement 15-27
         CallExpression 15-26
           VariableName 15-16
           ArgList 16-26
             ( 16-17
             MemberExpression 17-20
               VariableName 17-18
               . 18-19
               PropertyName 19-20
             , 20-21
             ArrayExpression 22-25
               [ 22-23
               Number 23-24
               ] 24-25
             ) 25-26
         ; 26-27
     ---
     Script 0-20
       FunctionDefinition 0-20
         def 0-3
         VariableName 4-5
         ParamList 5-8
           ( 5-6
           VariableName 6-7
           ) 7-8
         Body 8-20
           : 8-9
           AssignStatement 14-19
             VariableName 14-15
             AssignOp 16-17
             VariableName 18-19"
    `);
  });
});

describe("outlines", () => {
  test("Scheme", () => {
    expect(report(scheme, scParser, SCHEME)).toMatchInlineSnapshot(`
     "== "42"
     literal "42" [0,2)
     LOST: []
     == "\\"hi\\" #t x"
     literal "\\"hi\\"" [0,4)
     literal "#t" [5,7)
     literal "x" [8,9)
     LOST: []
     == "(f 1 2)"
     call [0,7)
       func
         literal "f" [1,2)
       args*
         literal "1" [3,4)
         literal "2" [5,6)
     LOST: []
     == "(define x 5)"
     define [0,12)
       name
         literal "x" [8,9)
       value
         literal "5" [10,11)
     LOST: []
     == "(define (f x) (* x 2))"
     define [0,22)
       name
         call [8,13)
           func
             literal "f" [9,10)
           args*
             literal "x" [11,12)
       value
         call [14,21)
           func
             literal "*" [15,16)
           args*
             literal "x" [17,18)
             literal "2" [19,20)
     LOST: []
     == "(lambda (a) a)"
     lambda [0,14)
       params
         call [8,11)
           func
             literal "a" [9,10)
           args*
       body
         literal "a" [12,13)
     LOST: []
     == "(if (> x 1) 2 3)"
     if [0,16)
       test
         call [4,11)
           func
             literal ">" [5,6)
           args*
             literal "x" [7,8)
             literal "1" [9,10)
       then
         literal "2" [12,13)
       else
         literal "3" [14,15)
     LOST: []
     == "(cond [(= x 2) 3] [else 4])"
     cond [0,27)
       clauses*
         clause [6,17)
           test
             call [7,14)
               func
                 literal "=" [8,9)
               args*
                 literal "x" [10,11)
                 literal "2" [12,13)
           body*
             literal "3" [15,16)
         clause [18,26)
           test
             literal "else" [19,23)
           body*
             literal "4" [24,25)
     LOST: []
     == "(f (g 1) (h (i 2)))"
     call [0,19)
       func
         literal "f" [1,2)
       args*
         call [3,8)
           func
             literal "g" [4,5)
           args*
             literal "1" [6,7)
         call [9,18)
           func
             literal "h" [10,11)
           args*
             call [12,17)
               func
                 literal "i" [13,14)
               args*
                 literal "2" [15,16)
     LOST: []
     == "(define (f x) (if (> x 1) \\"a\\" (cond [(= x 2) 3] [else 4])))"
     define [0,59)
       name
         call [8,13)
           func
             literal "f" [9,10)
           args*
             literal "x" [11,12)
       value
         if [14,58)
           test
             call [18,25)
               func
                 literal ">" [19,20)
               args*
                 literal "x" [21,22)
                 literal "1" [23,24)
           then
             literal "\\"a\\"" [26,29)
           else
             cond [30,57)
               clauses*
                 clause [36,47)
                   test
                     call [37,44)
                       func
                         literal "=" [38,39)
                       args*
                         literal "x" [40,41)
                         literal "2" [42,43)
                   body*
                     literal "3" [45,46)
                 clause [48,56)
                   test
                     literal "else" [49,53)
                   body*
                     literal "4" [54,55)
     LOST: []
     == "(if 1 2)"
     call [0,8)
       func
         literal "if" [1,3)
       args*
         literal "1" [4,5)
         literal "2" [6,7)
     LOST: []
     == "; hi\\n(f ; c\\n 1)"
     comment "; hi" [0,4)
     call [5,15)
       func
         literal "f" [6,7)
       args*
         literal "1" [13,14)
     LOST: ["LineComment \\"; c\\""]"
    `);
  });
  test("JavaScript", () => {
    expect(report(javascript, jsParser, JS)).toMatchInlineSnapshot(`
     "== "let x = 1 + 2;"
     declare [0,14)
       name
         literal "x" [4,5)
       value
         binary [8,13)
           left
             literal "1" [8,9)
           rest*
             operator "+" [10,11)
             literal "2" [12,13)
       rest*
     LOST: []
     == "function f(a, b) { return a * b; }"
     function [0,34)
       name
         literal "f" [9,10)
       params*
         literal "a" [11,12)
         literal "b" [14,15)
       body
         block [17,34)
           body*
             return [19,32)
               value
                 binary [26,31)
                   left
                     literal "a" [26,27)
                   rest*
                     operator "*" [28,29)
                     literal "b" [30,31)
     LOST: []
     == "if (x) { f(1, 2); } else { g(); }"
     if [0,33)
       test
         literal "x" [4,5)
       then
         block [7,19)
           body*
             statement [9,17)
               expr
                 call [9,16)
                   func
                     literal "f" [9,10)
                   args*
                     literal "1" [11,12)
                     literal "2" [14,15)
       else*
         block [25,33)
           body*
             statement [27,31)
               expr
                 call [27,30)
                   func
                     literal "g" [27,28)
                   args*
     LOST: []
     == "while (i < 10) { i = i + 1; }"
     while [0,29)
       test
         binary [7,13)
           left
             literal "i" [7,8)
           rest*
             operator "<" [9,10)
             literal "10" [11,13)
       body
         block [15,29)
           body*
             statement [17,27)
               expr
                 assign [17,26)
                   target
                     literal "i" [17,18)
                   value
                     binary [21,26)
                       left
                         literal "i" [21,22)
                       rest*
                         operator "+" [23,24)
                         literal "1" [25,26)
     LOST: []
     == "for (const x of xs) { f(x); }"
     for [0,29)
       var
         literal "x" [11,12)
       iterable
         literal "xs" [16,18)
       body
         block [20,29)
           body*
             statement [22,27)
               expr
                 call [22,26)
                   func
                     literal "f" [22,23)
                   args*
                     literal "x" [24,25)
     LOST: []
     == "a.b(c);"
     statement [0,7)
       expr
         call [0,6)
           func
             member [0,3)
               object
                 literal "a" [0,1)
               property
                 literal "b" [2,3)
           args*
             literal "c" [4,5)
     LOST: []
     == "[1, 2];"
     statement [0,7)
       expr
         array [0,6)
           elements*
             literal "1" [1,2)
             literal "2" [4,5)
     LOST: []
     == "({a: 1});"
     statement [0,9)
       expr
         object [1,7)
           properties*
             property [2,6)
               key
                 literal "a" [2,3)
               value
                 literal "1" [5,6)
     LOST: []"
    `);
  });
  test("Python", () => {
    expect(report(python, pyParser, PY)).toMatchInlineSnapshot(`
     "== "x = 1 + 2"
     assign [0,9)
       target
         literal "x" [0,1)
       value
         binary [4,9)
           left
             literal "1" [4,5)
           op
             operator "+" [6,7)
           right
             literal "2" [8,9)
     LOST: []
     == "def f(a, b):\\n    y = a\\n    return y"
     function [0,35)
       name
         literal "f" [4,5)
       params*
         literal "a" [6,7)
         literal "b" [9,10)
       body
         body [11,35)
           body*
             assign [17,22)
               target
                 literal "y" [17,18)
               value
                 literal "a" [21,22)
             return [27,35)
               value
                 literal "y" [34,35)
     LOST: []
     == "if x:\\n    f(1)\\nelif y:\\n    g()\\nelse:\\n    h()"
     if [0,44)
       test
         literal "x" [3,4)
       then
         body [4,15)
           body*
             statement [10,14)
               expr
                 call [10,14)
                   func
                     literal "f" [10,11)
                   args*
                     literal "1" [12,13)
       rest*
         literal "y" [20,21)
         body [21,31)
           body*
             statement [27,30)
               expr
                 call [27,30)
                   func
                     literal "g" [27,28)
                   args*
         body [35,44)
           body*
             statement [41,44)
               expr
                 call [41,44)
                   func
                     literal "h" [41,42)
                   args*
     LOST: []
     == "while i < 3:\\n    i = i + 1"
     while [0,26)
       test
         binary [6,11)
           left
             literal "i" [6,7)
           op
             operator "<" [8,9)
           right
             literal "3" [10,11)
       body
         body [11,26)
           body*
             assign [17,26)
               target
                 literal "i" [17,18)
               value
                 binary [21,26)
                   left
                     literal "i" [21,22)
                   op
                     operator "+" [23,24)
                   right
                     literal "1" [25,26)
     LOST: []
     == "for x in xs:\\n    f(x)"
     for [0,21)
       var
         literal "x" [4,5)
       iterable
         literal "xs" [9,11)
       body
         body [11,21)
           body*
             statement [17,21)
               expr
                 call [17,21)
                   func
                     literal "f" [17,18)
                   args*
                     literal "x" [19,20)
     LOST: []
     == "f(1, 2)"
     statement [0,7)
       expr
         call [0,7)
           func
             literal "f" [0,1)
           args*
             literal "1" [2,3)
             literal "2" [5,6)
     LOST: []
     == "[1, 2]"
     statement [0,6)
       expr
         array [0,6)
           elements*
             literal "1" [1,2)
             literal "2" [4,5)
     LOST: []"
    `);
  });
});

describe("Scheme: against the hand-written wescheme", () => {
  const PROGS = SCHEME.filter((p) => !p.includes(";"));
  test("same kinds, slots and ranges where it holds; the differences listed", () => {
    const diffs: string[] = [];
    for (const p of PROGS) {
      const a = wescheme.parse(p).map(shape).join(" "),
        b = scheme.parse(p).map(shape).join(" ");
      if (a !== b) diffs.push(`${p}\n  wescheme: ${a}\n  lezer:    ${b}`);
    }
    expect(diffs.join("\n")).toMatchInlineSnapshot(`
     "(if 1 2)
       wescheme: unknown[0,8]{elts:list(literal[1,3]if{} literal[4,5]1{} literal[6,7]2{})}
       lezer:    call[0,8]{func:one(literal[1,3]if{}) args:list(literal[4,5]1{} literal[6,7]2{})}"
    `);
  });
});

describe("the renderer, unchanged", () => {
  test("one JavaScript and one Python program", () => {
    const out = (
      [
        [javascript, "function f(a, b) { return a * b; }\nif (x) { f(1, 2); }"],
        [python, "def f(a, b):\n    y = a\n    return y\n"],
      ] as const
    ).map(([lang, text]) => {
      const r = new Renderer(lang);
      return lang
        .parse(text)
        .map((n) => r.element(n).outerHTML.replace(/ data-id="\d+"/g, ""))
        .join("\n");
    });
    expect(out.join("\n---\n")).toMatchInlineSnapshot(`
     "<span class="blocks-node blocks-function blocks-compound" id="cmb6-node-352" role="treeitem" tabindex="-1" contenteditable="false" aria-label="function f with 2 parameters" aria-level="1" aria-setsize="1" aria-posinset="1" aria-expanded="true"><span class="blocks-operator">function</span><span class="blocks-slot" data-slot="name"><span class="blocks-node blocks-literal blocks-value" id="cmb6-node-353" role="treeitem" tabindex="-1" contenteditable="false" aria-label="name f" aria-level="2" aria-setsize="1" aria-posinset="1"><span class="blocks-literal blocks-literal-symbol">f</span></span></span><span class="blocks-args" data-slot="params" role="group"><span class="blocks-gap" data-slot="params" data-index="0" aria-hidden="true"></span><span class="blocks-node blocks-literal blocks-value" id="cmb6-node-354" role="treeitem" tabindex="-1" contenteditable="false" aria-label="name a" aria-level="2" aria-setsize="2" aria-posinset="1"><span class="blocks-literal blocks-literal-symbol">a</span></span><span class="blocks-gap" data-slot="params" data-index="1" aria-hidden="true"></span><span class="blocks-node blocks-literal blocks-value" id="cmb6-node-355" role="treeitem" tabindex="-1" contenteditable="false" aria-label="name b" aria-level="2" aria-setsize="2" aria-posinset="2"><span class="blocks-literal blocks-literal-symbol">b</span></span><span class="blocks-gap" data-slot="params" data-index="2" aria-hidden="true"></span></span><span class="blocks-slot" data-slot="body"><span class="blocks-node blocks-block blocks-compound" id="cmb6-node-356" role="treeitem" tabindex="-1" contenteditable="false" aria-label="block with 1 body" aria-level="2" aria-setsize="1" aria-posinset="1" aria-expanded="true"><span class="blocks-args" data-slot="body" role="group"><span class="blocks-gap" data-slot="body" data-index="0" aria-hidden="true"></span><span class="blocks-node blocks-return blocks-compound" id="cmb6-node-357" role="treeitem" tabindex="-1" contenteditable="false" aria-label="return a * b" aria-level="3" aria-setsize="1" aria-posinset="1" aria-expanded="true"><span class="blocks-operator">return</span><span class="blocks-slot" data-slot="value"><span class="blocks-node blocks-binary blocks-compound" id="cmb6-node-358" role="treeitem" tabindex="-1" contenteditable="false" aria-label="a *, b" aria-level="4" aria-setsize="1" aria-posinset="1" aria-expanded="true"><span class="blocks-slot" data-slot="left"><span class="blocks-node blocks-literal blocks-value" id="cmb6-node-359" role="treeitem" tabindex="-1" contenteditable="false" aria-label="name a" aria-level="5" aria-setsize="1" aria-posinset="1"><span class="blocks-literal blocks-literal-symbol">a</span></span></span><span class="blocks-args" data-slot="rest" role="group"><span class="blocks-gap" data-slot="rest" data-index="0" aria-hidden="true"></span><span class="blocks-node blocks-operator blocks-value" id="cmb6-node-360" role="treeitem" tabindex="-1" contenteditable="false" aria-label="operator *" aria-level="5" aria-setsize="2" aria-posinset="1"><span class="blocks-literal blocks-literal-other">*</span></span><span class="blocks-gap" data-slot="rest" data-index="1" aria-hidden="true"></span><span class="blocks-node blocks-literal blocks-value" id="cmb6-node-361" role="treeitem" tabindex="-1" contenteditable="false" aria-label="name b" aria-level="5" aria-setsize="2" aria-posinset="2"><span class="blocks-literal blocks-literal-symbol">b</span></span><span class="blocks-gap" data-slot="rest" data-index="2" aria-hidden="true"></span></span></span></span></span><span class="blocks-gap" data-slot="body" data-index="1" aria-hidden="true"></span></span></span></span></span>
     <span class="blocks-node blocks-if blocks-compound" id="cmb6-node-362" role="treeitem" tabindex="-1" contenteditable="false" aria-label="if x" aria-level="1" aria-setsize="1" aria-posinset="1" aria-expanded="true"><span class="blocks-operator">if</span><span class="blocks-slot" data-slot="test"><span class="blocks-node blocks-literal blocks-value" id="cmb6-node-363" role="treeitem" tabindex="-1" contenteditable="false" aria-label="name x" aria-level="2" aria-setsize="1" aria-posinset="1"><span class="blocks-literal blocks-literal-symbol">x</span></span></span><span class="blocks-slot" data-slot="then"><span class="blocks-node blocks-block blocks-compound" id="cmb6-node-364" role="treeitem" tabindex="-1" contenteditable="false" aria-label="block with 1 body" aria-level="2" aria-setsize="1" aria-posinset="1" aria-expanded="true"><span class="blocks-args" data-slot="body" role="group"><span class="blocks-gap" data-slot="body" data-index="0" aria-hidden="true"></span><span class="blocks-node blocks-statement blocks-compound" id="cmb6-node-365" role="treeitem" tabindex="-1" contenteditable="false" aria-label="statement with 1 expr" aria-level="3" aria-setsize="1" aria-posinset="1" aria-expanded="true"><span class="blocks-slot" data-slot="expr"><span class="blocks-node blocks-call blocks-compound" id="cmb6-node-366" role="treeitem" tabindex="-1" contenteditable="false" aria-label="call to f with 2 arguments" aria-level="4" aria-setsize="1" aria-posinset="1" aria-expanded="true"><span class="blocks-slot blocks-operator" data-slot="func"><span class="blocks-node blocks-literal blocks-value" id="cmb6-node-367" role="treeitem" tabindex="-1" contenteditable="false" aria-label="name f" aria-level="5" aria-setsize="1" aria-posinset="1"><span class="blocks-literal blocks-literal-symbol">f</span></span></span><span class="blocks-args" data-slot="args" role="group"><span class="blocks-gap" data-slot="args" data-index="0" aria-hidden="true"></span><span class="blocks-node blocks-literal blocks-value" id="cmb6-node-368" role="treeitem" tabindex="-1" contenteditable="false" aria-label="number 1" aria-level="5" aria-setsize="2" aria-posinset="1"><span class="blocks-literal blocks-literal-number">1</span></span><span class="blocks-gap" data-slot="args" data-index="1" aria-hidden="true"></span><span class="blocks-node blocks-literal blocks-value" id="cmb6-node-369" role="treeitem" tabindex="-1" contenteditable="false" aria-label="number 2" aria-level="5" aria-setsize="2" aria-posinset="2"><span class="blocks-literal blocks-literal-number">2</span></span><span class="blocks-gap" data-slot="args" data-index="2" aria-hidden="true"></span></span></span></span></span><span class="blocks-gap" data-slot="body" data-index="1" aria-hidden="true"></span></span></span></span><span class="blocks-args" data-slot="else" role="group"><span class="blocks-gap" data-slot="else" data-index="0" aria-hidden="true"></span></span></span>
     ---
     <span class="blocks-node blocks-function blocks-compound" id="cmb6-node-370" role="treeitem" tabindex="-1" contenteditable="false" aria-label="function f with 2 parameters" aria-level="1" aria-setsize="1" aria-posinset="1" aria-expanded="true"><span class="blocks-operator">def</span><span class="blocks-slot" data-slot="name"><span class="blocks-node blocks-literal blocks-value" id="cmb6-node-371" role="treeitem" tabindex="-1" contenteditable="false" aria-label="name f" aria-level="2" aria-setsize="1" aria-posinset="1"><span class="blocks-literal blocks-literal-symbol">f</span></span></span><span class="blocks-args" data-slot="params" role="group"><span class="blocks-gap" data-slot="params" data-index="0" aria-hidden="true"></span><span class="blocks-node blocks-literal blocks-value" id="cmb6-node-372" role="treeitem" tabindex="-1" contenteditable="false" aria-label="name a" aria-level="2" aria-setsize="2" aria-posinset="1"><span class="blocks-literal blocks-literal-symbol">a</span></span><span class="blocks-gap" data-slot="params" data-index="1" aria-hidden="true"></span><span class="blocks-node blocks-literal blocks-value" id="cmb6-node-373" role="treeitem" tabindex="-1" contenteditable="false" aria-label="name b" aria-level="2" aria-setsize="2" aria-posinset="2"><span class="blocks-literal blocks-literal-symbol">b</span></span><span class="blocks-gap" data-slot="params" data-index="2" aria-hidden="true"></span></span><span class="blocks-slot" data-slot="body"><span class="blocks-node blocks-body blocks-compound" id="cmb6-node-374" role="treeitem" tabindex="-1" contenteditable="false" aria-label="body with 2 body" aria-level="2" aria-setsize="1" aria-posinset="1" aria-expanded="true"><span class="blocks-args" data-slot="body" role="group"><span class="blocks-gap" data-slot="body" data-index="0" aria-hidden="true"></span><span class="blocks-node blocks-assign blocks-compound" id="cmb6-node-375" role="treeitem" tabindex="-1" contenteditable="false" aria-label="set y to a" aria-level="3" aria-setsize="2" aria-posinset="1" aria-expanded="true"><span class="blocks-slot" data-slot="target"><span class="blocks-node blocks-literal blocks-value" id="cmb6-node-376" role="treeitem" tabindex="-1" contenteditable="false" aria-label="name y" aria-level="4" aria-setsize="1" aria-posinset="1"><span class="blocks-literal blocks-literal-symbol">y</span></span></span><span class="blocks-glue" aria-hidden="true">=</span><span class="blocks-slot" data-slot="value"><span class="blocks-node blocks-literal blocks-value" id="cmb6-node-377" role="treeitem" tabindex="-1" contenteditable="false" aria-label="name a" aria-level="4" aria-setsize="1" aria-posinset="1"><span class="blocks-literal blocks-literal-symbol">a</span></span></span></span><span class="blocks-gap" data-slot="body" data-index="1" aria-hidden="true"></span><span class="blocks-node blocks-return blocks-compound" id="cmb6-node-378" role="treeitem" tabindex="-1" contenteditable="false" aria-label="return y" aria-level="3" aria-setsize="2" aria-posinset="2" aria-expanded="true"><span class="blocks-operator">return</span><span class="blocks-slot" data-slot="value"><span class="blocks-node blocks-literal blocks-value" id="cmb6-node-379" role="treeitem" tabindex="-1" contenteditable="false" aria-label="name y" aria-level="4" aria-setsize="1" aria-posinset="1"><span class="blocks-literal blocks-literal-symbol">y</span></span></span></span><span class="blocks-gap" data-slot="body" data-index="2" aria-hidden="true"></span></span></span></span></span>"
    `);
  });
});

describe("identity across an edit", () => {
  test("300 statements, one character changed in the middle", () => {
    const lines = Array.from(
      { length: 300 },
      (_, i) => `f(${i}, g(${i + 1}, [${i}, 2]));`
    );
    const text = lines.join("\n");
    const old = jsParser.parse(text);
    const at = text.indexOf("f(150,") + 2;
    const text2 = text.slice(0, at) + "9" + text.slice(at + 1);
    const frags = TreeFragment.applyChanges(TreeFragment.addTree(old), [
      { fromA: at, toA: at + 1, fromB: at, toB: at + 1 },
    ]);
    const t0 = performance.now();
    const next = jsParser.parse(text2, frags);
    const ms = performance.now() - t0;
    const t1 = performance.now();
    jsParser.parse(text2);
    const full = performance.now() - t1;

    const trees = (t: Tree, acc = new Set<Tree>()) => {
      acc.add(t);
      t.children.forEach((c) => c instanceof Tree && trees(c, acc));
      return acc;
    };
    const oldSet = trees(old),
      newSet = trees(next);
    let reused = 0;
    for (const t of newSet) if (oldSet.has(t)) reused++;
    const tops = (t: Tree) => {
      const r: ReturnType<
        Tree["topNode"]["tree"] extends never ? never : any
      >[] = [];
      for (let c = t.topNode.firstChild; c; c = c.nextSibling) r.push(c);
      return r;
    };
    const oldTops = tops(old),
      newTops = tops(next);
    const withTree = newTops.filter((n) => n.tree).length;
    const sharedTops = newTops.filter(
      (n) => n.tree && oldSet.has(n.tree)
    ).length;
    // NodeWeakMap: set on an old top-level statement, read from the corresponding new one
    const map = new NodeWeakMap<string>();
    oldTops.forEach((n, i) => map.set(n, "s" + i));
    const kept = newTops.filter((n, i) => map.get(n) === "s" + i).length;
    const keptOnTrees = newTops.filter(
      (n) => n.tree && map.get(n) !== undefined
    ).length;
    const stats = {
      statements: newTops.length,
      oldTreeObjects: oldSet.size,
      newTreeObjects: newSet.size,
      reusedTreeObjects: reused,
      statementsThatAreTrees: withTree,
      statementsSharedByIdentity: sharedTops,
      nodeWeakMapKept: kept,
      nodeWeakMapKeptOnTrees: keptOnTrees,
    };
    console.log(
      JSON.stringify({
        ...stats,
        incrementalMs: +ms.toFixed(2),
        fullMs: +full.toFixed(2),
      })
    );
    expect(stats).toMatchInlineSnapshot(`
     {
       "newTreeObjects": 6,
       "nodeWeakMapKept": 222,
       "nodeWeakMapKeptOnTrees": 0,
       "oldTreeObjects": 6,
       "reusedTreeObjects": 3,
       "statements": 300,
       "statementsSharedByIdentity": 0,
       "statementsThatAreTrees": 0,
     }
    `);
  });
});

describe("editing through the tree", () => {
  const apply = (
    lang: LezerLanguage,
    text: string,
    ch: { from: number; to: number; insert: string }
  ) => {
    const t = applyText(text, ch);
    lang.parse(t);
    return t;
  };
  const slotOf = (lang: LezerLanguage, text: string, path: string[]): Slot => {
    let n: BNode = lang.parse(text)[0];
    let s!: Slot;
    for (const name of path) {
      s = n.slots.find((x) => x.name === name)!;
      n = s.nodes[0];
    }
    return s;
  };
  const cases: [
    string,
    LezerLanguage,
    string,
    string[],
    string,
    string,
    string,
  ][] = [
    ["scheme args", scheme, "(f 1 2)", ["args"], "3", "(f 1 2 3)", "(f 2 3)"],
    [
      "js block",
      javascript,
      "function f(a) { x(); y(); }",
      ["body", "body"],
      "z();",
      "function f(a) { x(); y(); z(); }",
      "function f(a) { y(); z(); }",
    ],
    [
      "js call args",
      javascript,
      "g(a, b);",
      ["expr", "args"],
      "c",
      "g(a, b, c);",
      "g(b, c);",
    ],
    [
      "python body",
      python,
      "def f():\n    a = 1\n    b = 2\n",
      ["body", "body"],
      "c = 3",
      "def f():\n    a = 1\n    b = 2\n    c = 3\n",
      "def f():\n    b = 2\n    c = 3\n",
    ],
  ];
  test.each(cases)(
    "%s: insert at the end, then remove the first",
    (_n, lang, text, path, snippet, afterInsert, afterRemove) => {
      const slot = slotOf(lang, text, path);
      const t1 = apply(
        lang,
        text,
        insertChange(lang.table, text, slot, slot.nodes.length, snippet)
      );
      expect(t1).toBe(afterInsert);
      const slot2 = slotOf(lang, t1, path);
      expect(slot2.nodes.length).toBe(slot.nodes.length + 1);
      const t2 = apply(lang, t1, removeChange(slot2.nodes[0]));
      expect(t2).toBe(afterRemove);
      expect(slotOf(lang, t2, path).nodes.length).toBe(slot.nodes.length);
    }
  );
});
