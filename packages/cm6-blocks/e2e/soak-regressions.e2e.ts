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

test("soak seed 1606: exception after toggleMode: uncaught: focusedNode() is only available in block mode", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 1606,
      language: "python",
      code: '# TODO\nf(f(None, True, h + "s1"), "s2", g(59, None))\n\nx = []\n\ng.acc(True)\ndef f(acc, f):\n    f({x: None}, 43, lst(lambda fact: None, {None: True}))\n    n = acc\n\n# note\nfor n in {None: True}:\n    x = fact()\n# a b c\ny(total, "s0" == 47, n) - None\nfact(None)\nwhile lst(fact.acc("s3"), None < "s2", "s5" == 13):\n    f = lst()\n    def fact(acc, g):\n        return y\n        return fact(None * 49, f.x(), None)\n\n',
      steps: [
        {
          op: "topLevelType",
          a: 0.77368995686993,
          text: "(",
          accept: true,
          how: "type",
        },
        {
          op: "insertText",
          a: 0.5037400040309876,
          b: 0.07215151353739202,
          text: "[1, 2]",
        },
        {
          op: "toggleMode",
          a: 0.033919941168278456,
          rush: 0.39,
        },
      ],
      motion: "reduced",
    },
    { baseURL: `http://127.0.0.1:${process.env.CMB6_PORT || 8177}` }
  );
  expect(v).toBeNull();
});

test("soak seed 1337: exception after after undo/redo: uncaught: focusedNode() is only available in block mode", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 1337,
      language: "python",
      code: "MAXFDS_TO_SEND = 256\nUNSIGNED_STRUCT = struct.Struct('Q')     # large enough for pid_t\n\n#\n# Forkserver class\n#\n\n",
      steps: [
        {
          op: "topLevelType",
          a: 0.4401160420384258,
          text: "(f 1)",
          accept: true,
          how: "type",
        },
        {
          op: "insertText",
          a: 0.0030426173470914364,
          b: 0.7292801185976714,
          text: '"s"',
        },
        {
          op: "toggleMode",
          a: 0.7653983817435801,
          rush: 0.15,
        },
      ],
      motion: "full",
      editor: {
        lineNumbers: false,
        lineWrapping: false,
        collapseAll: false,
        reconcile: true,
        anchors: true,
        fastErrors: true,
        skipRoots: true,
        activityLimit: null,
      },
    },
    { baseURL: `http://127.0.0.1:${process.env.CMB6_PORT || 8177}` }
  );
  expect(v).toBeNull();
});

test("soak seed 4569: exception after search: uncaught: focusedNode() is only available in block mode", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 4569,
      language: "javascript",
      code: 'y.y(["s8", "s1"] ? {a: null, b: acc} : f());\nconst n = 56;\nwhile (null) {\n  if (fact(fact, true, "s9") ? null === x : "s1") {\n    const y = g(fact.y(53 === null, "s8"), y(total, {a: "s6", b: true}, [true, acc, true]), (h) => "s0" - x);\n    null;\n  }\n  var y = n(null, g, 25);\n}\nif (null) {\n  while (g()) {\n    true;\n    let x = fact();\n  }\n  var h = (acc) => fact("s4") ? (y) => true + "s5" < total : true;\n  f(true, true);\n} else {\n  while (22) {\n    var h = n();\n    total(63);\n  }\n  let lst = null;\n}\nif ([92, y, fact] < [5]) {\n  function g(fact, y) {\n    [fact] < y(true, "s2", null) * y((lst) => null, [true, acc, "s3"]);\n    return {a: f(y), b: 68};\n  }\n} else {\n  x = acc("s7");\n  let acc = x(y((x) => acc, lst(), h(87, true, "s0")));\n  const n = h();\n}\n// a b c\nfor (const x of true * x) {\n  const g = 44;\n  function fact(total, n) {\n    26;\n    return acc(null, "s8");\n  }\n  for (const n of 82 + total) {\n    let x = lst(h ? null : true - [true], fact(x(), (n) => null), f(null - 65, n(69)));\n  }\n}\nh();',
      steps: [
        {
          op: "key",
          key: "Mod+Shift+z",
          a: 0.5859131976030767,
        },
        {
          op: "undo",
        },
        {
          op: "replaceDoc",
          text: '// TODO\nf.x("s4");\n\nconst f = g(lst() < 24 ? null : "s5");\nf;\n// note\nfor (const fact of y === true) {\n  if (fact(total + acc, [24, null, null])) {\n    var n = n(f(), {a: null, b: x(true, null)});\n    y = lst(acc, h("s1", null, total));\n  }\n  fact = [];\n}\nfor (const g of x) {\n  const f = [lst(), fact(true), f(true)] ? "s9" : (x) => (g) => 11;\n  fact = fact(acc(y));\n  var g = f(fact(null ? true : 44, "s2" * total), x(15 * 56), "s8");\n}\nvar n = y();\n\n// a b c\nfor (const total of fact(total, y)) {\n  if (true - x) {\n    const g = g((fact) => null === f(), null, acc.g("s3"));\n    12;\n  }\n}\n',
        },
        {
          op: "insertText",
          a: 0.46900667576119304,
          b: 0.5890645917970687,
          text: "true",
        },
        {
          op: "topLevelType",
          a: 0.9677418568171561,
          text: "(f 1)",
          accept: true,
          how: "type",
        },
        {
          op: "textEdit",
          a: 0.9333418761380017,
          len: 2,
          w: "",
        },
        {
          op: "insertText",
          a: 0.45990118477493525,
          b: 0.500926676671952,
          text: "f()",
        },
        {
          op: "dragBlock",
          a: 0.728226532228291,
          b: 0.12854257551953197,
          where: "end",
        },
        {
          op: "comment",
          a: 0.323386391159147,
          text: "note",
          accept: true,
        },
        {
          op: "click",
          a: 0.7705515490379184,
          shift: false,
        },
        {
          op: "undo",
        },
        {
          op: "removeNode",
          a: 0.3381074743811041,
          b: 0.15617139427922666,
        },
        {
          op: "key",
          key: "Delete",
          a: 0.8716683543752879,
        },
        {
          op: "textEdit",
          a: 0.8945401522796601,
          len: 0,
          w: "/*",
        },
        {
          op: "insertText",
          a: 0.2591058509424329,
          b: 0.5687064814846963,
          text: "[1, 2]",
        },
        {
          op: "comment",
          a: 0.7419541359413415,
          text: "x; y",
          accept: false,
        },
        {
          op: "focus",
          a: 0.6316943275742233,
        },
        {
          op: "click",
          a: 0.8524912793654948,
          shift: false,
        },
        {
          op: "topLevelType",
          a: 0.4278958751820028,
          text: "42",
          accept: true,
          how: "type",
        },
        {
          op: "key",
          key: "Escape",
          a: 0.9572529287543148,
        },
        {
          op: "key",
          key: "End",
          a: 0.0587524794973433,
        },
        {
          op: "typeIntoBlock",
          a: 0.14139127475209534,
          text: "7",
          accept: true,
        },
        {
          op: "toggleMode",
          a: 0.5804434434976429,
          rush: 0.13,
        },
        {
          op: "search",
          text: "x",
          next: false,
        },
      ],
      motion: "full",
      editor: {
        lineNumbers: false,
        lineWrapping: false,
        collapseAll: false,
        reconcile: true,
        anchors: true,
        fastErrors: true,
        skipRoots: true,
        activityLimit: null,
      },
    },
    { baseURL: `http://127.0.0.1:${process.env.CMB6_PORT || 8177}` }
  );
  expect(v).toBeNull();
});

test("soak seed 3369: focus after editBox: keyboard focus is on the page body", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 3369,
      language: "scheme",
      code: "#f\ntotal\n(lambda (f) 'a)",
      steps: [
        {
          op: "replaceDoc",
          text: '(define n (< (= (cond [#t total] [else \'a]) "s6") (lambda (y) (total #t n))))\n\n(define (x n) (x (cond ["s8" (cond [#t x] [else x])] [else (cond [#f "s7"] [else 59])]) 4 (acc \'(#t \'a n) (fact \'a #f x) (total "s8" 50 #t))))\n; TODO\n(define n (let ([n #f]) \'(4 (y))))\n; TODO\n(f (if (let ([total (cond ["s0" fact] [else #f])]) #f) #f (if \'a #t \'a)) (x (cond [(if \'a "s7" \'a) (= 12 x)] [else (f 73 \'a)]) (fact (x \'a) (x)) (total "s2" #t (n x #f))) (cond [(n (f #f) #f) (total (g n) (fact "s1" 79))] [else (* (< fact acc) "s2")]))\n(lambda (acc) (if (acc (if h \'a #f)) 88 (fact (lambda (h) \'a) (if \'a #t 86) #t)))\n\n(cond [#t \'((if (f) (if #f \'a 13) (lst h "s6" \'a)) (cond [(x #f) (= 76 #t)] [else \'(#f total)]) (* (g #f total) (< #t 96)))] [else (n (total #t))])\n\n(let ([g (= (x (f)) (h))]) (lst))\n(define fact (if (< (f) (g "s7" #f "s3")) (acc (let ([total \'a]) h) (if 22 \'a #f) (- lst acc)) (f (h "s9" "s9" \'a))))\n',
        },
        {
          op: "dragSelection",
          a: 0.028305394342169166,
          b: 0.6536570591852069,
          n: 4,
        },
        {
          op: "insertText",
          a: 0.6987120877020061,
          b: 0.5398613195866346,
          text: "(define y 2)",
        },
        {
          op: "editBox",
          a: 0.9748298155609518,
          text: "(",
          accept: false,
        },
      ],
      motion: "reduced",
    },
    { baseURL: `http://127.0.0.1:${process.env.CMB6_PORT || 8177}` }
  );
  expect(v).toBeNull();
});

test("soak seed 285: a document replaced while scrolled far down keeps the focus in the editor until its blocks are drawn", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 285,
      language: "python",
      code: '"""#"\n\nimport codecs\n\n### Codec APIs\n\n\ndef create_subprocess_exec(program, *args, stdin=None, stdout=None,\n                           stderr=None, loop=None,\n                           limit=streams._DEFAULT_LIMIT, **kwds):\n    if loop is None:\n        loop = events.get_event_loop()\n    protocol_factory = lambda: SubprocessStreamProtocol(limit=limit,\n                                                        loop=loop)\n    transport, protocol = yield from loop.subprocess_exec(\n                                            protocol_factory,\n                                            program, *args,\n                                            stdin=stdin, stdout=stdout,\n                                            stderr=stderr, **kwds)\n    return Process(transport, protocol, loop)\n\n"s9"\nacc(34)\n# note\n58\n"s2"\nx(fact() - y(fact, None, "s8"), True, None)\nif {[None, "s9", "s9"]: [f, None, None]}:\n    [y.lst()]\nh = True\n\ndef _repr(self):\n    return "<%s at 0x%x: %s>" % (self.__class__.__name__, id(self), self)\n\n\n# This file was generated from:\n#   Id: option_parser.py 527 2006-07-23 15:21:30Z greg\n#   Id: option.py 522 2006-06-11 16:22:03Z gward\n#   Id: help.py 527 2006-07-23 15:21:30Z greg\n#   Id: errors.py 509 2006-04-20 00:58:24Z gward\n\ny.lst({{60: n}: fact("s7", None)}, acc(lambda y: "s8", ["s2"]))\n\ndef total(g, h):\n    while y(lambda x: 34, lambda y: "s3", n):\n        return acc.h()\n        []\n    if "s8":\n        fact = 27\n        fact("s4", lst - [True, True, True])\n    else:\n        n = 51\n\ntotal.total(total(True, None < True, lst("s1", "s5")))\n\n# note\ndef fact(f, f):\n    y.y(lst(25, True) < f, 39)\nfor lst in {None: None}:\n    "s3" + lst(acc)\n    while 64:\n        f = fact(88, [], True)\n        []\n    fact\n# note\n{True: lst(True < f, "s8", lambda h: True)}\nfor x in x():\n    []\n    h()\ntotal.lst(n())\n# note\nif {n(): x.total()}:\n    while 11:\n        y = lst(lambda g: lambda x: "s6", fact(None), {[g]: h(True, "s2", None)})\n        n = 78 - n + {True: f}\n        lambda f: []\n    f({82: "s0"}, f({n: True}), f.g(n(True), acc()))\n    while ["s4", None]:\n        lst = n(acc, h, [53 + True, {g: None}])\n        n = total({16: acc}) == {{fact: "s9"}: lambda acc: True}\nn\nfor x in None - "s4":\n    fact = [True, True == None, None * 65] - True\n    None\n    h.total(acc(), f)\n{lambda lst: True - "s7": "s5"}\nx = 1 + 2\nf(x, 3)\nwhile x < 9:\n    x = x + 1\n    g(x)\ny = 2\n\n# a comment\ntotal = 0\nfor x in [1, 2, 3]:\n    total = total + x\nprint(total, "done")\nimport os\n\n__all__ = ["url2pathname","pathname2url"]\n\n# note\ndef y(fact, total):\n    h()\n    def y(n, y):\n        lst = 61\nfor n in {True: True}:\n    def h(x, f):\n        return None\n        h = True\n        return lambda g: True\n# a b c\ndef g(fact, fact):\n    n()\n    y = [total()]\nf = True - acc()\ndef h(y, x):\n    acc = "s5"\n    f = 4\n    return "s3"\ndef f(h, n):\n    while None:\n        43\n        [] + x.acc(86)\n        lst = True\n    x = lst(total.total(), total.g([True, 58, "s8"]), {17: n()})\n    "s6"\n\n13\nn\n# TODO\ndef total(x, y):\n    True\n    if None:\n        return None\n        f = True == None\nwhile True:\n    "s0"\n    h\n# TODO\nif "s3" * 20 - 33:\n    h = fact(lst, None)\n    lst = x.f(None, lambda x: lambda y: True)\ntotal = {None: h()}\nif acc.f():\n    if f() * {lst: "s2"}:\n        total = "s9"\n        n = h\n        h = [None, None * "s5"]\n    else:\n        y = acc(x(), y(lambda n: acc))\n        x = "s4"\n        total = fact.lst(fact([None]), fact(True, lst()))\nelse:\n    acc = True\n\n# note\nh = acc\nif lambda total: f(True):\n    []\n    [acc, y([None, None], [x, fact, None]), f(lst(lst, True, 62), 26 < 7)]\nelse:\n    def fact(acc, g):\n        46\n        g = lambda lst: lambda acc: 33\n\n63\n\nclass A:\n    def m(self):\n        return 1\nA().m()\n# note\ndef lst(fact, total):\n    acc = lambda acc: [72 + "s7", h(None, "s3"), acc]\n# note\nlambda y: g()\nif acc(f.g(11, 54)):\n    lst = y(34, total(f(lst, 45)))\n    lst([])\n    lst = x(lambda fact: lambda g: None, {g(None, "s6", "s6"): None})\n{h(True, True): None}\nn = total(55)\nif x(f(None)):\n    fact = n(True)\n    def y(n, total):\n        return [None] + [None]\n        return h(fact(lst, x), True * 99)\nlambda fact: total\n\nfrom turtle import Screen, Turtle, mainloop\n\nclass ColorTurtle(Turtle):\n\n    def __init__(self, x, y):\n        Turtle.__init__(self)\n        self.shape("turtle")\n        self.resizemode("user")\n        self.shapesize(3,3,5)\n        self.pensize(10)\n        self._color = [0,0,0]\n        self.x = x\n        self._color[x] = y\n        self.color(self._color)\n        self.speed(0)\n        self.left(90)\n        self.pu()\n        self.goto(x,0)\n        self.pd()\n        self.sety(1)\n        self.pu()\n        self.sety(y)\n        self.pencolor("gray25")\n        self.ondrag(self.shift)\n\n    def shift(self, x, y):\n        self.sety(max(0,min(y,1)))\n        self._color[self.x] = self.ycor()\n        self.fillcolor(self._color)\n        setbgcolor()\n\ng = fact.n(h(f + None, lst * "s8"))\n\nh.n({None: lambda f: None})\nn = lambda acc: total\nif {n(): None}:\n    lambda x: h.h([])\ng(31, "s9" < True) + True\nNone < x(True, True) * "s1"\ndef g(total, g):\n    return total\n    if lambda g: fact(95, True, "s4"):\n        lambda y: x\n    else:\n        "s4"\n        return "s6"\n        return lambda f: g()\nif {x.lst(fact, None): 25}:\n    n(g([True, "s7"], fact.h(None), "s3" - acc))\n    y\n    y = x(lst(True, "s3") * [59, True], x())\nelse:\n    h = [total()]\nfact(h(True) == 60, g("s5", 51) < {None: g}, lambda f: g(None, True, lst))\n\ng(n.g(), None + h(True), "s4")\nf = ["s9"]\ng = [f, {None: n()}, x(True)]\n\nNone\ntotal = total(x(None, "s9", "s3")) == g()\n\nclass Generator:\n    """Generates output from a Message object tree.\n\n    This basic generator writes the message to the given file object as plain\n    text.\n    """\n    #\n    # Public interface\n    #\n\n    def __init__(self, outfp, mangle_from_=None, maxheaderlen=None, *,\n                 policy=None):\n        """Create the generator for message flattening.\n\n        outfp is the output file-like object for writing the message to.  It\n        must have a write() method.\n\n        Optional mangle_from_ is a flag that, when True (the default if policy\n        is not set), escapes From_ lines in the body of the message by putting\n        a `>\' in front of them.\n\n        Optional maxheaderlen specifies the longest length for a non-continued\n        header.  When a header line is longer (in characters, with tabs\n        expanded to 8 spaces) than maxheaderlen, the header will split as\n        defined in the Header class.  Set maxheaderlen to zero to disable\n        header wrapping.  The default is 78, as recommended (but not required)\n        by RFC 2822.\n\n        The policy keyword specifies a policy object that controls a number of\n        aspects of the generator\'s operation.  If no policy is specified,\n        the policy associated with the Message object passed to the\n        flatten method is used.\n\n        """\n\n        if mangle_from_ is None:\n            mangle_from_ = True if policy is None else policy.mangle_from_\n        self._fp = outfp\n        self._mangle_from_ = mangle_from_\n        self.maxheaderlen = maxheaderlen\nclass IncrementalDecoder(codecs.IncrementalDecoder):\n    def decode(self, input, final=False):\n        return codecs.charmap_decode(input,self.errors,decoding_table)[0]\n\n\ng()\ntotal = None\n\ndef acc(h, x):\n    True\n# note\nif {[3]: lambda total: True}:\n    for lst in None:\n        lst.x()\n    if lambda g: True:\n        lst({[True, "s4"]: None})\nacc = acc(True, lambda x: [], total(True) < total())\n{True: lambda y: None}\nfor y in {fact: 89}:\n    {acc(g(), total("s4")): [[19, 26, 44], lambda acc: "s0", acc(70, True)]}\n# a comment\ntotal = 0\nfor x in [1, 2, 3]:\n    total = total + x\nprint(total, "done")\n# note\ny = h()\n\nlst = acc(g(lambda f: "s9", lambda lst: True, 92 == 27), [fact], f(total()))\ntotal = lst(total(True), 88, {"s6": 61})\nif lst(True == 84):\n    def h(acc, fact):\n        h = lambda h: "s7"\n        acc.lst(total(h < True, None < "s1"))\n        return lambda h: True\n    60\n    if "s1":\n        g = {[x(None), total()]: None}\n        lst = total(32)\nif __name__ == "__main__":\n    import unittest\n    unittest.main(\'idlelib.idle_test.test_searchengine\', verbosity=2, exit=False)\n\n"""\n    --------------------------------------\n        About this viewer\n    --------------------------------------\n\n    Tiny demo viewer to view turtle graphics example scripts.\n\n    Quickly and dirtyly assembled by Gregor Lingl.\n    June, 2006\n\n    For more information see: turtledemo - Help\n\n    Have fun!\nf = lst(fact(None), lst(acc), n.total())\nacc(lambda acc: None)\nf = [[lambda n: True]]\ntotal = True - lambda lst: 16\ntotal = total.total("s4") < fact(True, "s2", f) < lambda n: total\n\n# TODO\nif {None: 43}:\n    total([n, None], {"s1": acc}) < True\n    n = lambda x: "s5"\nelse:\n    lambda total: h(None, None, lambda x: 75)\n\nh(n(None)) - y(64)\n\n# TODO\nfor x in lambda fact: None:\n    "s8"\n    total = lambda total: n(fact) * lambda acc: True + {None: f}\n    x = ["s5" - {"s8": True}, x({fact: g}, lambda f: True)]\n\n# TODO\nfact = lambda y: y(lambda total: x, fact)\ntotal = None\nfact = fact(f, [None, None] - ["s1", h, True])\ntotal = n()\nx = lst.total([f, True] - True)\nNone\nlst = lambda total: y("s5") < {21: None}\n\n\nwhile "s9":\n    n = 25\n\n# note\nwhile True:\n    {y.fact({None: "s9"}, lst.g(62, "s7")): "s4"}\n    90\n18\n\nh()\nx(44, 15, True)\nn = True + h(2) == 74\nif fact(lambda total: 16, [y, y, None], None < 54):\n    h = 46\n    fact()\n    lambda n: x(lambda acc: None)\nwhile n():\n    40 == 74\n    h = True\n    True\ntotal(True * None, None, []) - True * 25 * lst\nx = {lambda x: x(True, "s5", lst): lambda h: fact}\n# a b c\ny.f(lambda total: h(None), f(None))\nlambda lst: x(acc(True, 35, "s2"), True < "s0", fact())\ntotal = None\n\n# a b c\nclass A:\n    def m(self):\n        return 1\nA().m()\n# note\nfor y in y("s3", None, True):\n    while None:\n        35\n        n = h.lst(h(True, acc(True, None)), [] + g)\n        x = total("s9", True, y())\nif y():\n    [] * g("s5", 26) * h()\nlst.y(True - f(16, True), h({"s3": "s2"}))\nfor g in []:\n    total = lambda acc: [[f, 0]]\n\n"""      turtle-example-suite:\n\n        tdemo_fractalCurves.py\n\n',
      steps: [
        {
          op: "scroll",
          a: 0.6728706853464246,
        },
        {
          op: "comment",
          a: 0.5471986455377191,
          text: "TODO: fix",
          accept: true,
        },
        {
          op: "replaceDoc",
          text: '# a comment\ntotal = 0\nfor x in [1, 2, 3]:\n    total = total + x\nprint(total, "done")\n',
        },
      ],
      motion: "reduced",
    },
    { baseURL: `http://127.0.0.1:${process.env.CMB6_PORT || 8177}` }
  );
  expect(v).toBeNull();
});

test("soak seed 261: a comment next to a block in a document scrolled past the drawn part marks the block (a refused paste, then a comment next to a comment)", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 261,
      language: "scheme",
      code: '; note\nacc\n(define total (h))\n(define (y total) (if #t (lambda (g) (h \'a)) (= \'a (let ([x lst]) 68))))\n; a comment\n(define (fact n)\n  (if (<= n 1)\n      1\n      (* n (fact (- n 1)))))\n(fact 5)\n; TODO\n(or true false)\n\n(define (f a b c) (+ a c))\n(define x 5)\n(f 1 2)\n(if (> x 1) 2 3)\n(define n acc)\n(n)\n; note\n(define (lst f) "s2")\n\n; TODO\n(define (y total) (- (y) (total fact (lambda (h) \'a) (if 35 h \'a))))\nacc\n; TODO\n(- (cond ["s3" (f (acc #t) (g \'a #f 59) (* #f #f))] [else (g)]) (y (fact)))\n\n(define (lst acc) (lambda (n) #t))\n\n; TODO\n(lst)\n(define lst \'(acc))\n(define (g lst) (acc #t #t (if (n) (if acc #t 91) (f "s5" #t #f))))\n(define (lst n) \'a)\n(define f (lst (lst "s4" \'(92)) "s5"))\n\ng\n(check-error (f) "m")\n\n(repeat 2\n  (show "a")\n  (show "x")\n  (show "b"))\n(f ... x)\n(cond [... 1] [else ...])\n; TODO\n(acc #t)\n\n(define (y x) (< (= \'a n) (lambda (f) (lst x))))\n(* "s3" #t)\n; a b c\n; a b c\n(define total (total))\n; TODO\n(lambda (y) "s4")\n; a b c\n(define total (cond [(acc (lambda (f) n) (cond [43 "s3"] [else #f])) (+ 74 (lambda (acc) #t))] [else (n 61 (if n 30 #t) "s6")]))\n; a b c\n"s7"\n; a b c\n(cond [54 \'a] [else (fact)])\n(define (y n) (cond [\'((total #t y "s6") #f) (< (y 0 "s5") (cond [35 \'a] [else h]))] [else (h (- fact 41) #t)]))\n(define g (h))\n(define y (g 52 "s5"))\n(define h (fact 74 (= (total) (+ 12 \'a))))\n(acc)\n(define (h total) (cond [(x) (+ (lambda (x) #f) (y "s0" 98 \'a))] [else (cond [(- "s1" "s0") (lst acc)] [else (lambda (n) #t)])]))\n(define (x total) (= 87 (lambda (total) (- #t 45))))\n(define y (f (h #t \'a (if \'a #f 35)) (* (y x "s7") \'a)))\n(define (h x) (h (cond [#t (y 3 h)] [else "s0"]) (cond [(lambda (x) #t) (let ([acc #t]) 96)] [else (total #t "s7")]) x))\nlst\n\n; note\n(h)\n(define (fact n) lst)\n(define (n y) \'a)\n(define (y lst) (f (= (y #f 90) (n)) g))\n; TODO\n(* (acc) (cond [36 #f] [else #t]))\n\n(+ (+ (* 3 (+ (* 3 5 (- 2 9))) 5 (- (+ (* 3 5 (- 2 9))) (+ (* 3 5 (- 2 9))) 9))) (* 3 (+ (* 3 5 (- 2 9))) (- 2 (+ (* 3 5 (- 2 9))))))\n))) 9))) (* 3 (+ (* 3 5 (- 2 9))) (- 2 (+ (* \n(+ (+ (* 3 (+ (* 3 5 (- 2 9))) 5 (- (+ (* 3 5 (- 2 9))) (+ (* 3 5 (- 2 \n(+ (+ (* 3 (+ (* 3 5 (- 2 9))) 5 (- (+ (* 3 5 (- 2 9))) (+ (* 3 5 (- 2 9))) 9))) (* 3 (+ (* 3 5 (- 2 9))) (- 2 (+ (* 3 5 (- 2 9))))))\n))) 9))) (* 3 (+ (* 3 5 (- 2 9))) (- 2 (+ (* 3 5 (- 2 9))))))\n 5 (- 2 9))))))\n\n(a b c)\n(d)\n(e (f g) (h i))\n(define (f n) (fact 93 (let ([n #f]) \'(44))))\n(define (total lst) (* (lst (if \'a "s7" h) (* #f #f)) \'(\'(#t #f) (x))))\n(define acc (y (let ([fact (lambda (h) n)]) 54) #f))\n(define n #f)\n(define (h y) (let ([total "s4"]) \'((y 17 67) (fact) (cond ["s9" \'a] [else #t]))))\n\n(define (fact f) (+ (fact) (lambda (acc) (n #t))))\n; TODO\n; TODO\n(define (f acc) (x (cond [(if total "s6" #f) (* \'a "s7")] [else (lst #t)])))\n16\n\n(define h (h (total #t "s8")))\n(define n (= "s4" acc))\nfact\n(define acc (cond [#t (fact (cond [#t "s5"] [else 9]) (h 42 #t 41))] [else (if lst (f) (= \'a 61))]))\n(total #f 64)\n(define (acc g) \'((lst (total #t) (g 79)) (cond [\'(h #f #f) (cond ["s5" total] [else #f])] [else (lst #f \'a)]) (f #t (if #f "s0" 2))))\n(let ([a 1] [b 2]) (+ a b))\n(lambda (x) x)\n\'(1 2 3)\n(define (fact f) 74)\n; a b c\n(define (n fact) (y (if (if 4 #f f) (x 36 #t) (lst)) (< 63 (let ([g #f]) y))))\n(define total #f)\n; a b c\n(define (lst fact) (cond [(f (if 11 h #t) (- acc lst)) (total (+ "s5" #f) \'a)] [else (g (cond [8 h] [else \'a]))]))\n; a b c\n(define n 44)\n\'a\n\n; a comment\n(define (fact n)\n  (if (<= n 1)\n      1\n      (* n (fact (- n 1)))))\n(fact 5)\n(define f #t)\n\n(define (fact total) (fact))\n\n(define fact (let ([total \'((acc) (if #f "s9" #t))]) (- (lambda (n) #t) (cond [#f #t] [else #f]))))\n#f\n(n (if (acc (cond [#f #f] [else "s2"]) (lambda (total) "s9")) #f (cond [(+ \'a #f) (lambda (f) \'a)] [else (let ([n \'a]) \'a)])))\n(define (y n) \'((total) #f))\n\n; a b c\n(define g x)\n(define (total acc) #f)\n\n; TODO\n(g)\n\n(define lst (+ f (lambda (total) (* 47 #t))))\n\n(function\n aaaa\n bbbb\n cccc)\n; TODO\n(let ([a 1] [b 2]) (+ a b))\n(lambda (x) x)\n\'(1 2 3)\n(define total (x (cond [(y h) (f \'a)] [else (g)]) (x (n #t) (fact)) (if (if #t \'a n) (if "s2" "s2" \'a) y)))\n#f\n(define g (acc #f))\n(< (g (lambda (h) y) (y (acc #f) (g #f \'a #f) \'a) x) 53)\n(define acc (lambda (g) (h #f (x #t fact x))))\n(let ([n "s3"]) (= \'((n #f 63) 30 (lst acc)) (- (* \'a g) (g acc "s8"))))\n\n(y)\n(define lst \'((h 58)))\n(lambda (lst) (if (< \'a #f) \'(f (x "s0") (let ([x "s5"]) #t)) \'a))\n\n(define total (y (x x (cond ["s8" "s1"] [else #f]))))\n\n(define (n total) (if (fact (f 14) \'(66)) (if (= #f \'a) #f (+ #t #f)) (let ([f (let ([n 76]) #t)]) n)))\n; note\n(define f (cond [(if (acc #t #t #f) (- "s1" 93) (n 51)) \'a] [else (cond ["s6" \'(#f lst)] [else f])]))\n(if (let ([y "s8"]) #t) #f (if (f) #f (cond [#f x] [else (y n \'a)])))\n(lambda (x) (acc 71))\n\n(define x (cond [(lambda (fact) #t) (g #t \'a)] [else \'((lambda (total) acc))]))\n\n(define y (acc (x 60 \'a (fact "s2" x)) (acc (if "s2" f 54) "s5") \'a))\n; note\n(define (total n) #f)\n(define acc #t)\n; a b c\n(define (total lst) (cond [(g) (< (n) (cond ["s8" 80] [else #t]))] [else (h #t \'a #f)]))\n(define f \'a)\n(define g h)\n(define y (fact (g)))\n(define (x y) total)\n(define n "s2")\n\n(define (acc total) "s6")\n; a b c\n(define (f fact) (x 96 (n (n #t #t y) (cond [#t "s4"] [else #t])) \'a))\n#f\n(define (g total) (- #f \'a))\n\'((lst (+ (h \'a #t #t) (cond [71 #t] [else #f])) y) 68 (lambda (f) #f))\n(let ([f (- (let ([h #f]) #f) y)]) (let ([g (let ([h (y "s5")]) \'(46))]) (let ([x lst]) (lambda (h) \'a))))\n(cond [total (n (lambda (y) (let ([g "s0"]) #t)) "s9")] [else \'a])\n\n(h)\n; note\n(define (total h) (if n (= (fact 80 "s1" #t) (if #t "s5" "s4")) (= (acc f n) \'a)))\n(define (g g) #f)\n; a b c\n(define total \'a)\n; note\n(define h (acc (lambda (x) total)))\n(define (n x) (f (let ([total (+ #f "s1")]) (cond [\'a #f] [else \'a])) (if (* "s1" y) (let ([f acc]) 25) (cond [\'a "s2"] [else fact])) (n (lambda (acc) "s0"))))\n(n)\n(define (g total) \'((+ (n \'a \'a "s2") (if \'a #f #t)) #t (x (cond [#f #f] [else x]) (f))))\n"s3"\n\n(x (= (fact) (fact (x lst #f) (acc \'a \'a #t) (+ #t g))))\n; note\n(define (n n) #t)\n\n(define (fact acc) (total (fact (* #f x) (f) #f) (acc \'a #t 44)))\n(define (fact x) n)\n; a b c\n(lambda (h) (n (g (total 91) #t)))\n(total (if (if (< #f "s5") (+ #t "s7") (n #t)) (lambda (total) #f) (y (y #f) \'(15) (h "s1" #t \'a))))\n(define x (- (x) (h (lambda (x) #f))))\n(define (x acc) (+ (let ([f (acc)]) \'a) (h g (total) #f)))\n(define (g x) (cond [(* (lst) \'a) (fact (cond [#t 89] [else 55]) (if 63 \'a 70) (fact 9 "s8"))] [else (y acc)]))\n(define (n f) (h (lambda (n) (cond [#f #f] [else \'a]))))\n(- (lst (lst)) (+ (cond [#f (f #f "s3" x)] [else (g x)]) (+ #t #f)))\n(y (let ([total (= (h \'a) x)]) (< 73 (f))) 40)\n(define y (acc (if (n y) 17 51)))\n\n(define total (lambda (n) (let ([total (f)]) "s9")))\n(define (f lst) (g))\n(define (x total) "s5")\n(define fact (* 32 (cond [h (+ "s2" #f)] [else 67])))\n(lst (- (if (if #t 15 #t) (lambda (lst) "s0") (if 50 #t 80)) (lst (* \'a \'a))))\n(define lst 66)\n; note\n(define (g lst) (x 59))\n(total (- (y) (+ (acc "s0" #f "s4") "s8")) \'a)\n(define (total acc) (h \'(\'a)))\n(define (g fact) (g #f (g (< 27 78) (+ #t 14) (lambda (fact) #t))))\n(+ (x (n (+ 53 g) (= #f \'a) acc) (f (let ([h 58]) "s2") (if f #t #t) (f #t))) (= (lambda (f) 52) (fact #f \'(81))))\n(comment free)\n1 #| comment1 |#\n1 #| comment1 |#\n#| comment2 |#\n(define total (cond [\'((- #f #f) #f) #t] [else (lst (if lst "s1" #t) (h))]))\n"s5"\n(define (f g) (- (total) (lambda (f) #t)))\n; a b c\n(let ([total (fact \'((+ n #t)) (* (y #t "s6" n) lst))]) 0)\n(cond [(if fact #t (n (let ([acc "s1"]) "s7") (let ([h \'a]) y))) "s1"] [else (h 4 (if (lambda (n) \'a) (lambda (n) \'a) (y)) (total (cond [\'a #t] [else #t]) #t))])\n(define (h g) (fact \'a (h) \'a))\n; a b c\n(define y (total))\n(define (total y) (g (+ (< "s8" #f) (n #t)) #f))\n\n; a b c\n(define f 77)\n(define total \'((f) (= (= \'a #t) (y \'a \'a)) (if 28 "s1" (+ \'a "s8"))))\n\'a\n(define x 5)\n(f 1 2)\n(if (> x 1) 2 3)\n(define fact (if (let ([g #t]) 88) \'a (n (h 66) \'a (h \'a fact y))))\n\n; a comment\n(define (fact n)\n  (if (<= n 1)\n      1\n      (* n (fact (- n 1)))))\n(fact 5)\n(define (n fact) \'a)\n(define fact (< (h (lambda (g) "s8") (if "s5" \'a \'a) (- #t #f)) (total (if "s0" 58 75) #t)))\n(define (g acc) \'a)\n(define x (- #f (x)))\n(define fact (x (x \'a) (cond ["s3" "s1"] [else (= #t #f)]) (x (let ([lst \'a]) "s3") (lambda (fact) \'a))))\n; a comment\n(define (fact n)\n  (if (<= n 1)\n      1\n      (* n (fact (- n 1)))))\n(fact 5)\n; TODO\n(define (h n) (acc 12 (y)))\n(y)\n(define n (= \'a #t))\n\'((* (n "s5") #f) (total \'((f 80 \'a)) (< (lambda (f) \'a) (if #f #f #f))))\n; TODO\n(define f (lst (= 50 "s0") (f \'a (if "s8" #f #t) (lambda (acc) #f))))\n(define (total g) #f)\n(define y (h (y (lambda (fact) "s9") (cond ["s0" #t] [else #f]) (lambda (fact) total)) \'a))\n\n; note\n(cond [(- #t (f (h acc "s5" #t) 52 acc)) 28] [else "s1"])\n(define (lst n) (n))\n(define (acc lst) "s4")\n(define f "s6")\n(define acc (= \'a (lst)))\n; TODO\n(define (g g) (total (- (fact \'a) 29) (cond [\'a (total h "s8")] [else #f])))\n(define acc (let ([y (acc (lambda (n) fact))]) "s8"))\n(define (acc acc) (h))\n; note\n(define total \'a)\n"s6"\n(define (g x) (lst (f (if 0 43 #f))))\n(define (n n) (f))\n(define (y acc) "s6")\n(define lst (lambda (fact) (cond [(f \'a) (lambda (acc) #f)] [else \'a])))\n(define (y y) #t)\n; note\n(cond [(h (lambda (acc) (+ lst "s5")) (acc (x) (if \'a 85 49) \'(\'a #t #t))) (lambda (h) (y (h \'a #t)))] [else (x #t (lambda (f) (y)) (h (cond [#t 40] [else f]) (if n #t \'a)))])\n(+ (< (lambda (n) (if #f \'a fact)) \'((if "s0" 48 \'a))) 13)\n\n; a b c\n(define (n fact) (cond [#t #t] [else #f]))\n(define y "s1")\n(define (n lst) (* (lst (g #f)) 2))\n; a b c\n(define (fact f) (* #f (* (* 53 \'a) (cond [#t #f] [else #f]))))\n(cond [(f) \'a] [else #f])\n"s5"\n\'a\n(- (total) \'a)\n; a b c\n(define acc \'a)\n"s8"\n(define f (y (- x #t) (lambda (g) #t) (f)))\n\n(y (acc) (x (total total #t (let ([h \'a]) total)) 37) (lst))\n\n(define x (* n \'((cond [11 54] [else \'a]) #f (h "s2" "s8" 60))))\n(define h (lst (= (= 22 39) (acc \'a #f #t)) (if 90 h x)))\n(define (fact fact) (acc (g #f (- fact #f) (< #t "s9")) (< 37 \'(#t #t \'a)) (if \'a \'a (let ([total total]) #t))))\n(define (h y) (if (if total 5 (if 58 \'a #t)) x (x (fact 78 acc) (x) #t)))\n\n; TODO\n(if (let ([lst #f]) \'(#t (f) (y #f))) #f (cond [(let ([total (let ([y #f]) 54)]) (f \'a #f)) (- (let ([h \'a]) g) (total))] [else (total (lst total #t #t))]))\n(define y (let ([h (cond [(total total 54 #f) (if 86 "s4" 1)] [else (if \'a #t 68)])]) (cond [#f \'a] [else (- "s8" 5)])))\n(define (h g) (if n #f (n)))\n\'((+ (f (y #f \'a) total "s3") (let ([total (total #t \'a 18)]) (cond [#f f] [else \'a]))) "s3")\n(define (n lst) (= (if (- \'a "s2") (h total 94) 86) (lambda (g) "s5")))\n; TODO\n(define fact "s8")\n(define (f h) (+ (* (lst "s8") (lst #f h acc)) (acc (total))))\n; TODO\n(* (lambda (n) (f #f (acc #t) (n fact \'a "s7"))) (f (< (n g total 82) (h #t 85)) g #t))\n\n(define x 5)\n(f 1 2)\n(if (> x 1) 2 3)\n(letbody x 1 ; a z b w)\n; TODO\n(define f (cond [(if (x) (lambda (g) y) (if \'a \'a \'a)) (cond [\'(\'a "s3" #t) (let ([total \'a]) 49)] [else #t])] [else "s4"]))\n(define (g f) (x))\n(define n (lst 19))\n(define acc (x 80 (h (lambda (g) #t) (if 48 h #f))))\n(define (y y) (lst (fact) (n (cond [#f 52] [else #f])) g))\n; TODO\n(define acc (- h (lambda (fact) "s8")))\n(define y (+ (cond [28 (n "s2" #f)] [else (if "s5" 70 acc)]) (lambda (g) (< \'a \'a))))\n\n; a b c\n(define (lst y) 37)\n\n(define cow1 (make-cow (make-posn (/ SCREEN-WIDTH 4) (- SCREEN-HEIGHT HALF-COW-HEIGHT)) "right"))\n(define cow2 (make-cow (make-posn (* SCREEN-WIDTH 3/4) (- SCREEN-HEIGHT HALF-COW-HEIGHT)) "left"))\n\n; A world is a posn and a list-of-cows\n; ufo: posn  cows: list-of-cows\n; Represents the ufo\'s position and all the cows\' positions directions\n\n(lambda (f) \'a)\n; TODO\n(ifs t (then a) (otherwise b))\n\n(define fact (= (acc acc (y 13 \'a \'a)) (= (lambda (total) 35) #f)))\n(define total (n))\n\n(define acc (cond [69 #f] [else acc]))\nlst\n(let ([f (h)]) 66)\n(define n (if (if (fact "s5") (if "s1" #f \'a) (n #t acc #t)) (cond [(f "s2") (f "s4" 17 n)] [else #t]) 80))\n(x)\n\n(function\n aaaa\n bbbb\n cccc)\n(define (sq x) (* x x))\n(sq 3)\n(cond [(= x 2) 3] [else 4])\n42\n\n(provide f)\n(define-values (a b) (values 1 2))\n(f a b)\n\n(define x (h "s6"))\n; TODO\n\'("s6" (= (g "s2" (x) \'("s0" total)) (cond [(acc 93 \'a #f) (if \'a #t lst)] [else #f])))\n\n(define x (- (y) (< (< "s8" "s3") \'a)))\n(define g "s5")\n(define (f total) \'((< (lst #t \'a \'a) (lambda (f) \'a))))\n(define (x y) (y (+ #f (= y "s7")) \'a))\n\n; TODO\n(let ([fact (- (* 68 #t) (= (let ([h "s2"]) "s2") (total y total "s6")))]) (g #f))\n(total)\n; note\n(define f (n (x #f)))\n; TODO\n(if (acc h) (fact) (- (fact (* 73 \'a) (acc #f g #t)) 62))\n(cond [(y) acc] [else (let ([total (lst)]) \'a)])\n(define (h h) (total (cond [g "s3"] [else \'a])))\n(f y (- "s2" (- "s1" (f 92))))\n(x)\n(define (h h) (+ (f) (cond [(h #t #f \'a) (let ([fact #t]) #t)] [else (lst "s9")])))\n(define (total n) "s6")\n; TODO\nn\n; a b c\n(lambda (f) (fact))\n(f ... x)\n(cond [... 1] [else ...])\n(a b c)\n(d)\n(e (f g) (h i))\n; a comment\n(define (fact n)\n  (if (<= n 1)\n      1\n      (* n (fact (- n 1)))))\n(fact 5)\n\n(define (h x) #t)\n#t\n(define x \'((lst)))\n(if (< \'((= x \'a)) (x "s8" #f #t)) n (f (lambda (acc) #f)))\n(define (fact total) (n g (let ([lst #t]) (lambda (n) 51)) (cond [(lambda (n) #t) (fact)] [else (- \'a #t)])))\n; TODO\n(define fact (cond [(h (y #f) "s6" 22) (fact (fact #t #f \'a))] [else (let ([h (n n #f 14)]) (if g #t "s5"))]))\n(define (h acc) 4)\n(define n \'(x \'a))\n(define (n acc) (lambda (fact) #t))\n(define (g f) (lst (lambda (y) #t) (cond [(g h \'a #t) (h \'a)] [else "s4"])))\n\n(define x 5)\n(f 1 2)\n(if (> x 1) 2 3)\n; TODO\n(define h (h #t))\n(define (g total) (if (lst (* "s3" \'a) (acc f "s2")) #f (h)))\n\n(+ (f (n (h #f) (f y))) (fact))\n(define y #t)\n(define lst (cond [(n \'a) (total)] [else "s8"]))\n(define lst (+ (let ([acc (lambda (fact) lst)]) (cond [#t "s3"] [else 32])) (let ([y (acc 72 lst)]) \'a)))\n(define x \'((= (< \'a total) (let ([h 89]) \'a)) \'((lambda (n) x))))\n(define h (acc (acc)))\n(define (n lst) (y \'a \'((f #f #t) (if "s9" y \'a))))\n#f\n(define (y g) "s8")\n(define h (let ([n (lst "s2" "s3" (g fact "s9"))]) \'a))\n(if (f \'(#t) (< (g #f fact) #f)) (lst n \'a) (cond [\'(11 (n "s1" #t) #f) (+ (total \'a y) (y "s3"))] [else (total (y \'a 13))]))\n\n',
      steps: [
        {
          op: "topLevelType",
          a: 0.7417658474296331,
          text: "x",
          accept: false,
          how: "paste",
        },
        {
          op: "commentNear",
          a: 0.8291500459890813,
          dir: 1,
          text: "a b c",
          accept: true,
        },
      ],
      motion: "full",
      editor: {
        lineNumbers: false,
        lineWrapping: false,
        collapseAll: false,
        reconcile: true,
        anchors: true,
        fastErrors: true,
        skipRoots: true,
        activityLimit: null,
      },
    },
    { baseURL: `http://127.0.0.1:${process.env.CMB6_PORT || 8177}` }
  );
  expect(v).toBeNull();
});

test("soak seed 3575: a collapse burst skips the blocks hidden inside a collapsed one (it waited out the timeout on each)", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 3575,
      language: "javascript",
      code: '// TODO\nvar h = f(n ? (h) => true : lst.total(87, true), null, g === "s5" ? total : fact(true, "s2", true));\n',
      steps: [{ op: "collapseBurst", a: 0.09770062356255949, n: 7, on: true }],
      motion: "reduced",
    },
    { baseURL: `http://127.0.0.1:${process.env.CMB6_PORT || 8177}` }
  );
  expect(v).toBeNull();
});
test("soak seed 3832: collapsing everything in a long document leaves no line number off its block (the measure loop gave up and the gutter kept old heights)", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 3832,
      language: "python",
      code: 'while acc:\n    total = fact.x(g(lambda y: True), lambda lst: [48])\n\ng = "s9"\n\nNone\nif (lambda lst: x(True)):\n    while 39:\n        y = True\n        x = 81\n        n = None\nelse:\n    f(y(True, "s6" < "s2", acc), lambda n: 52 * 91, None < None * fact(f, f, True))\nlst = f(lambda total: lst(total, None, True), lst(29, fact) - (lambda lst: 26), g("s7", "s9") == None)\ny(["s7"])\n\nf = acc(acc(lst.lst(41), y("s9", True, g)))\n\nf = "s5"\nfor g in lst(True):\n    acc = {{True == True: lambda h: total}: lambda g: x(11)}\n    [None]\n    h = lambda x: lambda n: lambda acc: True\nfact = "s9"\nif None == "s3" == None:\n    y = y(y.acc(), h()) < fact(acc < 22)\n    n = 95\n    "s6"\nelse:\n    while None:\n        g = fact(n(n(), y(None, None), 61))\n        y = lambda y: (lambda h: True) - x("s6", x, None)\n        lambda x: 77\nfor h in True + "s0":\n    def y(fact, f):\n        None\n        f = fact.fact() < f(f())\nfact = {lst(n(), True, x()): lambda y: "s6"}\n[total, lst(g(y, 52))]\nx = {h([True, True, n], [True, None, "s7"]): {True: lambda lst: "s2"}}\nwhile "s7":\n    lambda y: 29\n\nx = 1 + 2\nf(x, 3)\nwhile x < 9:\n    x = x + 1\n    g(x)\ny = 2\n# note\ndef lst(acc, x):\n    while {acc("s0", "s3"): x(total)}:\n        g(f.acc(), acc("s2"))\n    h\nf\n(lambda fact: g()) * x(acc, f(acc), x())\ng("s7", fact.total() - [None, "s5"])\ny = True\nlambda g: 69\nfor fact in g(77):\n    h = lambda total: y(acc(True, True))\n    "s0"\nfor acc in [lst, None]:\n    None\nif True == 97:\n    x = lst.acc()\nlst = f(x(f(None, 40, lst), {83: 97}))\n\n33\nlambda f: [None, "s5"] * x(36, fact, 64)\n{(lambda total: None) * acc.y(x, True): [lambda h: None]}\n{n.y(99): 2}\n"s6"\nlst(g(lst(None, 39), True + True), [50])\ndef f(a, b):\n    y = a\n    return y\nf(1, 2)\ny = None\nNone\ny = acc(n("s2" == True), True, {[True, "s8", True]: lambda x: 56})\ndef x(f, g):\n    for fact in total.g():\n        lambda acc: "s1"\n        None * (lambda acc: None)\n        None\n    [f()]\n    def y(total, acc):\n        lst(True)\ndef f(n, y):\n    fact = "s2" == g([], f())\n    lambda g: h()\n\nwhile True:\n    x(f(y(), []), total())\n    def acc(h, n):\n        return []\n        x = 54\n    [lambda y: f, "s5"]\nfor acc in h("s6"):\n    g = lst.n(acc(28, lambda fact: True, y(total, None)))\n\nNone\n\nacc = g(f, total, True) < h + g\n# TODO\n[lambda n: total("s7", True, fact), [lambda acc: lst, True == "s6"], n]\nf = h()\nif x:\n    f(1)\nelif y:\n    g()\nelse:\n    h()\n[1, 2]\nif f(acc(None, "s8", "s6")):\n    def y(total, total):\n        y = "s7"\n        return True\n        return lst.x(None + "s2")\nelse:\n    "s4" - (lambda h: [26, "s7"])\n\nx = 46\ndef f(n, h):\n    while {h(): x(True)}:\n        lambda g: "s1"\n        return lst(acc("s9"), n(), n())\n        return f([True, True, 78])\n    while total:\n        lst = x.h()\n        lst = x.h() * 88\n        return n\nif total(None, "s7"):\n    {(lambda fact: 63): {h(True): g}}\n    f = acc(acc(None, lambda g: g), n(h - n, f(True, None), y()))\ny()\nTrue\nacc()\ntotal([], [] == (lambda fact: None))\ny = n\n# a b c\nfor h in fact(None, True):\n    def lst(lst, n):\n        [lambda fact: 63 + True]\n        x = lst(f() < {True: None}, lst(True, lambda h: n), fact(n, n(n, 17, "s3")))\n        True\n    n = 13\n    {None: "s2"} < y\n# a b c\nfor n in "s1":\n    True\n    None\n    67\ng()\n# note\nif x(y) - y:\n    while n(acc.x(16)):\n        acc = total()\nelse:\n    x = 74\n    f(acc(lst, lambda x: 2, g(None, True, True)))\nx = total(fact(96 - 91, lst(91, 72, 77)), lst(True) + y(44))\ndef total(y, fact):\n    def x(x, y):\n        f = fact.lst(h("s5" < True, n.acc(25), [90, True, n]))\n    return x(True) == 29\n    x.g(lst()) - "s9"\nNone\n"s5"\nlst()\nwhile None:\n    18\n    acc = f(72)\nclass IncrementalDecoder(codecs.IncrementalDecoder):\n    def decode(self, input, final=False):\n        return codecs.charmap_decode(input,self.errors,decoding_table)[0]\n\ndef remoteref(obj):\n    oid = id(obj)\n    objecttable[oid] = obj\n    return RemoteProxy(oid)\n\n\ntotal\nh(h(n(), "s0"))\nif x([], []):\n    fact = 88\n    n = {fact(66, True): "s5"} - "s8"\n    total = True\nelse:\n    lst = True + None == [total.x(), h(21, f, 59), x(acc, g)]\n    total = acc({True: n}, lst()) == "s8"\n    total.total()\n# a comment\ntotal = 0\nfor x in [1, 2, 3]:\n    total = total + x\nprint(total, "done")\n# TODO\nlst = n.acc([])\n3\nx = None\nacc = [n(f(True, "s3", h), h("s7", fact), {fact: None}), g.fact(y(True, None, 50))]\nif (lambda y: [49, x]):\n    x = 65\nh = h() - h.h()\n# note\nlst([h(g, None)], lambda total: 27 + True, n.n(n(True), 26))\nimport os\n\n__all__ = ["url2pathname","pathname2url"]\n\nn("s2", 49 == lst, g)\ng = g()\nacc\n\n[]\nif (lambda n: acc < True):\n    acc(None)\nh = None\nn = None\nwhile n.acc(h, n(None)):\n    def y(f, fact):\n        return n - (lambda x: "s8")\n        total.lst()\nacc = {fact(lst(), x.total(x, 38), 93): lst}\nlambda total: lambda h: True\nx\n(lambda total: lambda n: None) * True\nclass AttributesNSImpl(AttributesImpl):\n\n    def __init__(self, attrs, qnames):\n        """NS-aware implementation.\n\n        attrs should be of the form {(ns_uri, lname): value, ...}.\n        qnames of the form {(ns_uri, lname): qname, ...}."""\n        self._attrs = attrs\n        self._qnames = qnames\n\n    def getValueByQName(self, name):\n        for (nsname, qname) in self._qnames.items():\n            if qname == name:\n                return self._attrs[nsname]\n\n        raise KeyError(name)\n\n    def getNameByQName(self, name):\n        for (nsname, qname) in self._qnames.items():\n            if qname == name:\n                return nsname\n\n        raise KeyError(name)\n\n    def getQNameByName(self, name):\n        return self._qnames[name]\n\n    def getQNames(self):\n        return list(self._qnames.values())\n\n    def copy(self):\n        return self.__class__(self._attrs, self._qnames)\n\n\nx = 1 + 2\nf(x, 3)\nwhile x < 9:\n    x = x + 1\n    g(x)\ny = 2\n\nclass KeysView(MappingView, Set):\n\n    __slots__ = ()\n\n    @classmethod\n    def _from_iterable(self, it):\n        return set(it)\n\n    def __contains__(self, key):\n        return key in self._mapping\n\n    def __iter__(self):\n        yield from self._mapping\n\ndef total(n, g):\n    for acc in 10:\n        n = h()\n    total = h(total(total.fact("s0"), [], None), lambda n: h, [])\n    if [[12], None * x, lst()]:\n        return lambda fact: fact()\n    else:\n        f = y(f("s4" < lst), f, None)\n        fact = g()\nlst = None\n# note\nfor g in f():\n    if h():\n        acc = {g(): total.lst()}\n        g = 9\n        g = "s9"\n    while fact < 30 + {acc: None}:\n        fact = y()\n        h = [lambda acc: f(None), None]\n        n = 14\n    f = h(91, acc.x("s0", "s2")) * x\ng = None\n\n18\n# TODO\n31 + True\nacc = True\ndef h(total, y):\n    total(90, True - (lambda lst: None))\n\ndef x(total, x):\n    if [y(52, None, h), "s4", g]:\n        return y(73 == "s3", lambda fact: True, [47])\n    if y():\n        h = n(y())\n        return f(True * h, lambda n: 62)\n        n = 83\ng = {True: None}\ny = x\nfact([])\n\ndef g(acc, acc):\n    for lst in fact + 9:\n        return lambda g: acc(None, h, 10)\n        y = lst(lambda total: f, x() + 91)\n        None\n    15\n    None\nx = 48\n# TODO\nx = g({22 == f: 18}, None)\n\ndef f(total, y):\n    []\nh = None\nif h(True):\n    h\n    while acc(True):\n        total()\nelse:\n    g(n.x(x), None)\n(lambda g: 29 + lst) - total\nif "s4":\n    if [g.fact(11)]:\n        total = lambda fact: h()\n        y = "s9"\n    g = y(h) + 63 == True\n    y(lst(), y(lambda n: h, [True]))\n"s0" + x() * {None: "s7"} - g(50, None, "s5")\nfor y in 13:\n    n(1, lambda lst: 93)\n    []\ng = n()\n# a b c\nfor acc in 58:\n    if lst(fact(x), g.h()):\n        h = lambda lst: 27\n    else:\n        lst = acc(total.fact(), 1 < None == None)\n        True\n    27\n    lst(None)\n# note\nn = fact\nx(lst())\n# note\nwhile (lambda y: None):\n    x = {total(x): lst([], [total, None], [])}\n    for x in True:\n        lst = y()\n    True\nTrue\n{[True]: f(h, h, 69)} - f(n < "s9")\n\n_invalid_codepoints = {\n    # 0x0001 to 0x0008\n    0x1, 0x2, 0x3, 0x4, 0x5, 0x6, 0x7, 0x8,\n    # 0x000E to 0x001F\n    0xe, 0xf, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19,\n    0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f,\n    # 0x007F to 0x009F\n    0x7f, 0x80, 0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a,\n    0x8b, 0x8c, 0x8d, 0x8e, 0x8f, 0x90, 0x91, 0x92, 0x93, 0x94, 0x95, 0x96,\n    0x97, 0x98, 0x99, 0x9a, 0x9b, 0x9c, 0x9d, 0x9e, 0x9f,\n    # 0xFDD0 to 0xFDEF\n    0xfdd0, 0xfdd1, 0xfdd2, 0xfdd3, 0xfdd4, 0xfdd5, 0xfdd6, 0xfdd7, 0xfdd8,\n    0xfdd9, 0xfdda, 0xfddb, 0xfddc, 0xfddd, 0xfdde, 0xfddf, 0xfde0, 0xfde1,\n    0xfde2, 0xfde3, 0xfde4, 0xfde5, 0xfde6, 0xfde7, 0xfde8, 0xfde9, 0xfdea,\n    0xfdeb, 0xfdec, 0xfded, 0xfdee, 0xfdef,\n    # others\n    0xb, 0xfffe, 0xffff, 0x1fffe, 0x1ffff, 0x2fffe, 0x2ffff, 0x3fffe, 0x3ffff,\n    0x4fffe, 0x4ffff, 0x5fffe, 0x5ffff, 0x6fffe, 0x6ffff, 0x7fffe, 0x7ffff,\n    0x8fffe, 0x8ffff, 0x9fffe, 0x9ffff, 0xafffe, 0xaffff, 0xbfffe, 0xbffff,\n    0xcfffe, 0xcffff, 0xdfffe, 0xdffff, 0xefffe, 0xeffff, 0xffffe, 0xfffff,\n    0x10fffe, 0x10ffff\n}\n\n\nfact = {"s5": {h(g, 28, f): [None]}}\n# a b c\nacc = "s4"\n# a comment\ntotal = 0\nfor x in [1, 2, 3]:\n    total = total + x\nprint(total, "done")\n{(lambda n: x) + True: n(h < f, "s4" * None, {None: None})}\nx = x\n\nlambda n: [fact.total(), total(total), g.h(total)]\n\nfor f in x():\n    acc(lst, x([]), None)\n    "s4"\nwhile {y(n): f}:\n    n = lambda h: 6 - 12 + True * 10\n    if x.fact(x, n) * [True, None, h]:\n        acc = total(h.y(None)) + "s2"\n    else:\n        lambda f: f()\n        f = "s1"\nTrue * h("s4", "s8")\n\nif None:\n    lst = {h(acc) == f(None, 56, True): total(acc(), acc(True, 16), total("s2"))}\nelse:\n    while fact.n():\n        total = f(y("s8", None, True), "s7", lambda fact: 85) + None\n    h(lst.fact(True))\n    True\nacc = h()\n# note\nfact = y([total(None, fact), 93], g)\n\nif x:\n    f(1)\nelif y:\n    g()\nelse:\n    h()\n[1, 2]\n# note\n[lambda h: "s8", fact, 58] + h(2 * y, True, lambda h: y)\n\nwhile {x(34): y("s5")}:\n    total = n(x("s3", lst()))\n    for g in y(total, True, x):\n        f = lst(True)\n        acc(fact(None * "s9"), g(h("s9", 74, "s5")))\n    fact = h(True)\nx = y() - None\nif acc(["s7"]):\n    def n(acc, y):\n        n = lst.acc(n)\n        f.acc(x, acc)\n    lambda x: x(41 < "s5", x.f(5, "s0"))\nelse:\n    total()\n    "s6"\nwhile 33:\n    while [f()]:\n        x.y()\n    x = [fact(h + True), lst, lst(acc())]\nacc = g("s8", None, lambda total: None == lst)\ndef total(total, total):\n    total(fact({total: None}, f.lst(True), g), True)\n    fact.fact()\nif x:\n    f(1)\nelif y:\n    g()\nelse:\n    h()\n[1, 2]\ndef f(a, b):\n    y = a\n    return y\nf(1, 2)\n# note\nclass A:\n    def m(self):\n        return 1\nA().m()\ndef create_subprocess_exec(program, *args, stdin=None, stdout=None,\n                           stderr=None, loop=None,\n                           limit=streams._DEFAULT_LIMIT, **kwds):\n    if loop is None:\n        loop = events.get_event_loop()\n    protocol_factory = lambda: SubprocessStreamProtocol(limit=limit,\n                                                        loop=loop)\n    transport, protocol = yield from loop.subprocess_exec(\n                                            protocol_factory,\n                                            program, *args,\n                                            stdin=stdin, stdout=stdout,\n                                            stderr=stderr, **kwds)\n    return Process(transport, protocol, loop)\n\n# TODO\ndef total(y, x):\n    def y(fact, total):\n        lst(f(None, {n: "s9"}, {2: "s4"}), n(True, lambda g: 78))\n        lambda total: f(True)\n        return y()\n    while 38 * y == y(None, total, "s8"):\n        fact = h()\n        return acc(True)\n        fact = lambda n: h\n    return acc(59 < "s5")\nNone\nwhile True:\n    x({total == 94: f(True, 96, "s0")}, 76)\n    x = n(y())\n    while f(lambda acc: None, "s8", x()):\n        lambda x: [] + 7\n        y(n, [], (lambda acc: 40) - (lambda f: "s3"))\n        h = total()\n"s1"\n\ndef lst(x, x):\n    n.g("s7")\n    f\n    h([n, "s0"], "s4", "s2")\n\n{"s2": 97} - True < "s1" * total()\nfrom distutils.dir_util import create_tree, remove_tree\nfrom distutils.errors import *\nfrom distutils.sysconfig import get_python_version\nfrom distutils import log\n\nif _day0.strftime(\'%Y\') == \'0001\':      # Mac OS X\n    def _iso8601_format(value):\n        return value.strftime("%Y%m%dT%H:%M:%S")\nelif _day0.strftime(\'%4Y\') == \'0001\':   # Linux\n    def _iso8601_format(value):\n        return value.strftime("%4Y%m%dT%H:%M:%S")\nx = 1 + 2\nf(x, 3)\nwhile x < 9:\n    x = x + 1\n    g(x)\ny = 2\n# a comment\ntotal = 0\nfor x in [1, 2, 3]:\n    total = total + x\nprint(total, "done")\ndef lst(n, f):\n    lst = n(True)\n    while 47:\n        {"s0": 75}\n    if 14:\n        {(lambda total: True): True} + (lambda total: fact)\ndef f(lst, lst):\n    if fact:\n        return y({"s7": "s8"}, "s1")\n        return x(lst(h), True == None, h(True, True))\n        [None, 88] - x()\n# a comment\ntotal = 0\nfor x in [1, 2, 3]:\n    total = total + x\nprint(total, "done")\ng = x(35, g(f, None, 70) < [99, None, h])\ng = None\n\n# a b c\nTrue\n\nn = lambda acc: {42 - 14: 34}\ntotal = {(lambda x: n()): None}\n\n"s1" - f(total())\nlst = [total()]\ng(fact(lambda h: None, h(g, True), None), h())\ntotal()\n{True: fact(lst(), [None, None, None], y == "s0")}\n\nTrue\nh = 33 * "s3" == {n: 68}\nfor g in x(None):\n    f = h((lambda total: None) * "s2", "s6", fact)\n    n\n    g = []\n\n# a b c\ng = None\n# TODO\ny\ny = 13\n\n[y(n), fact(), (lambda n: True) + []]\n# note\nfor y in (lambda lst: None):\n    f = None < 24\n    lst = {(lambda x: acc()): True}\nf("s8", "s6")\n\nclass A:\n    def m(self):\n        return 1\nA().m()\ndef http2time(text):\n    """Returns time in seconds since epoch of time represented by a string.\n\n    Return value is an integer.\n\n    None is returned if the format of str is unrecognized, the time is outside\n    the representable range, or the timezone string is not recognized.  If the\n    string contains no timezone, UTC is assumed.\n\n    The timezone in the string may be numerical (like "-0800" or "+0100") or a\n    string timezone (like "UTC", "GMT", "BST" or "EST").  Currently, only the\n    timezone strings equivalent to UTC (zero offset) are known to the function.\n\n    The function loosely parses the following formats:\n\n    Wed, 09 Feb 1994 22:23:32 GMT       -- HTTP format\n    Tuesday, 08-Feb-94 14:15:29 GMT     -- old rfc850 HTTP format\n    Tuesday, 08-Feb-1994 14:15:29 GMT   -- broken rfc850 HTTP format\n    09 Feb 1994 22:23:32 GMT            -- HTTP format (no weekday)\n    08-Feb-94 14:15:29 GMT              -- rfc850 format (no weekday)\n    08-Feb-1994 14:15:29 GMT            -- broken rfc850 format (no weekday)\n\n    The parser ignores leading and trailing whitespace.  The time may be\n    absent.\n\n    If the year is given with only 2 digits, the function will select the\n    century that makes the year closest to the current date.\n\n    """\n    # fast exit for strictly conforming string\n    m = STRICT_DATE_RE.search(text)\n    if m:\n        g = m.groups()\n        mon = MONTHS_LOWER.index(g[1].lower()) + 1\n        tt = (int(g[2]), mon, int(g[0]),\n              int(g[3]), int(g[4]), float(g[5]))\n        return _timegm(tt)\n\n    # No, we need some messy parsing...\n\nif x:\n    f(1)\nelif y:\n    g()\nelse:\n    h()\n[1, 2]\n# TODO\nclass A:\n    def m(self):\n        return 1\nA().m()\n_implicit_encoding = \'ascii\'\n_implicit_errors = \'strict\'\n\ndef _noop(obj):\n    return obj\n\n# a b c\nn = None\n# a b c\nf = acc(x.x({True: "s4"}), lambda f: 27)\nh = f.n(True)\ndef _format_pipe(fd):\n    if fd == subprocess.PIPE:\n        return \'<pipe>\'\n    elif fd == subprocess.STDOUT:\n        return \'<stdout>\'\n    else:\n        return repr(fd)\n\n\nMAXFDS_TO_SEND = 256\nUNSIGNED_STRUCT = struct.Struct(\'Q\')     # large enough for pid_t\n\n#\n# Forkserver class\n#\n\nlst.f()\n# a b c\ndef h(g, x):\n    while (lambda lst: lst("s2", "s8", lst)):\n        lst = acc({(lambda acc: n): None})\n        fact() + {True: True} * []\n        return None\n\n56\n# note\nfact = [None]\nlambda lst: x(n)\ndef isfuture(obj):\n    """Check for a Future.\n\n    This returns True when obj is a Future instance or is advertising\n    itself as duck-type compatible by setting _asyncio_future_blocking.\n    See comment in Future for more details.\n    """\n    return (hasattr(obj.__class__, \'_asyncio_future_blocking\') and\n            obj._asyncio_future_blocking is not None)\n\n\nacc = True\n\n\ntotal = h(acc("s1", "s2", 0) + "s5", None, lst < True * (lambda g: fact))\n\nNone\nh.lst(True + None, lambda acc: 5) * (lambda fact: f) + [None, True, "s5"]\n\n{None: [h(32, "s7", "s2"), None]}\nfact(g(None) + h(total), total(8), {True: lambda y: "s4"})\nn(n({"s6": lst}, 94, fact(None, True, "s4")))\nif True:\n    [[f(h, "s8"), None * 28]]\n    f(lambda lst: 51, x(True) < "s6" - 45)\n    None + [] < {25: True}\nTrue\nfor h in (lambda f: "s0"):\n    lambda h: (lambda g: total) * True\n    def x(fact, g):\n        None\n        return y.h(g.y())\n(lambda total: lambda y: 24) * True - "s7"\nx(None * {"s9": 65}, lambda g: lst(30, lst))\nn = total(52, "s7", g.f())\nTrue\ntotal(["s5", [None, acc, 41], "s6"], total(True, 88, ["s3", True]))\n# TODO\n(lambda acc: None * "s0") + x.g() < None\nn = None\nn = "s5"\n[None, n(lambda x: True, True)]\nif True:\n    lst = y.g(h("s3", h))\nelse:\n    if g.h(x) - (lambda g: "s0"):\n        f = y.g()\n        fact = n.x(acc())\n        31\n    while f(None == fact, True - total, None):\n        n = y([None + None], 41)\n        f = True\n    while fact(89, lambda g: acc, [True, True]):\n        y = None\n        x.y("s2", [])\n        acc(h(), fact)\nx = {x: fact("s0", True)}\n# note\nfact = fact(x.h("s7"), None)\nLOCALHOST = \'127.0.0.1\'\n\n\ndef idle_formatwarning(message, category, filename, lineno, line=None):\n    """Format warnings the IDLE way."""\n\n    s = "\\nWarning (from warnings module):\\n"\n    s += \'  File \\"%s\\", line %s\\n\' % (filename, lineno)\n    if line is None:\n        line = linecache.getline(filename, lineno)\n    line = line.strip()\n    if line:\n        s += "    %s\\n" % line\n    s += "%s: %s\\n" % (category.__name__, message)\n    return s\n\nx = 1 + 2\nf(x, 3)\nwhile x < 9:\n    x = x + 1\n    g(x)\ny = 2\n"""distutils.command\n\nPackage containing implementation of all the standard Distutils\ncommands."""\n\ndef f(a, b):\n    y = a\n    return y\nf(1, 2)\nfrom distutils.dir_util import create_tree, remove_tree\nfrom distutils.errors import *\nfrom distutils.sysconfig import get_python_version\nfrom distutils import log\n\n',
      steps: [
        {
          op: "focus",
          a: 0.9931259027216583,
        },
        {
          op: "multiSelect",
          a: 0.5310075816232711,
          n: 5,
          then: "delete",
          b: 0.7214922462590039,
        },
        {
          op: "typeIntoBlock",
          a: 0.18611900741234422,
          text: "(",
          accept: true,
        },
        {
          op: "collapseAllThen",
          on: true,
          a: 0.5170499663800001,
          text: ")",
          accept: true,
        },
      ],
      motion: "reduced",
    },
    { baseURL: `http://127.0.0.1:${process.env.CMB6_PORT || 8177}` }
  );
  expect(v).toBeNull();
});
test("soak seed 1847: the focus stays in the editor when a scroll takes the pending top-level box out of the page", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 1847,
      language: "scheme",
      code: '; note\n(define x (cond [(lambda (lst) (n acc #t)) 86] [else (y)]))\n(define (g h) (acc))\n(define x acc)\n\n(define total (= (lst (cond [#f 99] [else #t]) (let ([f fact]) 25)) 40))\n; a b c\n(define fact (lambda (y) (g 21 (lambda (f) "s5"))))\n(define (total total) (< (if (let ([lst #t]) \'a) \'a (if "s6" #t 38)) (lambda (lst) \'a)))\n(when ; note\n a b c)\n(f)\n(define (n n) (lambda (h) fact))\n(define x \'((if y \'(22 n f) \'(#t #t)) "s8"))\n(h)\n(let name) or (let name value)\n(define (x total) #f)\n(define f #f)\n(define total #f)\n(define h (lambda (x) 37))\n(define f (h (if \'a (total \'a) (- \'a 15))))\n\n[contenteditable=true]\n(* #t (< (cond [(y \'a #t) (< #t 1)] [else (y "s2" #f \'a)]) (cond [(x #f) (cond [#f fact] [else #f])] [else (f)])))\n\n(define (fact y) (acc (if (if "s0" #f "s8") (cond ["s7" #f] [else x]) \'(#f \'a #f)) (lambda (total) (if #f #f #t)) (if (* y "s4") (lst #t lst) (< "s7" 58))))\n\n(define g n)\n(define n "s1")\n\n; a b c\n(lambda (total) #f)\n(define (total n) \'(#f))\n(let ([h (let ([h (h)]) (- 90 #f))]) \'a)\n; a b c\n(- total #f)\n; note\n(define h "s7")\n(define (fact x) #f)\n\n58\n\n; TODO\n(define (x lst) (if g (total) (cond [#f (let ([x "s0"]) n)] [else fact])))\n\n(if (> x 3) "big" "small")\n(define lst "s8")\n(define (h total) (lambda (h) (h (if #f \'a 90) (= \'a "s6"))))\n\n(define (g h) \'((let ([lst (lambda (x) 4)]) (= y "s6"))))\n(define (x n) (= 53 (n (* "s9" "s7") (- "s7" y))))\n; a b c\n(define (n y) (lambda (lst) (let ([f (x)]) \'(total acc))))\n(x (acc #f))\n(define h 52)\n(define y (cond [\'((+ \'a f) \'a) (= (x) (let ([total #t]) #t))] [else \'a]))\n(define g (total (f (n #f) (< \'a 28) (total)) #t 76))\n(define acc (n (* "s4" 80) #f))\n(define (fact n) (if (if (h g 7 acc) (= #f total) "s0") (lambda (h) (g "s6" "s0")) #f))\n(define f #t)\n\n(cond [(total (total (cond [87 #t] [else 98]) (lst) #t) (n) (if (< 29 16) \'a (f))) (< (f) (total 77 fact (g #f)))] [else (let ([n (x (lambda (lst) "s3") (lambda (g) #f) \'a)]) (cond [(lambda (x) "s5") (lst "s4" lst "s0")] [else (lst)]))])\n(define x 5)\n(f 1 2)\n(if (> x 1) 2 3)\n(comment free)\n1 #| comment1 |#\n1 #| comment1 |#\n#| comment2 |#\n(cond [#t 1] [else])\n(let ([a 1] [b 2]) (+ a b))\n(lambda (x) x)\n\'(1 2 3)\n\n(fact (if (+ (cond ["s4" #t] [else #f]) (x \'a)) n #f))\n(define (g g) #t)\n(if #t \'("s4" "s3" 81) \'a)\n(define acc (y (if (y) (g 33) (cond [n n] [else g])) \'((acc #t) (let ([n \'a]) #t) #t)))\n(define h \'(#f))\n(define h (lst (< (+ 11 "s4") (let ([acc \'a]) #t)) "s6"))\n(let ([h (h #f (g (if #f lst 28) #t))]) (acc (= lst (let ([lst "s6"]) total)) "s8"))\n(define total (fact "s5" \'a "s5"))\n\n(define (g y) (h (f (total) (< #t #f)) 81 (y g #f)))\n(let ([x (f (total 11 (total "s1")) (lambda (g) (lst #f)))]) #f)\n(f #f (cond [(acc) (total)] [else (cond [(if #t 33 \'a) (cond [total #t] [else #f])] [else (n)])]) "s0")\n(define (lst fact) \'((cond [(n) (if #t "s7" f)] [else \'a]) #f))\n(define acc (acc (let ([acc (cond [#f acc] [else 22])]) (g \'a #f))))\n(define (acc g) (= (if total (cond [f #f] [else x]) (n 41 g "s1")) (lst 57 (x) (total acc "s5"))))\n(define x 5)\n(f 1 2)\n(if (> x 1) 2 3)\n(define (lst lst) (cond [#f (x)] [else #t]))\n\n(define lst (y n "s9" (+ (f #f) (h #f))))\n; TODO\n; note\n(define g #f)\n"s4"\n(define (n acc) #t)\n(define (f n) (+ #t (if (f #f 98 "s4") (lambda (lst) #f) #t)))\n(f "s1")\n; TODO\n(define (y h) (y))\n(lambda (g) (x #t (fact (+ #f "s9") (h))))\n(define g #t)\n; note\n(total (< (lst (if 84 "s4" f) (if #t #t \'a) (h #t 45 "s1")) (total)))\n(define n #f)\n; TODO\n(acc #t (cond [#f #f] [else (+ #f #t)]) (h "s6" (acc) \'((fact fact #f fact))))\n\n(define (lst total) (total (let ([total (lambda (acc) #t)]) (fact \'a))))\n; a b c\n(define (x n) (lambda (acc) \'(\'("s2" 89) (cond ["s5" \'a] [else 34]) (if #f \'a 85))))\n(define total \'(67 #f "s5"))\n(define (y fact) (y (h (fact #t #t #t)) (cond [(fact \'a g #f) (f)] [else (if #t #f 97)]) #f))\n(define y (lst))\n; TODO\n(lst)\n(x (let ([n 87]) (let ([h (* #t #t)]) 73)))\n(* (- #t (fact (- #f 96))) #t)\n(define x (f))\n(define total (lambda (n) \'((lst f \'a) (< #t "s7") (x #t #t "s3"))))\n\n"s6"\n(y)\n(define (g h) (- \'a #f))\n(define (x f) (+ (f (+ "s3" #t)) (< (acc x) (if 7 #t #f))))\n\n(define h total)\n69\n\'a\n(define (f fact) \'((= #f fact) #t))\n(define (sq n) (* n n))\n(sq 4)\n(define n (lst (if #f (lambda (n) h) \'a)))\n(define (acc total) (fact))\n(define h (cond [(lambda (h) #t) y] [else \'a]))\n(h total)\n\'a\n(define x (n))\n\n(define total (* (y f (y 29)) (acc)))\n(define (g n) n)\n; TODO\n69\n\n(define x "s3")\n(f (cond [(cond ["s0" (n total #f)] [else (g #t #t)]) (* (total \'a #t) 24)] [else (lambda (total) "s9")]))\n\n(define acc (lst (g) (if (total #t \'a lst) \'(#t "s8") acc) fact))\n; note\n(y (total (lambda (n) \'a) 47))\n; note\n(define (g f) \'a)\n(define acc (if (n (acc \'a #t "s4") (f) (if "s8" y \'a)) 87 (let ([fact (total y)]) (cond [68 #t] [else \'a]))))\n(define (lst x) (cond [(if (- "s5" "s7") total #t) (lambda (total) (let ([h "s1"]) #t))] [else fact]))\n(fact \'a)\n\n(define y (let ([n (let ([acc (< #t #f)]) (fact 41 31))]) (total #t)))\n(define fact "s4")\n\nacc\n\n; note\n"s8"\n; note\n(define h \'(\'(#f) #t))\n\n(define (f y) (acc #t "s1" #f))\n(define n "s8")\n(define lst (lambda (x) (- #t (h 4 #t #f))))\n; TODO\n(define (h g) (acc "s9" #t))\n"s2"\n(total (lambda (h) (let ([total (n #t 68)]) "s0")))\n\n(define (n h) (lambda (fact) (h (if "s5" 85 \'a) (lambda (acc) #f))))\n\n(define y 47)\n(define g (y))\n#t\n#t\n(lambda (acc) (if (x (lambda (fact) 75) (x)) (+ y (if #t 58 85)) x))\n(define (acc fact) (y))\n(define h (let ([y (lambda (acc) (lambda (fact) "s4"))]) (if (cond [#t "s1"] [else #f]) h (cond [#f 63] [else #t]))))\n(define (acc acc) (h))\n\n#f\n(define lst \'a)\n\n\'a\n36\n\n(define (x g) #t)\n(cond [a 1] [else 2])\n\n(define (x x) (lst \'((if #f #f #f) "s8") (x) #t))\n(define x (h (cond ["s9" (fact)] [else (cond [97 \'a] [else lst])])))\n; TODO\n(define (h g) "s4")\n(define acc (= (cond [(if #f #t n) (total "s3" #t \'a)] [else (= \'a #t)]) f))\n(define lst (lambda (f) (h (lambda (total) f))))\n; note\n(define y #f)\n[contenteditable=true]\n; a b c\n(define (y acc) (- (* #f (if x "s5" \'a)) (lambda (n) (fact))))\n(define (moveDRAGON3 time enemy)\n  (cond\n    [(> time 550)\n     (make-enemy\n      (enemy-image enemy)\n      (cond\n        [(> (enemy-eX enemy) 1050) -50]\n        [else (+ (enemy-eX enemy) 10)])\n      (+ (* 390 (cos (/ time 20))) 410)\n      (enemy-move enemy))]\n    [else enemy]))\n\n(define x 5)\n(f 1 2)\n(if (> x 1) 2 3)\n(define x 5)\n(f 1 2)\n(if (> x 1) 2 3)\n; TODO\n(g f)\n(define (lst fact) (x))\n\n(define y (n))\n; a b c\n(acc (n \'(\'a #t) (lst (fact "s6" n) #t) \'((if 21 "s3" #t))))\n; note\n(lst "s9" (let ([x (g)]) (y)) (y))\n(define (g y) (g (acc)))\n; note\n(lambda (f) \'((lambda (fact) (lambda (f) #t)) (total (cond [fact #t] [else 77]) (h #t) (if #f "s3" \'a))))\n; TODO\n(define (lst n) (if (lambda (n) \'a) (y (let ([fact #f]) #t) (< 54 \'a) (if #f #t #t)) (h (let ([n 89]) "s8"))))\n(define (h fact) (n (n #f (+ #t "s0") 55)))\n(+ (lambda (f) n) (lst \'((let ([y #f]) "s9") \'a "s1") (< (let ([x "s8"]) #t) \'(fact)) \'((if #f #t #t) (if \'a "s4" 4))))\n\n(define lst (* (let ([x 64]) (cond [4 50] [else #f])) 91))\n(define g (acc (let ([total (lambda (g) y)]) \'(64))))\n(let ([a 1] [b 2]) (+ a b))\n(lambda (x) x)\n\'(1 2 3)\n; a comment\n(define (fact n)\n  (if (<= n 1)\n      1\n      (* n (fact (- n 1)))))\n(fact 5)\n(define (sq x) (* x x))\n(sq 3)\n(cond [(= x 2) 3] [else 4])\n42\n\n(define (g n) #f)\n\n(define (lst fact) (x (lambda (f) (< \'a \'a))))\n; note\n(cond [71 84] [else total])\n(check-error (f) "m")\n(block (let a) (block (let b)))\n(let ([a 1] [b 2]) (+ a b))\n(lambda (x) x)\n\'(1 2 3)\n\n(add secondVar) (sub fourthVar firstVar)\n(define (total total) (h \'a (if (f \'a) (if \'a 42 58) 20) \'a))\n(fact (h (< (cond [10 #t] [else n]) #t)) (lambda (lst) (acc #t (n g))) (let ([acc "s6"]) #t))\n(define (lst h) (= (y "s6" (- 77 36)) #f))\n\n(f (acc (x (lambda (n) 19) "s0") (y) (lambda (acc) (f "s5"))) (fact) (y))\n(define (g total) (total (total)))\n(let* ((x 1) (y 2) (z (+ x y))) (* x y z))\n(define n "s3")\n; note\n(define n \'a)\n; a b c\n(define h (if "s1" (g) (x \'a)))\n\n(define (lst fact) #t)\n(define f (let ([y (cond [(= "s0" #t) (= #f #f)] [else (x "s2" 9)])]) (f (let ([h #t]) \'a) (+ \'a 61))))\n"s0"\n\n(cond\n  ; first\n  [a 1]\n  #| second |#\n  [b 2]\n  [else 3])\n; note\n(define (sq x) (* x x))\n(sq 3)\n(cond [(= x 2) 3] [else 4])\n42\n(a b c)\n(d)\n(e (f g) (h i))\n(define (n h) (* #f g))\n#t\n(define (fact n) (cond [(fact (if "s2" \'a x) (g #t) (- #f total)) (* (< "s6" \'a) 80)] [else (lambda (h) (cond [#t #f] [else "s1"]))]))\n(define (h n) (fact #f \'((cond [#t "s4"] [else 54]))))\n(total (lambda (y) \'((n #f 78 #t) (- #t \'a))))\n(let ([n (x (+ #f (cond [#t #f] [else #f])))]) (cond [(y (= \'a 19)) (let ([f "s2"]) (n "s8"))] [else #t]))\n(define (x h) \'(89 (y (h "s7" f) (lambda (y) 30)) (if x \'(#f "s8" #t) \'a)))\n\n(define lst (total #f (lambda (g) \'(#f #f #f))))\n\n(define (lst acc) (cond [(total (acc #f) (y \'a total 46) (cond ["s4" \'a] [else \'a])) (h (= #t "s1") \'a)] [else (cond [(if \'a #f \'a) \'a] [else 19])]))\n; note\n(define (acc y) "s6")\n(define (fact lst) (let ([g (* 42 (lambda (f) \'a))]) (y (acc "s1") \'(17) total)))\n\'((let ([total (if (< "s7" #t) (h #f #t x) (g f #f))]) (n (let ([x #f]) #t) #t)) (acc))\n(h (< "s1" (x (total 21))))\n; a b c\nacc\n(define (fact n) (- (fact (cond [#f #f] [else 77]) (h #t)) (g 7 \'a (lst \'a "s2"))))\n(define h \'a)\n\n(define (acc h) (if 60 \'((< \'a "s4") (cond [24 total] [else y])) (h (x #t n "s4") 35 \'a)))\n(define (acc lst) (acc (n #t) (lambda (x) (lambda (n) \'a)) (h (= x #f) #t (f \'a 29))))\n\n(define total (f #t \'((- y 70))))\n; a b c\n(define (fact x) (g (if (+ total \'a) (* #t \'a) #t) (g (f) (y #f "s6")) (x (cond [lst \'a] [else "s7"]))))\n; a b c\n(y)\n\n; note\n(total (h))\n(lst \'a (lambda (y) (lambda (total) (n 1 23 36))) (lambda (x) (if (cond ["s9" #f] [else n]) (y #f fact) "s4")))\n\n(define n (if (n (y) #t) "s6" (total (lambda (total) #f))))\n\n(define total \'((if (cond [#t #t] [else "s0"]) (if 24 #t h) \'a) 80))\n(define (acc lst) (- #f (f (lambda (x) #t) (- y #f) \'a)))\n(define (f acc) 44)\n(define (fact g) #f)\n\n(acc (if (let ([g (acc #f 72)]) (lst "s0")) (lst "s1" (< "s6" #f) (h \'a #f)) (< 63 (- \'a "s6"))) (f (= (let ([fact 17]) \'a) (lambda (y) \'a)) (cond [(g) #f] [else (f)]) 61) (y (total #t) (* (acc fact "s4" f) (if "s4" 55 #f))))\n(cond [(h (total) (g)) (< #f \'a)] [else (lst y)])\n40\n(n #f (g (lambda (x) (n #f #f "s0"))) g)\n\n; note\n#f\n; TODO\n(define (total x) y)\n; note\n(define fact #f)\n(define lst (let ([f \'a]) n))\n(if (x (h (cond [\'a 84] [else #t]) (- \'a 96) (n 86))) (n "s9") h)\n\n(- #f (lambda (x) \'a))\n#f\n\n(define acc (acc (n "s5" (- "s2" #f) (n 98 #t)) \'a))\n; TODO\n(define x (lambda (y) n))\n(define (fact x) (lst (* #f #t)))\n; a b c\n(define (lst n) #t)\n; TODO\n(define (y x) (cond ["s0" g] [else "s9"]))\n(define h (total (< (if 61 #t x) "s8") #f \'((* \'a "s4") (n) \'("s6" g))))\n\n(lambda (x y) (+ x y))\n(if (< a 1) (show 1) (show 2))\n(define n (f #t (+ #f \'(64)) (acc (lst \'a \'a) "s2")))\n; TODO\n(define (x g) (if \'a #t #t))\n; note\n(if (g \'a) (n (total (lst) 84) \'((g "s4" "s4" #t) (total))) (- \'a \'a))\n; note\n(define (total fact) \'a)\n(define (total g) #t)\n(define n \'a)\n\n; TODO\n(define total (cond [(n #t #t (+ \'a 87)) (f (if #f #f h))] [else (total \'(33))]))\n63\n#f\n\n\'a\n(define (g n) \'(6 \'a))\n(define total (* \'a (let ([acc (* \'a #f)]) (g 16))))\n(define y (y))\n(define (n lst) "s9")\n(f (n (f (cond [#t 62] [else #t])) (h)))\n; a b c\n#t\n; TODO\n(define (f fact) f)\n(define n (cond [#t (lambda (acc) (acc #t "s8" "s3"))] [else (if #t (x total "s0") 41)]))\n(define (g acc) (total))\n(lambda (f) (+ #t \'((let ([h #f]) 23))))\n; a b c\n(lambda (n) (f (y "s4" #t y) (let ([lst (total)]) #f) (lambda (x) (x #t #f \'a))))\n(define (x x) (lst (lambda (y) (if \'a \'a lst)) #f))\n(define y "s8")\n(define (h y) #t)\n(define (acc fact) (lambda (n) 28))\n; a b c\n(define (h total) (fact (if (lambda (n) #f) #f (acc #t x)) (g) #f))\n(define (fact h) \'a)\n(define (fact lst) (g \'(\'a (lambda (n) 86) "s8") (< (lambda (n) acc) (lst \'a #f)) (f #f)))\n(define (g x) \'a)\n(define h (+ (if #f "s6" (x "s8" g)) (cond [(acc) (cond ["s0" #t] [else acc])] [else (lambda (lst) #t)])))\n\n; note\n(define y total)\n; a b c\n(define y \'a)\n\'a\n(lst (if (h (+ \'a "s9") (* #f #t) "s0") (cond [(lst) \'a] [else (- "s7" 24)]) (h 62 "s5")) \'a (total \'a (< (f 11) #f) \'a))\n(define (f total) (f))\n\n(define total "s7")\n40\n; note\n(define lst (lst (fact \'a "s8" (g #f #t)) (y (lambda (h) 22) 63) #t))\n; note\n(g (cond [32 \'((if #f #f "s7") (lambda (f) #t))] [else (total \'a)]) (lst (if 28 (total #t f \'a) (- lst \'a))) \'a)\n\n(define h (lst (cond [(g) "s8"] [else f]) (fact "s4")))\n(define (fact h) x)\n(define (g g) (- (let ([n (acc "s4")]) (lst)) \'("s0" (* #f 9))))\n\n(let ([a 1] [b 2]) (+ a b))\n(lambda (x) x)\n\'(1 2 3)\n(define (g y) \'((- (h) (n))))\n\n(n #f)\n(define f (= #t (* (h #t #t #t) (if "s6" #f #t))))\n; note\n(define acc (h (if (lambda (x) \'a) (+ #f total) (* \'a "s5")) (f)))\n; TODO\n(define (total f) #f)\n; TODO\n#f\n(define (lst acc) (fact \'(#t (total))))\n(define lst #f)\n(repeat 2\n  (show "a")\n  (show "x")\n  (show "b"))\n(define total "s2")\n(if (cond [#t g] [else (cond [\'(\'a \'a \'a) (f g \'a f)] [else (g 65)])]) (lambda (lst) (< (f "s8") (x \'a \'a))) (* (total (lst h)) \'a))\n; TODO\n(define total (g (f) #t 60))\n(cond [(cond [(* #f \'(96 \'a "s0")) \'a] [else \'a]) 72] [else (+ (+ "s3" (f)) (n))])\n(define (x fact) (acc))\n\n(define (y total) (n (cond [(f 42 #f y) (+ 82 lst)] [else \'("s2")]) 57 (g (* \'a \'a))))\n(total)\n\n(define x (n))\n\n(define (h y) #t)\n\n; a b c\n(define (lst h) (cond [(cond [(g n #t \'a) (lambda (f) #t)] [else (lst 65 x \'a)]) g] [else (lambda (fact) "s6")]))\n(define (lst y) "s2")\n(if #f (h h (h (total #t) (h)) (< (cond [#t #t] [else #t]) (x \'a y))) (y (< (cond [#t 17] [else #f]) 8) (x #t (lst #f #t) 58) (fact (if "s5" 29 #t))))\n(repeat 2\n  (show "a")\n  (show "x")\n  (show "b"))\n(define n (y (x 64 (lambda (total) #t) #f) (g (fact)) \'a))\n(define (lst g) (let ([y h]) (n #t \'(acc "s6") #t)))\n(lst y (x (lambda (lst) (acc #f))))\n(define n (fact (if (n #t) (let ([total \'a]) f) (lst "s0" "s3" "s2")) \'a))\n(define (acc lst) (< (lst #f \'a (let ([h 53]) 93)) #f))\n(define y (lambda (fact) 66))\n(define (total g) (h (* #f (< #t lst)) (if #f 65 (total)) #t))\n(define fact (fact \'a (fact) 26))\n; a b c\n(define g 11)\n\n; TODO\n(define (lst n) "s2")\n(< (< \'a (let ([h (if 79 total 50)]) (let ([n lst]) "s0"))) (lambda (total) (* (* fact \'a) fact)))\n(define total (y (y) "s6"))\n\n52\n; note\n(define (x y) fact)\n\n(define (h x) (let ([acc (total #f)]) (- (fact) (cond [85 #t] [else "s8"]))))\n\n(f \'a (lst (fact (n \'a f "s2") #t (n)) #t (lst #f \'(n) #t)))\nacc\n(define g (g \'a (f) #f))\n33\n(g (if "s6" (y (fact "s3")) (lambda (f) (lambda (acc) #t))) (+ (if #t "s8" (cond [#t \'a] [else "s2"])) (total (n "s9" total #f))) #f)\n\n(= #t (acc (let ([n (lst "s0" #t)]) "s6") (h (cond [\'a #f] [else "s9"]))))\n(define (acc acc) (if (total (n) (+ "s6" 97) (n)) (lambda (acc) (= "s4" fact)) (let ([g (lambda (total) \'a)]) (let ([n n]) \'a))))\n; TODO\n(define n (+ fact (cond [(if #f \'a #t) (g "s3" \'a acc)] [else (f)])))\n\n(define n (n (if (cond [#t "s6"] [else #f]) "s0" (let ([lst g]) #t))))\n(define f (if (< (let ([g "s6"]) 62) \'a) (if h "s3" (lambda (total) \'a)) "s6"))\n(define (f x) (if (cond [#t (g)] [else (= 11 \'a)]) (lst) (if (- "s5" #t) (< "s8" \'a) (lst n))))\n(fact)\n(define y \'a)\n(define x \'a)\n\n',
      steps: [
        {
          op: "topLevelType",
          a: 0.01959998346865177,
          text: "(",
          accept: true,
          how: "paste",
        },
        {
          op: "topLevelType",
          a: 0.1218848719727248,
          text: "(f 1)",
          accept: true,
          how: "type",
        },
        {
          op: "scroll",
          a: 0.8983779866248369,
        },
      ],
      motion: "reduced",
    },
    { baseURL: `http://127.0.0.1:${process.env.CMB6_PORT || 8177}` }
  );
  expect(v).toBeNull();
});
test("soak seed 6258: an unclosed ( typed at the top level reads on over later roots to a far error: the roots it swallows are read again, not kept", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 6258,
      language: "javascript",
      code: '({a: h(), b: "s0"});\nfor (const g of ["s5", 78, n]) {\n  let acc = fact() ? x() : lst;\n  if (f("s0", y(true, "s5"))) {\n    lst(y(g(16, 39, "s2")), [50 + total]);\n    [];\n  } else {\n    acc(x(null, [g]), acc.h(true, true));\n  }\n  lst = null;\n}\na.b(c);\n[1, 2, 3];\nlet y = 5;\nconst dir = path.join(__dirname, "..", "assets", "sounds");\nconst url = (name) =>\n  "data:audio/mpeg;base64," +\n  fs.readFileSync(path.join(dir, name)).toString("base64");\n\nconst lst = 55;\n(y) => fact(true, [69], null);\ntotal("s0", y());\nfunction acc(n, n) {\n  null;\n  while ([[x], 99]) {\n    f = true;\n  }\n}\n"s8";\nlet lst = true;\n// TODO\nx = null;\nlet acc = "s3";\nlet h = y;\nvar acc = lst.g();\nf();\nwhile ([true, y(fact, f)]) {\n  true;\n  19;\n  let lst = g("s2");\n}\nlet fact = (x) => ({a: f(), b: null ? x : "s6"});\n\ntotal(lst(36, lst(), g(null, null, "s1")));\n// TODO\nlst(y);\nif (null) {\n  var y = [{a: "s4", b: ["s2"]}, acc(), total.y(y)];\n}\nclass A {\n  m() {\n    return 1;\n  }\n}\nnew A().m();\nif (lst(fact.fact(true, 49))) {\n  fact(n((f) => 49));\n  [true, f === n(70, true, h)];\n} else {\n  if (n()) {\n    12;\n    var x = true;\n  } else {\n    var y = [true, g(70), y] < total("s1" ? 37 : null, "s4" ? g : acc, []);\n    x(63, 82) === null;\n    f([null, 57], h.x("s1", "s3"), {a: f, b: f}) ? null : 73;\n  }\n}\nfunction acc(f, total) {\n  13;\n  const total = (x) => g();\n}\nconst f = 45;\n[n.h(true)];\nlet fact = null;\nconst flag = (name) => args.includes(`--${name}`);\nconst opt = (name) => {\n  const i = args.indexOf(`--${name}`);\n  return i === -1 ? undefined : args[i + 1];\n};\n\nmodule.exports = require("../codemirror-blocks/.babelrc.js");\n\n// TODO\nif (null * 37 - null) {\n  true;\n}\ntotal();\nfor (const fact of 60) {\n  n = true;\n}\n({a: null, b: [{a: null, b: 70}]});\n\n// a b c\nconst lst = y() ? null : y;\nlet y = total;\nfunction acc(f, x) {\n  if ([fact.h(), n(49, null)]) {\n    acc([lst.n(null, "s7")]);\n  }\n}\nfunction h(g, acc) {\n  [26] ? [[true, 62], x()] : h((h) => null, total(g), 97 + true);\n}\nconst path = require("path");\nconst root = path.join(__dirname, "..", "demo");\nconst types = {\n  ".html": "text/html",\n  ".js": "text/javascript",\n  ".map": "application/json",\n};\n\n// TODO\nlet y = [total(true, total.f(2, 70)), (f) => ({a: 80, b: null})];\n// a b c\nif (y(71 ? 43 : "s9")) {\n  if (total(acc(null, x, "s6"), n(fact, true), y("s5"))) {\n    var n = x;\n  } else {\n    let f = {a: true, b: (fact) => "s9"};\n    const acc = total() - f(lst(), 8 * null);\n    var h = fact;\n  }\n  const fact = y(y("s2", "s7"), true ? null : lst, 4) ? total(fact(), g(true), true) : [];\n  total = n();\n} else {\n  y("s3", 16);\n  var h = y.h(fact(acc("s1"), 95), null);\n}\n"s0";\nlst();\nf.g();\nfor (const f of 20 < null) {\n  while (null) {\n    [h.y(null, null), 70] ? x : total(lst.x(null));\n    const n = fact;\n  }\n  var lst = {a: true, b: true} ? acc(x(true), "s7") : null;\n}\nif ({a: acc ? 94 : "s3", b: null}) {\n  for (const g of n(true, null, true)) {\n    let y = 48;\n    fact.lst();\n  }\n  var h = 79;\n}\nlet x = n();\n\nnull - h();\nn();\n// TODO\nconst total = "s2";\nfunction g(g, lst) {\n  while ((f) => n < "s1") {\n    24;\n    return fact.n(x(), {a: 21, b: "s9"});\n    return ["s8", total(null, true), f];\n  }\n  function f(acc, g) {\n    return total.acc([32, 94, true]);\n  }\n  function lst(fact, total) {\n    return {a: true, b: (g) => 10};\n  }\n}\nconst y = "s4" - h;\nmodule.exports = function gen(lines) {\n  const out = [];\n  for (let i = 0; out.length < lines; i++) out.push(...form(i));\n  return out.join("\\n");\n};\n\nconst {\n  getWebpackBundleConfig,\n} = require("@bootstrapworld/cmb-toolkit/lib/webpack");\n\n// dist/codemirror-blocks-min.js: the editor, with no language, for a page that\n// loads it with a <script> tag (a language is another file: see wescheme, ...)\n\nfunction y(acc, y) {\n  function h(fact, fact) {\n    const f = 90;\n  }\n}\nvar f = [];\ng("s1" ? x : "s7", (acc) => "s1", n("s8", null, null)) * "s0" === null ? f("s6", true) : null ? x : true;\n// TODO\n"s7";\n// TODO\nif (97 < true + 64) {\n  if (true) {\n    var h = null;\n    fact.n();\n  } else {\n    n(37) ? acc("s1", g, "s8") < n.x() : lst.n() * y * 27;\n  }\n}\n({a: true === total, b: 11 + true} * [(g) => null]);\n"s8";\n// a b c\nconst f = g;\nif (true) {\n  if (acc(10, 23)) {\n    [];\n    h(x, y);\n    fact(true);\n  } else {\n    lst = f(total, true) + "s1" + "s0";\n    let lst = x("s9", fact(h("s0", 26), null, {a: 88, b: 14}), 70);\n  }\n  h = y();\n}\nacc();\nlet fact = {a: n < "s4" ? (g) => 50 : 24 ? true : true, b: total.x("s5", 36)};\nwhile (fact.f(95) - total(null)) {\n  const h = n(null, n(), 27);\n  let y = total;\n  [fact.total(["s6", 62, "s9"], {a: f, b: null}), fact.acc(null < "s8", {a: acc, b: null})];\n}\n\n// TODO\n"s7";\nconst x = "s9";\ny = g(acc.f(), true * h, 75);\n// note\ng((fact) => lst) ? {a: fact(x, "s2"), b: ["s1"]} : n(true, x(30, true, "s9"), total < null);\n\n({a: f(n(true, "s6"), fact(null), [lst, "s9"]), b: f([])});\nconst acc = g.g(acc.y(fact(), g));\n// a b c\n// TODO\nx(null, 13, 35) ? [82, 97] : true ? 73 : true ? acc(h("s7", "s4", 68), 83 - 98, "s3" + true) : [x(31), 17 === "s8"];\nif (true) {\n  72 === lst();\n  while (y(lst(y, fact), true)) {\n    n = acc(85, true, true) ? {a: true, b: 54} : acc("s7", null, null);\n    h((g) => 62, (acc) => f(null, true, null));\n  }\n}\n\n// a b c\nconst {\n  getLanguageBundleConfig,\n} = require("@bootstrapworld/cmb-toolkit/lib/webpack");\n\n// dist/lambda-min.js: this language, for a page that loads it with a <script>\n// tag after the editor\'s (the global `CMBLambda` is the language, which is\n// also added to the editor, to be asked for by its id: "lambda")\n// TODO\nnull;\n\nh = fact.g(fact + x, total("s1", true));\n\nacc(h(true ? "s2" : x, n.lst()), n());\nacc = acc(acc.n(), [null, true, "s6"]);\n\nwhile (y) {\n  total();\n  var x = ["s0", (x) => null];\n  for (const fact of 65 === g) {\n    h = (fact) => acc(true);\n  }\n}\n// note\nx;\n[] ? true * y.f(true, n) : [total.f(total, true)];\nvar h = [];\nfunction g(y, x) {\n  var acc = "s3";\n}\n\n"s7";\nlet h = true;\n(f) => [(total) => 24, true - null, "s5" ? total : 67];\nfact;\ny(lst(null, null, null) < total(true), g({a: f, b: f}), n());\nlet n = null;\nwhile ({a: y, b: total(96, true)}) {\n  y(h() ? lst.x(25, 19) : (g) => true, null, lst);\n}\n// TODO\nlet g = true;\n// note\nf({a: 64, b: null - f});\n// TODO\nvar fact = h.total(null, (total) => f.total());\nn = n.g(y, h("s8"));\n\ng = ["s7" ? 45 : "s7", (y) => null, 51 < lst];\n\nlet total = 34;\nconst lst = true;\nvar acc = n ? y.acc(acc, true) - "s0" : f(true + null);\nconst lst = h.f(h((g) => null, [null, 83]));\n// TODO\nnull;\nfact(g(4, x), f.g(40), 47) < fact();\n// a b c\nlet lst = true === total ? f("s8") : total + 22 + "s0";\nif (26) {\n  while ("s8" - "s4") {\n    ({a: "s6" ? true : n, b: null < "s7"} - true);\n    f ? (x) => g.g(true) : fact;\n  }\n  const total = (acc) => g(x(acc, 20, 4));\n  g();\n} else {\n  const acc = "s2";\n  for (const g of x()) {\n    const acc = f.g("s6", g());\n    const x = fact;\n  }\n  acc = (acc) => f === true;\n}\ng(n((lst) => 94), x());\ng(fact(total(f)), null);\nvar x = true;\nif (h - n) {\n  const h = "s7" ? (lst) => n(total) : 88;\n  acc = x() - lst();\n}\nimport eslintReact from "@eslint-react/eslint-plugin";\nimport reactHooks from "eslint-plugin-react-hooks";\nimport prettier from "eslint-config-prettier";\nimport globals from "globals";\n\nif (null) {\n  if (lst()) {\n    var lst = y;\n    const f = f();\n  } else {\n    var f = 35;\n    const acc = lst([[], x - 72, x(true, null)]);\n  }\n  function fact(x, total) {\n    return g();\n  }\n  31 + 77;\n}\nmodule.exports = require("../codemirror-blocks/.babelrc.js");\n\nif ("s5") {\n  null;\n  total();\n  for (const y of total(y)) {\n    let y = total() ? {a: true, b: y} : x();\n  }\n}\nfor (const f of "s5") {\n  while ([true < null, n.lst("s1", lst), 54 ? 49 : h]) {\n    var x = null;\n    null ? (f) => null : y(true, y) - ["s9", null, 70];\n  }\n  if (g(h(), null)) {\n    var n = [];\n  } else {\n    fact;\n  }\n}\nx(true);\nconst acc = 23;\nlet acc = {a: y([]), b: acc()};\nfunction f(acc, total) {\n  if (acc([null])) {\n    var total = fact();\n  }\n}\nfunction fact(lst, h) {\n  fact = null;\n  for (const f of 99) {\n    true === acc(lst());\n  }\n  return true;\n}\n\n// TODO\nfunction lst(acc, total) {\n  while (95) {\n    return y([null], fact);\n  }\n}\n\ng("s1");\n\nfor (const lst of lst(96, "s2")) {\n  72 ? null : g(true);\n  if (f(f < true)) {\n    var h = true;\n    35;\n  } else {\n    g = y(75 < true);\n  }\n  function y(fact, total) {\n    return f.f(null < total);\n  }\n}\nlet f = {a: null * lst, b: total ? null : "s5" < (lst) => null};\nvar f = true;\ntrue * 34 - "s0" ? true : 63 * true;\n\n// a b c\ng("s9");\n\nconst f = total(f(), [58]) ? n : [acc(84, 12), null];\n\nfact(75) ? "s7" : x({a: true, b: 9});\nif (true) {\n  lst = lst.y();\n}\n// TODO\n[[(h) => "s1", total.fact(), {a: true, b: "s7"}], (acc) => ({a: true, b: true}), g];\nh;\nfor (const f of fact.x()) {\n  let n = {a: fact((acc) => true, x, true), b: [{a: "s4", b: true}, h.y(), h(total, "s2")]};\n  var y = g();\n}\nfunction acc(acc, fact) {\n  g.n("s8") ? f(null * "s3") : ["s1" ? "s8" : 35, fact("s1", null)];\n}\nwhile (true) {\n  if (y("s1")) {\n    const g = acc;\n    var h = total.y();\n  } else {\n    const y = (fact) => [];\n    fact(acc.total(), null ? y : total(true, 14));\n  }\n}\ny = f(true);\n\nvar f = total;\n\nif (null) {\n  while (lst.acc(x, true)) {\n    lst((fact) => ({a: 13, b: true}));\n    const y = lst();\n  }\n  lst = "s3";\n  function fact(g, lst) {\n    const fact = (g) => g();\n    true;\n    let fact = total();\n  }\n}\n// TODO\nfunction total(acc, lst) {\n  if (49) {\n    h();\n    const f = 52;\n  }\n  while (acc(acc(true))) {\n    var lst = null;\n    return total(f(null, 21, "s1"), 86 ? true : 44);\n    null;\n  }\n  g.acc(true, (y) => true ? "s6" : null);\n}\n[acc([true, true], h === null, (n) => null), n(60) + "s5" ? f : n, total(null)];\nvar y = true === total.acc();\nlst(71 ? 2 : true ? x + 93 : null);\nif ("s6") {\n  while (true) {\n    var g = fact(x("s8", null) < null);\n    let fact = true;\n  }\n  let x = y();\n  ({a: 79 * null * (lst) => acc, b: 64});\n} else {\n  x.total(61);\n}\n// TODO\nif ("s7") {\n  f({a: (x) => "s3", b: f()}, x(true - null, {a: 48, b: h}));\n  x = (x) => acc < 20;\n} else {\n  if (f + fact ? y(null, "s0") : f(5, acc)) {\n    n = acc(h ? h : null, true + null, 45);\n    var h = 98 ? h.g({a: 25, b: 47}, f(null)) : {a: lst, b: null} ? 21 ? "s8" : null : g();\n    let h = g(acc(), acc(acc, total()), (x) => [h, null, "s6"]);\n  }\n  const lst = total(x ? "s3" + true : lst);\n  78;\n}\nconst path = require("path");\nconst root = path.join(__dirname, "..", "demo");\nconst types = {\n  ".html": "text/html",\n  ".js": "text/javascript",\n  ".map": "application/json",\n};\n"s4";\nwhile (f) {\n  var x = y();\n  function lst(g, x) {\n    var x = {a: [], b: null + true ? "s1" : null};\n    return {a: 77, b: total("s9", true)};\n    const y = "s0";\n  }\n}\n// note\ny;\n"s8" + h(g ? 18 : true);\n\nfunction g(fact, total) {\n  function acc(acc, y) {\n    y(x(null), y);\n    let f = y(fact({a: f, b: true}, 97 ? true : 66, []));\n  }\n}\n// a b c\n// a comment\nfor (const x of [1, 2, 3]) {\n  total = total + x;\n}\nconsole.log(total, "done");\nmodule.exports = require("../codemirror-blocks/.babelrc.js");\n\nmodule.exports = function gen(lines) {\n  const out = [];\n  for (let i = 0; out.length < lines; i++) out.push(...form(i));\n  return out.join("\\n");\n};\n\nfor (const n of (total) => n) {\n  let h = [];\n}\n\nfunction n(y, total) {\n  ({a: "s7" === "s5", b: null});\n  if ({a: 73 * lst, b: x.acc(null, 52)}) {\n    return acc(null, n.total(true));\n  } else {\n    return null;\n  }\n  return null - (acc) => null;\n}\n"s4" ? {a: null, b: null} : fact.f("s2") * f ? f : h ? true + 76 : y();\nx;\nvar f = lst(x.n());\nconst base = require("../../../packages/codemirror-blocks/webpack/example.config.js");\n\nconst group = (name, test, priority = 20) => ({\n  name,\n  test,\n  chunks: "all",\n  priority,\n  enforce: true,\n});\n\nclass A {\n  m() {\n    return 1;\n  }\n}\nnew A().m();\n\n"s3";\ntotal((lst) => total(), n() ? y("s0") : y);\nif (lst) {\n  for (const lst of true) {\n    var total = y(63);\n    let lst = x(y(null, g === 62, 63 ? "s8" : true));\n    let x = 48;\n  }\n  x = "s8";\n}\ny;\n8;\nfunction f(g, n) {\n  for (const f of true ? null : "s0") {\n    [];\n    const lst = fact;\n  }\n  return y.n("s6", "s5") ? n(h) : total("s5", null, true);\n}\n\nvar lst = {a: g, b: lst()};\ny = (fact) => [true, x];\nfunction n(x, f) {\n  let n = h(null, h ? "s8" : g);\n  (total) => [null];\n  y(y(null, true, true), null, {a: fact, b: f}) * total(true * null);\n}\nfor (const fact of fact) {\n  var y = h(total(fact, 34, h()));\n  if (24) {\n    let y = lst(h.h(82, {a: true, b: null}), fact(x(lst), "s0", [lst, "s5", true]));\n    x(h(38, h(true, null), ["s3", 57]), (x) => null < n, (x) => y());\n    g = true;\n  } else {\n    let f = {a: [lst(), y(true, "s3", null), null], b: (fact) => h()};\n  }\n}\ntotal = {a: null, b: 88};\n// note\nwhile (total()) {\n  if (x()) {\n    [null, true];\n  } else {\n    var fact = acc(fact.lst("s2", 8));\n    const acc = f("s6", true) < [null] ? acc : [lst, null];\n  }\n  g(lst(), y(f.acc(), 62, null ? null : null), y());\n}\nlet h = [null, [{a: true, b: true}, g(53)]];\n\n\nfor (const acc of "s1") {\n  f = f("s4");\n  if (45) {\n    [];\n    fact(h, true ? "s4" : true, y * null) + [null] < total(83, "s0", 53);\n    let g = g(n(total.n(f, null)), "s1");\n  } else {\n    (total) => lst;\n    const total = h(f(acc.lst()), x());\n    var fact = fact();\n  }\n  true ? {a: y("s6", total), b: [true]} : acc();\n}\nif (n(h("s8", "s5", f), null, null)) {\n  acc - null;\n  const f = {a: true, b: h([null, 87], n(), total(null, true))};\n  ({a: 73, b: {a: 61 * 77, b: "s8"}});\n}\n// TODO\nfunction f(total, acc) {\n  var h = null;\n}\nconst flag = (name) => args.includes(`--${name}`);\nconst opt = (name) => {\n  const i = args.indexOf(`--${name}`);\n  return i === -1 ? undefined : args[i + 1];\n};\nclass A {\n  m() {\n    return 1;\n  }\n}\nnew A().m();\nconst REDUXFN =\n  /useSelector|useSyncExternalStore|selector|dispatch|subscribe|getSnapshot/i;\n\n/** Self time (ms) per bucket, plus inclusive time of some named functions. */\n\nlet n = (g) => f;\n\n// note\nnull;\n// TODO\nfor (const y of 5) {\n  for (const f of true) {\n    const x = "s8";\n    null;\n  }\n  g("s6");\n  for (const total of [lst, true]) {\n    x() === g(true ? 96 : 85);\n  }\n}\n(f) => ({a: true, b: 29}) - true;\nif (x(h(true))) {\n  10;\n} else {\n  f = h;\n}\nvar g = fact(0) ? y : true ? true - true : (f) => 67;\nconst fact = x(f((fact) => 29, g.total(), total("s3", null)));\nconst g = f("s7", null ? y(true, null) : total());\n\nlst(x.total(n.x(acc, null), f()), x());\n\n// a comment\nfor (const x of [1, 2, 3]) {\n  total = total + x;\n}\nconsole.log(total, "done");\nfunction y(x, n) {\n  if (true) {\n    null;\n  } else {\n    return [f(fact, "s6")];\n    return [null] ? lst : true ? true : true;\n    let acc = "s9";\n  }\n  if (acc()) {\n    return x(lst(lst), 10 - f, [total, x]);\n    "s3";\n    fact = 4;\n  }\n  const y = total();\n}\nwhile ("s9") {\n  true;\n  ({a: true ? [] : f("s8"), b: true});\n}\na.b(c);\n[1, 2, 3];\nlet y = 5;\n// note\nfact({a: null < 87, b: fact()}, null + n * true);\nif (null) {\n  function lst(h, x) {\n    n = lst("s8" ? y : fact);\n    return [25, total()];\n  }\n  n = n(true, null, acc());\n  ({a: "s0", b: h.acc([acc, 49])});\n} else {\n  let h = [f(), f() * true, "s3"];\n  const fact = x(true, lst, null);\n  function x(y, y) {\n    y(y);\n  }\n}\nconst h = fact();\n// a b c\nfunction h(f, h) {\n  function total(lst, y) {\n    total;\n    return [fact(true, null), 23];\n    return [44];\n  }\n}\n// note\nfunction total(h, h) {\n  fact();\n}\nvar g = fact();\n// note\nwhile (true) {\n  (x) => fact(56 ? "s5" : true, fact.f(), n(n, "s8"));\n  total();\n  var acc = null;\n}\nfunction f(fact, g) {\n  var acc = h();\n  while ([true, null - 38, fact]) {\n    acc = x(true);\n    return [true];\n  }\n  acc(49, g.lst(h.g()), lst("s1") ? y(null, acc) : true);\n}\n\nacc = 95 ? null : fact === fact(x);\n\n// note\nvar acc = 90;\n// TODO\nvar y = y.total({a: {a: true, b: 99}, b: f(23, true)}, lst);\n// a b c\nf = g(h.x(), "s1");\nwhile (acc.acc()) {\n  acc(lst(h(), g(acc)), true, true);\n  acc = true * y * lst;\n  while (null) {\n    (acc) => ({a: {a: "s6", b: null}, b: f(null, n)});\n    let fact = total(lst) === f(g, n(68), true ? true : y);\n  }\n}\nconst f = [[], h()];\n\nn(fact(y(), "s6", f()), {a: "s9", b: null});\nconst y = null;\nnull;\n\nfunction parseJsdomFailure(title, message) {\n  const text = stripAnsi(message);\n  if (!text.includes("A randomized sequence of operations broke the editor")) {\n    return null;\n  }\n  const seed = /seed (\\d+)/.exec(title)?.[1];\n  const at = /failed at: (.*)/.exec(text)?.[1] ?? "?";\n  const problem = (\n    /problem:\\s+([^\\n]*(?:\\n {13}[^\\n]*)*)/.exec(text)?.[1] ?? "?"\n  )\n    .split(/\\n\\s+/)\n    .join(" | ")\n    .trim();\n  const shrunk = /Shrunk to (\\d+) of (\\d+) steps/.exec(text);\n  const replay = /CMB_RANDOM_REPLAY=\'(.*)\' npx jest/.exec(text)?.[1];\n  const ops = [...text.matchAll(/^\\s+\\d+\\. (.*)$/gm)].map((m) => m[1]);\n  return {\n    kind: "jsdom",\n    seed: seed === undefined ? undefined : Number(seed),\n    steps: Number(/\\((\\d+) steps\\)/.exec(title)?.[1]) || undefined,\n    failedAt: at,\n    problem,\n    shrunkTo: shrunk ? Number(shrunk[1]) : undefined,\n    trace: ops.slice(0, 40),\n    replay,\n  };\n}\n\n/** Failures of the same kind get the same signature, whatever the ids and numbers */\nimport * as compat from "preact/compat";\n\noptions.requestAnimationFrame = (callback) => queueMicrotask(callback);\n\nconst REDUXFN =\n  /useSelector|useSyncExternalStore|selector|dispatch|subscribe|getSnapshot/i;\n\n/** Self time (ms) per bucket, plus inclusive time of some named functions. */\nconst {\n  getWebpackBundleConfig,\n} = require("@bootstrapworld/cmb-toolkit/lib/webpack");\n\n// dist/codemirror-blocks-min.js: the editor, with no language, for a page that\n// loads it with a <script> tag (a language is another file: see wescheme, ...)\na.b(c);\n[1, 2, 3];\nlet y = 5;\nacc < (h) => x;\n// a b c\nwhile (lst.total()) {\n  for (const g of acc.x(y, null)) {\n    var n = 14;\n    x(total((acc) => true), f.acc() * true, null);\n  }\n  let n = total();\n  if ("s7") {\n    f.h([total(null, g), fact.total(18)], null);\n    total = f(total * 78, null ? total : "s7");\n    ({a: n("s9", total) + true, b: lst(total.g(null))});\n  }\n}\n\nif (f(h(null))) {\n  for (const n of {a: 13, b: "s2"}) {\n    const x = true;\n    const y = [y(null, {a: 25, b: null}), acc(x, lst("s4", lst))];\n    const total = x(lst(g), n(), lst([], true));\n  }\n}\nfor (const fact of null) {\n  const fact = x(y.h(n.f(true, null), null ? true : true), n(null, 9, [94]));\n}\nif ("s3" * (lst) => f) {\n  function y(g, acc) {\n    return acc([true]);\n  }\n  const x = g;\n} else {\n  if (total()) {\n    58;\n  } else {\n    h = [true, x.total(null), n()];\n    12 + true ? {a: "s7", b: "s8"} : "s7" - true;\n    acc;\n  }\n}\nfunction fact(y, total) {\n  const x = acc({a: "s7", b: null * null}, lst.fact(total(25, n, true), null));\n}\nconst h = h(f("s8", 21), acc("s9", 36));\n\nlet f = "s8";\nacc ? true : true ? 78 : 54 ? total.h(null) === fact(51) : [];\n// a b c\nvar total = h();\n// a b c\nh;\n\nn = lst("s0", true, true) + {a: null, b: h};\ny(76 ? true : y, {a: total, b: total}) ? "s0" : null;\n\ndescribe("promoting a failure to a regression test", () => {\n  const replay = JSON.stringify({\n    code: "(f x)\\n(g)",\n    steps: [{ op: "cut", r: [1, 2, 3, 4] }],\n  });\n  const records = [\n    { seed: 7, signature: "cut :: bad", problem: "bad", shrunkTo: 3, replay },\n    { seed: 9, signature: "cut :: bad", problem: "bad", shrunkTo: 1, replay },\n    { type: "crash", seed: 7 },\n  ];\n\n  it("finds a failure by seed or by signature text (the smallest)", () => {\n    expect(lib.findForPromote(records, "7").shrunkTo).toBe(3);\n    expect(lib.findForPromote(records, "CUT").seed).toBe(9);\n    expect(lib.findForPromote(records, "nothing")).toBeNull();\n  });\n\n  it("prints an it() in the format of the once-broke block", () => {\n    expect(lib.promoteCase(records[0])).toBe(\n      [\n        \'  it("seed 7: bad", () => {\',\n        "    check({",\n        \'      code: "(f x)\\\\n(g)",\',\n        "      steps: [",\n        "        {",\n        \'          "op": "cut",\',\n        \'          "r": [\',\n        "            1,",\n        "            2,",\n        "            3,",\n        "            4",\n        "          ]",\n        "        }",\n        "      ],",\n        "    });",\n        "  }, 120_000);",\n      ].join("\\n")\n    );\n  });\n});\n// a b c\nwhile ((h) => total ? g : null) {\n  true;\n  let g = acc;\n  const g = f(n(null - "s8"), y((n) => true, lst(null, true), {a: null, b: "s8"}));\n}\n\nacc = g(f, lst.x(68, true));\n// TODO\nf(acc(n.fact("s6")));\nconst f = "s5" ? (acc) => [g, null, "s8"] : 41;\ny(total(34, acc()), y() ? true : fact());\n\nmodule.exports = require("../codemirror-blocks/.babelrc.js");\n\nwhile ("s1") {\n  lst = true;\n}\n// note\ntotal();\n({a: n ? f : "s7" < 37, b: acc()});\n\n[total(f(), [], g(90, "s9", true))];\nconst y = total(g() * 96, [70 ? null : 20, "s5", total(g)]);\n// a b c\n// a b c\nlst([null]) ? h(h ? "s6" : "s3") : "s6";\nif ([]) {\n  const g = y.f(30 ? "s8" < "s7" : acc("s6", 90));\n  if (g) {\n    let total = total(35);\n    acc = total([], {a: true, b: "s1"}, total(85, true, 91));\n  }\n} else {\n  if (n) {\n    let acc = n() + null ? acc(94, 29, y) : (lst) => null;\n    null;\n  }\n}\nfor (const fact of "s5") {\n  (y) => true + total(h, true, 0) * true;\n  if (fact(true * 36, true, h())) {\n    const h = {a: [true ? 13 : n], b: fact};\n    var n = y("s6" - total(null, true));\n  } else {\n    const x = (total) => [null, acc, y] + true;\n    total((total) => (lst) => true);\n    x = g < 93;\n  }\n  const h = true;\n}\nfunction lst(acc, x) {\n  if (null) {\n    (acc) => fact("s7" ? true : "s5", "s8" ? fact : true);\n  } else {\n    return true;\n  }\n  if (x("s4" ? null : 22, 51)) {\n    return lst("s0", true) < g();\n    let acc = "s2";\n  } else {\n    return (lst) => true ? [] : "s6";\n    acc - total(75);\n  }\n}\nfor (const f of 9) {\n  lst.g("s3");\n  var h = f();\n}\n53;\nh = true;\n\nwhile (h) {\n  null;\n}\nlst("s2");\nfor (const total of null ? 26 : y) {\n  if ({a: null ? 98 : "s0", b: {a: true, b: fact}}) {\n    var y = acc();\n    const y = null;\n  } else {\n    var f = {a: (y) => true === 72, b: fact()};\n  }\n}\nif ({a: [25, acc], b: 29 ? true : h}) {\n  var g = h({a: 57 + n, b: 11});\n  function g(n, acc) {\n    let fact = f;\n    return fact();\n    return g();\n  }\n  const total = total("s0", {a: true ? "s6" : null, b: null});\n} else {\n  if (true - true) {\n    var fact = x(null, (x) => "s2" - null);\n  } else {\n    var lst = "s7" + f(null);\n    var y = true;\n  }\n  true ? true : true - true * lst < acc(null + 44, true);\n}\n93;\n// note\nwhile ([]) {\n  function y(h, g) {\n    null;\n    return (g) => [g, x];\n  }\n  for (const lst of 35 ? true : true) {\n    let f = {a: null, b: (n) => null * true - "s6"};\n    acc = "s4";\n  }\n}\nconst {\n  getWebpackBundleConfig,\n} = require("@bootstrapworld/cmb-toolkit/lib/webpack");\n\n// dist/codemirror-blocks-min.js: the editor, with no language, for a page that\n// loads it with a <script> tag (a language is another file: see wescheme, ...)\n\n// TODO\nconst h = acc("s6", y(x + true));\nlst = true ? acc() : f.fact(41, 19);\nf;\n// TODO\nif ([lst(true, 67, true)]) {\n  true;\n}\nh === total(total(), fact());\n\n// note\nacc(x(null));\nif ({a: [93, 46, lst], b: [true]}) {\n  y = total([acc, y], 10 * "s8");\n  var y = fact();\n}\n// TODO\nlst();\nfor (const total of {a: "s5", b: true}) {\n  if (fact(x.x(true))) {\n    var g = "s9";\n    var acc = f.total();\n    75;\n  }\n  h(fact);\n}\nwhile (fact()) {\n  if (y(true, lst(null), 2)) {\n    const fact = lst();\n  }\n  for (const total of y) {\n    const fact = [acc(null, true, null) + fact(y, null, "s6")];\n  }\n}\nconst flag = (name) => args.includes(`--${name}`);\nconst opt = (name) => {\n  const i = args.indexOf(`--${name}`);\n  return i === -1 ? undefined : args[i + 1];\n};\n// a b c\nclass A {\n  m() {\n    return 1;\n  }\n}\nnew A().m();\nh() ? acc(91) : y(null, n, 28) ? (total) => fact("s1", 35, 38) : fact(total("s0"), true - true);\nif (lst()) {\n  const total = acc() + (acc) => null;\n} else {\n  const y = null;\n  for (const h of {a: null, b: lst}) {\n    const y = h.h(null, f(null) * lst());\n  }\n  for (const lst of null - 44) {\n    var y = (x) => ({a: true - "s2", b: []});\n    let y = f(g(98) ? null : g(47, 94), null, (lst) => n());\n  }\n}\n// note\ntrue;\nvar f = [total];\n\nvar g = 17;\n// note\ntotal(20);\nn(g(), null) ? total() : (fact) => h.h(true, true);\n// a b c\nh;\nconfig.module.rules.push(\n  {\n    test: /\\.rkt$/,\n    type: "asset/source",\n  },\n  {\n    test: /\\.tsx?$/,\n    use: [\n      {\n        loader: "ts-loader",\n        options: {\n          // Point directly to your custom tsconfig that excludes tests\n          configFile: path.resolve(__dirname, "../tsconfig.build.json"),\n        },\n      },\n    ],\n    exclude: /node_modules/,\n  }\n);\n\nvar y = g;\nconst f = y.n();\nconst n = n();\n\nvar fact = h("s3", x.total("s1"), 59);\nvar total = g();\nfor (const n of 66) {\n  (g) => fact(total(null, null), 76, h(0, y));\n  let g = x();\n  f.y(y(fact(), true));\n}\n// TODO\nfor (const x of lst.f()) {\n  n(["s9", true, "s8"] - h(null, y));\n}\n\nfunction n(n, fact) {\n  while ([x(null, 84), 73 < 29, g()]) {\n    const y = "s0";\n    return lst(lst("s7", null), "s2", null * y);\n    total();\n  }\n  while ((lst) => "s5") {\n    return n("s2" ? 88 : fact);\n    "s8";\n    7 * "s5" === true ? 90 : 92;\n  }\n}\n\nmodule.exports = {\n  plugins: ["@babel/plugin-transform-modules-commonjs"],\n  exclude: ["/\\bcore-js\\b/"],\n  presets: [\n    [\n      "@babel/preset-env",\n      {\n        targets: {\n          browsers: [\n            "Firefox >= 76",\n            "Safari >= 13",\n            "Chrome >= 85",\n            "Edge >= 85",\n          ],\n        },\n        useBuiltIns: "entry",\n        corejs: {\n          version: "3",\n        },\n      },\n    ],\n    "@babel/preset-react",\n    [\n      "@babel/preset-typescript",\n      {\n        allowDeclareFields: true,\n      },\n    ],\n  ],\n  sourceMaps: true,\n};\n\n\n[20 ? null : f ? "s5" ? true : null : 96 === true, total({a: true, b: null})];\nif (38 + 2) {\n  f(80, true, acc((g) => y));\n  function h(total, x) {\n    return (g) => acc();\n  }\n}\n// note\nfunction total(fact, h) {\n  true;\n  var f = true;\n}\nif (true) {\n  fact(null < n * [n], true < null ? "s0" : 45, lst("s5", "s6") - true);\n  const lst = [55, 23, y()];\n}\nvar total = lst(f.g(fact("s9", "s8"), null ? 55 : true));\n\n// a b c\ntrue;\n// TODO\ntrue;\n// TODO\nif (n(true + 50, true, acc(18))) {\n  function h(h, acc) {\n    fact = total((f) => true);\n    "s8";\n  }\n  75 === (g) => total(true, null);\n} else {\n  g.x(acc);\n  x(null, "s2", x());\n}\n({a: acc(), b: ["s8"]} ? (fact) => "s8" : acc(["s2", 9, true], {a: "s0", b: 74}, 51));\nfunction total(n, n) {\n  while (null ? [fact, true, 42] : f < true) {\n    return {a: true, b: "s9"};\n  }\n  for (const y of true ? true : true) {\n    h(true < h, lst("s6", null), (y) => fact) ? total() : null;\n    fact();\n  }\n}\n\nif ([]) {\n  while (f.acc(true) ? n : g()) {\n    g(acc("s7", [null]));\n    let acc = f.total(fact * true ? 70 - null : [y, y]);\n    acc = f("s2" ? null : 32, y);\n  }\n  95;\n}\nvar f = [null, total] + g(n(g), null === "s7", true);\nwhile (h()) {\n  84 === g((x) => null, null < true, {a: acc, b: 77});\n  function f(f, f) {\n    return [n(null), 94 < null];\n    n = 75;\n    const f = null;\n  }\n}\nlst = f("s6", y.total(true, null), h.f());\n// TODO\nclass A {\n  m() {\n    return 1;\n  }\n}\nnew A().m();\nconst g = h(lst(null, {a: 26, b: null}, total), (g) => y(acc), y(44 ? true : 76, n(11, fact), acc));\nlet x = 1 + 2;\nf(x, 3);\nwhile (x < 9) { x = x + 1; g(x); }\nwhile (lst(fact.x(), null, "s9")) {\n  for (const total of g(true)) {\n    h = g();\n  }\n  const y = h(null, lst(true, true, 15)) ? true + lst(true, y, total) : n.f("s5", total) ? true : x(null, true);\n  let f = x(g(), (lst) => 79, "s0") ? acc() : true ? "s7" : h ? true + "s7" : x(true, 2);\n}\nmodule.exports = require("../codemirror-blocks/.babelrc.js");\n\nfunction f(a, b) { return a * b; }\nf(1, 2);\nif (x) { f(1, 2); } else { g(); }\nf("s3");\n\n// TODO\nconst n = 50;\n// a b c\n// a comment\nfor (const x of [1, 2, 3]) {\n  total = total + x;\n}\nconsole.log(total, "done");\nlet y = n(fact(h, 46), lst(h, true)) < n(null < true);\ntotal(lst(total(y, true, "s5"), 41, lst()), true);\nvar h = null;\nif (f(h("s4", "s1", 64), fact(true), "s1")) {\n  null;\n}\n// note\n// note\nif (fact) {\n  g;\n}\n\nwhile (0) {\n  total = 5;\n  const lst = true - {a: null, b: "s4"} ? (n) => lst(true, 40) : fact;\n  var f = 68;\n}\n\n// TODO\nvar fact = null;\n\nlet h = x;\n\n({a: x(g()), b: "s5"});\nacc;\nif ("s0") {\n  let total = f + fact(true, (x) => null);\n} else {\n  lst();\n  while (y(fact) === lst.g()) {\n    var total = true;\n    fact(lst(fact(true, null, null), total(null, 42), "s0"), [null, true] ? true : null);\n  }\n  let acc = total() < true ? "s2" : [f ? acc : "s6", 61 ? null : n];\n}\n[];\n// TODO\nnull;\nconst n = acc;\n"s1";\nnull;\nif (null) {\n  fact();\n  const lst = null;\n  var total = x;\n}\nlet lst = fact({a: g, b: lst} ? "s2" : fact(33, true), null);\n\n(lst) => ({a: h(null, x, true), b: y});\n// TODO\nlet g = h.h((y) => x(), [true, true, "s8"] ? f : null);\n// a comment\nfor (const x of [1, 2, 3]) {\n  total = total + x;\n}\nconsole.log(total, "done");\n// note\nfunction total(y, lst) {\n  while (g() < h(total, "s8")) {\n    return lst < fact(null);\n    return true;\n  }\n  for (const y of "s2" ? "s0" : lst) {\n    fact = "s9" ? "s8" : h - "s0" ? 97 : 52;\n    return g;\n  }\n  if (n()) {\n    return (y) => acc;\n    return f();\n    var x = null < acc - "s5" ? true : h();\n  } else {\n    let h = total(f(h.h(), x(34, "s3"), acc - null));\n    ({a: acc() ? true : total(f, "s1"), b: x});\n  }\n}\n\nfor (const g of {a: total, b: null}) {\n  const x = g({a: {a: "s1", b: true}, b: x(null, true)});\n}\nacc();\n(lst) => lst(total(true));\n\n({a: g + x, b: f.h(g)} ? f : total(null, null, lst("s8", f, y)));\nacc(true ? 14 : true, true, true) ? f(g(null)) : 22;\nfunction lst(lst, fact) {\n  return g();\n  true;\n}\nconst n = h();\n\nif ([n, null < total, [31]]) {\n  n([9, null === y], "s0", acc(y));\n  var g = true;\n  function lst(lst, fact) {\n    let n = 14 ? f([], f) : [];\n    return [];\n  }\n}\n\n// a b c\n"s1" ? h(g(80)) : [];\nmodule.exports = require("../codemirror-blocks/.babelrc.js");\n\ndescribe("jsonValues", () => {\n  it("reads the pages gh prints one after another", () => {\n    expect(lib.jsonValues(\'[{"a":1}]\\n[{"a":2},{"a":3}]\\n[]\')).toEqual([\n      [{ a: 1 }],\n      [{ a: 2 }, { a: 3 }],\n      [],\n    ]);\n  });\n  it("is not fooled by brackets and quotes inside a string", () => {\n    const body = \'a ] [ " \\\\ } { b\';\n    const text = JSON.stringify([{ body }]) + "\\n" + JSON.stringify([{ body }]);\n    expect(lib.jsonValues(text)).toEqual([[{ body }], [{ body }]]);\n  });\n});\n\nconst at = process.argv.indexOf("--port");\nconst port = at >= 0 ? Number(process.argv[at + 1]) : 8080;\nconst types = {\n  ".html": "text/html",\n  ".js": "text/javascript",\n  ".css": "text/css",\n  ".json": "application/json",\n  ".map": "application/json",\n  ".rkt": "text/plain",\n};\n\n// a b c\nfunction replayCommand(record, file) {\n  return `npm run soak -w @bootstrapworld/cm6-blocks -- --replay ${file ?? record.seed}`;\n}\n\n/** A readable summary: new failures first, most common first, then the known ones */\nfact(53, 86) - n - [];\nfor (const lst of (total) => null) {\n  lst(fact(true, total), fact(null, 83) * 77, acc(acc(), 69));\n  const g = n(48 ? null - true : "s0");\n  function g(g, acc) {\n    null;\n  }\n}\nconst x = {a: f(f(g, null), {a: lst, b: "s3"}, null), b: lst(y())};\n// note\nfor (const fact of (h) => 83) {\n  57;\n  x = true ? 46 : 67 + n("s1");\n  y.x(acc);\n}\n// a b c\n[true < null] ? f - 38 + acc() : true;\nvar acc = total("s6" ? true : lst("s6", null));\n\nx = true;\nvar x = g;\n\nh = g.total(f(y, 33, true));\n\nif (x(y(fact, acc, true))) {\n  true;\n  var n = (n) => x((g) => "s8");\n}\nmodule.exports = getLanguageBundleConfig({\n  name: "routine",\n  global: "CMBRoutine",\n  entry: "./src/index.ts",\n});\n\n\nlet g = n(fact, n(true === x, lst()), true < null ? g() : true);\n\nfor (const x of x()) {\n  for (const h of {a: "s7", b: null}) {\n    let total = ["s4", 94, n("s2") + x(f, "s4")];\n    var lst = g(67, (total) => total + "s6", h(70, [74, 41]));\n  }\n}\n// note\nvar h = fact(y(true, null, 60) - 25, "s1");\n\nconst acc = "s5";\n',
      steps: [
        {
          op: "topLevelType",
          a: 0.1113172871991992,
          text: "(",
          accept: true,
          how: "paste",
        },
      ],
      motion: "full",
      editor: {
        lineNumbers: false,
        lineWrapping: false,
        collapseAll: false,
        reconcile: true,
        anchors: true,
        fastErrors: true,
        skipRoots: true,
        activityLimit: null,
      },
    },
    { baseURL: `http://127.0.0.1:${process.env.CMB6_PORT || 8177}` }
  );
  expect(v).toBeNull();
});

test("soak seed 141: a finger pressing within 4 px of the left edge of the window, with the editor scrolled sideways, lands on the page (Chromium), not on the block that `elementFromPoint` finds: the soak presses a finger at least 12 px in, and the focus stays on the block", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 141,
      language: "javascript",
      code: 'n() ? total - y : "s5" * 70 === null;\nlet f = 36 - x.h(true, {a: 32, b: true});\n// note\nlet h = total("s9" ? null : "s9" ? ["s8", "s6"] : true, true, true);\nfunction n(h, acc) {\n  while (acc.y((fact) => h, "s5")) {\n    n = n(y(true, 27, true));\n    g;\n  }\n  return (acc) => 67 ? true : total();\n}\n// TODO\nfunction y(h, f) {\n  function total(n, acc) {\n    null;\n    ({a: {a: true, b: y(19, null, true)}, b: (x) => 68});\n    return acc(true, "s4", [null]);\n  }\n  return [g(72, true)];\n}\n\nif (h(true, total, n) * null ? null : f) {\n  if (60) {\n    var g = true;\n    x(x("s5", 39) < total(null), (acc) => "s2" ? "s1" : true);\n  }\n  for (const fact of ["s3", true]) {\n    (x) => ({a: null, b: "s5"}) + acc.lst(lst(83, null, null));\n    const lst = {a: total(x, null) ? 91 : x(), b: {a: n.x(), b: (fact) => x}};\n    let g = lst.f(null ? true : "s3" ? x(12, null, null) : acc(lst));\n  }\n  var h = true;\n}\ng();\n',
      steps: [
        {
          op: "replaceDoc",
          text: 'let fact = acc;\ng = f(fact(24, g, 86), null ? 17 : null);\nfor (const y of {a: "s7", b: null}) {\n  var total = true;\n  function fact(acc, f) {\n    return true;\n  }\n  ({a: [null, 44], b: f()} ? ["s6", f, 7] ? fact(94, x, "s0") : h(null, 82) : null ? f - true : g(44, null, "s2"));\n}\n',
        },
        {
          op: "touchDrag",
          a: 0.6176962102763355,
          b: 0.8825520123355091,
          where: "gap",
        },
        { op: "swipe", a: 0.7138197321910411, dir: "down" },
        { op: "undoRun", n: 2, redo: true },
        { op: "editBox", a: 0.4813648834824562, text: "(((", accept: true },
        { op: "longPress", a: 0.5447568707168102 },
      ],
      motion: "full",
      editor: {
        lineNumbers: false,
        lineWrapping: false,
        collapseAll: false,
        reconcile: true,
        anchors: true,
        fastErrors: true,
        skipRoots: true,
        activityLimit: null,
      },
    },
    { baseURL: `http://127.0.0.1:${process.env.CMB6_PORT || 8177}` }
  );
  expect(v).toBeNull();
});

test("soak seed 1490: a block dragged by a finger leaves no `blocks-hole` mark on a blank that CodeMirror took out of the page during the drag (the renderer kept it and drew it again marked)", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 1490,
      language: "javascript",
      code: 'let fact = "s7";\nlet fact = [n({a: 81, b: 43}, "s5" - "s0"), fact(null)];\nx = acc("s6" ? 37 : "s2", n, (g) => 23);\nwhile ("s7") {\n  var fact = null;\n}\n// note\nx = g(lst, null, null);\nfor (const lst of lst("s7", 9)) {\n  let lst = f(y(1, 88, null), fact(null, g(), y(29)));\n  true;\n  const acc = g("s8", f);\n}\nif (acc()) {\n  function fact(n, total) {\n    null;\n    acc = fact();\n  }\n  g(true, acc.y({a: "s0", b: null}));\n} else {\n  while ([true - null]) {\n    var h = y(acc(true ? null : null, [n]), 66);\n    let total = {a: n, b: g};\n    const g = {a: 98 + true - x("s9"), b: true * y()};\n  }\n}\nwhile (fact([], (x) => "s9")) {\n  fact(lst.g(), []);\n  const y = 95;\n  if (lst.x(38 - null, "s8")) {\n    var h = true;\n    var h = true;\n    fact(g < lst(null, 80, 59));\n  } else {\n    g = 23;\n    const total = g.fact(87);\n  }\n}\n',
      steps: [
        { op: "longPress", a: 0.9934745153877884 },
        {
          op: "touchDrag",
          a: 0.17173217539675534,
          b: 0.13277739356271923,
          where: "end",
        },
      ],
      motion: "reduced",
      editor: {
        lineNumbers: true,
        lineWrapping: false,
        collapseAll: false,
        reconcile: true,
        anchors: true,
        fastErrors: true,
        skipRoots: true,
        activityLimit: null,
      },
    } as Sequence,
    { baseURL }
  );
  expect(v).toBeNull();
});

test("soak seed 1568: a block dragged by a finger leaves no `blocks-hole` mark on a blank that CodeMirror took out of the page during the drag (the renderer kept it and drew it again marked)", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 1568,
      language: "scheme",
      code: '9\n\n; TODO\n(define x (f (g) (x (n)) \'((if #t \'a "s3") (let ([f \'a]) y) #t)))\n; note\n(define lst (acc 43 (h (lambda (n) #t)) (+ (fact \'a) (= lst \'a))))\n(define acc (f h (cond [(if 71 n "s3") (= "s8" \'a)] [else 31]) "s0"))\n\n(acc (fact (cond [#t lst] [else "s1"]) \'a) \'a (if "s2" (fact (cond [#t #f] [else #f]) (g #t \'a #t)) (h \'(\'a \'a "s5") (if 50 5 #t))))\n\'a\n; note\n(fact (let ([acc (< (let ([x "s5"]) \'a) (< h #f))]) (- (f "s9" 39 53) (total \'a \'a))) acc (if (cond [(lambda (fact) "s2") \'(h)] [else 19]) (lambda (g) (total 20)) (if \'a (cond [x 4] [else "s4"]) (+ #t y))))\n(define (fact g) (lambda (g) #t))\n',
      steps: [
        { op: "clickTemplate", t: 0.38204983272589743 },
        { op: "collapse", a: 0.2133080109488219, on: true },
        {
          op: "touchDrag",
          a: 0.7618581808637828,
          b: 0.36990698194131255,
          where: "whitespace",
        },
      ],
      motion: "reduced",
      editor: {
        lineNumbers: true,
        lineWrapping: false,
        collapseAll: false,
        reconcile: true,
        anchors: true,
        fastErrors: true,
        skipRoots: true,
        activityLimit: null,
      },
    } as Sequence,
    { baseURL }
  );
  expect(v).toBeNull();
});

test("soak seed 2334: a block dragged by a finger leaves no `blocks-hole` mark on a blank that CodeMirror took out of the page during the drag (the renderer kept it and drew it again marked)", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 2334,
      language: "python",
      code: 'fact() == lst(None == "s2", True, y(34, None))\n# a b c\nif n:\n    []\n    f = {total("s6", 81, 67) < 42: [True, lst(None)]}\n    while g():\n        h = [None] - "s3" < (lambda g: [None, "s8", total])\nelse:\n    h = f(h.n(None + "s4", [17, True, "s7"]), x(90, None) + (lambda y: None), 73)\n# TODO\nif n():\n    acc(acc(f("s8", True)))\n    (lambda h: lambda g: None) * h.lst()\n# TODO\nif True:\n    True\n    total = f([fact("s0"), total(True)], lambda acc: n(True), 96 - n("s3", True, x))\n    def lst(h, h):\n        lst = lambda f: True\n\ng(lambda y: lambda y: g, 46, [None, "s0" * h])\nwhile {total("s1", g): "s0"}:\n    g(x(acc.g("s7"), 76 + True), {"s1": None} * n(), n)\nh = 93\n',
      steps: [
        { op: "focus", a: 0.8906855210661888 },
        {
          op: "dragTemplate",
          t: 0.9489812140818685,
          b: 0.25555131724104285,
          where: "whitespace",
        },
        { op: "tap", a: 0.35054748761467636, twice: true },
        {
          op: "touchDrag",
          a: 0.8295241782907397,
          b: 0.4552744154352695,
          where: "end",
        },
      ],
      motion: "full",
      editor: {
        lineNumbers: true,
        lineWrapping: true,
        collapseAll: false,
        reconcile: true,
        anchors: true,
        fastErrors: true,
        skipRoots: false,
        activityLimit: null,
      },
    } as Sequence,
    { baseURL }
  );
  expect(v).toBeNull();
});

test("soak seed 2601: a block dragged by a finger leaves no `blocks-hole` mark on a blank that CodeMirror took out of the page during the drag (the renderer kept it and drew it again marked)", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 2601,
      language: "javascript",
      code: 'if (acc.acc() ? y : 6) {\n  var f = h(null * n(50, null), n(true, fact.n(28, true)));\n  while (fact(g(true), (h) => "s7", g(f, null))) {\n    const y = {a: 18, b: g} === fact(33, "s2") ? (acc) => lst(n, 38, y) : null ? null : null;\n    x(x(total(true)));\n    let f = h.y(53);\n  }\n} else {\n  for (const f of null ? y : null) {\n    total;\n    let acc = total("s2", f([51]), acc(f(null, "s9"), h.total(), {a: null, b: fact}));\n    81;\n  }\n  x(null, true);\n  var h = 18;\n}\n({a: y(acc(true, 29), 94, fact(total)), b: fact()});\n\nimport "codemirror/lib/codemirror.css";\nimport "../lib/css/codemirror-blocks.css";\nimport "@bootstrapworld/wescheme/css/wescheme.css";\nimport "@bootstrapworld/routine/css/routine.css";\nconst lst = acc;\n20 === "s6";\n\nvar y = null;\nif (total(88, null) ? 59 ? true : "s1" : {a: "s2", b: true}) {\n  fact(h(27, acc) + total());\n  y = (lst) => "s5" * (lst) => "s9";\n  const n = acc() + 51 + h("s5", n("s8", fact, 38));\n}\n\nn = y();\ntrue;\nlet y = "s9";\nlst;\n// a b c\nvar f = (h) => (x) => null ? h : true;\nacc + total();\nlst();\nif ("s1" === (x) => 72) {\n  h(true, [null, lst()], x ? "s2" : f - g(89));\n} else {\n  function fact(fact, g) {\n    const f = true;\n    return true < total - g("s1", null);\n    return h.acc(14, lst) * 19;\n  }\n}\nlet fact = 63;\nif ("s4") {\n  total = "s7";\n  const total = true ? "s5" : y() < total(null, y, lst);\n  null;\n} else {\n  if (g(96 ? true : null, null, {a: acc, b: null})) {\n    "s7";\n    const total = "s4";\n  }\n}\nfor (const lst of 20) {\n  const g = n;\n}\nclass A {\n  m() {\n    return 1;\n  }\n}\nnew A().m();\nlet x = 1 + 2;\nf(x, 3);\nwhile (x < 9) { x = x + 1; g(x); }\nvar g = g(true, 72 ? null : 46 < "s8");\nfor (const g of (acc) => f) {\n  const x = lst(f.x(), 63 - 77, f(59)) ? acc(true ? f : g, null) : {a: {a: null, b: y}, b: n.acc(33)};\n  var n = "s4";\n  for (const fact of n(lst, true)) {\n    ({a: h(g("s1"), g.n(), true), b: true});\n  }\n}\n\nvar x = null;\n// note\nif (n.x(42)) {\n  while ("s1" - true) {\n    true;\n    const y = [];\n    const fact = fact(acc(true, h(67, y), null < total));\n  }\n}\nfact();\nx = g(n());\nfunction x(lst, acc) {\n  function h(f, y) {\n    return [true ? n : 1];\n    return [true, f(14, 59), x(null, null, h)];\n    return "s6";\n  }\n  ({a: null, b: true});\n  var n = (fact) => h(x(true), 52 ? true : "s7", h === true);\n}\n// TODO\nwhile (null) {\n  g(61 < null);\n}\nwhile (x()) {\n  h = 23;\n}\nconst f = (h) => n * 1 * fact(g.total(null, true), g(h, 71, true));\n\n// TODO\n3;\nwhile (null) {\n  f(18 + true < f, lst.acc([true, n], g.lst()), x(true));\n  acc("s3", true * ["s9", null, null]);\n}\nwhile (true === 53 ? f ? "s6" : h : 17 ? true : n) {\n  "s4" < true;\n  fact();\n}\n\nvar n = [lst(acc("s8", null), fact), "s2", "s9" * y ? h.n(true) : true - n];\nfor (const lst of g.n(true)) {\n  n.acc(46 < true ? null : total);\n}\nconst y = {a: null, b: {a: {a: null, b: null}, b: n(null)}};\n// TODO\nif (true ? f : null - g(null, 78)) {\n  true;\n}\n// TODO\nfor (const g of {a: h, b: null}) {\n  "s0";\n}\n\nn = [y.y("s2", 37)];\nfunction total(y, x) {\n  x(acc);\n}\n[(acc) => g(true, "s8"), n(null * "s2")];\nconst n = null;\nasync function main() {\n  for (const { from, to, prepend } of targets) {\n    const file = path.join(root, from);\n    const source = fs.readFileSync(file, "utf8");\n    const result = await less.render(source, { filename: file });\n    const dest = path.join(out, to);\n    fs.mkdirSync(path.dirname(dest), { recursive: true });\n    fs.writeFileSync(dest, (prepend ? prepend() + "\\n" : "") + result.css);\n    process.stdout.write(\n      `lib/css/${to}  ${Math.round(result.css.length / 1024)} KB\\n`\n    );\n  }\n}\n\n// TODO\nfunction f(x, lst) {\n  total.lst(f.x("s0" + true, 37));\n}\n// note\nlet total = (g) => f;\n// a b c\nx([], lst.fact(y - true, {a: null, b: 52}), null);\n\nlst.acc();\ng = [41 * true, true];\nconst y = y(null, null, (y) => true) + h();\nwhile (fact((n) => "s8")) {\n  const n = f.acc("s0");\n  while ([71, true, "s4"] === "s0") {\n    n((h) => true) ? x(y(), null, acc(acc)) : "s1";\n    acc = h();\n    total = fact(h(), 84, fact < true);\n  }\n}\n\n// note\nif (null ? total : true * null) {\n  for (const n of null) {\n    var f = total(20 ? y() : n, x(null));\n    var acc = y(null, y("s4" - null, f.h(), 68 ? 18 : true));\n    const h = lst;\n  }\n  for (const y of total(null, true, null)) {\n    f = true;\n    h = acc(true) ? [] : h();\n    let fact = y(null ? (n) => true : true, g === true);\n  }\n} else {\n  const y = g((y) => null + null, true === f, f("s0" === 14));\n  (f) => "s5";\n}\nnull;\n\n(fact) => y("s0") ? x === fact : {a: null, b: total};\nfunction h(fact, g) {\n  if (acc) {\n    let n = f(null, 2, (g) => fact(41, null, null));\n    return {a: null, b: "s9" ? n : 13};\n  }\n  if (y(null) ? n.n(g) : "s1" ? null : true) {\n    fact = y.x(n(28));\n  }\n}\nconst y = [null, true, y((acc) => 0)];\nlet total = acc();\nlet h = f(true);\n// note\nfact;\n// TODO\nvar lst = {a: total(null === null, "s2" * true, total("s0")), b: []};\n\nfor (const lst of true < true) {\n  let lst = x(true ? 36 : 74) * fact() * lst(true, null, "s9");\n  const fact = [total(), x(null * 4, true < true, f(true)), 46 ? true : 79];\n}\n\nmodule.exports = function gen(lines) {\n  const out = [];\n  for (let i = 0; out.length < lines; i++) out.push(...form(i));\n  return out.join("\\n");\n};\n\n// a b c\nconst {\n  getLanguageBundleConfig,\n} = require("@bootstrapworld/cmb-toolkit/lib/webpack");\n\n// dist/lambda-min.js: this language, for a page that loads it with a <script>\n// tag after the editor\'s (the global `CMBLambda` is the language, which is\n// also added to the editor, to be asked for by its id: "lambda")\nif ("s7") {\n  true;\n} else {\n  let n = lst(76, true, "s9") ? null * null === x(14) : fact.total("s0");\n}\nwhile (f(lst("s5", true, true), n)) {\n  g = total(x(f, true, null), 51, {a: true, b: "s4"});\n  for (const total of [x]) {\n    var total = true;\n    f(fact({a: lst, b: null}, h.acc("s6", g), g()));\n  }\n  78;\n}\nconst y = x(n("s3", 82), [], []);\ntrue;\nvar x = true;\ntotal(null ? null : fact, null ? fact : g === "s2", n("s0" ? true : null, [null], n(null, true)));\nif ([h(80)]) {\n  var h = n(n()) === [83, null < null, n("s2", 79)];\n  if (g()) {\n    n = y((y) => true, 2 * n, ["s5"]);\n    const f = "s1";\n  }\n  let n = 19;\n}\n// a b c\nconst g = true;\n[[(g) => x, null]];\nconst h = g;\nlet total = total(null + x(), y(), g(acc(true)));\n\n\nwhile (f.x()) {\n  function total(y, g) {\n    return lst() ? lst.x() : x(true);\n    n();\n  }\n  y(y());\n  function x(fact, fact) {\n    return (fact) => lst - fact;\n    (y) => null;\n  }\n}\nh = (x) => h;\n// TODO\nfunction fact(g, y) {\n  [h, 82] === 93;\n  if ("s5") {\n    return {a: 25 === true, b: total(null)};\n    var lst = null;\n    acc();\n  }\n}\n\n// a b c\nvar y = [];\nif (n) {\n  x = "s9";\n  while (fact < true * 33) {\n    const lst = null;\n    true;\n    h(n(null, true), true, total("s2", h)) + x(true ? 91 : "s5", null === null, (acc) => lst);\n  }\n  function n(f, acc) {\n    h("s6", lst(y));\n    return 58;\n  }\n}\nvar total = {a: [null, 78, total.acc(85, null)], b: n("s7", acc.n())};\n// note\nfor (const total of g) {\n  ({a: "s0" ? "s3" : "s4", b: n()} < []);\n  59;\n  function y(x, h) {\n    x = [g("s1")];\n    let fact = g();\n    return f;\n  }\n}\n// TODO\ng = n(38 < g, [true, acc]);\n\nfunction h(n, h) {\n  var n = total;\n  for (const y of 98 < 2) {\n    h.y(77);\n    true;\n    let y = [y(true) ? h(true) : x(true, null), "s9", g.n(true) ? "s3" : h.fact(null)];\n  }\n}\nnull;\n\n({a: {a: 12, b: "s9" * 33}, b: []});\nfor (const total of total(h)) {\n  let fact = "s1";\n}\nvar lst = h;\n\n// TODO\nfact() + acc();\n\nmodule.exports = getLanguageBundleConfig({\n  name: "example",\n  global: "CMBExample",\n  entry: "./src/index.ts",\n});\n\nfunction parseJsdomFailure(title, message) {\n  const text = stripAnsi(message);\n  if (!text.includes("A randomized sequence of operations broke the editor")) {\n    return null;\n  }\n  const seed = /seed (\\d+)/.exec(title)?.[1];\n  const at = /failed at: (.*)/.exec(text)?.[1] ?? "?";\n  const problem = (\n    /problem:\\s+([^\\n]*(?:\\n {13}[^\\n]*)*)/.exec(text)?.[1] ?? "?"\n  )\n    .split(/\\n\\s+/)\n    .join(" | ")\n    .trim();\n  const shrunk = /Shrunk to (\\d+) of (\\d+) steps/.exec(text);\n  const replay = /CMB_RANDOM_REPLAY=\'(.*)\' npx jest/.exec(text)?.[1];\n  const ops = [...text.matchAll(/^\\s+\\d+\\. (.*)$/gm)].map((m) => m[1]);\n  return {\n    kind: "jsdom",\n    seed: seed === undefined ? undefined : Number(seed),\n    steps: Number(/\\((\\d+) steps\\)/.exec(title)?.[1]) || undefined,\n    failedAt: at,\n    problem,\n    shrunkTo: shrunk ? Number(shrunk[1]) : undefined,\n    trace: ops.slice(0, 40),\n    replay,\n  };\n}\n\n/** Failures of the same kind get the same signature, whatever the ids and numbers */\nmodule.exports = {\n  plugins: ["@babel/plugin-transform-modules-commonjs"],\n  exclude: ["/\\bcore-js\\b/"],\n  presets: [\n    [\n      "@babel/preset-env",\n      {\n        targets: {\n          browsers: [\n            "Firefox >= 76",\n            "Safari >= 13",\n            "Chrome >= 85",\n            "Edge >= 85",\n          ],\n        },\n        useBuiltIns: "entry",\n        corejs: {\n          version: "3",\n        },\n      },\n    ],\n    "@babel/preset-react",\n    [\n      "@babel/preset-typescript",\n      {\n        allowDeclareFields: true,\n      },\n    ],\n  ],\n  sourceMaps: true,\n};\n\n\n// note\nfor (const acc of n) {\n  fact(true, total()) - {a: (total) => "s0", b: null};\n}\nwhile ("s7") {\n  while (n(null) ? 3 : x ? fact : "s1") {\n    total = true;\n  }\n  function f(f, acc) {\n    h(null, "s1");\n  }\n  function f(fact, g) {\n    let g = g === 54 ? lst : null === lst.lst(true);\n    ({a: lst ? "s7" : 41 === "s8", b: [null, true] ? f : "s5"});\n    return [h(true, null, null), h(null, 48, x), null];\n  }\n}\nfunction fact(f, acc) {\n  let y = ["s1" ? "s4" : 5, lst] < (n) => acc(true);\n  h(total(acc(null), true - fact), {a: null * true, b: true});\n}\n[{a: [true, null], b: g(null, fact, 74)}];\n// note\nconst h = fact(f("s4", true, 65), "s1", fact ? x : null) - h(g ? acc : null);\nwhile ("s7" + 19 ? [] : total()) {\n  let fact = {a: null ? "s1" ? null : true : [], b: null};\n}\n\n// a b c\nif (null) {\n  for (const total of {a: null, b: true}) {\n    h = h(h(), true ? null : "s0");\n    let total = g.lst(h("s8"), g());\n    var n = f.h(g.y(), h("s3", 47) ? 12 : "s1");\n  }\n} else {\n  const f = "s6";\n  [] ? 40 - "s7" : f.g(null) - {a: lst(), b: total("s6", 2)};\n  let n = fact.total();\n}\n\n// a b c\nx + null;\nwhile ((lst) => n) {\n  for (const fact of null ? "s3" : null) {\n    var f = {a: g, b: "s3" ? true : y * h(n, null)};\n    f = "s3";\n  }\n}\nlst("s7", null) ? (total) => 83 : acc() + true;\ntotal = n([]);\n\n// a b c\nfor (const x of "s4") {\n  "s6";\n}\n// a b c\nlet x = "s6";\nlet x = 1 + 2;\nf(x, 3);\nwhile (x < 9) { x = x + 1; g(x); }\nfunction x(g, n) {\n  let y = [];\n  for (const lst of (f) => "s5") {\n    [f(70)];\n    g(n(f(null, g), null ? 16 : acc, [null, 1]), true);\n  }\n  let g = (lst) => 2 === (g) => ({a: true, b: g});\n}\nvar h = [{a: "s6", b: y}, null, "s4"];\n\nif (y()) {\n  lst = 35;\n  var total = "s7";\n}\n[total(), [lst, 80] ? fact.acc("s4") : n + x];\n// TODO\nh({a: "s1", b: {a: 80, b: "s6"}}, {a: true, b: n("s6", 34, true)});\nwhile ("s5") {\n  if ("s7" ? true : (f) => 54) {\n    n = g(true, null);\n  } else {\n    (y) => acc({a: true, b: null});\n  }\n  acc.y((n) => y());\n  h.n(true);\n}\nif (h(["s7"])) {\n  acc.lst();\n  if (68 * null ? fact(98) : {a: null, b: "s6"}) {\n    var x = "s0" + g(h, 24) ? [["s3", "s9"], (lst) => 41, x(h, 44)] : f();\n  }\n  21 - {a: "s0" - true, b: true};\n}\n\n// note\n[[]];\nlst(fact(y(true, true, null)));\n\nvar x = 33;\nacc([]) ? f((total) => 69, lst, null) : [];\n// TODO\nvar lst = acc();\n// TODO\nfunction f(f, acc) {\n  let total = fact(null, {a: null, b: true} ? true : fact(h, "s2", 50));\n  if (h) {\n    const n = h;\n  } else {\n    return acc("s2");\n    return 6;\n  }\n}\nwhile (n()) {\n  if ({a: "s2", b: f}) {\n    const g = x.y(y.lst(total(null, "s7")), 42 + "s7" ? null : fact);\n    const y = [null, 51] * lst() ? {a: lst(null), b: n} : null;\n    x = fact(82, true, true) ? y() : y(null, null);\n  }\n}\n[{a: y(true), b: [true]}, "s8"];\nlet fact = n.g({a: true, b: "s4"});\nn.h(g(acc - x, "s3" ? "s7" : null, x(null, acc)), y(y(), h ? null : "s6"));\nlet x = 1 + 2;\nf(x, 3);\nwhile (x < 9) { x = x + 1; g(x); }\nclass A {\n  m() {\n    return 1;\n  }\n}\nnew A().m();\n// note\nconst n = h("s9" - fact, lst, x());\nfunction fact(acc, lst) {\n  if (56) {\n    [true ? 70 : 73 * h(21, "s7")];\n  }\n}\n// a b c\nlet f = h();\nif (lst) {\n  if (true) {\n    let h = [h.n(f(85, true, true)), f(f) + {a: fact, b: "s7"}, lst(true, n(), null + true)];\n    var total = 2 * 37 < null ? 31 : y();\n    let g = null;\n  }\n} else {\n  for (const acc of fact(37, true, "s3")) {\n    var lst = null;\n  }\n}\nmodule.exports = getLanguageBundleConfig({\n  name: "routine",\n  global: "CMBRoutine",\n  entry: "./src/index.ts",\n});\n\n// TODO\nfunction f(h, f) {\n  function f(f, n) {\n    return total("s2", (f) => null);\n  }\n}\nvar g = (y) => null;\n37;\nlst = (g) => true;\n48;\nconst h = x;\ntotal(f.h(), y.f(null), total({a: 33, b: true}, null < 50, total));\nfunction parseJsdomFailure(title, message) {\n  const text = stripAnsi(message);\n  if (!text.includes("A randomized sequence of operations broke the editor")) {\n    return null;\n  }\n  const seed = /seed (\\d+)/.exec(title)?.[1];\n  const at = /failed at: (.*)/.exec(text)?.[1] ?? "?";\n  const problem = (\n    /problem:\\s+([^\\n]*(?:\\n {13}[^\\n]*)*)/.exec(text)?.[1] ?? "?"\n  )\n    .split(/\\n\\s+/)\n    .join(" | ")\n    .trim();\n  const shrunk = /Shrunk to (\\d+) of (\\d+) steps/.exec(text);\n  const replay = /CMB_RANDOM_REPLAY=\'(.*)\' npx jest/.exec(text)?.[1];\n  const ops = [...text.matchAll(/^\\s+\\d+\\. (.*)$/gm)].map((m) => m[1]);\n  return {\n    kind: "jsdom",\n    seed: seed === undefined ? undefined : Number(seed),\n    steps: Number(/\\((\\d+) steps\\)/.exec(title)?.[1]) || undefined,\n    failedAt: at,\n    problem,\n    shrunkTo: shrunk ? Number(shrunk[1]) : undefined,\n    trace: ops.slice(0, 40),\n    replay,\n  };\n}\n\n/** Failures of the same kind get the same signature, whatever the ids and numbers */\nif ([total(true, total, true), fact(lst, "s0", null)]) {\n  let g = n() - (g) => lst < f.total();\n  ({a: f.x([true]), b: [fact]});\n  if (y()) {\n    var f = true;\n  }\n}\nwhile (f()) {\n  const lst = {a: g("s3") * 72, b: true};\n  if ([]) {\n    let lst = f("s1" ? null : "s0", 18) ? 53 : fact("s3" === true, true === 18);\n    total = true;\n    const x = "s8";\n  } else {\n    fact = true;\n  }\n}\nlst();\nif (y(lst(null, "s7"), null, acc(true))) {\n  ({a: ["s2" === 20, "s2" ? "s0" : true, {a: 98, b: g}], b: f.x(h("s8"), {a: null, b: true})});\n}\n// TODO\n"s7";\ntrue + total(null * 4);\n// a b c\n"s5";\nlet x = g();\ny(h(h, ["s0", 81, null], 60));\n\nconfig.module.rules.push(\n  {\n    test: /\\.rkt$/,\n    type: "asset/source",\n  },\n  {\n    test: /\\.tsx?$/,\n    use: [\n      {\n        loader: "ts-loader",\n        options: {\n          // Point directly to your custom tsconfig that excludes tests\n          configFile: path.resolve(__dirname, "../tsconfig.build.json"),\n        },\n      },\n    ],\n    exclude: /node_modules/,\n  }\n);\n\n\n// a b c\nvar g = total();\nconst lst = acc();\n// note\nvar x = {a: true ? 44 : 95, b: (total) => n} - true;\n// TODO\nfunction f(acc, x) {\n  if (84) {\n    f(true ? "s3" : true, "s4") ? 7 : n(g(total, 39, 47), y.total("s3"), [n, f]);\n  } else {\n    const g = h();\n    const x = total;\n  }\n  39;\n  let h = x.g() < g(acc, null, "s7") - 44 * "s2";\n}\nif (total(g(), {a: true, b: true}, h)) {\n  true;\n} else {\n  if (y(x(total, null, "s1"), g(n), "s6")) {\n    let fact = n(acc(37), "s0");\n  }\n}\n// note\nvar y = 71;\n// a b c\nwhile (lst.lst()) {\n  if ([]) {\n    let f = [{a: "s5" - "s6", b: f.total()}];\n  }\n  while (y) {\n    g = g.g(y(), null * 71);\n    let h = 67;\n    var x = (x) => true ? {a: null, b: total(null, 19)} : lst(fact(null), n.n());\n  }\n  lst = "s1";\n}\n// note\nif (n(true)) {\n  function lst(h, y) {\n    return 85;\n    var g = true;\n  }\n} else {\n  acc = n(y(62, acc));\n}\n\nconst {\n  getLanguageBundleConfig,\n} = require("@bootstrapworld/cmb-toolkit/lib/webpack");\n\n// dist/lambda-min.js: this language, for a page that loads it with a <script>\n// tag after the editor\'s (the global `CMBLambda` is the language, which is\n// also added to the editor, to be asked for by its id: "lambda")\nfor (const fact of "s9") {\n  const acc = 89;\n  x = h(82 < lst);\n  if (x(acc("s6", 31), g.f("s4"), h.h(n))) {\n    var g = fact();\n    var total = n.acc();\n    (x) => 48;\n  } else {\n    const h = [];\n    let n = g();\n    var total = f();\n  }\n}\n(lst) => (x) => null * fact(null);\nconst total = fact.lst(fact((x) => true), f());\nif (y(h.fact(), h(null, 93))) {\n  true;\n  if (null < 23) {\n    const x = total();\n    (h) => ({a: "s6", b: "s3"} * g ? 85 : null);\n    var x = (n) => n ? n : "s8";\n  } else {\n    const n = [97] ? fact(true ? 71 : "s5") : h;\n    let x = x.x();\n    var lst = [{a: "s4", b: true} ? ["s2", 70, 32] : []];\n  }\n  27;\n} else {\n  function lst(f, y) {\n    "s0";\n  }\n  var n = (acc) => n("s8") ? [lst.y(), 59 < "s1"] : true;\n}\n({a: x(), b: (x) => [3, null, 53]});\nconst acc = (n) => x();\n\nacc(97, true ? g : null, n) < n();\n// TODO\nacc = "s0";\nif (x()) {\n  const acc = (n) => 97;\n  lst = x(true, g(total, 77, true));\n} else {\n  (lst) => h();\n  x(x()) ? [] : {a: "s5", b: acc(null)};\n}\nnull;\nwhile (y.f(fact(null, 54, true))) {\n  if (g(x(), "s4" ? 38 : "s6")) {\n    n = 41;\n    let lst = fact(y(true)) ? acc(15, [x, "s3"]) : n;\n  }\n  for (const n of (acc) => 54) {\n    "s4" * {a: true, b: null};\n    const f = [(n) => null ? n : null, y(true), (h) => 91];\n  }\n}\n"s6";\nf = true;\n\ny(null, true) * true ? y : "s5" ? h(null * true) : (lst) => true ? n.lst(null, true) : null;\nfor (const acc of [null]) {\n  y(h.n(acc()), f(42), g());\n  x(lst(true, acc), true, fact(lst, null, acc) ? fact ? 34 : h : fact === h);\n}\n["s8" ? x("s9") : fact.fact(true), x(lst, "s6", null) ? null - 20 : true ? total : fact, {a: y("s7", true, "s5"), b: total.f()}];\nfunction total(h, x) {\n  n = (n) => null ? 70 : acc;\n  let total = null;\n  let h = total();\n}\ng([h]);\nconst y = (fact) => x();\n\nnull < lst.total();\nlst(acc.n(acc * h), []);\n// TODO\nfor (const h of 71) {\n  function h(n, y) {\n    return total({a: true, b: true}, "s9" === 69);\n    y = true;\n  }\n  lst(true, n(acc(), true, lst), g.h(lst(total, null, "s2"), n("s3")));\n}\nvar total = h(acc(), "s2" - 9 * lst, f(x(35, "s0")));\nvar g = 11 + true;\nlst.x(fact.fact(true, h)) - g(null);\n(lst) => [];\nconst {\n  getWebpackBundleConfig,\n} = require("@bootstrapworld/cmb-toolkit/lib/webpack");\n\n// dist/codemirror-blocks-min.js: the editor, with no language, for a page that\n// loads it with a <script> tag (a language is another file: see wescheme, ...)\nfunction h(n, n) {\n  acc = y();\n}\n\nfact;\nlet n = y() ? true : ["s9", [true]];\nif ("s8" ? 90 : null + [true, 21]) {\n  if (g(x * true, h("s7", 47, null), n.total(total))) {\n    ({a: null - total("s2", total, null), b: (total) => 82});\n    const total = 73 < total();\n  }\n  if (acc(g * "s3")) {\n    var n = 55;\n    total = y("s0", total, 48) ? (fact) => null : y();\n  } else {\n    const acc = 40;\n    [15 ? (acc) => lst : [true, 14], null];\n  }\n  if (true) {\n    let lst = n();\n  }\n}\n\n// TODO\ny = "s4";\n// note\nif (x(null)) {\n  ({a: true, b: lst()});\n  if (lst()) {\n    var h = {a: (n) => h ? null : null, b: true};\n    true ? null : 69;\n    const n = lst(y.y(), y(total.y(21), (fact) => 92), 87);\n  }\n  true;\n}\n\n// TODO\nfor (const fact of total("s5", "s6")) {\n  h.x();\n  if ("s8" - total ? {a: 39, b: null} : null + x) {\n    [fact(null, true) ? 2 ? total : x : h("s8", "s7")];\n    var g = [null, (g) => null - true];\n    x = fact();\n  }\n  12;\n}\nfunction n(x, lst) {\n  const f = acc(h.y());\n  function fact(lst, y) {\n    return h(acc());\n  }\n}\n\ntrue;\nn = null;\n"s6";\n\nfunction total(x, lst) {\n  if (total(n(23), null < y, "s1")) {\n    return total(true === null);\n    return 70 + 13 + 95;\n  } else {\n    return acc(null, 22 + h);\n  }\n  for (const fact of acc("s1", true, 6)) {\n    return h();\n  }\n}\ntotal({a: null + null, b: h(20, true, null)}, g("s5"), [true ? "s1" : null]);\nconst fact = (acc) => g(total ? g : null);\n\nvar n = acc() ? acc((n) => fact, fact, true) : acc(true, true < true, (f) => null);\nlet acc = fact(g(null, {a: true, b: null}));\nif (n(true < "s5", true - x, h())) {\n  f() ? true : ["s3", {a: lst, b: true}];\n  if (lst(true, "s8", true - fact)) {\n    h(f, "s1", {a: 29 ? true : "s8", b: null + total});\n    var x = null;\n  }\n} else {\n  h() ? 89 : fact({a: "s7", b: 0});\n  for (const total of 88) {\n    n((g) => null, lst(lst ? null : true, f(), [null, n, true]), fact([]));\n  }\n}\nlet n = acc();\n// a b c\n// TODO\nlet lst = true;\nif (x("s9", true - "s5", h())) {\n  while ("s7") {\n    let n = 8 ? 68 ? (total) => null : true : acc;\n    let x = 93 + true;\n  }\n  lst.acc(true < true ? x(75, f, true) : null < "s2", f());\n}\nfor (const lst of lst()) {\n  let x = true ? 67 : n ? n : 93 + x(38);\n  let n = y(57, {a: h(76), b: [null, "s4", 67]});\n  var lst = total < null ? y(null, 6) : h("s7") ? [g.g(null), (y) => true, [46]] : g(null ? null : null);\n}\nvar total = true;\ng.x();\n// note\nfact;\nfunction x(y, acc) {\n  if (g(total(), lst("s4"), acc("s9"))) {\n    null ? n(y()) : "s9";\n    return [total < 46];\n    "s1" - g(true) ? [f(h, 23), {a: "s7", b: "s6"}, f()] : 97;\n  }\n  ["s4", null ? x(x, 95, fact) : n("s6", "s5", 75)];\n  while ({a: true, b: true} ? x() : g(null)) {\n    g = n.acc(x());\n    const x = [true, ["s8", "s4", true]] === lst;\n    return null;\n  }\n}\n[];\n// note\n({a: "s9", b: total(acc.f(42, null))});\n// TODO\n"s7";\nvar x = [x()];\nif (lst(n ? true : 72)) {\n  var y = total - g(true);\n} else {\n  let x = 20;\n  if ((total) => (n) => null) {\n    let g = [12, "s5" ? y : null, f] === lst(true ? x : true, true ? total : true, "s1");\n    const h = null;\n    acc;\n  } else {\n    x = (total) => null;\n    total;\n  }\n}\n// note\nlet h = (fact) => n();\nconst url = (name) =>\n  "data:audio/mpeg;base64," +\n  fs.readFileSync(path.join(dir, name)).toString("base64");\n\nfor (const n of ["s9", null]) {\n  const acc = 22;\n  [16];\n  if (lst([true, f], "s2", true)) {\n    var y = n();\n    var g = acc();\n  }\n}\n// TODO\n"s9";\nfor (const n of "s0") {\n  for (const acc of 37) {\n    var lst = fact();\n  }\n  while (g()) {\n    "s7";\n    let f = total();\n  }\n  (g) => null;\n}\nlst([total("s6", 37, "s5"), (f) => null], fact(x(null, null, null), [h, 40, null]));\n\nn();\n// TODO\nif (x("s2") * "s0") {\n  [];\n  while (y("s1", y(null, "s3", true))) {\n    (total) => acc() ? [fact("s5", "s4", null), {a: true, b: 30}] : [(n) => true, lst + true, null];\n    const lst = null < {a: lst ? null : "s2", b: {a: h, b: 31}};\n    total(true);\n  }\n  (acc) => n.n() === f.f((y) => "s4", null);\n}\n\nlet x = 1 + 2;\nf(x, 3);\nwhile (x < 9) { x = x + 1; g(x); }\n// note\nfunction h(f, f) {\n  acc(n());\n  var n = f(49, null, "s3") - true === h;\n}\nconst REDUXFN =\n  /useSelector|useSyncExternalStore|selector|dispatch|subscribe|getSnapshot/i;\n\n/** Self time (ms) per bucket, plus inclusive time of some named functions. */\n// TODO\nfunction h(n, n) {\n  if (g.g(fact(null, null, "s2"), [null, true])) {\n    return lst ? "s0" : true ? 45 : "s4";\n    total;\n  }\n}\n// note\nfact = null;\n\nwhile (y(14) - h) {\n  let h = lst((x) => true + null, acc());\n  const x = [true, y.y(lst(31, true), true + lst), n(total - x)];\n}\n// TODO\nif (true) {\n  null - true < true;\n  if ([fact.f(acc), true < 7, null]) {\n    ({a: null, b: "s2"} === (g) => "s1" === null);\n    const f = [acc, "s4"];\n  }\n}\nconst lst = "s2";\n(n) => true ? x("s6") : lst();\n\nconst n = h(lst()) - acc;\n\n// a b c\nfor (const f of true) {\n  var acc = f(f({a: 16, b: "s2"}, "s1", y(87)));\n  [] === {a: y(total, x), b: true};\n  let n = "s3" ? null : true === total < 51;\n}\n\nfunction h(n, fact) {\n  if (fact(null)) {\n    lst();\n    let fact = fact();\n    return x();\n  } else {\n    return 39 ? "s5" : "s0" ? h : fact("s8", f);\n    return n.acc();\n  }\n  let acc = [n, f(), [] * lst ? 25 : 0];\n  var acc = f([g(48), null, total], total({a: "s8", b: "s7"}, [8, true], lst(true, null, "s9")));\n}\nfact = {a: null ? 28 : "s7", b: 80};\n// TODO\nfunction g(n, n) {\n  const total = [49] ? [null < 5, null] : [g(), [x], lst("s0", 63)];\n}\n',
      steps: [
        { op: "longPress", a: 0.2919252801220864 },
        { op: "scroll", a: 0.5142889388371259 },
        {
          op: "touchDrag",
          a: 0.8555232672952116,
          b: 0.4522918045986444,
          where: "end",
        },
      ],
      motion: "full",
      editor: {
        lineNumbers: true,
        lineWrapping: false,
        collapseAll: false,
        reconcile: true,
        anchors: true,
        fastErrors: true,
        skipRoots: true,
        activityLimit: null,
      },
    } as Sequence,
    { baseURL }
  );
  expect(v).toBeNull();
});

test("soak seed 4334: a block dragged by a finger leaves no `blocks-hole` mark on a blank that CodeMirror took out of the page during the drag (the renderer kept it and drew it again marked)", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 4334,
      language: "javascript",
      code: 'let total = g;\n// a b c\nvar f = h();\n// note\n({a: lst(fact, y.acc(true), total()), b: x("s4", null === 63, x)});\nif (null) {\n  g = "s7";\n  h({a: n(), b: "s4" === null});\n}\n// a comment\nfor (const x of [1, 2, 3]) {\n  total = total + x;\n}\nconsole.log(total, "done");\n// TODO\nfact(f(n("s4", g, 72), 9, acc(null, null, null)), y.g(y(null, "s2"), h(69)), f ? lst() : y(x, 41));\n15;\nh(acc.x(), (n) => 63 === acc, true);\ny.x() === n();\n\n// a b c\nconst acc = "s7";\nconst h = fact(total(), "s6", "s4");\n// note\nx = x("s4", f(11, true), true);\nh(y(["s0", true, "s1"], "s1"), true - g(), {a: 3, b: x});\nconst REDUXFN =\n  /useSelector|useSyncExternalStore|selector|dispatch|subscribe|getSnapshot/i;\n\n/** Self time (ms) per bucket, plus inclusive time of some named functions. */\nconst lst = h(y(true), "s8", g + true);\nfunction lst(acc, f) {\n  if (n) {\n    return n(fact(29), f("s0", 85, acc), f(acc, "s5", 42));\n    return y();\n    let total = {a: total, b: lst()};\n  } else {\n    return acc.fact("s5" ? acc : null);\n    return (fact) => g(6, "s9");\n  }\n  if (lst.g()) {\n    x.lst();\n    return acc(y);\n    y = y(null) + "s4";\n  }\n  f = (y) => null ? true : null;\n}\nif (g("s3", null)) {\n  total = g;\n}\nwhile (g(null) ? "s2" : (n) => null) {\n  if ((x) => f(null, null, "s2")) {\n    g = true;\n    fact(lst(total()), true ? true : 86 ? (y) => null : total("s3", true), total());\n  }\n  total = total() ? h() : total.y();\n}\nif (acc.n()) {\n  if (null) {\n    let y = acc();\n    f.y(26, []);\n  } else {\n    var fact = acc(lst ? 47 : total, g(), lst + null) ? null ? n : null * 60 : 98;\n    ({a: f([], 10 ? null : true, f), b: 24});\n    var fact = acc(71, null === 34 === 37);\n  }\n  const y = (total) => ({a: null, b: (f) => null});\n} else {\n  const acc = h.y();\n  let x = [total(74) ? (lst) => 48 : total, 27];\n  f = lst({a: y, b: fact}, h ? fact : null);\n}\n\nfor (const h of acc(null, 79, g)) {\n  for (const x of null === true) {\n    let fact = y.f(true === "s2", {a: total(), b: acc(n, "s8", "s0")});\n  }\n  var acc = x(true, g(true, n, 21) < total.acc("s0", true), true);\n}\n\n// TODO\nh = {a: (n) => g, b: f()};\nif ([]) {\n  for (const g of true) {\n    var h = x(true, x(n(true, "s3", 67), 10 - 85));\n  }\n  fact = true;\n}\n// a b c\n9;\nlet x = "s6";\nn = total(y("s8", true), true);\nwhile (x((lst) => 90)) {\n  while ([y(lst), [null, acc, null], g(null, true, true)]) {\n    98;\n  }\n  while (f(total())) {\n    var n = true - "s9" < [null, "s5", "s2"];\n    const x = total(y(total), f(x, true), "s8");\n    y({a: h(true), b: [lst, f, "s8"]}, "s6");\n  }\n}\nh(g(26 ? true : null, g.y(h, "s0")), h(lst(g, true), acc(76), y));\n// TODO\nfor (const h of null) {\n  acc({a: total, b: n}, [null, true]) ? null : {a: null ? acc : "s9", b: "s1"};\n}\nlet fact = true;\n[36] ? h(76, total.g(total, y)) : true;\nf.n(lst(25, (total) => f, g.f("s2", "s8")));\n\nfor (const fact of g()) {\n  let h = true;\n  let x = h();\n  const lst = g.total(fact, "s8") - {a: acc(true), b: []};\n}\nlet acc = [];\nfor (const acc of null ? "s3" : true) {\n  "s8";\n}\n\n// a b c\nn();\n\n// TODO\nif (lst(acc(29))) {\n  h.lst((lst) => h) ? (h) => n(null, "s5", true) : "s6";\n  if (acc(48)) {\n    var f = lst;\n    let g = f;\n  }\n  let x = (x) => lst("s6", "s7" * 85);\n} else {\n  while ({a: "s1", b: [fact, true]}) {\n    var n = total(lst(null, "s3" ? true : 74), lst());\n    var x = g();\n    acc;\n  }\n  if (true) {\n    [];\n  } else {\n    var lst = {a: fact < 82 ? 1 : null === true, b: x(f(n, "s2", null))};\n    n(x === 95);\n    [{a: 42, b: fact(null)}];\n  }\n  for (const acc of (lst) => 23) {\n    var acc = fact();\n    let n = fact(y, total(62, true, true) ? 53 < 87 : acc(x, 31));\n  }\n}\n\n({a: ["s9"], b: {a: 51, b: 82} === f()});\nlet n = acc(total(true, fact(null, true, null)), g(lst(53, null, 70), (acc) => true, (x) => null));\n({a: {a: y.acc(true), b: y("s3")}, b: "s0" ? g + g : {a: "s1", b: true}});\n// TODO\nfunction f(a, b) { return a * b; }\nf(1, 2);\nif (x) { f(1, 2); } else { g(); }\n\nwhile (f(y)) {\n  for (const g of (y) => null) {\n    75;\n    const fact = x.g(acc, lst(16 - null, []));\n    total = null * x(true);\n  }\n}\nh();\n"s1" === x((y) => acc);\ng;\n(lst) => [h(), [null, null]];\nf(fact(null === null, true), lst(y, "s5") ? {a: "s9", b: 39} : (g) => true);\n// a b c\nlet acc = 78 + null === true;\n// TODO\nif (null ? true + true : null) {\n  8;\n  null;\n  for (const acc of h.x()) {\n    total();\n  }\n}\n\nfact.n(acc(52, "s6")) ? [] : {a: y(), b: g(55, null)};\n\ntotal = true ? 66 : 19 ? fact(null) : fact(35);\n[true, [true, "s0", 62]] ? {a: fact(null, 50), b: null} : g(acc(), total, g());\nfunction fact(x, x) {\n  [];\n  while (f.fact()) {\n    const g = total("s3", x) < acc("s7") ? 4 : {a: 98, b: "s0"} < {a: 14, b: "s8"};\n    g(total, h.f("s8"), acc(acc)) ? y(fact === null) : acc();\n    total = null * "s8" === "s9";\n  }\n  while (h()) {\n    "s0" ? h() : y(fact ? 34 : x, n(true, null, total));\n    lst = 92 ? total : x(null);\n    return y;\n  }\n}\nfunction n(g, total) {\n  h = "s6";\n}\nwhile (total(h(), acc(y, acc), 56 + "s2")) {\n  if (total()) {\n    total = 83 * fact(y, "s2", null);\n  } else {\n    f = "s7";\n  }\n  const lst = (y) => true;\n  let h = acc();\n}\n\n// TODO\nvar lst = y((y) => true, fact.n(true)) + total() + [61, 20];\nconst x = total();\ntotal("s4") ? null : fact();\n\n// note\nlst = y;\n// a b c\nfor (const x of acc) {\n  let lst = [] - acc(h(y, null));\n  n < acc("s0" ? null : 10, f(true, "s7", y), true);\n}\nf(fact.n(), (total) => null, h.g()) * {a: f * "s4", b: (n) => "s1"};\n\nx = [lst ? x : null, lst ? null : true, {a: 61, b: 62}];\nif (n(x(null, "s3", "s5"), total("s5", null))) {\n  if (null * 87 ? true : h(null, 90)) {\n    var acc = true;\n    let x = g();\n  } else {\n    var total = null;\n    (x) => "s6";\n  }\n}\nn ? (fact) => lst(true) : null;\n// TODO\nconst x = f() ? 2 : null < [19, null];\nconst fact = null;\n[];\nfunction x(n, total) {\n  while (true) {\n    return (lst) => true ? 85 : g();\n    x.x();\n    92;\n  }\n  x();\n}\nlet total = "s8";\nvar acc = g([acc], y()) - null;\n\ng(true, "s6", {a: true, b: true}) < (f) => null ? "s5" : 19 + lst;\nh(true, {a: 64, b: 55} < [lst, null, "s2"], null + n * true);\nif ([y(), [h, x], (total) => true]) {\n  acc;\n  for (const f of n) {\n    acc.total(acc ? 97 : n(null));\n    const total = (y) => fact(h(92, null), lst());\n    const y = null ? true ? f() : y === 43 : "s7";\n  }\n  const total = fact(total(), true, true);\n}\n\nvar acc = n(n, y(70, 42, lst) ? [] : n - 40);\nlst(11, "s9", 87 - n) ? [] : total.g() ? true : true + null;\nlet total = total(f(), (fact) => "s9", 21) < 86 < h - f();\n43;\nvar fact = total(h(fact * n, 52, null));\n\nconst lst = [true, {a: null, b: n(fact, true, f)}];\n// TODO\nwhile (true) {\n  const h = f(95, g(total, null, "s4") ? true : [null, null, true], x(acc(null, 38, total), total * x, g(true, "s6", true)));\n  for (const y of acc(null, true, 14)) {\n    lst();\n    fact.n();\n  }\n}\ntrue;\nacc() + true;\n// TODO\nfunction total(y, lst) {\n  function lst(acc, f) {\n    return 20;\n    lst((g) => f("s2"), n());\n    return f({a: true, b: 76}, true);\n  }\n  var fact = total(null);\n}\ny(87, total(x.f(34)));\ng = (g) => h.f(null, "s6");\n[true] * total;\nvar n = total.total();\nfor (const n of {a: lst, b: total}) {\n  [];\n  while (n(null, true, "s0") ? null : fact(n)) {\n    acc;\n    null - f((h) => lst, fact("s2"));\n  }\n  if (n(total)) {\n    const total = fact.fact();\n    let y = y;\n  }\n}\n// note\nfunction g(total, lst) {\n  let y = true ? n([null, "s8"], null ? "s7" : true) : x({a: null, b: "s1"}, acc.g(), total());\n  let g = f.n([47 === total, total.n("s3", null)]);\n}\n// a b c\nfunction x(y, x) {\n  f = total();\n  function lst(g, g) {\n    [y, g(null)];\n    return [h(82, null, true), x.f(total), {a: "s2", b: 84}];\n  }\n}\nwhile ("s5") {\n  const x = [] * h(null);\n  for (const f of "s4") {\n    const lst = (x) => acc();\n  }\n}\n// note\nwhile (g(null < h)) {\n  f({a: f("s1", "s5", 18), b: 59 ? 59 : null});\n  const y = null;\n}\nlst = "s6" * total;\nfact(lst(n()), acc.acc(g()), true - 64 === y);\nwhile ([x()]) {\n  function g(acc, f) {\n    return f(g(), fact(19, 41));\n    lst((x) => null < true, true);\n  }\n  if ((acc) => y * 98) {\n    let x = true;\n    let h = x();\n  } else {\n    const total = (fact) => fact(true, "s6") + {a: lst * "s1", b: true ? true : 22};\n  }\n}\nif (null) {\n  acc(total(n(null, "s4", "s8")));\n}\n\n// a b c\nconst flag = (name) => args.includes(`--${name}`);\nconst opt = (name) => {\n  const i = args.indexOf(`--${name}`);\n  return i === -1 ? undefined : args[i + 1];\n};\nfunction f(a, b) { return a * b; }\nf(1, 2);\nif (x) { f(1, 2); } else { g(); }\n[[null], "s6", "s6"] * 17;\n// note\ny;\nh.f(lst()) ? 43 : acc(acc(49));\n[h < true === fact.n(true, 22), h(lst, ["s3", null, "s3"])];\n// TODO\nlet f = true;\nfunction f(a, b) { return a * b; }\nf(1, 2);\nif (x) { f(1, 2); } else { g(); }\nvar acc = lst(lst(49, null) ? y(n) : (acc) => null, null, true);\n\nlet x = total();\n\n// TODO\nfor (const y of null) {\n  f;\n}\nvar f = {a: 94, b: true};\nfor (const y of (fact) => null) {\n  let y = 72;\n}\n\nwhile (61) {\n  fact = n({a: null, b: true});\n  function h(fact, lst) {\n    return n();\n  }\n  const fact = "s8";\n}\nvar acc = 18;\nx(h.total());\n\nconst f = lst.x([true, h * true, null], true);\nwhile (acc) {\n  total < "s7" ? {a: "s7", b: 38} : null;\n  80;\n}\nfunction g(n, acc) {\n  for (const lst of 29 + true) {\n    return [null, {a: true, b: "s2"}];\n    f = "s0" ? null : 16 + "s7";\n  }\n  if (y(true, true + 35, 81)) {\n    let lst = h(acc(null, {a: "s4", b: 71}), g(null), fact(true < "s2", fact(91, fact), lst(true, "s9", g)));\n  }\n  if (x) {\n    x((acc) => null * 82);\n  }\n}\nconst acc = f(null, lst(24, true, true) * 90);\n\n// a b c\nif ((g) => "s3" ? h(null) : null < "s9") {\n  "s3";\n  "s9";\n} else {\n  function y(lst, fact) {\n    ({a: {a: true, b: "s1"}, b: {a: g(f, true), b: "s3"}});\n  }\n  for (const n of null) {\n    var lst = (x) => total.y(y());\n    let lst = null;\n    let x = ["s0"];\n  }\n  h(null, (y) => lst(fact, x, "s8"));\n}\nif (x(x(true), true)) {\n  while (x(null, null, true - 25)) {\n    let fact = [[true, "s7"], [65]] ? "s1" : [g()];\n  }\n  if (lst(null) ? lst() : h(48)) {\n    let total = acc;\n    total.fact(h.y("s1"), fact("s2"));\n    var total = h;\n  }\n  g(fact(0, y, true) ? ["s9", null] : "s4", x(40 ? null : true), f(true * null));\n} else {\n  const h = [1, 0 + null ? [] : (fact) => true];\n}\n\nif (acc(f) - "s7") {\n  var h = fact(91);\n}\n\nconst g = "s5";\n\nmodule.exports = getLanguageBundleConfig({\n  name: "example",\n  global: "CMBExample",\n  entry: "./src/index.ts",\n});\n\ny = acc(60) * (x) => 98;\n[];\n// note\nwhile (y(h(g), acc("s6", true, 63))) {\n  y([null]);\n  h = n();\n}\n// a b c\nif ([[acc, acc], "s1"]) {\n  total;\n  const g = x;\n  if (4) {\n    var g = lst();\n    var fact = x();\n  }\n}\ng(44, f((fact) => "s0"), total((fact) => 78, 29, null));\ng = n("s1" < 43);\n// TODO\nacc = "s2";\ndescribe("results of a worker", () => {\n  const lines =\n    JSON.stringify({ seed: 1, ok: true }) +\n    "\\n" +\n    JSON.stringify({ seed: 2, invariant: "focus", steps: [{ op: "key" }] }) +\n    "\\n" +\n    \'{"seed": 3, "ok"\'; // (cut: the worker was killed in the middle of a line)\n  test("passed, failed, and what was done", () => {\n    const r = lib.readResults(lines);\n    expect(r.passed).toBe(1);\n    expect(r.failures.map((f) => f.seed)).toEqual([2]);\n    expect([...r.done]).toEqual([1, 2]);\n  });\n  test("the first seed that was not done is the one that was running", () => {\n    expect(lib.missingSeeds([1, 2, 3, 4], lib.readResults(lines).done)).toEqual(\n      [3, 4]\n    );\n    expect(lib.readResults("").done.size).toBe(0);\n  });\n});\n\nacc = n;\ny();\nlet x = true;\n(total) => (total) => "s2" - {a: true, b: h};\n\nlet x = 1 + 2;\nf(x, 3);\nwhile (x < 9) { x = x + 1; g(x); }\nconst chooseEngine = () => {\n  if (engines.length === 1) return engines[0];\n  const chromiumRunning = [...jobs].filter(\n    (j) => j.engine === "chromium"\n  ).length;\n  if (opts.alternate)\n    return !chromiumRunning && startedBatches - lastE2e >= opts.e2eEvery - 1\n      ? "chromium"\n      : "jsdom";\n  // both at once: Chromium gets about a third of the slots, at most --e2e-cores\n  return chromiumRunning <\n    Math.min(chromiumCap, Math.max(1, Math.ceil(limit() / 3)))\n    ? "chromium"\n    : "jsdom";\n};\n// TODO\n({a: (x) => "s7", b: fact([fact], [x], 52)});\nconst g = true;\n\n[g.lst(true), acc(23), h < "s0"] ? y.acc() : f;\nvar y = h(g("s9"), null, g(g, acc(true, 42), g));\nif (null) {\n  if (true) {\n    var n = f((total) => [true, true]);\n    [lst("s5"), h.y(null, null), "s8"];\n    let lst = "s0" ? acc() : {a: [66], b: y()};\n  } else {\n    let g = "s2";\n    const y = true === 54;\n  }\n  function acc(g, fact) {\n    y.y(39);\n    acc(null ? null : null ? lst(null, true) : fact(true, true, 28), (total) => true < y, "s9");\n  }\n} else {\n  function h(fact, h) {\n    return true;\n    [n(16, true) < f(), g.f()];\n  }\n  h;\n}\na.b(c);\n[1, 2, 3];\nlet y = 5;\nmodule.exports = [devServerConfig, bundleConfig];\n\nimport eslintReact from "@eslint-react/eslint-plugin";\nimport reactHooks from "eslint-plugin-react-hooks";\nimport prettier from "eslint-config-prettier";\nimport globals from "globals";\n\nwhile (acc.total()) {\n  var lst = true ? 42 : 6 < true < x();\n}\nif (total(y, g("s4", 58, null))) {\n  ({a: {a: null, b: 38}, b: {a: "s6", b: true}} + {a: true, b: true < null});\n  if (y()) {\n    acc = lst.lst();\n  } else {\n    var g = total(true, {a: 56, b: g} + 9);\n    y;\n  }\n} else {\n  function g(lst, lst) {\n    x(80, [true, "s6"] + n.total(y, "s5"), true);\n  }\n}\nif ((g) => true) {\n  while ((f) => f) {\n    let acc = (h) => true;\n  }\n  let f = n.total(n) * lst();\n}\nmodule.exports = require("../codemirror-blocks/.babelrc.js");\n\n// note\nif (acc.total()) {\n  const f = true;\n  var y = fact(x("s0" - y, "s3"));\n} else {\n  [[]];\n  fact = h.acc(null * 40, n());\n  var x = null * true < lst.fact("s6", null) ? h(true) : x.h() ? 50 : ["s5", true];\n}\nvar x = {a: (lst) => y(), b: "s4"};\n// TODO\nfunction n(f, x) {\n  lst;\n  n = null;\n  lst = h([total, lst, true]);\n}\nx = lst ? "s7" + acc : acc("s4", "s4", "s5");\nn("s0", 90, n(total(99, "s7"), h(60, 90, null)));\nconst {\n  getWebpackBundleConfig,\n} = require("@bootstrapworld/cmb-toolkit/lib/webpack");\n\n// dist/codemirror-blocks-min.js: the editor, with no language, for a page that\n// loads it with a <script> tag (a language is another file: see wescheme, ...)\nclass A {\n  m() {\n    return 1;\n  }\n}\nnew A().m();\nfunction h(acc, n) {\n  acc = acc(true, n(true));\n  var acc = ["s9"];\n}\nfunction f(a, b) { return a * b; }\nf(1, 2);\nif (x) { f(1, 2); } else { g(); }\n// note\nlet x = 1 + 2;\nf(x, 3);\nwhile (x < 9) { x = x + 1; g(x); }\nacc.y([y ? null : "s3", acc === null, fact * null]);\nvar x = true;\nif (fact(x())) {\n  const h = {a: 53, b: h(fact(null), x(null, true))};\n}\nconst {\n  getWebpackBundleConfig,\n} = require("@bootstrapworld/cmb-toolkit/lib/webpack");\n\n// EXPERIMENT: the editor for a <script> tag, with Preact in place of React (which is\n// most of the bundle: react-dom is half of codemirror-blocks-min.js). Everything\n// that asks for react or react-dom gets preact/compat. Not the build that is shipped.\n// note\nx = "s2";\nfor (const x of total(98, "s9", lst)) {\n  99 ? "s9" : "s6" ? total.acc() : true ? null : "s1" + acc(x, n.total());\n}\n// a b c\nwhile (true ? 15 : "s9" === (acc) => n) {\n  if (g ? g : 23 < 87) {\n    const h = {a: total(), b: (fact) => 90};\n    const lst = lst(6, (x) => g) < acc(true, total());\n    y(10, true);\n  }\n  true;\n}\n\nconst base = require("../../../packages/codemirror-blocks/webpack/example.config.js");\n\nconst group = (name, test, priority = 20) => ({\n  name,\n  test,\n  chunks: "all",\n  priority,\n  enforce: true,\n});\n\nasync function main() {\n  for (const { from, to, prepend } of targets) {\n    const file = path.join(root, from);\n    const source = fs.readFileSync(file, "utf8");\n    const result = await less.render(source, { filename: file });\n    const dest = path.join(out, to);\n    fs.mkdirSync(path.dirname(dest), { recursive: true });\n    fs.writeFileSync(dest, (prepend ? prepend() + "\\n" : "") + result.css);\n    process.stdout.write(\n      `lib/css/${to}  ${Math.round(result.css.length / 1024)} KB\\n`\n    );\n  }\n}\n\nlet f = n();\n\nfunction n(x, n) {\n  let h = [] ? n : null < n * null;\n  var f = true;\n  null ? fact.x() : [];\n}\n// a b c\nfor (const n of true) {\n  const fact = true;\n}\nvar total = x(acc("s5", lst(), f()));\nfunction lst(g, n) {\n  const total = f.y(null) ? h.total(h) : h(total("s6", "s7"), (n) => true);\n  lst.f((acc) => (n) => null);\n  var n = 19;\n}\n\nlet fact = "s3";\nf() ? fact((acc) => 22) : "s5";\n// a b c\n({a: g(true, fact.fact(), true), b: [f.n(n), (lst) => "s3"]});\nfunction fact(h, y) {\n  return true;\n  total.fact(lst("s8"), []) < true;\n  const y = (y) => f(y.x(true, acc), n(h));\n}\nfunction total(lst, h) {\n  [];\n  var fact = x;\n}\nlet y = "s4";\nconst acc = y(total(g(24), y(true, f, acc)), x(null, null) === true, total ? 95 : true === acc());\n// a b c\nconst fact = {a: "s6", b: f() ? x() : (f) => true};\nlet x = 1 + 2;\nf(x, 3);\nwhile (x < 9) { x = x + 1; g(x); }\n// a b c\n// note\nfor (const fact of null) {\n  f({a: 35, b: 0}, 24 ? 9 : null) + ["s6" * fact];\n  g = acc(null, n, null) === lst.n(null);\n  "s5";\n}\nvar total = "s8";\n// a b c\nh = lst ? "s9" ? 45 : null : {a: acc, b: "s4"};\nfor (const f of 98) {\n  var f = x() ? "s3" - {a: 74, b: true} : true;\n  if (lst(null, 58, y) ? 39 < "s7" : x()) {\n    var g = n.x(lst, 40);\n    (acc) => "s5" === y("s3");\n  } else {\n    const x = [[] ? "s8" : fact];\n    h("s8", 73);\n  }\n}\nacc(acc(x(true, f)));\nfunction x(f, acc) {\n  f(fact.total(28 === "s6"), f("s4" - true, {a: null, b: null}), "s6");\n  function g(fact, f) {\n    return [[], acc(f, f, x)];\n    const h = f;\n    return (y) => n;\n  }\n  if ((x) => "s5") {\n    const y = lst.h(x(), n);\n    var g = null;\n    const x = fact("s3", 42 * true) - f();\n  }\n}\nif (x([f, lst])) {\n  var h = "s3";\n} else {\n  lst(null - 21, fact, "s9" * null) ? 59 < "s0" ? f : g : true - null + "s0";\n  null;\n  for (const y of [true, 74]) {\n    x = y.f();\n    let x = f();\n    let total = null;\n  }\n}\n// note\ntrue + x() === x("s7", "s2", 99);\n// a b c\nx = x((n) => 80, null);\n\n// a b c\nif (true) {\n  let lst = (h) => null;\n  let fact = [{a: (h) => 83, b: [fact, null, acc]}];\n}\n\nvar fact = f(78, {a: total, b: "s3"}, null ? 6 * "s1" : 52 ? "s1" : fact);\n({a: f, b: y("s9", true * f, g())});\nlet y = [true, lst.lst(52 === true)];\n[null ? y : h, "s7"] < total("s7", fact, acc) ? (y) => "s2" : null;\n58;\n// TODO\n99;\nif ({a: g.acc(), b: true}) {\n  true;\n  h();\n}\nif (total(h.g(n))) {\n  lst([null, true ? "s3" : "s7", "s6"]);\n}\nvar h = true ? "s7" : [acc(), true, total(h, true, null)];\nif (null) {\n  const x = 68;\n  x = (y) => g.f();\n} else {\n  acc.x(total([null]), total());\n  if (true) {\n    const h = true;\n    g = null ? total : f;\n    let acc = 67 ? fact : 99;\n  } else {\n    n ? "s5" : 92 ? true ? "s2" : 92 : lst(null, g) + null;\n    g.f(n());\n  }\n}\nwhile ("s1" - null) {\n  acc([68, "s0"], x, (x) => y) ? [acc, "s7"] < f(x) : true;\n}\n// note\nlet h = [];\nconst lst = fact((fact) => 38, n.g(true)) ? true - x() : acc(true ? acc : true, (g) => "s9", (g) => true);\n\n// TODO\nh(true, total(16 ? total : "s4", "s8"), lst(acc.acc("s5", 39), lst(39, g)));\n// note\nnull + acc(90) ? null : n.f(true, total) - [];\nx();\n\nconst acc = 34 ? "s6" : {a: n(acc, "s8", null), b: 50};\nvar fact = "s5";\n\nfor (const h of 75 * "s9") {\n  fact = n(true, 35 ? "s4" : h);\n  function y(fact, f) {\n    return 12;\n    return (h) => total ? acc(true, fact) : n ? h : "s8";\n    n(f(fact(69, true, 57), "s8"));\n  }\n}\nmodule.exports = [devServerConfig, bundleConfig];\n\n// note\n(fact) => true ? "s9" : 21;\nfor (const total of total < 10) {\n  if (x(18 ? 85 : 3)) {\n    var acc = 81;\n    var n = n;\n    const total = (lst) => (acc) => null ? g() : x("s9");\n  } else {\n    g = acc(11, h, "s3") ? "s3" ? 69 : acc : null - n;\n  }\n  fact = [];\n}\nfunction lst(fact, fact) {\n  var f = g;\n  while (x(87)) {\n    return fact(null) ? x : 52 ? "s7" : null;\n    total(lst(y - h, 83));\n    const x = {a: 4, b: [{a: "s7", b: null}]};\n  }\n}\nvar fact = fact;\nif (60 - fact(32, 37)) {\n  var x = g(58 ? y(true) : lst.n("s0"), fact(h()));\n  const f = acc([true, null], "s6", (fact) => g) - (total) => "s4";\n}\nwhile (total() ? x(36, 76) : g.y(null, "s7")) {\n  var f = g.acc();\n}\nconst x = y({a: (f) => 26, b: total(18)}, lst());\nconst x = acc;\nvar f = "s5";\n// a b c\nlet n = h.h(f(78 * true, "s7" ? "s9" : h));\nvar total = n();\n// a comment\nfor (const x of [1, 2, 3]) {\n  total = total + x;\n}\nconsole.log(total, "done");\ny(lst(n(), true), "s4", [x(y, g)]);\nmodule.exports = require("../codemirror-blocks/.babelrc.js");\n\nconst path = require("path");\nconst root = path.join(__dirname, "..", "demo");\nconst types = {\n  ".html": "text/html",\n  ".js": "text/javascript",\n  ".map": "application/json",\n};\n// a b c\nvar n = n();\n// note\nf();\nif (h()) {\n  if (acc()) {\n    fact();\n  } else {\n    let acc = fact(fact());\n  }\n  ({a: true === "s0" * null, b: "s5"});\n  if (f(true, (x) => 93, f.h())) {\n    const acc = y.fact(g(null)) + [] ? true : null < true;\n    let n = n < h() + n();\n  }\n} else {\n  let fact = fact(f(), n(acc, x("s7")));\n  ({a: total.g("s3"), b: fact(true, null)} ? true : f(null) === []);\n  acc = x(1 ? null : h, n(f, "s2", 61), fact(98, null));\n}\nf(g());\n\nn = true ? 59 : "s1";\nconst flag = (name) => args.includes(`--${name}`);\nconst opt = (name) => {\n  const i = args.indexOf(`--${name}`);\n  return i === -1 ? undefined : args[i + 1];\n};\n// a b c\nfunction fact(total, total) {\n  if (29 ? "s7" : null ? fact.lst(g, true) : 15) {\n    return y;\n    var total = 98;\n    return (h) => [];\n  }\n  let fact = lst.lst({a: total.total(), b: x("s9", 68)});\n}\ntrue;\n\nvar acc = lst.lst();\nconst fact = "s8";\ntotal();\na.b(c);\n[1, 2, 3];\nlet y = 5;\na.b(c);\n[1, 2, 3];\nlet y = 5;\nvar g = y({a: null - true, b: {a: g, b: acc}}, "s5");\nlst.n(g.g());\n// note\n(total) => true;\nvar total = (h) => f("s2" - "s7");\n\nif ((f) => null) {\n  function fact(n, fact) {\n    const g = "s1" === y;\n    lst(null, 85 < true) < f;\n    const total = [h(84 ? 3 : null, null), acc(y(true, total), x(true, "s4"), null ? null : "s8")];\n  }\n}\nlet acc = fact;\nconst lst = true;\nfor (const lst of {a: y, b: "s0"}) {\n  let g = "s5" ? 79 ? null : 63 : fact() + lst() ? "s1" === null : ["s7", lst];\n  null;\n}\n\nwhile ((f) => "s9") {\n  while ((g) => total ? true : x) {\n    y({a: n(null), b: true === lst}, 86, f);\n    const x = g(h(true === "s6", true));\n    var y = x(x(acc.total(), true), y(), f("s0", true, null) ? total.f() : lst(true, fact));\n  }\n  const h = y.h();\n}\nfunction lst(g, total) {\n  function acc(n, g) {\n    return (acc) => x.lst(h, true);\n  }\n}\n\nconst validAction = (a) =>\n  !!a && (Object.hasOwn(EVENTS, a.type) ? EVENTS[a.type](a) : validState(a));\n\nconst validState = (a) =>\n  ACTIONS.has(a.type) &&\n  (a.type !== "SET_AST" || typeof a.code === "string") &&\n  (a.type !== "SET_BLOCK_MODE" || typeof a.enabled === "boolean") &&\n  (!["COLLAPSE", "UNCOLLAPSE"].includes(a.type) || Number.isInteger(a.nid)) &&\n  (a.type !== "SET_FOCUS" || a.nid === null || Number.isInteger(a.nid));\n\n/**\n * The report in an issue body: `{ report, warnings }`, or `{ skip }` with the\n * reason when there is none we can use (an old-format issue, a block that\n * does not parse, the wrong shape).\n */\nlet x = 1 + 2;\nf(x, 3);\nwhile (x < 9) { x = x + 1; g(x); }\n// TODO\nn.n(true) + 4;\nn.acc(y(f(8, true, true)));\n// note\nx(lst ? fact : lst) ? {a: {a: 32, b: x}, b: "s4" + 56} : true - null;\n// a b c\nvar n = "s9";\nwhile (93) {\n  var total = (lst) => [];\n}\nfor (const h of lst(null, null)) {\n  fact(lst(fact("s2", "s5", true), h(), h(x, "s0", true)), 69);\n  for (const acc of ["s3"]) {\n    f();\n  }\n  ({a: f.x(true), b: acc});\n}\nlst(fact("s6", fact ? total : true), x(y(fact, null), fact(true, true), fact()));\n\n// TODO\nfunction fact(n, total) {\n  g = [h];\n  y("s4", true ? null : null === n);\n  [lst(null, null, 52) < (total) => "s6", [null, lst, true] ? [null, true] : {a: null, b: 58}];\n}\nwhile (h(88 ? null : true, lst < "s0", true * null)) {\n  acc = {a: fact(), b: y};\n}\nfunction f(a, b) { return a * b; }\nf(1, 2);\nif (x) { f(1, 2); } else { g(); }\nif (y.fact(g)) {\n  y(f(null, null), "s4", true);\n  [g(75, n) ? h : "s3", [(acc) => n, null + null, {a: x, b: f}]];\n}\nconst acc = [total - h * 33, g(total(true, true))];\nn([[true, null, "s2"], lst(true, true, true), f - "s6"], h({a: "s4", b: total}, 53 * lst));\n// a b c\nwhile ("s8") {\n  x.y({a: fact, b: (y) => y});\n  ({a: 22, b: "s8" ? "s7" : null ? "s4" < true : y});\n}\nn(total === y - x());\n\n// a b c\nfunction y(h, y) {\n  let y = x(g, 74);\n}\n\n// a comment\nfor (const x of [1, 2, 3]) {\n  total = total + x;\n}\nconsole.log(total, "done");\n\nwhile (true) {\n  function g(lst, g) {\n    acc = null;\n  }\n  for (const lst of h.total()) {\n    let h = acc(lst, 28, "s8") ? [41, lst] : {a: fact, b: "s1"} * [fact(81, 52), total(acc), (total) => null];\n  }\n  function g(n, lst) {\n    return true;\n  }\n}\n\nconst flag = (name) => args.includes(`--${name}`);\nconst opt = (name) => {\n  const i = args.indexOf(`--${name}`);\n  return i === -1 ? undefined : args[i + 1];\n};\n\n74;\n\nlet fact = x(null);\nwhile (y(70, h ? fact : "s7", "s2" ? 83 : fact)) {\n  "s8";\n}\ny;\nwhile (true) {\n  if (h(acc, true, "s1")) {\n    var acc = fact.total(null);\n    const g = acc.h() - "s4" - 46;\n    const h = {a: y(true ? "s2" : "s4", lst(), h), b: n()};\n  }\n}\n\nlet x = 1 + 2;\nf(x, 3);\nwhile (x < 9) { x = x + 1; g(x); }\nh = {a: n(true), b: "s2" * true};\nn("s8", g(null, x) ? 20 : acc("s1", 90));\nacc(64, h(g("s3"), null < null, total("s9")), x([], total(acc, null), [null]));\n\n[acc(n, 12 ? 19 : g, acc), f(), []];\nwhile (n(null, h(), 86)) {\n  total((h) => null ? 26 : null, y("s7", "s4", "s2") ? [] : ["s8", 24]);\n  function lst(acc, f) {\n    total("s3", acc(null, "s2")) ? [] : null ? h : y ? 91 : 4;\n  }\n  h(acc(), null);\n}\na.b(c);\n[1, 2, 3];\nlet y = 5;\n\ndescribe("promoting a failure to a regression test", () => {\n  const replay = JSON.stringify({\n    code: "(f x)\\n(g)",\n    steps: [{ op: "cut", r: [1, 2, 3, 4] }],\n  });\n  const records = [\n    { seed: 7, signature: "cut :: bad", problem: "bad", shrunkTo: 3, replay },\n    { seed: 9, signature: "cut :: bad", problem: "bad", shrunkTo: 1, replay },\n    { type: "crash", seed: 7 },\n  ];\n\n  it("finds a failure by seed or by signature text (the smallest)", () => {\n    expect(lib.findForPromote(records, "7").shrunkTo).toBe(3);\n    expect(lib.findForPromote(records, "CUT").seed).toBe(9);\n    expect(lib.findForPromote(records, "nothing")).toBeNull();\n  });\n\n  it("prints an it() in the format of the once-broke block", () => {\n    expect(lib.promoteCase(records[0])).toBe(\n      [\n        \'  it("seed 7: bad", () => {\',\n        "    check({",\n        \'      code: "(f x)\\\\n(g)",\',\n        "      steps: [",\n        "        {",\n        \'          "op": "cut",\',\n        \'          "r": [\',\n        "            1,",\n        "            2,",\n        "            3,",\n        "            4",\n        "          ]",\n        "        }",\n        "      ],",\n        "    });",\n        "  }, 120_000);",\n      ].join("\\n")\n    );\n  });\n});\nconst opsOf = (rs) =>\n  rs[0]?.ops.map((o) => o.op).filter((o) => !o.startsWith("0.")) ?? [];\nconst pick = (rs, size, op, f) =>\n  rs\n    .filter((r) => r.size === size)\n    .map((r) => f(r.ops.find((o) => o.op === op)));\n\n// a comment\nfor (const x of [1, 2, 3]) {\n  total = total + x;\n}\nconsole.log(total, "done");\nwhile (h) {\n  const f = null;\n  (acc) => acc.x(81, null < true);\n}\n\n// a b c\nconst f = "s6";\n// TODO\nfor (const n of lst(91)) {\n  if ("s3" * null ? g.y(null, "s1") : null) {\n    const lst = n.total(60);\n    h;\n    (n) => f.y(n());\n  } else {\n    const total = total(x, true, 73);\n  }\n}\nlet acc = n.g([]);\n\nconst y = "s3";\nconst x = [null, y(4, "s5"), n()];\ntrue;\nfor (const n of h("s6", true)) {\n  const h = "s1";\n  (x) => total("s8", 21);\n}\n// a b c\nfunction x(y, lst) {\n  y(n, 57);\n  f;\n}\nvar g = true;\nacc.h(x(65 ? "s8" : 86), acc({a: null, b: true}, [x, null], x));\n(h) => (x) => "s3" ? lst(24 + true, g(null, null, fact), (acc) => h) : acc.lst();\n\nlet g = total(h, true === true === true);\n\n"s0";\nfunction f(a, b) { return a * b; }\nf(1, 2);\nif (x) { f(1, 2); } else { g(); }\nmodule.exports = getLanguageBundleConfig({\n  name: "routine",\n  global: "CMBRoutine",\n  entry: "./src/index.ts",\n});\n\nconst flag = (name) => args.includes(`--${name}`);\nconst opt = (name) => {\n  const i = args.indexOf(`--${name}`);\n  return i === -1 ? undefined : args[i + 1];\n};\nwhile (h(68)) {\n  91;\n  x = lst(acc(), n("s2", 73), x);\n}\nacc(fact, f() ? acc(10, 51, x) : acc.lst("s5"));\nfunction x(h, f) {\n  total({a: true - 46, b: 68}, y() === 38 - f, (y) => fact.n(true, null));\n  (acc) => y;\n  while (acc.fact()) {\n    fact = h.y({a: 36, b: 51});\n    g = x;\n  }\n}\n"s9";\n\nwhile (h(total(null, null))) {\n  const lst = x(true, n(), 66 * acc);\n  37 ? true : null + fact ? true : "s7";\n  if ([(acc) => true]) {\n    let n = total;\n    n();\n    var lst = acc();\n  }\n}\n// TODO\nconst h = h(51);\n// a b c\nfunction f(fact, total) {\n  const fact = [] ? {a: true === g, b: total(lst, 84)} : fact(n(29, null));\n}\ny = lst ? acc.lst(8, "s4") : null;\nasync function main() {\n  for (const { from, to, prepend } of targets) {\n    const file = path.join(root, from);\n    const source = fs.readFileSync(file, "utf8");\n    const result = await less.render(source, { filename: file });\n    const dest = path.join(out, to);\n    fs.mkdirSync(path.dirname(dest), { recursive: true });\n    fs.writeFileSync(dest, (prepend ? prepend() + "\\n" : "") + result.css);\n    process.stdout.write(\n      `lib/css/${to}  ${Math.round(result.css.length / 1024)} KB\\n`\n    );\n  }\n}\n\n// TODO\n// a comment\nfor (const x of [1, 2, 3]) {\n  total = total + x;\n}\nconsole.log(total, "done");\nlst(true, "s4");\nif (h.n((n) => y)) {\n  acc(y.total(true, 44), null, []) - [];\n  [{a: [], b: null}, y(n ? x : true, true)];\n}\nacc();\nf(true, lst(null, acc, null)) ? 78 : true;\n\nconst {\n  getWebpackBundleConfig,\n} = require("@bootstrapworld/cmb-toolkit/lib/webpack");\n\n// dist/codemirror-blocks-min.js: the editor, with no language, for a page that\n// loads it with a <script> tag (a language is another file: see wescheme, ...)\nwhile (null + null + []) {\n  37;\n}\nvar h = null;\n// a b c\n(lst) => (x) => y(null, total, true);\nif ({a: g("s8", lst), b: {a: 22, b: null}}) {\n  86;\n}\n\nfunction f(a, b) { return a * b; }\nf(1, 2);\nif (x) { f(1, 2); } else { g(); }\n\n// TODO\nacc();\n// a b c\n10;\nwhile ([g("s5"), lst(true, true, n)]) {\n  const lst = true;\n  var h = h(fact < "s6" ? acc.x(true, "s6") : true);\n}\nlet y = (x) => y;\nwhile (5) {\n  [] ? fact : (g) => 84 ? f(null, null) : fact.y(lst, fact);\n  while ("s8") {\n    var x = {a: (y) => acc(), b: fact.y("s4", ["s4", "s8"])};\n  }\n  while (h()) {\n    total([n ? true : "s1", (y) => 81], true);\n    const total = [fact(true) ? null ? true : true : "s4", "s4"];\n    const total = f(n.lst(g(true, true)), {a: fact(20), b: true * null});\n  }\n}\nlet total = 3;\n\nlet f = 2;\n\nfor (const fact of y()) {\n  true;\n}\nnull;\n// a b c\nlet total = total(acc(true), ["s1", n]) * fact("s4", g ? "s7" : 74, {a: "s5", b: true});\nif ("s1") {\n  var total = n("s2", y);\n} else {\n  lst(y("s2" ? fact : null, {a: acc, b: 87}, null ? true : lst), h(null) ? f() : n("s8"), g.x());\n  let g = "s4";\n}\n\n',
      steps: [
        {
          op: "touchDrag",
          a: 0.9988768300972879,
          b: 0.5631256115157157,
          where: "whitespace",
        },
        { op: "longPress", a: 0.02715701167471707 },
      ],
      motion: "full",
      editor: {
        lineNumbers: true,
        lineWrapping: false,
        collapseAll: false,
        reconcile: true,
        anchors: true,
        fastErrors: true,
        skipRoots: true,
        activityLimit: null,
      },
    } as Sequence,
    { baseURL }
  );
  expect(v).toBeNull();
});

test("soak seed 4681: a block dragged by a finger leaves no `blocks-hole` mark on a blank that CodeMirror took out of the page during the drag (the renderer kept it and drew it again marked)", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 4681,
      language: "javascript",
      code: '// TODO\nvar y = total();\nh(true, true);\na.b(c);\n[1, 2, 3];\nlet y = 5;\nwhile (true) {\n  if (acc.x() + true < 71) {\n    const n = null === n((h) => true);\n    g = 46 ? "s3" : true - (fact) => g;\n    const total = true;\n  }\n}\nif ((x) => y("s2")) {\n  for (const total of fact) {\n    var n = (total) => (fact) => null < "s7";\n    let fact = null * g(fact.n(true, "s2"));\n  }\n}\n\nwhile ("s1") {\n  let n = {a: total(n("s3")), b: y()};\n  true;\n  null;\n}\nvar acc = true;\nclass A {\n  m() {\n    return 1;\n  }\n}\nnew A().m();\n// TODO\nfunction acc(g, g) {\n  if (g()) {\n    h = true < true ? {a: 49, b: "s1"} : fact(null, n, true);\n    y.y(x(true, 63) + y(true, "s9", y));\n    40 * f(fact(2, f), 44);\n  } else {\n    (total) => "s7" - x();\n  }\n  return [true, total === g];\n}\nvar y = 52;\ntotal();\ng((lst) => null ? h(true) : null ? "s1" : true, 36);\nwhile (74 ? null : "s1" + "s9") {\n  let lst = "s5";\n  function g(n, f) {\n    const acc = lst(null) ? y.x((n) => 98, 2) : null;\n    n;\n    (h) => total;\n  }\n}\nnull;\nwhile (26) {\n  let x = [g(), null];\n  for (const g of total()) {\n    n = 67;\n  }\n  n.f() === h(fact ? acc : 19, (n) => x, {a: n, b: x});\n}\nh;\n\nfor (const y of fact ? "s5" : true) {\n  if (lst("s1", "s3")) {\n    let y = total(f, (lst) => null, acc());\n  } else {\n    null;\n    const h = x(true);\n  }\n}\n// a b c\nif (null) {\n  var g = 5;\n  while (fact()) {\n    let lst = {a: {a: h, b: null}, b: {a: g, b: "s2"}} < null;\n    let g = x();\n  }\n}\n// note\nh(75, {a: acc(null), b: fact === "s0"});\nlet fact = {a: true, b: true};\n\nfor (const x of x.x("s3", lst)) {\n  while (f()) {\n    fact = y();\n    y = fact(lst(true, "s7"), (acc) => "s7");\n    acc === true * [{a: null, b: "s8"}];\n  }\n  if ("s4" ? 54 : null ? "s9" : "s4" === x) {\n    const g = n.g(25);\n    [null ? null : lst, 84, x(true, fact, true)] === fact;\n    var h = null < n ? "s5" : total ? {a: true, b: true} : acc(null, y, f);\n  }\n}\nfor (const lst of fact) {\n  acc = fact(true);\n  for (const h of total(true, "s0", "s2")) {\n    let fact = null ? "s6" : 63;\n    const n = g(f(x, true - 66), {a: 38 - 47, b: null - f});\n    const lst = {a: h(fact < true, (y) => null), b: {a: acc(), b: g(null)}};\n  }\n}\nfunction fact(fact, fact) {\n  f(g) - x === true - "s8";\n}\n\nacc(true);\nimport eslintReact from "@eslint-react/eslint-plugin";\nimport reactHooks from "eslint-plugin-react-hooks";\nimport prettier from "eslint-config-prettier";\nimport globals from "globals";\n\n\n// note\nh;\nif (lst ? 27 ? "s3" : total : "s0") {\n  for (const acc of lst(66, 9, n)) {\n    var y = lst("s5", x(fact.f(true, true), 80));\n    x;\n    let acc = {a: x(["s8"], {a: true, b: 88}), b: null};\n  }\n} else {\n  lst.lst();\n  function n(n, lst) {\n    return acc.h(true, "s8") * y("s2");\n  }\n}\n({a: g(10), b: {a: null, b: lst}} * acc.acc(acc.y(lst, null)));\nlet h = lst() < {a: total(), b: 5};\n// a b c\nlet g = null ? 86 : null ? (fact) => true : total ? 7 : null ? null : (fact) => acc(h);\nh.total(f([true], true * 96, true), f({a: "s0", b: null}, (y) => true, "s2"));\nwhile ([]) {\n  (n) => x({a: 56, b: true}, 35 ? "s4" : 52);\n  g.fact();\n}\n// note\ny.h((f) => g.f("s6", 15), "s3");\nconst g = total;\n\ng.y();\n// a b c\nfunction y(x, h) {\n  g = 81;\n}\nif ((x) => x(8, null)) {\n  if ("s6") {\n    h(acc.n(true, y(h, true)), [n] < null, (y) => y);\n    let acc = lst(true, acc(true, x, x)) < null;\n  } else {\n    var lst = 47;\n    lst.total() + total(0);\n  }\n  acc;\n}\nfor (const g of "s3") {\n  let fact = true;\n  let lst = "s6";\n}\nfunction x(fact, f) {\n  null;\n  while (g()) {\n    var x = fact;\n  }\n}\n\nwhile (31) {\n  "s6";\n  [g("s8", "s4"), null ? 61 : "s8"] - h();\n  if (null) {\n    var total = acc(g, y("s5", true, 48) ? {a: x, b: "s3"} : null, null);\n    f = fact(true, h(h, null));\n    let n = lst(total ? true : null * null, fact(n(h, 44), lst, acc.acc(x)));\n  } else {\n    "s0" + acc;\n    h = lst.fact(58) * 56;\n  }\n}\n\nlst = g(null + h, n, y(39, 96, null));\nx = y("s8") < [];\n// note\nlst();\n\nif ([null, 0] ? g("s0", "s7", "s4") : "s6" ? "s3" : null) {\n  while (51) {\n    (acc) => (g) => "s6" - (lst) => "s5";\n    n = [null, "s7"] ? total.y("s5", null) : true;\n  }\n}\n// a b c\nif (acc.h(lst(g, 19, "s1"))) {\n  for (const acc of acc("s6", "s8")) {\n    const h = lst((fact) => true);\n    true;\n  }\n  let fact = x(16, acc(n(true)));\n  function f(f, x) {\n    "s6";\n    null;\n    lst.f();\n  }\n}\n// TODO\ng();\n// a b c\n// note\nh(h(x, 27, g) ? h(x) : true, fact({a: 92, b: "s4"}, total("s4")));\nlet n = total;\n[];\nlet h = 94 + null ? null + true : "s9" ? true : true * true;\n// TODO\nnull;\nfunction lst(acc, lst) {\n  function fact(total, total) {\n    h(78);\n    y = "s9" ? null : 71 === null;\n  }\n}\nif (34 < 27 ? 31 + "s8" : acc(g)) {\n  function acc(g, n) {\n    return f(true, true, "s0");\n    const x = 24;\n  }\n  (y) => acc.x("s9" * true);\n} else {\n  let y = lst;\n  null;\n}\nh = f.g(null) * n();\n// a b c\nlet x = [];\nvar y = g();\nconst fact = null;\nvar lst = true;\n\nh = n.fact(g(true, acc, null), true);\n// a b c\nif ({a: 20, b: 45} === acc("s0", "s5")) {\n  for (const total of null) {\n    let total = true - 66 + y + [null, acc(null, true, total), 88];\n    acc = 50;\n  }\n} else {\n  95;\n  if ([[], fact(null)]) {\n    20;\n  }\n}\n37 ? fact((f) => null) : total(n ? 90 : g);\nimport {\n  CodeMirrorBlocks,\n  setLogReporter,\n} from "@bootstrapworld/codemirror-blocks";\nfunction f(a, b) { return a * b; }\nf(1, 2);\nif (x) { f(1, 2); } else { g(); }\n(f) => 63;\nfact;\nwhile (total((acc) => g, f, g(null, lst, true))) {\n  if (x(true + true, n.total("s6"), null)) {\n    let lst = "s6";\n    let fact = acc;\n  }\n  function y(h, acc) {\n    return null;\n    var x = g(true, [x.f(true, "s7")], h());\n    return (lst) => [];\n  }\n}\nif (y([], 36 ? h : "s6", n())) {\n  for (const total of null) {\n    const acc = acc() ? null : lst;\n    let g = "s7";\n    const f = x("s4", [40] ? fact.n(true, 28) : null * lst);\n  }\n  ({a: "s7", b: (acc) => true});\n}\nvar f = (fact) => true;\n"s7";\n// TODO\nwhile (h.n() < acc) {\n  lst(77, h, f()) ? (n) => 72 : true;\n  function h(fact, acc) {\n    [null, total.total(17), null < null] ? x([h], lst.acc(59)) : {a: "s5", b: acc} * 46 + null;\n    return f((h) => 16, (n) => true);\n  }\n  let acc = null * total.y(acc(true, null));\n}\n8;\n// a b c\nfor (const g of 72) {\n  let total = (h) => null;\n  function h(x, f) {\n    return 43;\n    "s2" ? true : lst(n * true);\n  }\n  const f = acc;\n}\ntotal((g) => "s9") ? lst(74 === f, 22) : true;\n\nif (null - total(y, n, acc)) {\n  f(y(f.n(), (h) => "s4", null), true ? fact.x(true, null) : y, []);\n  true;\n} else {\n  f(null, 62 < true) * "s5";\n  f(fact("s4" - null, x.lst(g, 96)), null ? "s4" : "s4" - true);\n  if (acc(x * 24, "s5" ? "s9" : 38, h())) {\n    let f = x();\n  }\n}\nlst = 65;\nconst n = "s9";\nwhile (x) {\n  ({a: null, b: h ? acc : lst * null});\n}\nwhile (true) {\n  const h = [{a: null + "s1", b: f < "s5"}];\n  const y = total.n(y, {a: true, b: 95} + [true, null]);\n  f = x(x, fact(), true);\n}\nwhile (x(null, {a: "s8", b: lst}, null)) {\n  "s6";\n  h = "s3";\n}\nfunction n(x, acc) {\n  acc = (total) => h;\n  const y = 57;\n}\n[x.g(f, null) - 97];\n\ntrue;\nlet acc = x(f(), total, "s1");\n\nconst base = require("../../../packages/codemirror-blocks/webpack/example.config.js");\n\nconst group = (name, test, priority = 20) => ({\n  name,\n  test,\n  chunks: "all",\n  priority,\n  enforce: true,\n});\n\n\nlet x = 1 + 2;\nf(x, 3);\nwhile (x < 9) { x = x + 1; g(x); }\na.b(c);\n[1, 2, 3];\nlet y = 5;\nif ({a: true, b: true}) {\n  f = [{a: null, b: 27}, true ? "s0" : true];\n  const y = (total) => total(null, true ? null : true, {a: 19, b: n});\n  for (const h of 34) {\n    const y = lst(g(total(), g.g("s7", h), h.h(null)), fact(g(y), [], [h]));\n  }\n} else {\n  var y = total(total(true), {a: {a: "s8", b: h}, b: true}, 97 - [n, 25]);\n  const x = {a: x(), b: g(["s5", 25, h], null, lst(true))};\n}\nwhile ({a: f(n, null, "s4"), b: "s9" + "s5"}) {\n  x = "s9";\n  for (const total of (total) => "s2") {\n    let acc = true;\n    fact(h(), f < true === y, 45 + fact ? null : true);\n    var f = true;\n  }\n  let g = (total) => n() ? g : [75] * null;\n}\n99;\nvar lst = total.fact(true === acc, true) ? "s4" : y(fact(), 77 ? true : n);\ndescribe("results of a worker", () => {\n  const lines =\n    JSON.stringify({ seed: 1, ok: true }) +\n    "\\n" +\n    JSON.stringify({ seed: 2, invariant: "focus", steps: [{ op: "key" }] }) +\n    "\\n" +\n    \'{"seed": 3, "ok"\'; // (cut: the worker was killed in the middle of a line)\n  test("passed, failed, and what was done", () => {\n    const r = lib.readResults(lines);\n    expect(r.passed).toBe(1);\n    expect(r.failures.map((f) => f.seed)).toEqual([2]);\n    expect([...r.done]).toEqual([1, 2]);\n  });\n  test("the first seed that was not done is the one that was running", () => {\n    expect(lib.missingSeeds([1, 2, 3, 4], lib.readResults(lines).done)).toEqual(\n      [3, 4]\n    );\n    expect(lib.readResults("").done.size).toBe(0);\n  });\n});\n\n// a comment\nfor (const x of [1, 2, 3]) {\n  total = total + x;\n}\nconsole.log(total, "done");\nfunction h(acc, fact) {\n  let fact = {a: "s3", b: null};\n}\n\n"s7";\nnull;\nfact();\nvar g = 64;\nwhile ({a: (g) => 38, b: null}) {\n  "s4";\n  function n(lst, x) {\n    fact([68] === (fact) => true, null, fact);\n    true;\n    n(34 ? total : "s7" * (g) => null, n.h(g(y, true, null), acc(lst, true)));\n  }\n}\nif (total(["s6"])) {\n  if ("s3") {\n    h = fact();\n  }\n  if ("s5") {\n    f((acc) => ({a: true, b: y}), acc(), "s2" ? 84 : acc());\n    25;\n    let f = acc(total(y(24), {a: null, b: true}, 40));\n  } else {\n    let lst = y("s6", null, h + h(94));\n    "s1";\n    let g = [f(n.y(true, 48), fact < null)];\n  }\n  const f = y < null < f ? ["s8", n, "s8"] ? h(true) : true : g;\n}\nnull;\ntotal(42, null, fact());\n// a b c\nwhile (fact(null, true)) {\n  n;\n  "s2";\n}\nfunction n(h, x) {\n  y.x(true, true);\n}\n[18, 1, "s1"];\n// a b c\nfunction h(x, g) {\n  acc = null;\n  function g(n, g) {\n    var n = g("s3", total(g(), "s8"), true);\n    return lst();\n  }\n  total;\n}\nif (fact()) {\n  null;\n  (n) => (n) => lst("s1");\n}\n\nfunction fact(x, n) {\n  for (const g of (h) => "s7") {\n    return fact();\n  }\n  for (const acc of 68) {\n    64 ? null : y(90, true, "s7") - 67;\n    const g = (fact) => x(h(), true);\n  }\n  function f(acc, y) {\n    const total = f.x() * y(56) ? "s4" : fact(null, null, true);\n  }\n}\nwhile (true) {\n  var total = y((fact) => acc.lst(true, "s6"));\n  var y = "s6" < f();\n  for (const lst of "s0") {\n    var g = f();\n    null - {a: g === true, b: {a: 11, b: lst}};\n  }\n}\nconst x = [total];\n// a b c\nfor (const f of {a: null, b: fact}) {\n  const f = 52;\n  for (const g of g) {\n    93 ? fact() : true * fact([acc], null);\n    const y = (total) => true;\n  }\n  var h = total(y() ? h() : total(81, "s4"));\n}\n\n// TODO\n[true, fact((x) => y, true), null - lst()];\n// a b c\nnull;\n\nwhile (true * [null, null]) {\n  function total(total, fact) {\n    total(null, y, 33 ? "s6" : y.x());\n    return y;\n    lst([g(31, true), h], null < n(null, null, "s9"), null < (x) => 72);\n  }\n}\nx(total, "s9", true) ? y("s0", null, true) : lst ? y(true) : f(true, true ? 6 : 85);\n\nclass A {\n  m() {\n    return 1;\n  }\n}\nnew A().m();\n\ng((f) => (n) => 18, h(), []);\nfor (const y of lst(84, null)) {\n  const acc = 44 ? {a: 65 === 33, b: {a: n, b: true}} : true;\n}\nlet total = "s6";\nfor (const y of null) {\n  fact(86, [{a: "s4", b: true}, y(y, acc)]);\n  true;\n  y(true * true < true, null, null);\n}\nf.x();\n\nfact;\ntotal();\n// a b c\n"s3";\nfact = {a: g(17, true, y), b: 38};\nfor (const f of fact("s6")) {\n  91;\n  for (const f of x ? true : 50) {\n    h;\n  }\n  function f(x, x) {\n    ({a: "s0", b: y(lst(82))});\n    n;\n  }\n}\n55 ? (fact) => ({a: true, b: "s2"}) : [{a: null, b: acc}, acc, h(n, "s2", "s2")];\nx = n(total(77, fact, "s5"));\nif (11) {\n  total = h(lst.fact(null), n(), 16 ? "s9" : f);\n} else {\n  null;\n  let g = lst(g(), g(total(39, null, 58)));\n  var h = {a: null, b: y ? y(38, 83, "s8") : h()};\n}\n(fact) => true;\n\nvar acc = {a: {a: 11 + fact, b: f(lst, null)}, b: [f(true, lst)]};\nx(null, null ? ["s9", "s9", "s2"] : x("s7", "s9", true), acc(true, total(y), fact(null, 35)));\n\n// TODO\nfunction f(n, lst) {\n  (y) => g.y();\n  var h = fact(y.h("s4" ? "s7" : 12));\n}\nfor (const h of true) {\n  function fact(h, h) {\n    return h("s1", 36) + 57;\n    return "s5" ? null : true * "s2";\n    var acc = n(y, acc.h(2, total), lst) ? lst("s9", 79, true) < "s7" < 95 : [true, "s1", lst.fact()];\n  }\n}\nfunction total(x, lst) {\n  if (lst(n(18), f(96, 1), (x) => null)) {\n    return true;\n    return y.x(acc.acc(), true);\n    lst();\n  }\n  let g = (lst) => x.g() ? g(true, 41) : x(63);\n}\n\nfunction f(fact, n) {\n  x([], fact(lst * g, null, []));\n  g;\n  let f = 29;\n}\n\n// a b c\nconst y = acc;\n\nf("s0", true, true) + true < g(8, [96, 8, 90]);\nfor (const g of (lst) => true) {\n  const h = true;\n  45;\n}\nnull;\n\nacc(fact, x) ? total(32, null) : f("s8") * f(29, "s4") + total("s4");\nfunction fact(h, f) {\n  function total(g, x) {\n    return y;\n    (h) => acc(true);\n    let h = total(y(f(true, true), null < 72, lst), 63 === total.y(70, "s4"));\n  }\n  let x = f;\n}\nlet h = {a: true, b: n(y(h, null, total), "s1", n(null))};\nlet h = true;\nfor (const acc of "s9") {\n  for (const x of true) {\n    let lst = 2 + null ? "s9" : (h) => "s1" ? 30 : g;\n    const total = [] * n(total("s4", true));\n    let g = [f(g, 53) ? (n) => 58 : y, y()];\n  }\n}\ny = null;\nclass A {\n  m() {\n    return 1;\n  }\n}\nnew A().m();\n// TODO\nacc(total, lst(), total.n(y()));\n// TODO\nimport * as compat from "preact/compat";\n\noptions.requestAnimationFrame = (callback) => queueMicrotask(callback);\n\nlet x = 1 + 2;\nf(x, 3);\nwhile (x < 9) { x = x + 1; g(x); }\nif ((f) => n(null, "s7", null)) {\n  let lst = [];\n  fact(true, null);\n  if (f()) {\n    true;\n  } else {\n    acc("s9") === total(total) < n();\n  }\n} else {\n  ({a: y, b: y() + null});\n  [(fact) => fact, true < null + (y) => 54];\n}\ndescribe("promoting a failure to a regression test", () => {\n  const replay = JSON.stringify({\n    code: "(f x)\\n(g)",\n    steps: [{ op: "cut", r: [1, 2, 3, 4] }],\n  });\n  const records = [\n    { seed: 7, signature: "cut :: bad", problem: "bad", shrunkTo: 3, replay },\n    { seed: 9, signature: "cut :: bad", problem: "bad", shrunkTo: 1, replay },\n    { type: "crash", seed: 7 },\n  ];\n\n  it("finds a failure by seed or by signature text (the smallest)", () => {\n    expect(lib.findForPromote(records, "7").shrunkTo).toBe(3);\n    expect(lib.findForPromote(records, "CUT").seed).toBe(9);\n    expect(lib.findForPromote(records, "nothing")).toBeNull();\n  });\n\n  it("prints an it() in the format of the once-broke block", () => {\n    expect(lib.promoteCase(records[0])).toBe(\n      [\n        \'  it("seed 7: bad", () => {\',\n        "    check({",\n        \'      code: "(f x)\\\\n(g)",\',\n        "      steps: [",\n        "        {",\n        \'          "op": "cut",\',\n        \'          "r": [\',\n        "            1,",\n        "            2,",\n        "            3,",\n        "            4",\n        "          ]",\n        "        }",\n        "      ],",\n        "    });",\n        "  }, 120_000);",\n      ].join("\\n")\n    );\n  });\n});\n\n// a comment\nfor (const x of [1, 2, 3]) {\n  total = total + x;\n}\nconsole.log(total, "done");\nfunction acc(h, f) {\n  n(n(9 - "s3", acc(25, 20), fact(null, 29)));\n  fact;\n  let f = true;\n}\n// TODO\nwhile ({a: 33, b: total.total(88)}) {\n  const acc = true;\n  while (fact) {\n    const x = null;\n    lst(x);\n    var acc = fact("s7" ? true : total ? null : f);\n  }\n}\nacc = y(true + "s4");\ntotal(47) === (x) => fact + fact(null, acc);\nfor (const lst of (n) => "s3") {\n  h(h, 70, true) < h();\n}\nx;\nfunction y(x, n) {\n  function n(g, fact) {\n    true;\n    return acc;\n    const fact = 64;\n  }\n  f(f("s5"), [92 ? "s3" : h, lst("s8"), "s7" * fact], acc(f, (h) => "s9"));\n  const fact = n(true, true, {a: true ? f : true, b: (f) => total});\n}\n// TODO\nconst f = n();\n\nclass A {\n  m() {\n    return 1;\n  }\n}\nnew A().m();\n// a comment\nfor (const x of [1, 2, 3]) {\n  total = total + x;\n}\nconsole.log(total, "done");\nclass A {\n  m() {\n    return 1;\n  }\n}\nnew A().m();\n// a comment\nfor (const x of [1, 2, 3]) {\n  total = total + x;\n}\nconsole.log(total, "done");\nfunction acc(y, fact) {\n  f.y((h) => null) < 75 === x ? "s1" : (n) => acc;\n  acc.y("s0" === null + 78, x({a: true, b: x}, y));\n  const y = [n(true, null, g)] + {a: acc(true, n), b: n};\n}\nfor (const lst of fact(total, true)) {\n  let n = {a: (n) => null, b: fact()};\n  for (const h of y(true)) {\n    h(true, n(f.acc()));\n    var h = "s3";\n  }\n}\n// TODO\nlst(53, null, f(acc(), y.total(), 55));\nn(n(true ? "s0" : null, [67, "s5"], acc(acc, true, "s7")), acc, "s1");\n\nclass A {\n  m() {\n    return 1;\n  }\n}\nnew A().m();\n\nfunction acc(h, y) {\n  while (acc("s9", f(f, true, fact))) {\n    ({a: (x) => fact(lst), b: total(x.y(), acc(null), n)});\n    let lst = g([h("s8", "s9", n)], true);\n    lst({a: lst.lst(42), b: "s5" ? 25 : true}, 28);\n  }\n  return f(n(0, true), true, null);\n  h.f(x());\n}\n// note\nif (y(y(), x(h), n())) {\n  while (true) {\n    lst((h) => (g) => true, total.lst(f(70, 60)));\n    var acc = [h, n()] < y ? acc.total(acc) : lst.lst("s7", null);\n    const x = h();\n  }\n  [(h) => true];\n  for (const total of [true, true]) {\n    const acc = h("s4" < ["s7", "s7", true], y() ? {a: "s4", b: x} : 83);\n    [f.y(g)];\n  }\n}\n\n// a b c\n(y) => true;\nnull ? null : n(true, null) === 49;\nlet g = lst ? 48 : x(47 ? "s3" : true);\ncontainer.id = "app";\n\nconst editor = CodeMirrorBlocks(\n  container,\n  {\n    collapseAll: false,\n    value: exampleCode,\n  },\n  WeScheme\n);\n\n// for debugging purposes\nfunction f(a, b) { return a * b; }\nf(1, 2);\nif (x) { f(1, 2); } else { g(); }\n\nif (89 - true === [null, h, null]) {\n  var n = lst.g(true, null);\n}\n\na.b(c);\n[1, 2, 3];\nlet y = 5;\n\n// note\nwhile ("s4") {\n  x(f) ? x("s3", total(true, null, null)) : [true, "s8", 38] - {a: null, b: acc};\n  f = true;\n  while (fact(null) ? "s1" : "s7") {\n    var y = true;\n    var n = 59;\n    true;\n  }\n}\nlet total = null;\nconst y = fact(x(lst) === n(true, f));\nfor (const fact of null) {\n  if (total) {\n    20;\n    true;\n  } else {\n    const f = 17;\n  }\n}\nvar total = "s5";\nfunction total(lst, g) {\n  (lst) => x({a: 61, b: f}, [f, 83, y]);\n  x();\n  function g(fact, h) {\n    return fact({a: true, b: 52});\n  }\n}\n\n// a b c\nnull;\nif (y() ? g.lst() : "s9" === acc) {\n  if (h(total(47), 94)) {\n    g.acc();\n  }\n} else {\n  acc() ? 34 : f;\n  while (fact) {\n    total = f(true);\n    var total = fact;\n  }\n}\nvar n = (f) => f(null) * x("s4", (total) => true, 33);\n// TODO\nif (47) {\n  while ("s5") {\n    let x = x;\n    total() * n.h() < [];\n    80;\n  }\n  var lst = x(fact(x, h), {a: x(null, "s0"), b: lst()}, 84 - total(17));\n}\n// a b c\nlet x = 1 + 2;\nf(x, 3);\nwhile (x < 9) { x = x + 1; g(x); }\n// TODO\nconst acc = ["s0" - [true], (h) => g("s7"), n(true - null, h)];\nfunction y(h, h) {\n  let acc = 43;\n  const n = 27;\n}\nnull;\nvar lst = true;\n\nvar fact = fact.f(true);\n// note\nconst lst = x((x) => fact(), {a: [null, "s5", "s9"], b: "s2"}, ["s4" + 23, "s9", (g) => true]);\nwhile (f) {\n  75;\n  if (null ? true : 68 ? f : acc()) {\n    let n = acc.lst() + lst(82, true, null) ? true : acc("s2");\n  }\n  function acc(total, f) {\n    x();\n    true === [];\n  }\n}\nmodule.exports = {\n  plugins: ["@babel/plugin-transform-modules-commonjs"],\n  exclude: ["/\\bcore-js\\b/"],\n  presets: [\n    [\n      "@babel/preset-env",\n      {\n        targets: {\n          browsers: [\n            "Firefox >= 76",\n            "Safari >= 13",\n            "Chrome >= 85",\n            "Edge >= 85",\n          ],\n        },\n        useBuiltIns: "entry",\n        corejs: {\n          version: "3",\n        },\n      },\n    ],\n    "@babel/preset-react",\n    [\n      "@babel/preset-typescript",\n      {\n        allowDeclareFields: true,\n      },\n    ],\n  ],\n  sourceMaps: true,\n};\n\n\n// a comment\nfor (const x of [1, 2, 3]) {\n  total = total + x;\n}\nconsole.log(total, "done");\n// a b c\n// TODO\nx = [h, acc(x, 61), "s7"];\nif (acc(n(lst, null, 96), "s7")) {\n  f(acc.g(), y(63) ? 8 * y : {a: x, b: 83}, y());\n  const lst = h(fact.g("s8", 54), total(null), {a: lst, b: null}) * 31;\n} else {\n  const lst = y(null === f - true);\n}\nfact = (lst) => "s1" ? total(true, "s3") : "s3";\nvar g = true;\nvar acc = fact();\nvar y = 75 ? 41 ? n : x : "s5" * "s9";\nfunction acc(y, total) {\n  return n();\n}\n\n// note\n"s6";\nlst();\nh = [true * n, (f) => 71];\nwhile (68) {\n  ({a: 84 === true - f(y, h, "s6"), b: x()});\n}\n8;\n60;\ntrue;\n\ng;\nvar h = f;\nvar total = true;\n\nfor (const f of h.h(true, true)) {\n  lst = y(lst());\n  var lst = 7 - lst.f(6, true) - null < "s4";\n}\nwhile (54) {\n  function g(n, x) {\n    lst = fact(true, 9) ? null : true * null;\n    return h("s1");\n  }\n  "s1" ? 9 : true;\n  total.h(true, true) ? y() : g ? y(true, null * true, acc ? 7 : 82) : g(32, total);\n}\n\nvar acc = [94];\nvar lst = y;\nf = y(total("s8"));\n// note\nf("s7", f());\nvar x = true === true === n(29, "s4", null);\n// TODO\nfact("s1");\nlet x = 1 + 2;\nf(x, 3);\nwhile (x < 9) { x = x + 1; g(x); }\nconst path = require("path");\nconst root = path.join(__dirname, "..", "demo");\nconst types = {\n  ".html": "text/html",\n  ".js": "text/javascript",\n  ".map": "application/json",\n};\nclass A {\n  m() {\n    return 1;\n  }\n}\nnew A().m();\n\nlet total = f(y({a: true, b: 57}, true ? null : lst));\n// note\nh() - [fact(g, "s6", "s7"), 55];\n// note\n"s5";\nh(f(true + "s4"));\nconst acc = [];\n\nn;\ny(true, g(), true);\nf(h, acc(acc("s8"), x(true, null), null), 95 + g(null, "s7"));\n\ng = (lst) => f;\n// TODO\nf = {a: null, b: y("s0", null)};\n\n// TODO\ntotal(g(true ? true : null), h(30, "s2") * (total) => g);\n"s9";\nclass A {\n  m() {\n    return 1;\n  }\n}\nnew A().m();\ndescribe("results of a worker", () => {\n  const lines =\n    JSON.stringify({ seed: 1, ok: true }) +\n    "\\n" +\n    JSON.stringify({ seed: 2, invariant: "focus", steps: [{ op: "key" }] }) +\n    "\\n" +\n    \'{"seed": 3, "ok"\'; // (cut: the worker was killed in the middle of a line)\n  test("passed, failed, and what was done", () => {\n    const r = lib.readResults(lines);\n    expect(r.passed).toBe(1);\n    expect(r.failures.map((f) => f.seed)).toEqual([2]);\n    expect([...r.done]).toEqual([1, 2]);\n  });\n  test("the first seed that was not done is the one that was running", () => {\n    expect(lib.missingSeeds([1, 2, 3, 4], lib.readResults(lines).done)).toEqual(\n      [3, 4]\n    );\n    expect(lib.readResults("").done.size).toBe(0);\n  });\n});\n\ny = {a: acc.acc(h, "s4"), b: lst()};\nif (null) {\n  94;\n}\n// TODO\n(y) => h(g, acc, fact) ? "s5" + "s3" : h(g);\n// a b c\nlet lst = null;\nwhile ((f) => 83 - true) {\n  const y = {a: (lst) => ["s4", 35, 50], b: x(fact, null) === f(true)};\n}\nfor (const fact of fact.total(true, null)) {\n  total();\n}\n(f) => y((y) => null, h(true, 0, true));\n// a b c\ny ? x(null, {a: null, b: x}, g - true) : h();\nwhile (null) {\n  null;\n  null;\n  let g = f(f(true ? null : true), f(fact, true - 21));\n}\n// TODO\nfor (const fact of [null]) {\n  70 ? y(n("s7")) : x((lst) => true);\n  true;\n}\nconst f = total(["s9", h + 28, 81 < 20]);\n\nlet x = null;\n\nclass A {\n  m() {\n    return 1;\n  }\n}\nnew A().m();\n',
      steps: [
        { op: "scroll", a: 0.6909541874192655 },
        {
          op: "touchDrag",
          a: 0.5306679275818169,
          b: 0.9786576507613063,
          where: "trash",
        },
      ],
      motion: "reduced",
      editor: {
        lineNumbers: false,
        lineWrapping: false,
        collapseAll: false,
        reconcile: true,
        anchors: true,
        fastErrors: true,
        skipRoots: true,
        activityLimit: 2,
      },
    } as Sequence,
    { baseURL }
  );
  expect(v).toBeNull();
});

test("seed 277: a copy of selected blocks whose event targets a `.cm-line` takes the selected blocks, not the caret's line", async ({
  page,
}) => {
  await page.goto(`${baseURL}/index.html?lang=scheme`);
  await page.waitForSelector(".cm-content [role=treeitem]");
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ed = (window as any).demo.ed;
    ed.view.dispatch({
      changes: {
        from: 0,
        to: ed.view.state.doc.length,
        insert: "(f 1)\n(g 2)\n(h 3)\n",
      },
    });
    ed.focusNode(ed.roots()[0]);
  });
  await page.keyboard.press("Space");
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ed = (window as any).demo.ed;
    ed.focusNode(ed.roots()[1]);
  });
  await page.keyboard.press("Space");
  const out = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ed = (window as any).demo.ed;
    const sel = ed.selectedBlocks().length;
    const line = document.querySelector(".cm-line") as HTMLElement;
    const data = new DataTransfer();
    const ev = new ClipboardEvent("copy", {
      clipboardData: data,
      bubbles: true,
      cancelable: true,
    });
    line.dispatchEvent(ev);
    return {
      sel,
      text: data.getData("text/plain"),
      handled: ev.defaultPrevented,
    };
  });
  expect(out.sel).toBe(2);
  expect(out.handled).toBe(true);
  expect(out.text).toBe("(f 1)\n(g 2)");
});

test("soak seed 9057: CodeMirror measures the page in the middle of a drag (the gap under the mouse still open) and the end of the drag changes the heights again with no change any observer reports: the line numbers follow (the heights are compared with the lines when the pointer is released)", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 9057,
      language: "python",
      code: '# a comment\ntotal = 0\nfor x in [1, 2, 3]:\n    total = total + x\nprint(total, "done")\nif x:\n    f(1)\nelif y:\n    g()\nelse:\n    h()\n[1, 2]\ndef f(a, b):\n    y = a\n    return y\nf(1, 2)\n# a b c\nwhile fact:\n    lambda acc: h(f("s4", None, None))\n    if x("s7" + h, 89):\n        n = y("s8", {(lambda acc: fact): None}, {(lambda fact: True): f})\n        total = None\n    else:\n        n = [y(), lst, lambda f: 65]\n        f = None\n\nNone\nTrue\n\n# a comment\ntotal = 0\nfor x in [1, 2, 3]:\n    total = total + x\nprint(total, "done")\nlambda fact: [[68, 42, "s7"], "s2"]\ntotal = fact()\nlst = acc([True, None - True, "s6"])\n(lambda h: fact(None)) - None\n# a b c\nn = f.g()\nfor fact in (lambda y: h):\n    acc = "s9"\n"s5"\n"""Find modules used by a script, using introspection."""\n\nimport dis\nimport importlib._bootstrap_external\nlst = [78]\n# TODO\nTrue\n[total(acc(None), [], {n: total})]\nx = 1 + 2\nf(x, 3)\nwhile x < 9:\n    x = x + 1\n    g(x)\ny = 2\ndef tree(tlist, size, level, widthfactor, branchlists, angledist=10, sizedist=5):\n    # benutzt Liste von turtles und Liste von Zweiglisten,\n    # fuer jede turtle eine!\n    if level > 0:\n        lst = []\n        brs = []\n        for t, branchlist in list(zip(tlist,branchlists)):\n            t.pensize( size * widthfactor )\n            t.pencolor( 255 - (180 - 11 * level + symRandom(15)),\n                        180 - 11 * level + symRandom(15),\n                        0 )\n            t.pendown()\n            randomfd(t, size, level, angledist )\n            yield 1\n            for angle, sizefactor in branchlist:\n                t.left(angle)\n                lst.append(t.clone())\n                brs.append(randomize(branchlist, angledist, sizedist))\n                t.right(angle)\n        for x in tree(lst, size*sizefactor, level-1, widthfactor, brs,\n                      angledist, sizedist):\n            yield None\n\n\nf = {y.x(x("s0", "s1")): lambda f: total(True)}\nlambda h: fact("s1", True)\n\nf()\ndef acc(total, total):\n    total(None, n(), fact(total.lst("s6"), lambda lst: g, [None, None, None]))\n\nfor total in (lambda total: "s6"):\n    fact = []\n    x = "s5"\nacc = "s1"\ndef g(lst, h):\n    n("s1", lst * y)\nif (lambda y: "s3" < 67):\n    if n(58 < "s7", lambda lst: "s2"):\n        f = []\n        f = fact(None, fact("s4" * "s8", total == True), fact - (lambda n: 92))\n    while n(None):\n        lst = True\n        total = acc()\n        y = lambda total: ["s9" - 95, "s8"]\n\n\n# a b c\nTrue + True * 53 == acc\n\ndef total(lst, g):\n    fact = None\ndef fact(n, n):\n    lst = lambda g: lambda h: True\n# a b c\nif x():\n    while [h(), f(True, total)]:\n        48\n        g\n# note\nacc = True < fact.f(lambda fact: True, y(y))\n\n# a b c\ndef h(g, h):\n    g(f < g, "s4", lst())\n    if g():\n        return 3 + (lambda acc: True)\n    else:\n        return f(lambda g: True, True)\n        g = lst.fact()\n    lambda lst: y(lambda fact: None)\n8\nwhile y:\n    while [True + 0]:\n        "s1"\n        n({{89: "s8"}: lst(69, "s4", True)})\n\nTrue\n\n# note\ndef lst(acc, lst):\n    75\n    total(fact(y()))\n    {(lambda acc: [None, f, "s1"]): True}\n\nif True:\n    while total(True == h):\n        y = f.h()\n        f\n        fact = x\n    "s5"\nelse:\n    for g in fact("s8"):\n        acc = acc()\n    def lst(y, n):\n        return (lambda x: True) < g()\n        return lst\n        x = None == True\n    total = "s5"\n\nwhile (lambda f: "s6" < 40):\n    acc = [["s4", n("s4"), "s4"]]\n    def g(g, y):\n        [None < True, lambda y: [None, None]]\n        7 < x(None, None == f)\n    for f in [True, f, True]:\n        g = True\n        f = "s0"\n        lst = g.fact(lambda h: 81)\nh = f()\nh("s2" + [f])\nlst(f("s7" == 54, None, True), n)\n# TODO\ny = lambda acc: fact(lst, None) == (lambda acc: True)\n"s2"\ng(f(x, lambda y: x), x(lambda g: True, "s1"))\nacc = "s6"\n\n"s8"\ny = lambda total: x({None: True}, n(), h())\nx = 1 + 2\nf(x, 3)\nwhile x < 9:\n    x = x + 1\n    g(x)\ny = 2\nif True:\n    fact = acc.acc(None)\nelse:\n    h(total(None))\nfor fact in lst("s4", True, h):\n    if ["s5" + 34, lambda x: 59, f.f("s9", None)]:\n        total(90, total(None < "s9"), f() * "s3")\n        lst = None\n    else:\n        n = lambda acc: "s5"\n# note\nTrue\ndef total(acc, x):\n    x(91 * [2, True, "s8"])\n    for acc in "s3":\n        return {True: True - 92}\n    if 42:\n        h(70)\nwhile "s8" == x():\n    def g(n, f):\n        return h\nf = None\n# TODO\nif y(None) * y.n():\n    while {"s5": x(None)}:\n        True < True == "s3" + None\n        f\n        fact = n("s1")\n    lambda n: total\n    "s1"\nelse:\n    lambda f: {(lambda fact: "s1"): fact(86, "s1")}\n    f = y()\n    "s2"\n# note\ndef acc(acc, fact):\n    for acc in h(fact):\n        return 22\n        return f("s3" * None, fact(), [])\nx = lambda g: 26\n\nif [n(n), lambda h: 55, lambda acc: 67]:\n    while lst(True == 45):\n        total = x(49) * lst(x < 58)\n        x()\n        x = True\n    n({99 - "s4": None})\nelse:\n    "s8" < fact("s5" + total, fact.total())\n    x()\n\nn = h()\nif {f(True): acc * None}:\n    def acc(total, total):\n        return []\n        return {acc: "s7"} == g.fact()\nelse:\n    x()\n    while True:\n        acc = [n(), lambda fact: f.h(), lambda fact: 5 - True]\n        f = True * True\n        total = 69\n    if (lambda y: f(True)):\n        y = total(x(n.x(), True, "s3"), "s7", g(None) + lst())\nh = {acc() + 55: g.f() - [True]}\nx = f()\nfact = 96\nif [True + fact]:\n    h(f(None, "s6", "s9") == f(g), [lambda acc: 78, total.lst(total), total("s1")], "s4")\n\nh = None\nlambda fact: None\ntotal = fact() < None - None == {None: "s6"} * None < None\nacc = 37\nfor total in x(fact, None):\n    def g(h, acc):\n        return True\n        h = None\nfor y in f < True:\n    None\n    fact = 84\n    def n(y, h):\n        return True\nx = None\nlambda lst: lst.x({None: None}, 22)\nx = {y: x * True} + acc(8)\n["s1" == True == h + "s8", "s8", h()]\n# note\nif h(lambda acc: 4):\n    while {{True: None}: [f, "s5"]}:\n        y = "s8"\n        acc = lambda g: {"s0" < True: f(None, None, True)}\n        h = [x(f(lst, acc), total("s7")), n, 3]\n    "s4" == (lambda total: n())\n    lst(48, acc(), y)\nelse:\n    total = g(fact.f(True), {y(None): None})\n    if x(g()):\n        y = {{g: 16}: True * fact} - total("s0", fact(n))\n    else:\n        fact = "s5" * (lambda acc: lambda f: None)\nx = 1 + 2\nf(x, 3)\nwhile x < 9:\n    x = x + 1\n    g(x)\ny = 2\n',
      steps: [
        {
          op: "dragBlock",
          a: 0.057062783278524876,
          b: 0.5652636853046715,
          where: "block",
        },
        {
          op: "dragSelection",
          a: 0.05667509837076068,
          b: 0.6965691703371704,
          n: 2,
        },
      ],
      motion: "reduced",
      editor: {
        lineNumbers: true,
        lineWrapping: true,
        collapseAll: false,
        reconcile: true,
        anchors: true,
        fastErrors: true,
        skipRoots: true,
        activityLimit: null,
      },
    } as Sequence,
    { baseURL }
  );
  expect(v).toBeNull();
});

test("seed 200: a zoom with line wrapping and line numbers (an editor squeezed to no visible height by the toolbar is not measured, and is not compared with the page)", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 200,
      language: "scheme",
      code: "(or true false)\n\n(define (f a b c) (+ a c))\n",
      steps: [{ op: "zoom", z: 0.99 }],
      motion: "reduced",
      editor: {
        lineNumbers: true,
        lineWrapping: true,
        collapseAll: false,
        reconcile: true,
        anchors: true,
        fastErrors: true,
        skipRoots: true,
        activityLimit: null,
      },
    } as Sequence,
    { baseURL }
  );
  expect(v).toBeNull();
});

test("soak seed 2448: a real cut with no block focused or selected is the browser's own line-wise cut (as in the old editor): the clipboard is checked only when blocks are taken", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 2448,
      language: "python",
      code: 'if __name__ == "__main__":\n    import unittest\n    unittest.main(\'idlelib.idle_test.test_searchengine\', verbosity=2, exit=False)\n\ny(g(), lambda y: 5 + True, x.acc())\n\ndef f(total, n):\n    {y.h(f(), fact()): {lst.lst(True, None): ["s9"]}}\nh(acc())\n[55]\n# note\ng = "s1"\nf = fact(acc(76))\ny\nwhile (lambda acc: None < True):\n    x([total(True, 69)], (lambda y: "s7") < 89)\n    total = lambda y: [lst.x()]\n\n"s8"\n\nh.total("s9", x)\nh = total()\nif total * True == None < True:\n    if (lambda g: h.acc(63, "s0")):\n        g = y.f(h(g.x("s1"), ["s0", 38, None]))\nelse:\n    if n.acc("s2"):\n        g = [lambda n: lst(), acc(), None]\n    else:\n        n.fact()\n        n(7)\n        n = None\nlambda y: True\nlst = acc - 86\n{total(): x(f(True, None), fact(11, True, "s2"), True)}\ndef y(x, n):\n    lst([], lst == g)\nn.acc(fact, lst(n(), g.total(g, None), lst(None, "s1", None)))\ndef fact(x, acc):\n    lst.n([[h], {None: None}])\n    ["s6" < True, {True: None}] - n(n(x, "s0"), f.g(f), g(19))\n# a b c\ng(lambda x: f.n(h, True), g)\nclass DatagramProtocol(BaseProtocol):\n    """Interface for datagram protocol."""\n\n    def datagram_received(self, data, addr):\n        """Called when some datagram is received."""\n\n    def error_received(self, exc):\n        """Called when a send or receive operation raises an OSError.\n\n        (Other than BlockingIOError or InterruptedError.)\n        """\n\n\n\ndef http2time(text):\n    """Returns time in seconds since epoch of time represented by a string.\n\n    Return value is an integer.\n\n    None is returned if the format of str is unrecognized, the time is outside\n    the representable range, or the timezone string is not recognized.  If the\n    string contains no timezone, UTC is assumed.\n\n    The timezone in the string may be numerical (like "-0800" or "+0100") or a\n    string timezone (like "UTC", "GMT", "BST" or "EST").  Currently, only the\n    timezone strings equivalent to UTC (zero offset) are known to the function.\n\n    The function loosely parses the following formats:\n\n    Wed, 09 Feb 1994 22:23:32 GMT       -- HTTP format\n    Tuesday, 08-Feb-94 14:15:29 GMT     -- old rfc850 HTTP format\n    Tuesday, 08-Feb-1994 14:15:29 GMT   -- broken rfc850 HTTP format\n    09 Feb 1994 22:23:32 GMT            -- HTTP format (no weekday)\n    08-Feb-94 14:15:29 GMT              -- rfc850 format (no weekday)\n    08-Feb-1994 14:15:29 GMT            -- broken rfc850 format (no weekday)\n\n    The parser ignores leading and trailing whitespace.  The time may be\n    absent.\n\n    If the year is given with only 2 digits, the function will select the\n    century that makes the year closest to the current date.\n\n    """\n    # fast exit for strictly conforming string\n    m = STRICT_DATE_RE.search(text)\n    if m:\n        g = m.groups()\n        mon = MONTHS_LOWER.index(g[1].lower()) + 1\n        tt = (int(g[2]), mon, int(g[0]),\n              int(g[3]), int(g[4]), float(g[5]))\n        return _timegm(tt)\n\n    # No, we need some messy parsing...\n\nx = 80\nwhile True + True - {True: True}:\n    y = 75\n\n# TODO\nTrue\n\nfact == lst()\n\ndef lst(g, total):\n    while None:\n        return lambda g: y(None, f, True)\n        lambda y: y()\n        [g(), ["s3", "s2"], None] < n(lambda f: "s6", total == 20)\n    {"s2": f(f(59, None), lambda f: x, n(True, "s2", y))}\n    while n([True]):\n        return lambda h: total(True, "s2")\n        acc(h(), total())\n        43\nif lst(n(None, 80, f)):\n    lambda y: lambda y: n - "s8"\n    for y in []:\n        fact = n\n        h = []\n        g = "s2"\n    n(h(True), total(h(None), None < h))\nelse:\n    if True:\n        "s4"\n        lst(lst(None, 20, "s0") - x(lst))\n    else:\n        y = [y(x(True, True, None), True + x)]\n        lst = h(None, [[36, 96], "s5", 64])\n        n(True, True, 24) == 92 < y({"s6": 7}, "s0", "s4")\n    for g in 70:\n        [x()]\n    total = y(31)\nfor h in lst("s6", 21, 62):\n    f()\n    def lst(total, g):\n        None\n        return [h(True), [], h(h)]\n        h == None\nh = lst(43, g(True, True, f.g()))\nTrue == None\nfact = lambda f: g\n"s9" == "s2" - f(None, acc, None)\nf = ["s1", total(fact("s6", 24, "s6"), {55: acc}, h), lambda acc: lambda fact: 70]\nimport traceback\ntry:\n    import fcntl\nexcept ImportError:\n    fcntl = None\n\nif acc():\n    y([98])\n    g.f([], g(acc(40), h(), None * True))\n# a b c\nTrue\n\nlst = (lambda x: f) + n(f(True), True + None, "s3")\n# TODO\nfor n in f("s5", "s2"):\n    def x(f, fact):\n        h(h(), h("s5", True < "s5", h("s8")))\n        {None: "s4"}\n        [[], lst(y(None, None), {11: None}, f(True)), lambda x: True - x]\nacc = y({{"s4": "s0"}: True})\nx = "s4"\n# a b c\n33\nfact = "s0" * f.fact([True, 38, "s5"])\nx = lambda y: total({19: 90})\ndef g(fact, total):\n    if lst([81, True, 87], 38, lambda acc: fact):\n        return g\n        True\n        return y({x: True}, "s8")\n    fact.h(lambda fact: "s3")\n    f\nlambda total: h.g()\n59\n\nif (lambda y: f("s1", None, fact)):\n    if y(41, g) < "s6":\n        n = None\n    x = True\n\n# TODO\nh = True\n\nclass A:\n    def m(self):\n        return 1\nA().m()\nx = 1 + 2\nf(x, 3)\nwhile x < 9:\n    x = x + 1\n    g(x)\ny = 2\nn = True + [fact] + (lambda lst: None)\nf.fact(y.g() == True)\n\nif x:\n    f(1)\nelif y:\n    g()\nelse:\n    h()\n[1, 2]\n\nLOCALHOST = \'127.0.0.1\'\n\n\ndef idle_formatwarning(message, category, filename, lineno, line=None):\n    """Format warnings the IDLE way."""\n\n    s = "\\nWarning (from warnings module):\\n"\n    s += \'  File \\"%s\\", line %s\\n\' % (filename, lineno)\n    if line is None:\n        line = linecache.getline(filename, lineno)\n    line = line.strip()\n    if line:\n        s += "    %s\\n" % line\n    s += "%s: %s\\n" % (category.__name__, message)\n    return s\n\nx = g(y.fact(y, True))\n\n[]\nTrue\n# TODO\nfor fact in 12:\n    "s8"\n    if [acc("s5"), [70, "s6", "s7"], [50]]:\n        lambda lst: g.lst(lambda fact: None, 75 + "s5")\n        True\n        lst = [None, n("s8" + None, None)]\n\ng = lambda h: [True, True, 56]\nwhile h(fact("s8", None), [True, "s8"]):\n    while True:\n        g = lambda n: lambda x: {lst: f}\n        g = lst([None, "s1"] == {None: True}, g(lambda fact: True, x(x, True)))\n    if 10:\n        n(n(y, f.lst("s5"), y(True, None)))\n        fact\n        y = [x(96, 92, lst) * {None: h}, 30 == None < True, True]\n    else:\n        x = lambda x: y()\n        y = {total(g(None, True, 43), None, lambda acc: True): [None, [True, 14, x], lst - True]}\n        n = g(n(), True, None)\nif (lambda lst: 79):\n    lambda h: g(lambda h: g)\n    "s5"\n    while None:\n        f()\n        n.y(lambda h: lst(None, 18, 84), n(y(None, None)))\n        h(n.acc("s3", fact < None))\nif {fact.total(): fact * True}:\n    if n:\n        h = {total(): [x(), n(True, "s0"), acc(True, None)]}\n        [7 + "s0", y(True), y.h()]\n        total(63, "s7" < "s6" == None, lst(total()))\n# note\nlst(None, True < "s4" + True, [lst(True, "s8")])\ny\ny = []\n\ndef n(acc, f):\n    y = total(lst, "s3", acc(lst(lst), g()))\n    while (lambda lst: None) < 39:\n        acc = lst()\n        return lambda f: "s1"\nfact.acc(x.n())\nNone\n# note\ndef g(fact, g):\n    [lambda n: "s0" * None, acc() - acc(acc)]\ntotal = lambda f: {total(y): [x]}\n"s8" < True\n\ng()\ntotal\nfact = x()\nacc = y(True * total("s9", fact, "s4"), 81)\n\nf\n\n"""distutils.command\n\nPackage containing implementation of all the standard Distutils\ncommands."""\n\n\n"""distutils.command\n\nPackage containing implementation of all the standard Distutils\ncommands."""\n\nfrom _weakrefset import WeakSet\n\n\ndef abstractmethod(funcobj):\n    """A decorator indicating abstract methods.\n\n    Requires that the metaclass is ABCMeta or derived from it.  A\n    class that has a metaclass derived from ABCMeta cannot be\n    instantiated unless all of its abstract methods are overridden.\n    The abstract methods can be called using any of the normal\n    \'super\' call mechanisms.\n\n    Usage:\n\n        class C(metaclass=ABCMeta):\n            @abstractmethod\n            def my_abstract_method(self, ...):\n                ...\n    """\n    funcobj.__isabstractmethod__ = True\n    return funcobj\n\n\ndef f(a, b):\n    y = a\n    return y\nf(1, 2)\n\n# note\nif x():\n    lambda x: f(n, y(), lst())\n# note\nacc = "s0"\n# a b c\n[{True: 38}, total(True)] - 50\n\n# a b c\ng.acc(total(6, n(y), fact), [None, "s9", [h]])\n\nfrom _weakrefset import WeakSet\n\n\ndef abstractmethod(funcobj):\n    """A decorator indicating abstract methods.\n\n    Requires that the metaclass is ABCMeta or derived from it.  A\n    class that has a metaclass derived from ABCMeta cannot be\n    instantiated unless all of its abstract methods are overridden.\n    The abstract methods can be called using any of the normal\n    \'super\' call mechanisms.\n\n    Usage:\n\n        class C(metaclass=ABCMeta):\n            @abstractmethod\n            def my_abstract_method(self, ...):\n                ...\n    """\n    funcobj.__isabstractmethod__ = True\n    return funcobj\n\n\nfact(lst, acc())\n\nx = True\ny = "s7" == (lambda fact: y.fact(8))\nfact = {50 - True * None * g: lambda y: fact.x(None)}\nh = fact(lst({43: True}), 53, acc(g(), 82 * True, g("s3")))\nif {y.h(None): n}:\n    while None + None + 92:\n        f = h([total, f(11, "s0")], [True == 67, acc(True), h(lst, None)])\n        "s4"\n        y(True, h(23 + None), acc())\n    while (lambda f: lambda g: True):\n        fact = fact(h(), total(True))\n        total = []\n        fact = acc(f.fact() * acc)\ng(n(x(), 72 < "s2"), {95: n} < "s9", [lambda fact: None])\nNone\n\n# note\nwhile g(acc(True, "s4"), "s0", y.x(None, h)):\n    24\n# a b c\nfact = g(n.fact("s5", None) + lst.fact("s5"))\ndef acc(acc, f):\n    if [None, None, None] * (lambda x: None):\n        51\n        return None < None\n        x(62 == "s0" < True == True, n(None, None), lambda total: True)\n    "s7" == "s3"\n    h = lambda lst: x()\nclass A:\n    def m(self):\n        return 1\nA().m()\n\n# TODO\nx()\n# TODO\nif acc(y("s1"), True, {"s3": fact}):\n    n = total(acc([], n(62, acc)), acc(fact.f(True), [], {None: "s8"}), {None: "s9"} == (lambda total: "s2"))\n    f = "s8"\nelse:\n    def lst(y, acc):\n        lambda h: "s0"\n        return 97\ntotal = [f(True, None)] == acc("s9" + None, acc("s9", True, "s5"))\nlambda fact: [None, y("s5", h, None), y < None]\n# note\nTrue\ndef lst(h, total):\n    if y(True, lambda total: "s0", g.h()):\n        return []\n        40\n    else:\n        h(True * (lambda total: "s3"), x(lst))\n        y([[]], x.x(fact(True, h, True)))\n    if g("s3", f):\n        return []\n    n(lambda n: x, True, f(40, lambda y: n))\ny = f(None)\nif g:\n    lst = y.f({True: lambda g: 99})\n    def h(f, lst):\n        h = total\nelse:\n    n = True < f(True, lst * None, 7 * 2)\n    lambda total: lambda lst: x.total(None, None)\n    while {True: lambda lst: True}:\n        x = 90\n\nif y("s8"):\n    x = [["s9", lambda fact: 1, lst.g(h, True)], "s6"]\n    while True:\n        {"s6": y(fact(), f())}\nelse:\n    if True:\n        total() + g\n    else:\n        total = {{True - 68: "s9" < 86}: f.fact(h("s9"))}\n        n = f(total(27, "s6")) == True * lst(True, "s7")\n        n = fact("s7", acc, lambda h: g.g(84, 97))\n\n# a comment\ntotal = 0\nfor x in [1, 2, 3]:\n    total = total + x\nprint(total, "done")\nclass KeysView(MappingView, Set):\n\n    __slots__ = ()\n\n    @classmethod\n    def _from_iterable(self, it):\n        return set(it)\n\n    def __contains__(self, key):\n        return key in self._mapping\n\n    def __iter__(self):\n        yield from self._mapping\n\n\nlambda x: y(x) < h(n, None, "s1")\n\nf(acc(None, fact == "s2"))\nacc = lst()\ndef acc(total, total):\n    if total():\n        n.n({fact(53, 96): {93: None}}, g())\nn\n# a b c\nif {"s0": True} < 17:\n    f = total() - g("s6" + None, True)\nif "s3":\n    h = lambda h: lambda y: True\n# TODO\nfact = f()\nx = total("s2", {(lambda x: None): []}, total("s3") * g())\ndef x(x, y):\n    def n(f, y):\n        x = total()\n        89 - n(28, n) * fact() < True\n        f = n(lst())\n    total = n(h(True, lambda lst: "s7", h.g(g)), n())\n    def n(g, f):\n        return y(x(True), lst)\n        n\nlst = y.f(total.y(), "s4")\ny = fact(total(n()), {lst(True, total, x): total(61, 22)}, h)\nlst = f\n\n\ndef create_subprocess_exec(program, *args, stdin=None, stdout=None,\n                           stderr=None, loop=None,\n                           limit=streams._DEFAULT_LIMIT, **kwds):\n    if loop is None:\n        loop = events.get_event_loop()\n    protocol_factory = lambda: SubprocessStreamProtocol(limit=limit,\n                                                        loop=loop)\n    transport, protocol = yield from loop.subprocess_exec(\n                                            protocol_factory,\n                                            program, *args,\n                                            stdin=stdin, stdout=stdout,\n                                            stderr=stderr, **kwds)\n    return Process(transport, protocol, loop)\n\n\n# a comment\ntotal = 0\nfor x in [1, 2, 3]:\n    total = total + x\nprint(total, "done")\nx.acc()\n# a b c\n73\ndef total(g, y):\n    []\nlst\nfor x in "s5":\n    for g in "s0":\n        total = []\n        lst(None)\n        total(True, y(88 - "s7", acc("s0", True, g), h(n, 31, True)))\n    if {[28]: [lst, h]}:\n        h(lambda lst: "s8" * 85, h(lambda f: True, None))\n        n = f(acc, [])\n        y = f(y({None: "s0"}, lambda h: 16, x(lst)))\n    f()\nlst = None < None\ndef f(n, g):\n    g = fact(fact(), f(), True + True)\ng = g(acc(None, None, n(None, None, acc)), fact("s5", None), total(True, h(True, True)))\n# a b c\nfor n in True * None:\n    lst(None)\ndef remoteref(obj):\n    oid = id(obj)\n    objecttable[oid] = obj\n    return RemoteProxy(oid)\n\n\n\n# TODO\nn = f(y(g(None, None, 58), total(True, 1)), [lambda fact: 48], x.x())\n\nfact()\nwhile [lambda lst: 83, {True: True}]:\n    True\n    [f(), "s1"]\n    lst()\n22\ndef y(x, acc):\n    y(x(x - None, ["s1", g, h], [True, f]))\n    None\n    if lst():\n        None\n        return fact(41 == None)\n# note\nlst(63 == [], None * None)\n\n(lambda total: [True]) + lst\ntotal = lambda g: 85 * x(True)\n\n# note\nlst\n(lambda lst: g(None, None, "s4")) * g * 92 == x()\n\nlst = [total(acc(), acc(60, "s1"), 84), x(g("s1", "s8", True), None, True), None - g.g("s2", acc)]\nif "s3":\n    def f(y, n):\n        n.x()\n    lambda fact: "s5"\n[{81: fact("s2", 67)}]\nn = None\ny = True\n\n# a b c\nwhile (lambda f: total.g(None)):\n    if (lambda n: h):\n        None\nif [acc, 81, "s4"] < None + y:\n    n = []\n    while None:\n        lst.h(n.lst(), None + "s4") - y(None + None)\n        y = None\n        h = 29\nelse:\n    34\n    None\n    x(lambda acc: "s1")\n\nx = x(lst(), y(lst), fact())\n\nf = [lambda acc: n(True, acc), None, None]\nx = x.acc()\nlst = 46\nwhile f.lst(total()):\n    if None:\n        lst = [lambda h: lambda total: None, x(g(lst), g)]\n    None\ndef fact(x, lst):\n    x = None\n    acc = total()\n\n\nh = [] * n()\nlambda total: True\nlst = None\ntotal = y(y, 8) == x(62, ["s9"], g("s7", 51, acc))\n# a b c\nf = g([lambda lst: None, h.x(lst), total(None, None, True)], None, f(lambda g: "s9", lambda y: True))\nif (lambda acc: fact(True, None, g)):\n    lst = lst(g.x(None + 80, h.total()), None - "s9" + (lambda y: 97))\n\n# note\ndef n(fact, total):\n    n = total.lst()\n    h = 65\nif "s6" < fact(43, 19, "s7"):\n    if {True: y} - acc("s5", "s3", 56):\n        y = fact(None)\n    n()\nlst = fact("s1", lambda fact: lambda n: total, h())\n# note\n# a b c\nfor h in 98:\n    if [[h, True]]:\n        total = True\n        lambda total: lambda lst: None < True\n        n.y([y.n(), g.fact(True)], 4 == None * acc)\n    fact()\nif 55:\n    g = True\n    {acc + [None, None, "s1"]: fact(16)}\n    if f():\n        f = y([n(), f.x("s8"), lambda f: True])\n        y = x.y()\n        h = acc({49: True}, n(), g(h(23, None), "s5" == "s3", [None]))\n    else:\n        h = total\ny = None\ny = lambda fact: "s8"\nfor g in "s0":\n    {[{True: "s4"}, [None, total, f]]: "s2"}\n    if True:\n        lst = g\n\nTrue\nif g():\n    []\nelse:\n    total([n.lst("s7"), []], "s3", {24: n})\n    y = g(lst())\n    f = {total(54, None) == h: 19}\nlambda y: total(total.h(76), total(20))\nif lst():\n    n = 24\n    if 9:\n        acc = True\nfact(True, x(), 93)\ntotal = g(h(x), h, x(fact)) < (lambda g: 85)\n# a b c\nlambda h: y(h(None, None, None))\n\ndef h(f, y):\n    [{True: x}] < "s7"\nif h("s8", True):\n    while acc(h, lambda x: 77):\n        lst = fact([], "s7", {69 * True: fact()})\n        lambda acc: ["s0", n, "s7"] < x("s3", True, None)\n        [] < 87\nn = 98\ndef fact(g, x):\n    while 72:\n        "s9"\n        return [n]\n    def f(y, acc):\n        {None: lst()}\n        h()\n\ndef f(a, b):\n    y = a\n    return y\nf(1, 2)\n# a comment\ntotal = 0\nfor x in [1, 2, 3]:\n    total = total + x\nprint(total, "done")\nfrom _weakrefset import WeakSet\n\n\ndef abstractmethod(funcobj):\n    """A decorator indicating abstract methods.\n\n    Requires that the metaclass is ABCMeta or derived from it.  A\n    class that has a metaclass derived from ABCMeta cannot be\n    instantiated unless all of its abstract methods are overridden.\n    The abstract methods can be called using any of the normal\n    \'super\' call mechanisms.\n\n    Usage:\n\n        class C(metaclass=ABCMeta):\n            @abstractmethod\n            def my_abstract_method(self, ...):\n                ...\n    """\n    funcobj.__isabstractmethod__ = True\n    return funcobj\n\n\n\n# note\nlst = [lambda total: n.acc(True, lst), x.n()]\n\nacc = lambda fact: True\ndef x(lst, lst):\n    x = True\n    for f in n:\n        38\n        return y() == "s6"\n        return f("s5")\n    f = y() == (lambda f: g(95))\ny = g(lambda n: 2 < fact)\nlst = True\nfor acc in []:\n    y = total.x()\nacc = None\nh = h({x("s7", "s7"): None - True}, True)\ndef y(g, n):\n    lst = h + g()\n\nif x:\n    f(1)\nelif y:\n    g()\nelse:\n    h()\n[1, 2]\nLOCALHOST = \'127.0.0.1\'\n\n\ndef idle_formatwarning(message, category, filename, lineno, line=None):\n    """Format warnings the IDLE way."""\n\n    s = "\\nWarning (from warnings module):\\n"\n    s += \'  File \\"%s\\", line %s\\n\' % (filename, lineno)\n    if line is None:\n        line = linecache.getline(filename, lineno)\n    line = line.strip()\n    if line:\n        s += "    %s\\n" % line\n    s += "%s: %s\\n" % (category.__name__, message)\n    return s\n\n\nimport random\n\n\nclass Block(Turtle):\n\n    def __init__(self, size):\n        self.size = size\n        Turtle.__init__(self, shape="square", visible=False)\n        self.pu()\n        self.shapesize(size * 1.5, 1.5, 2) # square-->rectangle\n        self.fillcolor("black")\n        self.st()\n\n    def glow(self):\n        self.fillcolor("red")\n\n    def unglow(self):\n        self.fillcolor("black")\n\n    def __repr__(self):\n        return "Block size: {0}".format(self.size)\n\n\ndef f(a, b):\n    y = a\n    return y\nf(1, 2)\nfrom _collections_abc import *\nfrom _collections_abc import __all__\n\n\ndef acc(y, fact):\n    [fact(), lst(30, g.total(None, True)), acc("s7")]\n    if lst.g():\n        ["s4", True, lst(y(None, 7), acc < 80)]\n        return lambda g: h(None, True)\n    acc = lambda acc: 77\ntotal.fact()\nif [acc.n(), 84]:\n    True\n    fact() < fact\ndef g(y, h):\n    if "s3":\n        acc(x(5, "s0", f) == x(True, True), {(lambda lst: "s9"): fact(95)})\n        lst.f(total(), lambda n: h())\n    def total(fact, y):\n        lst = n()\n        fact(total(total, "s1"))\nf = lambda f: None\nif 14:\n    total = [lambda n: total()]\n    if True:\n        y = lambda fact: {fact: x(97, acc)}\n    else:\n        y = y(68, n + 41 - "s5")\n        g = None\n    x(g(g < lst), total(39, lambda n: g))\nelse:\n    h("s6", lambda g: f("s5"))\nacc()\n\nif acc([True, "s6", 83], g.f(), 3):\n    for total in acc():\n        x = 34\n        total = n\n    [n]\n\nwhile total.g(None, fact.lst()):\n    lambda h: "s2"\n    if [[None, None, f]]:\n        total()\n        (lambda fact: fact("s8")) == g < (lambda x: 28)\n    else:\n        g = x.total()\n        x = {n(79): lst.y()}\n# TODO\nfact = True\ny(65 == fact < [None, lst, 78], {True: lambda n: None})\n# a b c\nx = [lambda fact: acc("s1", "s6")]\nacc()\nTrue\nx(lambda f: lambda lst: total, [y + None])\n43\n[[h(), y(True, True)]]\n[lst(), {g("s2", None): {lst: None}}, f(lambda fact: None)]\n# a b c\nn = 76\n\n# TODO\n[(lambda y: 69) + None, {{"s5": 22}: 47}]\n\nfor fact in None:\n    True\nn(n(), x(g("s9", True), None, fact == 11))\n"""distutils.command\n\nPackage containing implementation of all the standard Distutils\ncommands."""\n\n# note\nfor f in y:\n    if f:\n        total = {x(acc(38, 44), 27): {True: "s8"} == "s6"}\n        acc = 23\n    while (lambda lst: 97) < "s9":\n        acc = "s7" - True\n        total = h([True, "s8", None], fact(lambda g: 70, y(9, True, None), lambda acc: x), n(None, [], x))\n    g = [True, 45 == None * 14 + None, fact(lambda acc: None, total("s6", None, None))]\nx = 1 + 2\nf(x, 3)\nwhile x < 9:\n    x = x + 1\n    g(x)\ny = 2\nif total:\n    if x:\n        []\n        fact = [lambda fact: [69], f]\n    def lst(f, total):\n        x = h()\n        return g(32, 94) - (lambda h: True)\nelse:\n    fact = acc()\n    "s8"\ntotal = {(lambda g: f()): lambda h: y(69)}\nn = h(None)\n\nh = n(f())\nfor n in 92:\n    def fact(f, y):\n        return n\n        f = y(lambda lst: True * 90)\n        return fact()\n    lst(h(), 71 * None)\n    if None:\n        acc = "s1"\n        y(95, {True: "s8"})\n    else:\n        acc = fact == None\n        acc = None\n{(lambda f: None): g()}\n# note\n{"s9": lst()}\n\n\nclass A:\n    def m(self):\n        return 1\nA().m()\ntotal = [fact()]\n\nfact = g(acc(7 * True), n(h, True * g, {63: "s2"}))\ndef create_subprocess_exec(program, *args, stdin=None, stdout=None,\n                           stderr=None, loop=None,\n                           limit=streams._DEFAULT_LIMIT, **kwds):\n    if loop is None:\n        loop = events.get_event_loop()\n    protocol_factory = lambda: SubprocessStreamProtocol(limit=limit,\n                                                        loop=loop)\n    transport, protocol = yield from loop.subprocess_exec(\n                                            protocol_factory,\n                                            program, *args,\n                                            stdin=stdin, stdout=stdout,\n                                            stderr=stderr, **kwds)\n    return Process(transport, protocol, loop)\n\n# note\nh = lst(h, lst)\n\nwhile x({23: True}, lambda acc: 0):\n    [lambda fact: lambda h: 99, g, {h(70, 41, 73): {"s1": h}}]\ndef main():\n    s = Screen()\n    s.bgcolor("black")\n    p=Turtle()\n    p.speed(0)\n    p.hideturtle()\n    p.pencolor("red")\n    p.pensize(3)\n\n    s.tracer(36,0)\n\n    at = clock()\n    mn_eck(p, 36, 19)\n    et = clock()\n    z1 = et-at\n\n    sleep(1)\n\n    at = clock()\n    while any([t.undobufferentries() for t in s.turtles()]):\n        for t in s.turtles():\n            t.undo()\n    et = clock()\n    return "runtime: %.3f sec" % (z1+et-at)\n\n\n\nwhile {None: lambda acc: "s3"}:\n    g = [11, "s3"]\n# TODO\ng = y(lst(True), "s9")\nwhile 37 + True:\n    x(True, n(True - None), n(n(acc, 78), True, {n: "s7"}))\n"s2"\n# TODO\nfor total in True:\n    total = None\nTrue\nif {total(None, "s1", "s0"): 84}:\n    "s6"\n    h = {y([49, g, g], {"s6": g}): g(["s2"], f("s0"))}\n    g(lst, None, True == 61 - "s6")\n\nif n.g(None * None, fact(n, None, None)):\n    None\n    if total:\n        lambda total: [lst * h, None]\n        y = (lambda total: 31) - 30\n        f = {True: 23 < lst()}\nacc = [] == f()\n# TODO\ny = y(True, "s2")\ng()\nif __name__ == "__main__":\n    main()\n    turtle.mainloop()\n\n# note\nf(45, 21)\n\nwhile (lambda total: n(71, 89, 20)):\n    def h(total, x):\n        n = g([], [y(34, y), [lst]], y() - n)\n    h = n.f(None, None) - h(f(None), None)\nh(x(56), 28)\nwhile h({"s6": True}, h(None), lst(None, "s8", acc)):\n    None == n(50) + None\n\n# a comment\ntotal = 0\nfor x in [1, 2, 3]:\n    total = total + x\nprint(total, "done")\nTrue\ntotal = fact() == None + True * [True, acc, 92]\n\nNone\nn = total\nTrue\n\nif x:\n    f(1)\nelif y:\n    g()\nelse:\n    h()\n[1, 2]\nclass MSVCCompiler(CCompiler) :\n    """Concrete class that implements an interface to Microsoft Visual C++,\n       as defined by the CCompiler abstract class."""\n\n    compiler_type = \'msvc\'\n\n    # Just set this so CCompiler\'s constructor doesn\'t barf.  We currently\n    # don\'t use the \'set_executables()\' bureaucracy provided by CCompiler,\n    # as it really isn\'t necessary for this sort of single-compiler class.\n    # Would be nice to have a consistent interface with UnixCCompiler,\n    # though, so it\'s worth thinking about.\n    executables = {}\n\n    # Private class data (need to distinguish C from C++ source for compiler)\n    _c_extensions = [\'.c\']\n    _cpp_extensions = [\'.cc\', \'.cpp\', \'.cxx\']\n    _rc_extensions = [\'.rc\']\n    _mc_extensions = [\'.mc\']\n\n    # Needed for the filename generation methods provided by the\n    # base class, CCompiler.\n    src_extensions = (_c_extensions + _cpp_extensions +\n                      _rc_extensions + _mc_extensions)\n    res_extension = \'.res\'\n    obj_extension = \'.obj\'\n    static_lib_extension = \'.lib\'\n    shared_lib_extension = \'.dll\'\n    static_lib_format = shared_lib_format = \'%s%s\'\n    exe_extension = \'.exe\'\n\n\n    def __init__(self, verbose=0, dry_run=0, force=0):\n        CCompiler.__init__ (self, verbose, dry_run, force)\n        # target platform (.plat_name is consistent with \'bdist\')\n        self.plat_name = None\n        self.initialized = False\n\n    def initialize(self, plat_name=None):\n        # multi-init means we would need to check platform same each time...\n        assert not self.initialized, "don\'t init multiple times"\ncodec = _codecs_cn.getcodec(\'gb18030\')\n\nclass Codec(codecs.Codec):\n    encode = codec.encode\n    decode = codec.decode\n\ny = [] + y - fact + 51\n# TODO\nh = True\ndef h(total, g):\n    g(y.f(), f(lambda n: None))\n    [total() < "s4", None, g(True, "s2", 27) - True + None]\nfact = {n(x(True, 1), 19 - True): f(True) < fact(f, 14, f)}\nfor lst in lst():\n    [lst(fact) + acc("s7", 98), {lst.x(True, True): lambda f: 91}]\n\ng()\ny = x(None, "s8", y(31, g()))\ng([72 + "s2"], [total.acc(), lambda n: True], lambda h: g(True))\nh.lst(n)\n\nwhile y(True, y(), 69):\n    if True:\n        n = fact\n        True\n        g(True, "s9" < lst(True, "s8", acc))\n    def acc(total, h):\n        g\n        lst = {y(): "s6"}\n        return lst\nx = g.acc(lambda f: lst(True), y())\n\nlambda n: 63\nwhile None:\n    lambda y: lambda fact: y.f("s0", None)\n\n{(lambda f: lambda acc: "s3"): "s3"}\ng.fact({True: True}) - lst({True: lst})\nf(total())\n\ntotal = n(fact(True), {y: acc}, None) - True\ny = f("s1" * True) == acc.f(None, lst) * (lambda lst: "s7")\nf = [43, lst * g < None]\n\n# a b c\nx = g({"s0" - total: True})\n# a b c\nif 20:\n    fact = g\n    n.y()\n    if x:\n        acc = lambda acc: [["s5", "s0", 80], y.n(f)]\nwhile None:\n    lambda h: lambda f: g.x(True)\nwhile {fact: 67} == 92:\n    acc = True\n    lambda acc: [acc] * y()\nif total(lambda lst: 15):\n    if {n.g(True): total()}:\n        n = [] == "s6"\n        [[True, n(), f("s2", fact, True)], y(None) - y(62), {acc(12, None, True): total(total, "s0", acc)}]\n    x(lambda g: h.total(True, fact), acc(lambda acc: total), x())\n    for y in True - 43:\n        h = lambda fact: h(True, {"s7": acc}, fact(None))\n"s8"\nif total({True: "s1"}, fact):\n    x = {None: True} + x\n    28\n    if x(5):\n        x = h(None, total(total, g(None, "s1"), lambda n: 24), "s5")\n        g\n        y = total\nx = None\n\n# a b c\ng = acc\ndef f(x, x):\n    while {None == 81: True + True}:\n        {None: "s4" == (lambda y: 35)}\n    if ["s6", fact] + f(8, total, True):\n        {x(lambda x: None, lst(None, None), x(6, y)): (lambda f: 5) < y(None, 6)}\n        86\n    h = [n()] * f(lambda y: None, f(True, "s0", "s6"), g())\nwhile n - n(40, True):\n    None\n    h.y(["s2", g("s8", None, 75)], x.g(y.fact()))\ndef g(x, acc):\n    if ["s4", 41 < "s7", lambda f: None]:\n        return y\n    "s6"\n{total(True): lambda n: 56}\nif g(g.h(9), lambda x: 79, True):\n    def h(lst, y):\n        x = n(x())\n        lambda acc: True\n    fact = True == "s6"\nlst(f(), n([True, True], lst(64)))\n\n# TODO\ny = y()\nacc = "s9"\ntotal(g(fact("s4", 90, acc), lst(True, h)))\ndef f(f, lst):\n    fact = 50\n    for h in {total: h}:\n        return 59\n        None\n# note\nh() - True\n# note\n# a b c\n"s9"\nif "s7":\n    for h in f(True, g):\n        lst = []\nelse:\n    f()\nwhile g.x():\n    x = {y.y(): total(True, "s3" == "s9", {18: 99})}\n',
      steps: [
        { op: "scroll", a: 0.5136409304104745 },
        { op: "longPress", a: 0.6611106730997562 },
        {
          op: "resize",
          w: 0.8301438943017274,
          h: 0.13386828894726932,
          wrap: "off",
        },
        {
          op: "dragSelection",
          a: 0.6243121000006795,
          b: 0.6875886679627001,
          n: 2,
        },
        {
          op: "clipboard",
          a: 0.8933647975791246,
          b: 0.8773319434840232,
          n: 1,
          how: "cut",
          to: "gap",
          accept: true,
        },
      ],
      motion: "full",
      editor: {
        lineNumbers: true,
        lineWrapping: false,
        collapseAll: false,
        reconcile: true,
        anchors: true,
        fastErrors: true,
        skipRoots: true,
        activityLimit: null,
      },
    } as Sequence,
    { baseURL }
  );
  expect(v).toBeNull();
});

test("soak seed 3395: a real copy with no block focused or selected is the browser's own line-wise copy (as in the old editor): the clipboard is checked only when blocks are taken", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 3395,
      language: "python",
      code: 'x = 1 + 2\nf(x, 3)\nwhile x < 9:\n    x = x + 1\n    g(x)\ny = 2\n# a b c\n# a b c\nfor lst in "s1":\n    [y.acc() == 66]\nif x.n() == fact(None, 36):\n    y = g()\n    while (lambda total: lambda fact: "s1"):\n        x([y(True)], "s7" - n == f(None, None))\n        f = g\n        h = {32: lambda x: True}\n    lst = x()\nTrue\nx = True\ny = None + None - (lambda g: acc) == f()\n\nif acc.x(lambda lst: 44):\n    acc = None\nelse:\n    if total(lambda total: total, {None: None}):\n        lambda x: lst(78, f("s0", None))\n        total() * f()\n        y = total("s7", lambda lst: acc.acc(98, lst))\n    else:\n        h = [] * "s1"\n        f = lambda total: True\n    True\ng = [x(34), "s6", total()] - total(53 * True)\nh = {fact(x, 54 * True, 1): "s6"}\n\ny = [f()]\nacc = n.total(lst(lambda x: lst, 1 - x, [y, None, True]))\n\nn = {[lst(), lst < "s5", {True: y}]: y < 87 - n(None)}\nfor total in 72:\n    [f(73 - "s4")]\ndef x(h, f):\n    f(n("s6", lst) + x(None, None), {(lambda total: True): 9}, x(y(g, True), None, h(None, f)))\nif total(9, lst(None, lst, True), True):\n    if [lambda acc: "s8", lst]:\n        x = "s1" == "s1" + y(acc(66, f))\n        fact = True\n    else:\n        {g(): h}\n        x = 37\n    None - (lambda lst: 34)\nelse:\n    for lst in g == None:\n        x = []\ndef g(x, g):\n    while x(acc):\n        h = lambda x: fact({None: lst}, g.n("s5", True))\nif {[]: lambda n: 42}:\n    y = (lambda h: True) * 35\n    def g(g, f):\n        return []\n    None\nfact = lambda y: f()\nn = lst()\ndef lst(lst, acc):\n    21\n# TODO\nlog = _global_log.log\ndebug = _global_log.debug\ninfo = _global_log.info\nwarn = _global_log.warn\n\nNone\nlst.acc([lambda h: True, x("s1"), total < 7])\nif y:\n    None\n    for total in acc():\n        y = {n(): x(h(73, 50, 69), fact("s1", lst, 6))}\n        acc = lst(total(None, None + 64), fact(n, None) == 65, y())\n        [h(None < g, 94), None, 3]\n{[] + g: lambda acc: True * None}\n\ny = lst\nf = []\nf = total.f()\ndef total(lst, fact):\n    for lst in None == 85:\n        return x\n        return [lambda n: None]\n    y(total("s8", lst, acc) + n.total())\nif None:\n    n = [None, fact(total(True, True, "s6")), acc.fact()]\n    64\n\ndef f(a, b):\n    y = a\n    return y\nf(1, 2)\n# note\nh = [[f.g(True), x(None, h, 42), g.f(fact)], fact]\n# note\ny = None + acc\nwhile "s7":\n    def h(x, f):\n        return f(32, True)\n        total(lambda x: lambda n: n, g.fact(), fact())\n        fact(None, lambda y: 24) - "s2"\n    []\nx = 1 + 2\nf(x, 3)\nwhile x < 9:\n    x = x + 1\n    g(x)\ny = 2\nif acc(None):\n    f = lst(fact(None, True, True)) + True + None\n    n\n    def n(total, n):\n        return f([])\n        return {True < 15: [True, True]}\n        [acc(), None, 62]\nelse:\n    {lst.g(): y(lambda fact: None)}\n    h = g()\ny.x(lambda x: {None: 86}, [lst.h(None), total(17), h(True, f, None)])\n\nif n(f()):\n    "s5"\nelse:\n    for n in True * 71:\n        acc = 57\n        y = g(y, "s1", x(g("s0")))\n        lst = 73\n    def g(acc, h):\n        return 98\n    fact = f\n93 + x.g([n], [2, True, h])\n# a b c\nf\nif h.g({8: None}):\n    for y in True:\n        total = {(lambda g: []): None}\n    x = g(acc() + None, g("s4", None, 16) + acc(), [fact])\nn(h(True, total, None)) - (lambda n: x.acc())\nacc = lambda y: g(n.acc())\ny(g, [fact(None, g, x), f(92)], lambda lst: "s2" * True)\n{lst() == n(fact): lst}\nif y(None, x("s8", True, None)):\n    while y("s8"):\n        g()\n        True\n    while ["s6"]:\n        f = lst(n, 52)\n        y = True\n    n = g(h.h([]))\n# TODO\nfor n in None + g:\n    if x() == x.total():\n        f\n        n = {None: total()}\n        28\n    else:\n        h = 96\n        acc()\n\n\n# TODO\n# a b c\nlst = h\nf = g(acc(None, fact(51, True)))\nfor y in f.y(True, "s3"):\n    for f in acc.x("s6", 49):\n        lambda h: ["s4" * True, lambda fact: 59]\n    y = "s7"\n# TODO\n[]\nacc = True\nwhile f:\n    h(y())\n    while fact(True, total, h("s7", y, acc)):\n        total((lambda f: "s4") - "s3", fact(57, None) == x.f(), acc(lambda total: None, lambda y: None, True * True))\n        acc(True) - y()\n        y = lambda x: None\ndef lst(fact, lst):\n    return [None, lambda total: True]\n    y = []\ndef http2time(text):\n    """Returns time in seconds since epoch of time represented by a string.\n\n    Return value is an integer.\n\n    None is returned if the format of str is unrecognized, the time is outside\n    the representable range, or the timezone string is not recognized.  If the\n    string contains no timezone, UTC is assumed.\n\n    The timezone in the string may be numerical (like "-0800" or "+0100") or a\n    string timezone (like "UTC", "GMT", "BST" or "EST").  Currently, only the\n    timezone strings equivalent to UTC (zero offset) are known to the function.\n\n    The function loosely parses the following formats:\n\n    Wed, 09 Feb 1994 22:23:32 GMT       -- HTTP format\n    Tuesday, 08-Feb-94 14:15:29 GMT     -- old rfc850 HTTP format\n    Tuesday, 08-Feb-1994 14:15:29 GMT   -- broken rfc850 HTTP format\n    09 Feb 1994 22:23:32 GMT            -- HTTP format (no weekday)\n    08-Feb-94 14:15:29 GMT              -- rfc850 format (no weekday)\n    08-Feb-1994 14:15:29 GMT            -- broken rfc850 format (no weekday)\n\n    The parser ignores leading and trailing whitespace.  The time may be\n    absent.\n\n    If the year is given with only 2 digits, the function will select the\n    century that makes the year closest to the current date.\n\n    """\n    # fast exit for strictly conforming string\n    m = STRICT_DATE_RE.search(text)\n    if m:\n        g = m.groups()\n        mon = MONTHS_LOWER.index(g[1].lower()) + 1\n        tt = (int(g[2]), mon, int(g[0]),\n              int(g[3]), int(g[4]), float(g[5]))\n        return _timegm(tt)\n\n    # No, we need some messy parsing...\n\n# note\n# note\nx = g([{62: "s9"}, g(True)])\nif fact("s4" - n, True + True, h(None)):\n    acc = {"s2": 87}\nelse:\n    if 31:\n        lst = h(n(93 == 72, None * "s2"), x(None, True), total.fact())\n        lambda total: "s3"\n    else:\n        total = acc < {[acc, None, "s1"]: y.total()}\n[h("s3" - 15, n(True), 42 < "s1"), []]\n# a b c\n[{{n: 34}: "s7" * 48}, lambda fact: None, {True: "s7"}]\n# a b c\ntotal = y * "s2"\n# a b c\nx = [73, acc(), [fact(), [59, None, "s9"], lambda lst: lst]]\ntotal = y(None)\ndef fixb2context(root):\n    \'\'\'Removed bad AquaTk Button-2 (right) and Paste bindings.\n\n    They prevent context menu access and seem to be gone in AquaTk8.6.\n    See issue #24801.\n    \'\'\'\n    root.unbind_class(\'Text\', \'<B2>\')\n    root.unbind_class(\'Text\', \'<B2-Motion>\')\n    root.unbind_class(\'Text\', \'<<PasteSelection>>\')\n\nlst = [x(), y()]\n\ndef n(acc, f):\n    if True == None - [76]:\n        None\n        return x(y(True), True)\n        return {[True, fact]: acc(lst, y, True)}\n    total = {"s7": True * lst("s9", "s8")}\n    acc = lambda h: fact(21)\n[lambda x: True]\nTrue\nfor total in {"s7": True}:\n    if "s6":\n        x = lst()\n        h = acc(acc("s6", "s6"), h, y() == [True, True, n])\n        f = g\n\nclass DatagramProtocol(BaseProtocol):\n    """Interface for datagram protocol."""\n\n    def datagram_received(self, data, addr):\n        """Called when some datagram is received."""\n\n    def error_received(self, exc):\n        """Called when a send or receive operation raises an OSError.\n\n        (Other than BlockingIOError or InterruptedError.)\n        """\n\n\nif {lst: None}:\n    True\nh = total(33, g()) == total(n - "s4")\nlst = 90\nif acc():\n    g(f()) - {f(): h()}\n\nh = acc(total(acc(), acc, lst(89, "s3")), None)\n',
      steps: [
        {
          op: "clipboard",
          a: 0.241735435789451,
          b: 0.8599013364873827,
          n: 1,
          how: "cut",
          to: "gap",
          accept: true,
        },
        {
          op: "clipboard",
          a: 0.4529189926106483,
          b: 0.06612001382745802,
          n: 1,
          how: "copy",
          to: "block",
          accept: false,
        },
      ],
      motion: "full",
      editor: {
        lineNumbers: false,
        lineWrapping: true,
        collapseAll: false,
        reconcile: true,
        anchors: true,
        fastErrors: true,
        skipRoots: true,
        activityLimit: null,
      },
    } as Sequence,
    { baseURL }
  );
  expect(v).toBeNull();
});

test("soak seed 1814: the gutter follows a line that wraps after the text/blocks toggle (the toggle changes the heights with no update that says so: the heights are checked again after it)", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 1814,
      language: "python",
      code: 'class MSVCCompiler(CCompiler) :\n    """Concrete class that implements an interface to Microsoft Visual C++,\n       as defined by the CCompiler abstract class."""\n\n    compiler_type = \'msvc\'\n\n    # Just set this so CCompiler\'s constructor doesn\'t barf.  We currently\n    # don\'t use the \'set_executables()\' bureaucracy provided by CCompiler,\n    # as it really isn\'t necessary for this sort of single-compiler class.\n    # Would be nice to have a consistent interface with UnixCCompiler,\n    # though, so it\'s worth thinking about.\n    executables = {}\n\n    # Private class data (need to distinguish C from C++ source for compiler)\n    _c_extensions = [\'.c\']\n    _cpp_extensions = [\'.cc\', \'.cpp\', \'.cxx\']\n    _rc_extensions = [\'.rc\']\n    _mc_extensions = [\'.mc\']\n\n    # Needed for the filename generation methods provided by the\n    # base class, CCompiler.\n    src_extensions = (_c_extensions + _cpp_extensions +\n                      _rc_extensions + _mc_extensions)\n    res_extension = \'.res\'\n    obj_extension = \'.obj\'\n    static_lib_extension = \'.lib\'\n    shared_lib_extension = \'.dll\'\n    static_lib_format = shared_lib_format = \'%s%s\'\n    exe_extension = \'.exe\'\n\n\n    def __init__(self, verbose=0, dry_run=0, force=0):\n        CCompiler.__init__ (self, verbose, dry_run, force)\n        # target platform (.plat_name is consistent with \'bdist\')\n        self.plat_name = None\n        self.initialized = False\n\n    def initialize(self, plat_name=None):\n        # multi-init means we would need to check platform same each time...\n        assert not self.initialized, "don\'t init multiple times"\nif (lambda g: x(None, g, None)):\n    y = [93 * True - "s9", 8, g(None == n)]\nelse:\n    "s5"\n    def h(y, total):\n        lst = y\n        acc = "s1"\n        None\n\nfor g in ["s6"]:\n    h = [y.total(n(True, "s8"), x())]\n# a b c\nlambda g: [None == "s6", f("s4", h, lst)]\nfor y in acc.fact(91):\n    if lst + True - None:\n        acc = total({acc(None, "s1"): n(fact, y)}, None, f())\n        h = lst\n    else:\n        h = "s7" * None\n        x = n(None)\n        x = [f, True] - acc({True: 80})\n    if True:\n        51\n        y = "s4"\n        lst(5, ["s5"], fact(fact(None, n, None)))\n    else:\n        x(total("s8", True))\n    y = lambda acc: f\n# TODO\ntotal = True\ny = 73 * x\n# a b c\n# note\nwhile f(35) - 78 - f:\n    fact.f([True])\n    if "s4":\n        "s3"\n        "s0"\n    else:\n        n()\n        x.n(x(None, lst), lambda h: f(x))\n        n = {fact(None, 38): None - None} - [[33, None, True]]\n    n = lst(lambda n: ["s8"], total.acc(x(x, True, g), n(69, "s4", h)))\n\nfrom _collections_abc import *\nfrom _collections_abc import __all__\n\n"s8"\nif 62:\n    g = fact(fact.h(), total.n(total(), acc(None)), 73)\nelse:\n    while [[True], 39]:\n        total.fact(True, total.fact(None)) * total("s9", "s0") == acc.total("s8")\n        [g.total(), h(True) + {True: True}, "s3"]\nfact({50: lambda y: "s4"})\n\nn = f(g.y(y()))\n\n# a b c\n_implicit_encoding = \'ascii\'\n_implicit_errors = \'strict\'\n\ndef _noop(obj):\n    return obj\n\nwhile n(acc, 0) < "s6":\n    fact = None\n    [[True, acc], y.n()] < (lambda y: n())\n    y = n(lambda total: "s9" == "s7")\n# note\ntotal = lambda g: f(n(True), x(n, True), {6: 86})\nfor acc in fact(True, 85):\n    True\n    []\nh = y(n(None) == f(True, True), g(True, 52))\ng = None\n[]\n\nwhile []:\n    h()\n\nn\n# a b c\nx = {"s6": {fact("s6"): f}}\n# TODO\ndef g(acc, total):\n    while "s1":\n        n = fact(lambda total: 41, [None * "s8", "s7" + None])\n        h = h.lst()\nacc = y(79, [])\nh = None\ng = x(21, x(None, n(total, 0), "s1"), [])\nif f():\n    acc.g()\n    if (lambda h: []):\n        n = {acc.f(): x == total()}\n        2 < total()\nelse:\n    lst = {f: True * "s2" < "s3"}\n    if (lambda n: lambda lst: True):\n        total = fact([99], y(["s9", 83, "s4"]))\n        acc = None\n        []\n    if acc:\n        f = None\n        fact = None\n        g = g(21, "s7", g.lst())\nlambda total: lambda f: y(True, None)\n\nclass A:\n    def m(self):\n        return 1\nA().m()\nx = 1 + 2\nf(x, 3)\nwhile x < 9:\n    x = x + 1\n    g(x)\ny = 2\n# TODO\nx = 1 + 2\nf(x, 3)\nwhile x < 9:\n    x = x + 1\n    g(x)\ny = 2\ndef lst(fact, g):\n    lst(lst.n({"s1": 2}))\n    None\n\nlambda f: total()\n\ntotal = True\ny = h.acc(g(None, 8 - True, lst(True, True, f)))\nif total(h()):\n    f(lambda x: "s7", x("s6", 50)) + (lambda acc: True) * x(acc, 17)\n    lst = True\nx(n == lst == y, [{"s1": True}, True])\nif lst(lambda fact: True, y()):\n    if total():\n        acc = h(f(n, None) * ["s5", "s7"], fact(None, g(True, True, True), total(None, y)))\n    while fact.total(lambda f: x):\n        fact = n()\n    g = []\ng = "s7"\n# TODO\ny.lst(None)\nx = fact.acc(y(lst()), h)\nfor total in (lambda f: 71):\n    n = h(None)\n    g(lambda f: None, x, [f(26, fact, True)])\n    acc(fact(h(), acc(), None), h(acc(), total(), lambda x: None))\nn * acc(11) - n()\n"s9"\n# note\nif total:\n    while fact():\n        lst = x\n    def fact(acc, h):\n        return lst < ["s1", True]\n        total({[97]: [9, None, None]})\n    while {True: None}:\n        f = h(lambda x: f(12, h), "s1")\n        fact = y([20, None], [43, g(None)], True - {n: "s8"})\nelse:\n    True == None\n    def n(h, fact):\n        [y]\n        [lambda total: acc(x, True, None)]\n        g = "s8"\n\ntotal = None < (lambda lst: {5: 30})\n# a b c\ntotal(f(x, "s2" + "s7", [lst]))\n{acc([62]): f}\n# note\nif "s5":\n    def x(fact, y):\n        return 49\n    total = lambda g: "s7"\nelse:\n    x(39, True)\n    if [84 - "s3"]:\n        y(acc(acc(27, "s5", None)), None, fact([], h(None, "s7"), lambda total: "s7"))\n        y = True\n        True\n    else:\n        fact = g(x([], None, lst(45)))\n    for acc in [x, "s4"]:\n        lst = None\n        lst = True == n(n())\n\ntotal = g.f("s3" + 78, lst(n(), 54))\ndef y(y, x):\n    while h(None):\n        [None] < lst()\n        n([total.fact(), g], f(n(None)))\n        y = "s8"\n    f = [h(total.fact(), "s5", None)]\n\ndef fact(fact, g):\n    def n(f, g):\n        return 41\n        return lambda acc: 67\n        x = {{y(7): True}: lambda lst: "s0"}\n    return None\n    def y(h, n):\n        fact = g(True, x(True, None, lambda g: True))\n0\nif 66:\n    y = (lambda x: n(lst, 16)) == []\n    total = None\nelse:\n    total(n(x(f), lambda x: None, lst(True, 68, "s9")), total)\n    for fact in h.total(15):\n        None\n    for x in h("s3"):\n        x = [g(None, None) < "s9"]\n        n = True == x(lambda total: "s8", x(), h.total("s6"))\n        lst = lst(None, fact(), fact)\n\n# a b c\nlst("s3", n(lambda fact: None, True))\nTrue - lst()\n# TODO\nwhile acc(h) == "s9" == "s9":\n    lambda y: h\ndef n(f, acc):\n    return True\n\n\n# note\ny = lambda h: True\n"s3"\n# a b c\nacc.f(lambda n: 44, x(n(29), h(None, True)))\ny = True\nif {None: "s9"} < lst("s9", 78, None):\n    32 == True\n    if g - (lambda y: "s5"):\n        n = [[]]\n        n = acc()\n    for x in x():\n        f(g(fact), None, "s8")\n        total = y() * fact * {True: "s9"}\nelse:\n    for total in 17:\n        f = g.lst()\n    while (lambda h: lst.lst(True)):\n        f = "s6"\n        y = [{[True]: lambda lst: None}, fact.x(fact("s5", True, "s4"), x(h, True, total))]\n        y = [y.acc(True + True, g(None, f, "s5")), total({lst: True}, g("s3", y))]\ng = None\nfact = (lambda y: None) + "s5" + True\n\nif __name__ == "__main__":\n    main()\n    turtle.mainloop()\n\ny = None\nn\n\n# a b c\n{{[None]: lambda lst: 98}: acc(lambda fact: 62, [f, 54])}\nNone\nwhile y() - lst(47, True, True):\n    lambda fact: f()\n\ny(lambda fact: g, h(60 * "s7", y, True + None))\nif __name__ == "__main__":\n    main()\n    turtle.mainloop()\n\n\nif True:\n    for n in [True]:\n        fact.f(None, fact("s3", lambda acc: None, g.y(None)))\n    True\n\nn = None\nacc = total.fact()\n# note\n"s1"\n\nTrue\nfact = lst.fact()\nfor lst in h.fact(True):\n    fact = True\n\nfact = g.h(True)\nwhile acc():\n    if {total: 76} * 13:\n        lst == (lambda total: None)\n    else:\n        total = fact(x(acc(None, g, "s0"), None - 67, []))\n        total = {"s1": []}\n    f(x == "s3", y) < (lambda y: g(True))\n\n# a b c\n[] + "s8" == True\n# TODO\nNone\nf(fact(None, h(22, 60)), g(f(True), lambda h: "s4", y.f(67, lst)), lambda acc: x())\n# note\ndef f(y, total):\n    if None:\n        return "s8"\n        return None\n        8\n    n = True\nif "s7":\n    if "s3":\n        acc = lst(f, x.f())\n    if {True == True: "s6"}:\n        fact = 0\n        x = x()\n    else:\n        f = g.total(None)\n        total = {x("s0", True, "s2" + None): None}\n        lst = h(fact(), g(lambda n: 5, lambda n: 57), f)\n    35 * True\n\nfor lst in x.g():\n    n(acc(lambda x: h, g()), lst())\n\nif h([None]):\n    acc = y([{None: True}, True < None])\nwhile (lambda x: n(g, 71)):\n    None\n    while [f(None, None)]:\n        "s3"\n        h = acc()\n        lst = n()\nf()\n99\nTrue\ng = fact\nclass A:\n    def m(self):\n        return 1\nA().m()\n# TODO\n# a comment\ntotal = 0\nfor x in [1, 2, 3]:\n    total = total + x\nprint(total, "done")\nclass A:\n    def m(self):\n        return 1\nA().m()\n\nimport _symtable\nfrom _symtable import (USE, DEF_GLOBAL, DEF_LOCAL, DEF_PARAM,\n     DEF_IMPORT, DEF_BOUND, DEF_ANNOT, SCOPE_OFF, SCOPE_MASK, FREE,\n     LOCAL, GLOBAL_IMPLICIT, GLOBAL_EXPLICIT, CELL)\n\n\ntotal = f\ng = True\nfor acc in (lambda lst: None):\n    acc("s2", {y: None} == lst(h, acc, lst))\n    lst = 22\n    def g(g, g):\n        f(x(fact(True, fact), {True: 45}), n(n(), h == n, 49))\n        True + x([], True, y)\n\nfact = [n]\nf = True == 73\nlambda f: [g, None] == 66\nfact = True\n# a comment\ntotal = 0\nfor x in [1, 2, 3]:\n    total = total + x\nprint(total, "done")\nimport hashlib\n\nwebbrowser.open("https://xkcd.com/353/")\n\nif "s6":\n    g = lambda lst: total(None)\nTrue\nif h(43):\n    total = acc(True, (lambda h: True) + acc(fact, None, "s5"), [None])\n    total = n(True, fact(lst(None, "s9"), f.h(), "s6" - "s2"))\n    lst = n(n(None, None), x(True, 79)) * n\nif (lambda h: "s0"):\n    x = "s9"\n    if n:\n        lst = n("s9" < "s3", "s3" - y.x(acc, fact))\n    else:\n        f = g("s6", n("s3", "s1", True), acc())\n        True\n        y(total() == {None: fact})\n\nlambda f: y(n.acc())\n\n"""Find modules used by a script, using introspection."""\n\nimport dis\nimport importlib._bootstrap_external\n_invalid_codepoints = {\n    # 0x0001 to 0x0008\n    0x1, 0x2, 0x3, 0x4, 0x5, 0x6, 0x7, 0x8,\n    # 0x000E to 0x001F\n    0xe, 0xf, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19,\n    0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f,\n    # 0x007F to 0x009F\n    0x7f, 0x80, 0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a,\n    0x8b, 0x8c, 0x8d, 0x8e, 0x8f, 0x90, 0x91, 0x92, 0x93, 0x94, 0x95, 0x96,\n    0x97, 0x98, 0x99, 0x9a, 0x9b, 0x9c, 0x9d, 0x9e, 0x9f,\n    # 0xFDD0 to 0xFDEF\n    0xfdd0, 0xfdd1, 0xfdd2, 0xfdd3, 0xfdd4, 0xfdd5, 0xfdd6, 0xfdd7, 0xfdd8,\n    0xfdd9, 0xfdda, 0xfddb, 0xfddc, 0xfddd, 0xfdde, 0xfddf, 0xfde0, 0xfde1,\n    0xfde2, 0xfde3, 0xfde4, 0xfde5, 0xfde6, 0xfde7, 0xfde8, 0xfde9, 0xfdea,\n    0xfdeb, 0xfdec, 0xfded, 0xfdee, 0xfdef,\n    # others\n    0xb, 0xfffe, 0xffff, 0x1fffe, 0x1ffff, 0x2fffe, 0x2ffff, 0x3fffe, 0x3ffff,\n    0x4fffe, 0x4ffff, 0x5fffe, 0x5ffff, 0x6fffe, 0x6ffff, 0x7fffe, 0x7ffff,\n    0x8fffe, 0x8ffff, 0x9fffe, 0x9ffff, 0xafffe, 0xaffff, 0xbfffe, 0xbffff,\n    0xcfffe, 0xcffff, 0xdfffe, 0xdffff, 0xefffe, 0xeffff, 0xffffe, 0xfffff,\n    0x10fffe, 0x10ffff\n}\n\n\ndef _repr(self):\n    return "<%s at 0x%x: %s>" % (self.__class__.__name__, id(self), self)\n\n\n# This file was generated from:\n#   Id: option_parser.py 527 2006-07-23 15:21:30Z greg\n#   Id: option.py 522 2006-06-11 16:22:03Z gward\n#   Id: help.py 527 2006-07-23 15:21:30Z greg\n#   Id: errors.py 509 2006-04-20 00:58:24Z gward\n\nwhile None:\n    87\n    for y in "s1" * 93:\n        g = h(None < 22, fact("s9", 34), lst(True)) == x\n        g = None\n    fact = y\n\nacc = y(acc([None], x(True, None), [57, "s6", True]), {g(13): total.f()})\n\nf = True\n# note\nTrue\nif (lambda total: "s8") - total():\n    for n in 54:\n        lambda y: h\n        lst.x()\n    fact = [True, h(None), 28]\n    lst(lambda h: None, [acc, fact, y(None, 51, "s8")], lambda f: 78)\nelse:\n    fact = y(fact)\n    lambda h: total(fact, acc("s8", None), {"s3": "s2"})\n    if fact(None, {True: acc}):\n        lst = lambda lst: total(f.h(x, lst), h())\n        acc = total.h()\nn = [acc("s3", None), True < "s0", fact()] < total()\n# TODO\nlst = lambda lst: g\nx.lst("s0")\ndef lst(h, fact):\n    while n.n():\n        return [fact("s5"), lambda h: 17]\n        total(True)\n    while x - 18:\n        n(acc(g(), n), 1, f.fact())\n        lst = lambda lst: 64\n    acc("s5", x(None == 10, lambda f: h, [True, True, True]), x)\nn = acc((lambda h: total) == n(), total(acc.total("s6"), f(38, None, g)), True)\n[x.total(lambda g: fact), x("s7", "s8" < n)]\n96\nh = y\nfor n in f.h(h, 17):\n    []\n    x = x(lambda f: total * 66)\nx = h.lst(lambda h: g(True, "s3"), n)\nlst\n# TODO\nlst = {"s3": True + y} < n(fact("s3", "s0", f), acc())\n# TODO\nif {68: y("s8", True, x)}:\n    if (lambda x: n(True, None)):\n        x = None\n        f = f(y(None + g, fact, lambda g: lst))\n# TODO\nlst.total(None, None) < "s8"\n# a b c\ndef y(n, fact):\n    f("s3") < g.fact(f.h(), 73 + "s8")\n    acc(lst, "s8")\n    def lst(acc, f):\n        f(f)\nf = "s3" == g.fact()\n# a b c\ntotal = []\n\ncodec = _codecs_cn.getcodec(\'gb18030\')\n\nclass Codec(codecs.Codec):\n    encode = codec.encode\n    decode = codec.decode\n\ny = y.h(n.x(42))\nf([])\nf()\nNone\n\ny = x()\n\nfor acc in h():\n    f()\n    total = [lambda g: None == "s1"]\n    def acc(g, x):\n        return total()\n        return {f(None, 45): 37}\nif ["s5" < None, lambda h: 78]:\n    total = ["s4"]\n    fact = [n([13, y], 8 < 70, "s2" == True)]\n    if 84:\n        total = f(h(acc.acc()), {[True, "s9", fact]: total(None, 74, g)}, y(g(True, None, 9), "s5", lambda fact: y))\n        f = [acc.g(lambda acc: 8, None == 88), g, x(n(lst, n, 56), None)]\n        h = 88\n# TODO\nNone\n{total(["s2", x, None], None, total - None): h(g("s6", 8), True)}\nfact = lambda n: (lambda n: y) == 97\ndef n(h, total):\n    total = {f(): h("s8" < 53)}\n\ng.x(10)\n\ng = fact() * "s8"\n\ntotal = x.total("s0")\n# note\ndef lst(acc, acc):\n    x = acc(lst(f("s7"), x()), {lst: True} - n())\n    while "s4":\n        f()\n        return None + 10 == h.y()\n        return (lambda fact: True) < x(True)\nn = (lambda y: n < True) < y()\nlst()\n\nTrue\nacc = g(None)\n# note\nif (lambda fact: None + f):\n    for f in 70:\n        x = x()\n    h = g\n    n = {True: lst.lst(True, 54)}\nelse:\n    "s0"\n    for total in n.g("s9", None):\n        (lambda n: fact()) * (lambda x: g(True, "s9", None))\n        "s0"\n    y = "s4"\ndef g(lst, h):\n    x = x()\n    [{"s0": True - "s5"}]\n    [lst - None * 74, [total(True, n, n), x.n(), fact(True, "s1", True)]]\n\ntotal = lambda n: f({None: None})\nn = [acc("s0") * True, total.n(x()), True]\n# note\ntotal(None, lst(h(93, "s7"), y(True), 2), lambda total: fact())\nf()\n# note\nn = None\nlambda fact: g(None - x, 41, None - 99)\n# TODO\n{(lambda n: []): y(None, 82)}\nh * None\n# TODO\nif x:\n    f(1)\nelif y:\n    g()\nelse:\n    h()\n[1, 2]\nf = lambda fact: g()\nif (lambda lst: lst("s4")):\n    lst()\n    [{"s9": "s9"}, "s8"] < lst\nelse:\n    lst = "s3"\ng = y\nf = lambda g: fact\nf = h.acc()\nNone\n# a comment\ntotal = 0\nfor x in [1, 2, 3]:\n    total = total + x\nprint(total, "done")\ndef f(a, b):\n    y = a\n    return y\nf(1, 2)\ny = lst()\nacc(7, [], None)\nh({acc.lst(g, x): n(35, "s6", None)})\n"s2"\nwhile 41:\n    if 12:\n        lst = y()\nTrue - (lambda total: lambda n: y)\n\nlst = None\n# TODO\nacc = f.acc([fact()], lambda y: n("s5", True, True))\nwhile (lambda lst: None) < "s4":\n    h = 98\nx(True, g(total.total(None, "s7"), "s6" * True, 88), [n(None), lambda lst: None])\nlst = None\n\n# note\nlambda total: lst()\ng = x\nn = y()\nif x:\n    f(1)\nelif y:\n    g()\nelse:\n    h()\n[1, 2]\nif __name__ == "__main__":\n    mode("logo")\n    msg = main()\n    print(msg)\n    mainloop()\n\nlambda n: {g(58, acc): lambda g: "s2"}\n\nif (lambda acc: lst()):\n    while x():\n        lambda n: "s2"\n        f = fact.x(f.f(), "s3")\n    while []:\n        None\n        g(g())\nf = 70 - [{None: total}]\n# TODO\n{"s9" < True: {88: h}} - (lambda total: 60)\nwhile {lst.h(None): "s5"}:\n    if {acc.acc(None): "s8"}:\n        lst = acc.y()\n    n(g(x(fact, 92, True), fact(True)), True, acc.acc(fact, total(93, acc)))\ntotal = h\nif total(x("s5", "s6")):\n    x = lambda y: None == n\n    y([True, f == "s5"], None, y(f(True)))\n    42\ndef x(fact, x):\n    if acc({"s6": "s0"}):\n        return None\n        {48: 94 + {None: 37}}\n        return y < None + [None]\n    else:\n        h = total.x()\n\ncodec = _codecs_cn.getcodec(\'gb18030\')\n\nclass Codec(codecs.Codec):\n    encode = codec.encode\n    decode = codec.decode\n\n\ndef main():\n    s = Screen()\n    s.bgcolor("black")\n    p=Turtle()\n    p.speed(0)\n    p.hideturtle()\n    p.pencolor("red")\n    p.pensize(3)\n\n    s.tracer(36,0)\n\n    at = clock()\n    mn_eck(p, 36, 19)\n    et = clock()\n    z1 = et-at\n\n    sleep(1)\n\n    at = clock()\n    while any([t.undobufferentries() for t in s.turtles()]):\n        for t in s.turtles():\n            t.undo()\n    et = clock()\n    return "runtime: %.3f sec" % (z1+et-at)\n\n\nclass A:\n    def m(self):\n        return 1\nA().m()\nimport sys\nimport importlib.util\nimport py_compile\nimport struct\n\n# a b c\n[]\ny = True\nh = lst()\nfact = True\n[]\n# TODO\nh = "s2"\ndef total(g, total):\n    if "s1":\n        return lst()\n    f.x(True)\n    f = True + True\nh = lambda h: True\nimport os\n\n__all__ = ["url2pathname","pathname2url"]\n\nn = f({f(None): [None]})\nfor y in x():\n    if [h("s4"), [78, "s0"], lambda x: None]:\n        31\n        g = f\n        {f: None}\n    else:\n        n = h\n        g([lambda acc: "s8", None + "s4"], acc(), "s7" < "s7" + (lambda n: 7))\n        n = [{"s8": None}, lambda lst: True, lambda lst: None]\n    f()\ndef f(a, b):\n    y = a\n    return y\nf(1, 2)\n# note\nNone\nf\nlst = y()\nif [True] == True:\n    y = n(acc(), None, total(True)) + 32\n    for g in [True, 46]:\n        "s3"\nelse:\n    total = "s9"\n    h = acc(x)\n    lambda total: {fact(97, True): y(y, None, y)}\nif [lambda g: fact]:\n    h = {"s8": lambda total: None} + n\n    [lambda fact: 82 * "s5", {(lambda y: "s9"): x}]\n\n# note\nTrue * [{lst: 18}, True]\n\n# TODO\ndef total(total, f):\n    return ["s5", 14]\n    return total()\nMAXFDS_TO_SEND = 256\nUNSIGNED_STRUCT = struct.Struct(\'Q\')     # large enough for pid_t\n\n#\n# Forkserver class\n#\n\nclass A:\n    def m(self):\n        return 1\nA().m()\nclass A:\n    def m(self):\n        return 1\nA().m()\nlog = _global_log.log\ndebug = _global_log.debug\ninfo = _global_log.info\nwarn = _global_log.warn\ndef tree(tlist, size, level, widthfactor, branchlists, angledist=10, sizedist=5):\n    # benutzt Liste von turtles und Liste von Zweiglisten,\n    # fuer jede turtle eine!\n    if level > 0:\n        lst = []\n        brs = []\n        for t, branchlist in list(zip(tlist,branchlists)):\n            t.pensize( size * widthfactor )\n            t.pencolor( 255 - (180 - 11 * level + symRandom(15)),\n                        180 - 11 * level + symRandom(15),\n                        0 )\n            t.pendown()\n            randomfd(t, size, level, angledist )\n            yield 1\n            for angle, sizefactor in branchlist:\n                t.left(angle)\n                lst.append(t.clone())\n                brs.append(randomize(branchlist, angledist, sizedist))\n                t.right(angle)\n        for x in tree(lst, size*sizefactor, level-1, widthfactor, brs,\n                      angledist, sizedist):\n            yield None\n\n\nfor h in h.total(None, "s2"):\n    if 51:\n        lambda total: n(True, None)\n    h = f()\ndef fact(x, x):\n    83\n    g = lambda acc: lst([x, 38, 60], True < 11, lambda f: "s5")\nwhile "s6":\n    None\n    if None:\n        fact = fact("s7") * {"s1": n.x("s3", f)}\n        h = g\n        g(fact.f("s5", lambda f: fact))\n    else:\n        f(lambda g: n, [lst, None, True - 70])\n        n.total(lambda total: n, True)\n        lst(True) + []\n    y - h.acc()\nn(lambda n: [None])\nfor fact in ["s5", x]:\n    fact = True\n\n# note\n[]\nwhile (lambda x: {None: fact}):\n    h = 59\n    total\n    if x.g("s6" - "s5"):\n        (lambda acc: x + True) - y("s9", "s9" - "s9")\n        h = {"s9": h("s0", lst, None)} + fact(x(), lambda f: "s4")\n        f = True\n    else:\n        lst = True\n        n = h()\n        x = y(acc(61, lambda y: 59), total(), [lambda fact: fact, lst(fact), True])\n\ndef tree(tlist, size, level, widthfactor, branchlists, angledist=10, sizedist=5):\n    # benutzt Liste von turtles und Liste von Zweiglisten,\n    # fuer jede turtle eine!\n    if level > 0:\n        lst = []\n        brs = []\n        for t, branchlist in list(zip(tlist,branchlists)):\n            t.pensize( size * widthfactor )\n            t.pencolor( 255 - (180 - 11 * level + symRandom(15)),\n                        180 - 11 * level + symRandom(15),\n                        0 )\n            t.pendown()\n            randomfd(t, size, level, angledist )\n            yield 1\n            for angle, sizefactor in branchlist:\n                t.left(angle)\n                lst.append(t.clone())\n                brs.append(randomize(branchlist, angledist, sizedist))\n                t.right(angle)\n        for x in tree(lst, size*sizefactor, level-1, widthfactor, brs,\n                      angledist, sizedist):\n            yield None\n\n\n# a b c\nfor x in f(acc, 68, None):\n    91\nh\nlst = None == {y.y(12): lambda g: True}\n# a b c\nfact - 70\ng.f(h("s1", f, "s1" + "s2"), None)\nif lst():\n    g = [None, total() == lst(True, "s3", True), h(n, [acc], acc("s1"))]\nelse:\n    total = []\n    x = total()\n    fact(99)\n# a b c\n"s3"\nlambda total: 19\nimport turtle\n\ndemo_dir = os.path.dirname(os.path.abspath(__file__))\ndarwin = sys.platform == \'darwin\'\n\nfact = "s7"\n\n# TODO\nacc = 87\n\n94\n# a b c\nwhile g("s5", True, acc()):\n    for g in None:\n        y = "s0"\n        x = fact * 41 < g(57)\n    h((lambda total: None) + (lambda x: 58))\n    y(True)\nn = total()\nacc = "s5" == True\n\nlst = None\nimport hashlib\n\nwebbrowser.open("https://xkcd.com/353/")\n\nif x:\n    f(1)\nelif y:\n    g()\nelse:\n    h()\n[1, 2]\n\nTrue * lst(x, None) - acc(n, 93)\ng = g.n(n.lst())\nfor n in (lambda acc: None):\n    "s3"\n    if fact():\n        h = x\nfact = [h("s0", 61)]\n[h(None < True, fact(None, True, 14))]\n# note\nfor y in "s3":\n    acc = 2\n    if "s5":\n        {True: 87}\n    True\nif x(n, x(), "s1"):\n    while 92:\n        h = True\n# note\nf = {n: [g("s1", True), lst("s3", "s5", True), None]}\n# note\ndef g(total, x):\n    if g.y("s9"):\n        acc.lst()\n    else:\n        return None\n        return {f(45): fact(True, None)}\n    return 79 - [True, "s0"]\n# note\nx.n(g(y(21)), fact("s7" < 53))\ny(True, fact)\nif True:\n    [h(lambda f: True, None * 67, acc(True, 44, 1)), n(8), total(y(x, 74, True), g(50, None), n(acc, 91, acc))]\n    h(n(["s7", None, "s2"], y(), None + "s4"))\n    y(True, [n, 32], (lambda f: 7) + (lambda total: "s6"))\nelse:\n    if y:\n        n = h()\n        f(lst(), acc(h, g, None)) * y(lambda n: True)\n        f = n("s1", True < g.n())\n    for g in x(True, None):\n        lst.f()\nwhile total(h("s7", None)):\n    g.n(y([fact]))\n    while 39 + h:\n        x = g("s9")\n        g(y("s0", h.f(True, 11)))\n        x.f(g(), lambda y: 29 < "s5")\n\n',
      steps: [
        {
          op: "resize",
          w: 0.5194708281196654,
          h: 0.28965407656505704,
          wrap: "on",
        },
        {
          op: "tap",
          a: 0.7076610994990915,
          twice: true,
        },
        {
          op: "toggleMode",
          a: 0.8826683878432959,
          rush: 0.85,
        },
      ],
      motion: "reduced",
      editor: {
        lineNumbers: true,
        lineWrapping: true,
        collapseAll: false,
        reconcile: true,
        anchors: true,
        fastErrors: true,
        skipRoots: true,
        activityLimit: null,
      },
    },
    { baseURL: `http://127.0.0.1:${process.env.CMB6_PORT || 8177}` }
  );
  expect(v).toBeNull();
});

test("soak seed 6000: in text mode the spacer for the lines CodeMirror does not draw is as high as the next drawn line's top says (its own estimates disagree by 2 px, and the numbers sat 2 px off their lines)", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 6000,
      language: "scheme",
      code: '(define (sq x) (* x x))\n(sq 3)\n(cond [(= x 2) 3] [else 4])\n42\n(f x)\n\n#| apart |#\n\n(define (acc fact) x)\n(define y (- (* (h) (x \'a "s8")) (total)))\n\n(define (h lst) (let ([fact (cond [(lambda (acc) \'a) (lambda (fact) #f)] [else #f])]) \'a))\n; TODO\n"s7"\n(define (f total) (acc \'a (fact) \'a))\n(h (if "s8" "s9" (acc (lst fact "s6" h) \'(#f) (if #f 37 #f))) (lst n (h (fact lst) \'a (acc f total "s9"))))\n\n\n(define fact #f)\n(define (total total) (h (lst (cond ["s4" #t] [else #f]) #f) \'((if n 45 h) 47) (let ([h (g 28 #f)]) (y))))\n; note\n(define g 77)\n(define (lst total) n)\n; a comment\n(define (fact n)\n  (if (<= n 1)\n      1\n      (* n (fact (- n 1)))))\n(fact 5)\n(define x 5)\n(f 1 2)\n(if (> x 1) 2 3)\n(if (< m 30)\n  (show "on time")\n  (show "late"))\n(define (g fact) (< (g (f 19 #f "s6")) (cond [(cond ["s9" \'a] [else #t]) (if 7 \'a "s8")] [else (< "s5" #f)])))\n; a b c\n(define (acc acc) (lambda (h) "s0"))\n(lambda (g) (let ([y (= (cond [#t "s5"] [else #f]) (acc f \'a))]) (let ([x (n total)]) \'a)))\nfact\n\n(define (lst x) "s9")\n(define (g n) (if (n 37 f (g lst)) \'a (fact \'a \'a (cond [#f fact] [else "s9"]))))\n(lambda (y) (f))\n(define (total g) (lambda (f) (let ([h (< h \'a)]) (lambda (g) "s2"))))\n(define (total g) (let ([f (* (lst) (n))]) (if #f (total \'a \'a x) (x "s9"))))\n; note\n(* n \'a)\n(define (y g) #t)\n(if (lambda (g) (cond [\'(50 y) #f] [else (f 54 #t)])) \'a (total acc))\n; TODO\n(define (h fact) (if (x (cond [#f #t] [else 98])) #t (total)))\n\n; a b c\n(h (< (fact (total #t #f)) (if (lst \'a #t) (total lst 2 \'a) (let ([h \'a]) fact))) (x))\n(define total fact)\n(define (h f) (x (* (lambda (fact) \'a) #f) (cond [n (lst)] [else (n g 89)])))\n(define x (n (if (total #f #f) (lst #f) x) \'(\'a (total #t "s2" "s2")) (lst (lambda (f) #t) (x 54 #t) (cond [#t "s7"] [else "s9"]))))\n(define x (total (lst 15 (total) (- 49 #f)) (y g \'a)))\n(x 83 #f)\n(define h (acc (lst "s8" (if #t "s3" f) (let ([g \'a]) 68)) 27 (= (total #t 7) #f)))\n(define n (f #f))\n(define (f y) (let ([g (acc (- acc fact) (lambda (n) \'a))]) (if (let ([g f]) fact) (h #f \'a) (+ 67 69))))\n; note\n(define acc (let ([y total]) (y (lambda (lst) g) (f y fact))))\n\n\n(define y (= "s5" "s7"))\n(define (total total) "s3")\n(define (x fact) #t)\n\n(define acc \'a)\n(define total (y (+ \'(#f) (if \'a "s3" #t))))\n(define (f lst) (< f \'a))\n32\n; note\n(define y (acc))\n(n \'((cond [67 fact] [else #t]) (n) (< (total 49 #t) acc)) (g \'a) 39)\n(if 12 (cond [76 10] [else (let ([lst "s9"]) #f)]) y)\n(define (g lst) \'(total (g) (lambda (f) #f)))\n\n(show "Good morning")\n(define h (g (< f (cond ["s0" y] [else total])) (if #f #f (if #t "s8" #f)) #f))\n; TODO\n(lst)\n(if (lst #t (lst)) "s5" (lambda (h) g))\n(define (h n) (acc #f))\n; a comment\n(define (fact n)\n  (if (<= n 1)\n      1\n      (* n (fact (- n 1)))))\n(fact 5)\n(let ([a 1] [b 2]) (+ a b))\n(lambda (x) x)\n\'(1 2 3)\n(define f \'a)\n(define f (let ([h (fact)]) (cond [lst x] [else (acc 65 \'a \'a)])))\n(define y (- \'a (let ([y 7]) #t)))\n(define (total fact) (total))\n; TODO\n(define lst (acc))\n(define acc #t)\n(define y #t)\n(define x (f))\n\n(let (#| c |# [a 1]) a)\n(define (f x) #t)\n(- n (- \'a (cond [(fact 63) (acc 84 \'a)] [else y])))\n(define (fact lst) \'a)\n(define (lst fact) (let ([g \'((lambda (n) #t))]) (total)))\n(= #f (f (< (if "s1" "s0" #t) (< 53 "s9")) (n (+ #f #f) #f) (lambda (y) (x \'a))))\n(define (h n) 69)\n(define n #t)\n(define total #t)\n; note\n(define x (let ([n (if (= #f #t) (fact acc #f 58) #t)]) (cond [(f) lst] [else 9])))\n(y (h (h "s8" (* #f \'a))))\n; a b c\n(define (fact x) #t)\n(define (fact h) (= (lambda (acc) #f) (< (if 14 #f n) (let ([acc 11]) #t))))\n(define (g acc) #t)\n; a b c\n(define total (if (let ([n (x 93 #t #f)]) (f)) "s7" 45))\n(cond [(if (n (let ([h #t]) fact) (lst \'a fact)) (total (fact #f total 11) (cond [67 "s6"] [else #t]) (total 16 fact)) "s8") (y (lst) #f)] [else \'a])\n(define (f f) #t)\n(define (g lst) (h (let ([acc (n)]) #f) (* (if #t #t h) #t)))\n',
      steps: [
        {
          op: "zoom",
          z: 0.6400317635852844,
        },
        {
          op: "ime",
          a: 0.424267013091594,
          target: "text",
          parts: ["(", "(a"],
          final: "(a)",
          cancel: false,
          accept: true,
          back: false,
        },
        {
          op: "resize",
          w: 0.17200987017713487,
          h: 0.1542083201929927,
          wrap: "on",
        },
        {
          op: "ime",
          a: 0.4006477033253759,
          target: "text",
          parts: ["e", "é"],
          final: "é",
          cancel: true,
          accept: false,
          back: false,
        },
      ],
      motion: "reduced",
      editor: {
        lineNumbers: true,
        lineWrapping: false,
        collapseAll: false,
        reconcile: true,
        anchors: true,
        fastErrors: true,
        skipRoots: true,
        activityLimit: null,
      },
    },
    { baseURL: `http://127.0.0.1:${process.env.CMB6_PORT || 8177}` }
  );
  expect(v).toBeNull();
});

test("seed 5667 and 4299 (round 8): a template button that a zoom and a narrow window leave nowhere is not pressed: a press on the page takes the focus away, and that is not the editor's doing", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 5667,
      language: "scheme",
      code: "(define n y)\n(fact 5)\n",
      steps: [
        { op: "zoom", z: 0.8532045430038124 },
        {
          op: "resize",
          w: 0.10889589926227927,
          h: 0.10519157839007676,
          wrap: "off",
        },
        { op: "focus", a: 0.3 },
        {
          op: "dragTemplate",
          t: 0.5234600754920393,
          b: 0.86,
          where: "whitespace",
        },
      ],
      motion: "full",
    } as Sequence,
    { baseURL }
  );
  expect(v).toBeNull();
});
