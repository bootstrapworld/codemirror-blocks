/*
 * Regressions found by the soak runner's Chromium engine (scripts/soak.js, e2e/soak-run.ts): each case is a shrunk sequence of steps, replayed
 * with every invariant checked after every step. `npm run soak -w @bootstrapworld/cm6-blocks -- --promote <seed>` prints a case.
 */
import { expect, test } from "@playwright/test";
import type { Sequence } from "../spec/soak-gen";
import { runChromium } from "./soak-run";

const baseURL = `http://127.0.0.1:${process.env.CMB6_PORT || 8177}`;

test("seed 552: an edit box that opens (a click on a leaf) and closes (the next click) changes the height of its line: the line numbers follow", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 552,
      language: "python",
      code: '# a comment\ntotal = 0\nfor x in [1, 2, 3]:\n    total = total + x\nprint(total, "done")\n',
      steps: [
        { op: "click", a: 0.924224688205868, shift: false },
        { op: "focus", a: 0.4647825409192592 },
      ],
      motion: "reduced",
    } as Sequence,
    { baseURL }
  );
  expect(v).toBeNull();
});
test("seed 832: an open leaf box whose block an API removal takes away is dropped with it (its text has nowhere to go, nothing is thrown)", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 832,
      language: "javascript",
      code: "function f(a, b) { return a * b; }\nf(1, 2);\nif (x) { f(1, 2); } else { g(); }",
      steps: [
        { op: "typeIntoBlock", a: 0.9805038259364665, text: "(", accept: true },
        { op: "removeNode", a: 0.9974410508293658, b: 0.8437184935901314 },
      ],
      motion: "reduced",
    } as Sequence,
    { baseURL }
  );
  expect(v).toBeNull();
});

test("seed 1385: an open leaf box and a replaced document", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 1385,
      language: "python",
      code: 'h = h()\nif True:\n    n()\nelse:\n    for y in x.y(True):\n        lambda total: "s3"\n        fact(lambda acc: y(30, 28, True), y(), "s0" - y())\n    def x(f, total):\n        return 68\n        None * lambda total: n.lst(None, True)\n        lst = lambda n: 37\n    g = x.n("s7")\nh = fact\ntotal(acc(f(n, "s6")))\ntotal = {x({"s4": True}, None): g}\ndef x(h, f):\n    for total in lambda acc: g:\n        return x(39 + True, True, g.g("s6"))\n        return lambda acc: 69\n        43',
      steps: [
        {
          op: "typeIntoBlock",
          a: 0.15461167506873608,
          text: "(",
          accept: true,
        },
        { op: "replaceDoc", text: "g\n" },
      ],
      motion: "full",
    } as Sequence,
    { baseURL }
  );
  expect(v).toBeNull();
});
test("seed 410: a gap that grows under the mouse (a drop target) makes its line taller: the line numbers follow (every root is watched for its height)", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 410,
      language: "python",
      code: '# a comment\ntotal = 0\nfor x in [1, 2, 3]:\n    total = total + x\nprint(total, "done")\n',
      steps: [
        {
          op: "dragSelection",
          a: 0.8571280292235315,
          b: 0.8411686394829303,
          n: 4,
        },
      ],
      motion: "full",
    } as Sequence,
    { baseURL }
  );
  expect(v).toBeNull();
});
test("seed 594: a comment block that has the focus and comes to go with a block (an undo) is hidden: the focus goes to that block, not the page body", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 594,
      language: "python",
      code: '# a b c\ng = "s2"\n',
      steps: [
        { op: "removeNode", a: 0.40681146341376007, b: 0.7477828704286367 },
      ],
      motion: "reduced",
    } as Sequence,
    { baseURL }
  );
  expect(v).toBeNull();
});
test("seed 1051: clicking a leaf whose box is already open (a second box in the same block) does not throw", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 1051,
      language: "python",
      code: '"""\n################################\n# Mini Lindenmayer tool\n###############################\n\n',
      steps: [
        { op: "click", a: 0.9077679137699306, shift: false },
        { op: "key", key: "Shift+|", a: 0.49513182789087296 },
        { op: "focus", a: 0.5956072302069515 },
      ],
      motion: "full",
    } as Sequence,
    { baseURL }
  );
  expect(v).toBeNull();
});
test("seed 520: undo with everything collapsed: the focus goes to the collapsed block that holds the restored one, not the page body (the second Ctrl+Z then works)", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 520,
      language: "scheme",
      code: "; a comment\n(define (fact n)\n  (if (<= n 1)\n      1\n      (* n (fact (- n 1)))))\n(fact 5)\n",
      steps: [
        {
          op: "dragTemplate",
          t: 0.525558193679899,
          b: 0.260945892194286,
          where: "end",
        },
        {
          op: "dragBlock",
          a: 0.3139909247402102,
          b: 0.2470884716603905,
          where: "whitespace",
        },
        { op: "collapseAll", on: true },
      ],
      motion: "reduced",
    } as Sequence,
    { baseURL }
  );
  expect(v).toBeNull();
});
test("seed 102: a replaced document whose first root is a comment that goes with a block: the focus goes to a block that is shown, not to the hidden comment", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 102,
      language: "javascript",
      code: "let x = 1 + 2;\nf(x, 3);\nwhile (x < 9) { x = x + 1; g(x); }",
      steps: [
        { op: "select", a: 0.197699966840446 },
        {
          op: "replaceDoc",
          text: '// note\nconst total = h("s8");\n\nif (fact(fact("s9"), null, lst("s1"))) {\n  function n(total, h) {\n    return f();\n    acc = (total) => true;\n    let acc = total(true, [] === total(true, true), true * true ? {a: null, b: lst} : true);\n  }\n} else {\n  null * [36 ? "s0" : true, g(53, x), total()];\n}\nwhile (8) {\n  function total(g, x) {\n    return g();\n    h(h);\n    return true;\n  }\n}\nif (lst(null, g(null, "s7"), n(75))) {\n  while (g(lst())) {\n    const total = lst("s2", lst * (y) => null);\n  }\n  function n(total, y) {\n    return n.acc();\n    var total = 25;\n  }\n  g("s4", true);\n}\ntrue;\n// note\nconst x = null ? total.g(y("s6"), "s2" ? "s6" : "s3") : [];\n\n// note\nfor (const h of "s1") {\n  for (const f of lst()) {\n    {a: y(y(77, 9, g), "s4" ? "s8" : y, (total) => "s2"), b: f(8)};\n    var acc = h === [98, true, true] ? n(5, true) : x("s4");\n  }\n  while ((n) => (acc) => null) {\n    y.y(fact, null);\n    const y = 62;\n    const g = fact.x(lst(f(true, true), {a: null, b: null}));\n  }\n  const fact = null;\n}\n\nconst x = "s8";\n',
        },
      ],
      motion: "reduced",
    } as Sequence,
    { baseURL }
  );
  expect(v).toBeNull();
});

