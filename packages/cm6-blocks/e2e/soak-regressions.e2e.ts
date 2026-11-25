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
