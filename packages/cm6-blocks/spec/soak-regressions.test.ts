/** @jest-environment jsdom */
/*
 * Regressions found by the soak runner (scripts/soak.js): each case is a shrunk sequence of steps, replayed with every invariant checked
 * after every step (spec/soak-jsdom.ts). `npm run soak -w @bootstrapworld/cm6-blocks -- --promote <seed>` prints a case.
 */
import { runJsdom } from "./soak-jsdom";
import type { Sequence } from "./soak-gen";

it("seed 18334: an open edit box among the children of a list does not shift the gap numbers when a block is moved or removed (the gaps are not at even positions)", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 18334,
      language: "python",
      code: '# a b c\ntotal = None\n[fact.lst("s0", {None: 93}), total(32) - lambda x: lst, "s8"]\nfor lst in {True: y}:\n    fact\n# note\nx = fact(acc)\ntotal.acc(n(None), 59)\n',
      steps: [
        { op: "editBox", a: 0.9357837017159909, text: "42", accept: true },
        { op: "key", key: "Control+[", a: 0.5797098914626986 },
        { op: "moveNode", a: 0.20588852162472904, b: 0.8826571924146265 },
      ],
      motion: "reduced",
    } as Sequence)
  ).toBeNull();
});
it("seed 16791: a comment that text edits brought next to a block that stayed drawn is shown after the return to blocks (marker, label)", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 16791,
      language: "scheme",
      code: "(define (total n) (cond [#t #f] [else (g)]))\nfact\n",
      steps: [
        { op: "setComment", a: 0.4706993780564517, text: "note" },
        { op: "moveNode", a: 0.000825150404125452, b: 0.413669912610203 },
        { op: "toggleMode", a: 0.2818378147203475 },
        { op: "undo" },
        { op: "toggleMode", a: 0.5272719168569893 },
      ],
      motion: "reduced",
    } as Sequence)
  ).toBeNull();
});
it("seed 12743: Escape on an insert box whose block an undo removed gives the focus to the block at its place (not the page body)", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 12743,
      language: "javascript",
      code: '// note\nif ((total) => g ? "s6" : true) {\n  const x = true;\n  if (null) {\n    const x = null;\n    const n = null;\n    (h) => [];\n  } else {\n    x = true;\n    var acc = 67 ? null : acc("s9");\n    let fact = h;\n  }\n  true ? {a: 75, b: true} : lst + f();\n}\n// a b c\nwhile (55) {\n  const lst = 40;\n}\nf();\n"s2";',
      steps: [
        {
          op: "pasteText",
          a: 0.45194285246543586,
          text: "{a: 1}",
          before: false,
        },
        { op: "key", key: "Control+[", a: 0.7378016810398549 },
        { op: "undo" },
      ],
      motion: "full",
    } as Sequence)
  ).toBeNull();
});
it("seed 41877: focus moves out of an edit box that commits and rewrites its target (jsdom's focus() ended on the detached block: the harness now acts as Chrome does)", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 41877,
      language: "python",
      code: 'lambda y: total(g * 59, y, lambda y: "s7")\n',
      steps: [
        { op: "editBox", a: 0.9107803255319595, text: "(((", accept: true },
        { op: "insertTemplate", t: 0.35886684618890285, a: 0.9274827176705003 },
      ],
      motion: "reduced",
    } as Sequence)
  ).toBeNull();
});

it("seed 11575: a pending top-level box that commits when the focus leaves it", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 11575,
      language: "python",
      code: "x = 1 + 2\nf(x, 3)\nwhile x < 9:\n    x = x + 1\n    g(x)\ny = 2",
      steps: [
        {
          op: "topLevelType",
          a: 0.18612669711001217,
          text: "(",
          accept: true,
          how: "type",
        },
        { op: "textEdit", a: 0.3408974742051214, len: 3, w: ")" },
        { op: "focus", a: 0.5597523967735469 },
      ],
      motion: "full",
    } as Sequence)
  ).toBeNull();
});
it("seed 21535: a block of half-typed text whose parts are all empty still has a label", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 21535,
      language: "python",
      code: "import sys\nimport importlib.util\nimport py_compile\nimport struct\n\n",
      steps: [{ op: "textEdit", a: 0.8710412695072591, len: 0, w: ":" }],
      motion: "reduced",
    } as Sequence)
  ).toBeNull();
});
it("seed 27851: closing the box of a template's hole that is piece of text that did not parse focuses the block next to it (not the page body)", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 27851,
      language: "python",
      code: 'def x(n, n):\n    x(y(), lambda x: h(59, None, None))\n    None\n    while lst.lst(total(True, 71, 92), g(None, "s6", 15)):\n        return "s8"\n# TODO\nx.g({[True]: True == g})\nwhile lambda fact: "s1":\n    [fact.f(h(h)), [], {fact(None, None): lst("s4")}]\n    g = {65: {9 + "s6": None}}\nfor f in lambda fact: n:\n    "s9"\n    y = h([x(None, True)], h("s3", ["s3"]))',
      steps: [
        {
          op: "insertTemplateAt",
          t: 0.7935750542674214,
          a: 0.003906820202246308,
          b: 0.7777902998495847,
        },
        { op: "key", key: "Escape", a: 0.2797254913020879 },
      ],
      motion: "reduced",
    } as Sequence)
  ).toBeNull();
});
it("seed 10316: focusNode on a block inside a collapsed block focuses the collapsed block that holds it (a hidden element cannot take the focus in a browser)", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 10316,
      language: "scheme",
      code: '(define x fact)\n"s4"\n#f\n(define (lst n) (lambda (g) (* (lst "s6" total \'a) (lst))))\n; note\n(cond [(cond [(* (cond [30 #t] [else y]) (acc #t y)) (total (= #f "s0") (lambda (acc) \'a) "s5")] [else (n (let ([f "s3"]) "s8") (f lst 51) "s1")]) (fact (if (f total #f #f) (x \'a f) #t) (< (+ x f) (lst y)))] [else #t])\n\n(define g #t)',
      steps: [
        { op: "collapseAll", on: true },
        {
          op: "insertTemplateAt",
          t: 0.020534857641905546,
          a: 0.8344515082426369,
          b: 0.13734120456501842,
        },
        { op: "editBox", a: 0.28765273932367563, text: "foo", accept: false },
      ],
      motion: "full",
    } as Sequence)
  ).toBeNull();
});