test("seed 223: a switch back to blocks that is refused (text that does not parse) leaves its message open: the harness closes it before the undo-all, and the history is whole (nothing is cleared without an edit made as text)", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 223,
      language: "python",
      code: '"""distutils.command\n\nPackage containing implementation of all the standard Distutils\ncommands."""\n\n',
      steps: [
        { op: "focus", a: 0.7516330345533788 },
        {
          op: "topLevelType",
          a: 0.414593217195943,
          text: "(f 1)",
          accept: false,
          how: "paste",
        },
        { op: "toggleMode", a: 0.3219862685073167, rush: 0.83 },
        { op: "toggleMode", a: 0.05625365348532796, rush: 0 },
      ],
      motion: "full",
    } as Sequence,
    { baseURL }
  );
  expect(v).toBeNull();
});

test("seed 579: dragging a selection of three blocks into a comparison chain (a `rest` slot) leaves the tree what its own parse gives: an anchor is not reconciled in place as another node", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 579,
      language: "javascript",
      code: 'describe("results of a worker", () => {\n  const lines =\n    JSON.stringify({ seed: 1, ok: true }) +\n    "\\n" +\n    JSON.stringify({ seed: 2, invariant: "focus", steps: [{ op: "key" }] }) +\n    "\\n" +\n    \'{"seed": 3, "ok"\'; // (cut: the worker was killed in the middle of a line)\n  test("passed, failed, and what was done", () => {\n    const r = lib.readResults(lines);\n    expect(r.passed).toBe(1);\n    expect(r.failures.map((f) => f.seed)).toEqual([2]);\n    expect([...r.done]).toEqual([1, 2]);\n  });\n  test("the first seed that was not done is the one that was running", () => {\n    expect(lib.missingSeeds([1, 2, 3, 4], lib.readResults(lines).done)).toEqual(\n      [3, 4]\n    );\n    expect(lib.readResults("").done.size).toBe(0);\n  });\n});\n\n',
      steps: [
        {
          op: "dragSelection",
          a: 0.8941608611494303,
          b: 0.14645513915456831,
          n: 3,
        },
      ],
      motion: "reduced",
    } as Sequence,
    { baseURL }
  );
  expect(v).toBeNull();
});

