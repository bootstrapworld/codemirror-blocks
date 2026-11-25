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
    },
    { baseURL: `http://127.0.0.1:${process.env.CMB6_PORT || 8177}` }
  );
  expect(v).toBeNull();
});