test("seed 1042: a document replaced while the editor is in text mode is an edit made as text: going back to blocks starts the undo history over (the soak did not model it; the editor did it as decided)", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 1042,
      language: "python",
      code: "x = 1 + 2\nf(x, 3)\nwhile x < 9:\n    x = x + 1\n    g(x)\ny = 2",
      steps: [
        { op: "focus", a: 0.790508302859962 },
        { op: "toggleMode", a: 0.8631290695630014, rush: 0.38 },
        {
          op: "replaceDoc",
          text: 'fact = "s7"\n\nfact = f(total(), lambda acc: "s3", "s1")\nif lambda h: 41:\n    lambda n: total - y(x)\n    while n(n, 65, "s6") == total("s4", None):\n        lst = None\n        "s8"\n    lst() + f()',
        },
        { op: "select", a: 0.06514712166972458 },
        { op: "toggleMode", a: 0.9001689238939434, rush: 0.08 },
        { op: "focus", a: 0.6229245853610337 },
      ],
      motion: "reduced",
    } as Sequence,
    { baseURL }
  );
  expect(v).toBeNull();
});

test("seed 1252: a block moved to a gap: the line above a changed range is measured while the page is laid out without the gap that comes back, and the observer of the roots reports no size after it: the heights are read again two frames after an edit, so the gutter does not stay 20 px off", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 1252,
      language: "scheme",
      code: '(define (f g) x)\n(define (fact n) (cond [(= (let ([y 76]) 22) #f) (if (if "s0" "s7" #t) (total \'a 98) (let ([fact \'a]) \'a))] [else (acc (fact #f 70 53) #t (total))]))\n(define (h acc) (cond [(lambda (h) (< f #f)) (fact (x "s5" #f #t) \'a)] [else \'((lambda (g) 14))]))\n(define (h y) "s0")\n(cond [(acc (y n (f \'a \'a "s9") 74) (if (* lst "s2") (if #f g 34) (acc))) (= (lambda (fact) (let ([g \'a]) "s8")) #t)] [else (+ #f (n))])\n\n; note\n(define acc (f "s0" (n) (let ([lst (= n #f)]) \'a)))\n',
      steps: [
        {
          op: "insertText",
          a: 0.9804787763860077,
          b: 0.46133909025229514,
          text: "(g 1)",
        },
        {
          op: "dragBlock",
          a: 0.03413062356412411,
          b: 0.7670880393125117,
          where: "gap",
        },
      ],
      motion: "full",
    } as Sequence,
    { baseURL }
  );
  expect(v).toBeNull();
});

test("seed 562: after a replaced document, an undo puts the focus on a block (the path a history item remembers is not the page body)", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 562,
      language: "javascript",
      code: 'var x = {a: y("s7", total, y), b: null};\n\nwhile ([]) {\n  let acc = "s3";\n}\n',
      steps: [
        { op: "key", key: "ArrowUp", a: 0.0004202895797789097 },
        { op: "typeIntoBlock", a: 0.5316811783704907, text: "(", accept: true },
        {
          op: "replaceDoc",
          text: 'function total(total, f) {\n  for (const y of true + null) {\n    const acc = null * 16 ? f() : [true, true] + h.n();\n    const x = fact() ? "s7" : null;\n    {a: true, b: n(94)};\n  }\n  if (true) {\n    97;\n    total = 24 ? h(true, 40) : f ? g : true;\n  } else {\n    x.f(f);\n    [x(true, f("s5", 36), (y) => g)];\n  }\n}\n[[83, {a: y, b: null}, h(63)]];\n',
        },
        { op: "editBox", a: 0.2935687529388815, text: "foo", accept: true },
        {
          op: "dragTemplate",
          t: 0.566902935737744,
          b: 0.2911756127141416,
          where: "end",
        },
        { op: "key", key: "Escape", a: 0.7866062289103866 },
        { op: "key", key: "Shift+Alt+ArrowRight", a: 0.4221438674721867 },
        { op: "key", key: "ArrowLeft", a: 0.5774770581629127 },
        { op: "undo" },
      ],
      motion: "reduced",
    } as Sequence,
    { baseURL }
  );
  expect(v).toBeNull();
});

test("seed 300077: the blur of a top-level box that an update has just taken out of the page does not dispatch inside that update (clearPending waits for it to end)", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 300077,
      language: "python",
      code: 'lst = 82\n14\nif "s5":\n    if lambda h: None:\n        y = total(g.f(acc()), True, h(None, fact.total(None, y)))\n        lambda x: True\n    g = 46 == lst(True) - y.total(lst())\nelse:\n    {acc("s3" + True): y(None == lst)}\n    []\n    x("s2" * True * lambda lst: 89)\nx = f(True - "s9" * y.total(47, 0), lambda g: x())\n\nlst\nlst = [h(None), x(), lambda x: "s0" + lambda acc: None]\nwhile x() + x.n(None, "s8"):\n    "s0"\n    if 47 * None < fact:\n        []\nacc\n',
      steps: [
        {
          op: "dragTemplate",
          t: 0.739395682932809,
          b: 0.36537408106960356,
          where: "whitespace",
        },
        {
          op: "topLevelType",
          a: 0.22530993702821434,
          text: "x",
          accept: true,
          how: "paste",
        },
        { op: "textEdit", a: 0.2185565046966076, len: 2, w: "if a:\n    b" },
        { op: "removeNode", a: 0.3816490995232016, b: 0.7682775428984314 },
        { op: "textEdit", a: 0.24009352084249258, len: 3, w: "" },
      ],
      motion: "reduced",
    } as Sequence,
    { baseURL }
  );
  expect(v).toBeNull();
});

test("seed 300005: a program taller than the window has only some of its roots drawn: their set size counts all of them and their positions go on from where the drawing starts (the check of the soak knows it)", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 300005,
      language: "javascript",
      code: '// TODO\nfunction acc(acc, total) {\n  [{a: "s1" ? n : null, b: "s6"}];\n}\nif (87) {\n  x = f((lst) => true, "s9" * "s7");\n  y = g;\n}\nif (total(x("s4", 72), lst)) {\n  g();\n}\nwhile (true) {\n  if (n("s3", h())) {\n    y = "s6";\n    let acc = null;\n    true;\n  }\n  true ? 84 : 51 === f(n, null) ? (acc) => h() : [fact.total(42), [43, 99]];\n}\nfor (const x of 53) {\n  while (n.acc(63, true === true)) {\n    let lst = n(g(), 55);\n    h();\n    const total = y();\n  }\n  true;\n  function lst(h, total) {\n    lst(null ? 43 : h, "s1") === {a: h, b: f};\n  }\n}\nwhile ({a: "s3", b: true} ? lst(true, true) : null) {\n  function f(acc, lst) {\n    let acc = 95;\n    y = f("s0", fact < "s3", acc());\n  }\n  const y = y;\n  {a: "s5" + y, b: h(f(), null)};\n}\nfor (const lst of true ? "s1" : 32) {\n  if (acc(["s0", true])) {\n    var acc = null;\n    let g = (lst) => {a: {a: null, b: g}, b: "s8"};\n    95;\n  } else {\n    let lst = x((h) => fact(), total(g, 89) + "s5");\n    (total) => {a: 14 ? true : 27, b: f()};\n  }\n  if ((acc) => 24 < true) {\n    let f = n(62 < f(f, 38, 82), x(fact, 76) === "s6" ? 4 : 26, true);\n    const fact = lst.y(79, y.n() === 27);\n    32 + total(null, "s5") + (total) => null;\n  }\n  for (const y of f) {\n    x("s8" ? lst : 51 * g.g(), [(h) => null, 15, acc.y("s6", null)]);\n    let x = [{a: {a: null, b: true}, b: acc(68, acc, n)}];\n    4;\n  }\n}\n// TODO\nlet g = fact(acc, true, (g) => null);\n\n',
      steps: [{ op: "toggleMode", a: 0.47722190083004534, rush: 0.93 }],
      motion: "full",
    } as Sequence,
    { baseURL }
  );
  expect(v).toBeNull();
});

test("seed 400082: a root whose widget CodeMirror replaced by the widget of the same node (an edit before it) is still watched for its height: the old widget does not unwatch the element the new one took", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 400082,
      language: "javascript",
      code: "resp.on('done', function() {\n  console.log('Done.');\n});\n\n",
      steps: [
        { op: "comment", a: 0.1218994373921305, text: "x; y", accept: true },
        {
          op: "dragSelection",
          a: 0.1637473765294999,
          b: 0.8612903871107846,
          n: 3,
        },
      ],
      motion: "full",
    } as Sequence,
    { baseURL }
  );
  expect(v).toBeNull();
});

test("seed 400454: the same (a template, a drag, a collapse and a drag of two blocks): the gutter follows a root that changes height while a block is dragged over it", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 400454,
      language: "python",
      code: "x = 1 + 2\nf(x, 3)\nwhile x < 9:\n    x = x + 1\n    g(x)\ny = 2",
      steps: [
        { op: "clickTemplate", t: 0.061207139398902655 },
        {
          op: "dragBlock",
          a: 0.23575315880589187,
          b: 0.13785666739568114,
          where: "whitespace",
        },
        { op: "collapse", a: 0.6928395961876959, on: false },
        {
          op: "dragSelection",
          a: 0.27944621653296053,
          b: 0.7344680898822844,
          n: 2,
        },
        { op: "click", a: 0.38587670866400003, shift: false },
      ],
      motion: "full",
    } as Sequence,
    { baseURL }
  );
  expect(v).toBeNull();
});

test("seed 500200: the blur of an edit box that an update has just removed does not write its text inside that update (an API insert while a leaf box is open)", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 500200,
      language: "javascript",
      code: 'if (true) {\n  var lst = "s7";\n}\nwhile (h(null, 16) * (acc) => null) {\n  const lst = f([]);\n  total = [x(null, null, 27), x(acc, fact), "s9"];\n  while ([lst(true, f)]) {\n    var h = null;\n  }\n}\nwhile ([{a: true, b: "s7"}, null, 94]) {\n  var acc = [h.f(null) + y(54, 78), true, {a: null, b: []}];\n  n.g("s8");\n}\n\n',
      steps: [
        { op: "collapse", a: 0.7540768512990326, on: true },
        { op: "key", key: "Shift+|", a: 0.523852125974372 },
        {
          op: "insertText",
          a: 0.791007575346157,
          b: 0.7261613749433309,
          text: "{a: 1}",
        },
      ],
      motion: "reduced",
    } as Sequence,
    { baseURL }
  );
  expect(v).toBeNull();
});

test("seed 1115: the popup of a comment held at the bottom edge is not a difference from a fresh drawing, and is let go when the focus leaves its block", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 1115,
      language: "scheme",
      code: "(+ (+ (* 3 (+ (* 3 5 (- 2 9))) 5 (- (+ (* 3 5 (- 2 9))) (+ (* 3 5 (- 2 \n(+ (+ (* 3 (+ (* 3 5 (- 2 9))) 5 (- (+ (* 3 5 (- 2 9))) (+ (* 3 5 (- 2 9))) 9))) (* 3 (+ (* 3 5 (- 2 9))) (- 2 (+ (* 3 5 (- 2 9))))))\n))) 9))) (* 3 (+ (* 3 5 (- 2 9))) (- 2 (+ (* 3 5 (- 2 9))))))\n 5 (- 2 9))))))\n\n",
      steps: [
        {
          op: "replaceDoc",
          text: "(define g (if (if 'a (total g 18) (n 'a #t)) (lambda (fact) '('a #t #f)) (cond [fact (lst #f)] [else (f #f \"s6\" \"s6\")])))\n; a b c\n(define f (if (- (g #f #t 'a) (g)) fact (f)))\n; note\n(fact #f (+ #f 'a))\n(define g (y 19 (fact (< 'a #f))))\n(define acc '((x) \"s3\"))\n",
        },
        {
          op: "dragBlock",
          a: 0.9308063371572644,
          b: 0.28622308489866555,
          where: "block",
        },
        {
          op: "comment",
          a: 0.7057544873096049,
          text: "a b c",
          accept: true,
        },
        {
          op: "focus",
          a: 0.7646133878733963,
        },
        {
          op: "key",
          key: "Mod+z",
          a: 0.17832401650957763,
        },
        {
          op: "replaceDoc",
          text: "; a comment\n(define (fact n)\n  (if (<= n 1)\n      1\n      (* n (fact (- n 1)))))\n(fact 5)\n",
        },
        {
          op: "key",
          key: "Shift+<",
          a: 0.38336282526142895,
        },
        {
          op: "undo",
        },
      ],
      motion: "reduced",
    },
    { baseURL: `http://127.0.0.1:${process.env.CMB6_PORT || 8177}` }
  );
  expect(v).toBeNull();
});

test("seed 3576: the popup of a comment held at the bottom edge is not a difference from a fresh drawing, and is let go when the focus leaves its block", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 3576,
      language: "scheme",
      code: '(define (n lst) (lambda (acc) (total #f (g) (cond [14 "s9"] [else lst]))))\n(define n (let ([y (f #f (< #f \'a))]) (let ([x 59]) (let ([y \'a]) #f))))\n#t\n\n; TODO\n(define fact (total \'a (if (lambda (h) "s8") (x 0 \'a \'a) (if 71 \'a "s5"))))\n; note\n(g (let ([y (lambda (h) (h #t))]) (y (lambda (total) "s6") (lst \'a) 54)))\n; note\n(define h \'a)\n\n(define n "s5")\n',
      steps: [
        {
          op: "dragSelection",
          a: 0.36554423347115517,
          b: 0.7932777416426688,
          n: 4,
        },
        {
          op: "dragBlock",
          a: 0.2784569358918816,
          b: 0.4314114267472178,
          where: "block",
        },
      ],
      motion: "reduced",
    },
    { baseURL: `http://127.0.0.1:${process.env.CMB6_PORT || 8177}` }
  );
  expect(v).toBeNull();
});

test("seed 3764: CodeMirror also draws the line of the selection, so the drawn roots of a tall program have gaps in their positions", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 3764,
      language: "javascript",
      code: "class A {\n  m() {\n    return 1;\n  }\n}\nnew A().m();\n",
      steps: [
        {
          op: "replaceDoc",
          text: 'function g(fact, lst) {\n  [null * y] - 89;\n}\n\n// a b c\nconst lst = "s1" ? true : [];\nif ((y) => true ? f === "s5" : true === 21) {\n  null;\n  while ("s8") {\n    let f = f;\n  }\n} else {\n  fact([lst(true), true + 71, acc("s5", "s4", "s6")], null < f("s2", n));\n  while (x("s7", 56, "s8") < fact(true)) {\n    "s6";\n    var h = acc(h());\n  }\n}\nif (h.fact(null, y("s2", null))) {\n  for (const g of x.h()) {\n    lst.g();\n    const x = lst(11, fact(50), total([true, null, true], "s5" - "s4", "s1"));\n    total(n.x(null));\n  }\n  let lst = [];\n  acc.lst(86, "s3") === 31 - null;\n} else {\n  for (const y of total(null, null, 64)) {\n    h = 59 ? 26 : "s3" ? true : null === "s4";\n    const h = 3;\n  }\n  while (h.total()) {\n    const total = {a: (f) => lst(null, true, null), b: null ? [acc, fact, true] : n ? 15 : n};\n    var x = "s8" ? total(null, 54 ? total : 87) : {a: 42, b: 8} ? y("s1", "s3") : null;\n  }\n  n(fact(null), lst(93 + y, n(true, true, null), 84));\n}\nfunction y(n, h) {\n  n = null ? x : true + 3;\n  while ((h) => 56 ? (fact) => 41 : (x) => "s7") {\n    f() + [13] < total();\n    [{a: total.fact(null), b: 61}, {a: null, b: ["s1"]}, fact];\n  }\n}\ntotal.fact();\nconst x = total(g(true * "s5"));\nwhile ([(total) => "s8"]) {\n  function x(total, y) {\n    n((g) => true, null) ? 63 : total(null, "s1") < acc();\n    true;\n    return g(lst(), {a: fact, b: y});\n  }\n  if (lst()) {\n    let f = [{a: h.h(null), b: g.fact("s3", g)}, x, [acc("s5"), total("s5"), null ? "s1" : y]];\n    const acc = [];\n    x(acc(f("s0"), n(), fact()), acc(acc, null, 35));\n  } else {\n    const lst = acc;\n    "s5";\n  }\n  "s8" ? true : "s2" + acc - [true, (h) => "s2"];\n}\n',
        },
        {
          op: "dragBlock",
          a: 0.9863571014720947,
          b: 0.45844932668842375,
          where: "end",
        },
      ],
      motion: "reduced",
    },
    { baseURL: `http://127.0.0.1:${process.env.CMB6_PORT || 8177}` }
  );
  expect(v).toBeNull();
});
