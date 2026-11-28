/** @jest-environment jsdom */
/*
 * Lezer's incremental parse can give the same text another tree, with no error in either (found by the soak runner). The document is cut
 * down to what is needed: the fault depends on how much text there is around the edit.
 */
import { TreeFragment } from "@lezer/common";
import { checkLezerEditor, createLezerBlockEditor } from "../src/lezer-view";
import { javascriptParser } from "../src/lang-javascript";
import { LANGS, shape } from "./steps";

const host = (): HTMLElement =>
  document.body.appendChild(document.createElement("div"));
const MARK = "\u0002";
const INSERT = "\nlet = ;";

// soak seed 4525669 (WebKit, brokenText): `null` has an unclosed `/* open` typed into it (the comment runs on to the next `*/`), and an edit
// inside that comment makes the incremental parse reuse the identifier before it with its old extent: the comment node holds an
// identifier that starts before it. A fresh parse has the comment inside the identifier (the node a leaf block cuts it from)
const JS =
  'const acc = nul/* openl;\nif (h) {\n// a b c\nfunction h(n, fact) {\n  function y(total, lst) {\n    var n = [80] ? g ? null : true : [] ? lst.total((acc) => null) : [g(true), {a: null, b: "s4"}];\n  }\n  let f = g(32 ? lst(29, lst) : total(true), null, null);\n[1, 2, 3];\nlet y = 5;\n\nconst {\n  getLanguageBundleConfig,\n} = require("@bootstrapworld/cmb-toolkit/lib/webpack");\n\n// dist/routine-min.js: this language, for a page that loads it with a <script>\n// tag after the editor\'s (the global `CMBRoutine` is the language, which is\n// also added to the editor, to be asked for by its id: "routine")\n\nclass A {\n  m() {\n    return 1;\n  }\na.b(c);\n[1, 2, 3];\nlet y = 5;\n\n// note\nclass A {\n  m() {\n    return 1;\n  }\n}\nnew A().m();\n\nacc(total(lst.total(), "s2" + 56, (g) => 22), total(h.fact(null), lst(null, "s8"), total("s3", lst)), []);\n\nif (x()) {\n  while (fact()) {\n    h = [lst()];\n  }\n  var x = (f) => g() ? total : h + "s8";\n  lst = "s8" + true < 83;\n}\nfor (const fact of total - true) {\n  let y = g();\n}\n({a: (y) => acc, b: []});\n(g) => null + (acc) => null;\n// TODO\nfunction h(x, fact) {\n  if (true) {\n    "s5";\n    return g(23 + null, true + "s5");\n    let n = h(acc(f(lst, true, 15), n(lst, n), f(64, null)));\n  }\n  if (acc(h(true, "s5", "s4"), h(), g(34, null))) {\n    fact();\n  }\n  var acc = h([n(54, g, 75), total("s9", true), n(null)], (n) => [68]);\n}\nlet n = fact(f(h), y(null), (n) => 10) ? x((fact) => true) : true;\ny = n;\nfunction y(g, total) {\n  for (const fact of true) {\n    x("s5", "s8" ? null : 23);\n    [null, null ? true : g] ? true : h.lst();\n  }\n}\n// TODO\nfunction x(g, y) {\n  if (n) {\n    "s2" < null;\n    y = 7;\n    return x(h(fact), true);\n  } else {\n    y = true;\n    const acc = f(x(), lst(true));\n  }\n  total = true;\n  true;\n  if ({a: fact, b: total(20)}) {\n    let fact = "s2";\n    const n = acc(x.n(g(61), h), "s2", x(null < "s3"));\n    null;\n  } else {\n    var fact = y(34 + 29, acc === 69) ? (total) => 13 : x(true === "s1", 96);\n    total();\n    let fact = [g(true, h.acc(), "s0"), y(), (y) => "s0"];\n  }\n} else {\n  90;\n}\nconst seenBefore = new Set();\ntokens.forEach((token) => {\n  if (token.kind !== \'option\') return;\n  if (seenBefore.has(token.name)) {\n    throw new Error(`option \'${token.name}\' used multiple times`);\n  }\n  seenBefore.add(token.name);\n});\n\nacc(g, x ? (y) => h : fact ? 6 : "s7", total());\nx ? acc : x("s1", [true], "s4");\n// a b c\nif (h("s3", null) - x.lst()) {\n  while ((g) => acc(null)) {\n    let h = y(null);\n    let lst = {a: true, b: 31} ? f() : true ? n(null === x, null - null) : null;\n  }\n}\n[] === {a: acc.g(), b: y(57, null)};\nf();\nif (30) {\n  n.g(lst((g) => null, f.lst(null)), total("s7", n(fact, 35), f(true)));\n  g() < true;\n}\nlet fact = 47 - true;\nfunction busyCores(before, after) {\n  let busy = 0;\n  let total = 0;\n  after.forEach((cpu, i) => {\n    const a = cpu.times;\n    const b = before[i].times;\n    const sum = (t) => t.user + t.nice + t.sys + t.irq + t.idle;\n    total += sum(a) - sum(b);\n    busy += a.idle - b.idle;\n  });\n  return total > 0 ? (after.length * (total - busy)) \u0002/ total : 0;\n}\n\n/** The failure to promote: by seed (the latest with steps) or by signature text (the shortest) */\n\n// note\n[true ? "s0" : null === true, "s8" - null === lst("s9")];\n// TODO\n  for (const acc of [35, 98, true]) {\n    return "s6";\n  }\n  function f(acc, fact) {\n    var total = total;\n    return x.total(true, 14);\n    lst(true, lst(lst, total.g("s8")), g(true - 41));\n  }\nconst y = fact.total();\nif (null) {\n  while (lst(g(), x(), 40)) {\n    var h = fact.acc();\n    null;\n  }\n  acc();\n}\n\nif ([n.acc("s1", h), 86, "s3" ? true : true]) {\n  const y = {a: acc(), b: lst.y("s1") + (lst) => h};\n  while ([{a: total, b: 53}, "s5"]) {\n    total = "s6";\n    var lst = acc(y((fact) => true, (f) => true));\n  }\n  ({a: "s6", b: fact.y([true, "s4"], {a: "s1", b: f})});\n}\ny();\n// a b c\nif ("s0" ? h() : true ? fact : true) {\n  if (null) {\n    let h = "s5";\n  }\n  g = x("s2");\n}\nresp.on(\'done\', function() {\n  console.log(\'Done.\');\n});\n\nfunction h(lst, n) {\n  [null];\n  var n = [(y) => acc];\n}\n\nconst n = (fact) => fact(null) - h(y(true));\n';

it("soak seed 4525669: an edit inside a comment that makes Lezer hold a name inside the comment is read again from nothing", () => {
  const at = JS.indexOf(MARK);
  const old = JS.replace(MARK, "");
  const doc = JS.replace(MARK, INSERT);
  const incremental = javascriptParser.parse(
    doc,
    TreeFragment.applyChanges(
      TreeFragment.addTree(javascriptParser.parse(old)),
      [{ fromA: at, toA: at, fromB: at, toB: at + INSERT.length }]
    )
  );
  // (the fault is Lezer's: if a newer Lezer reads this right, the test no longer shows anything)
  expect(incremental.toString()).not.toBe(
    javascriptParser.parse(doc).toString()
  );

  const ed = createLezerBlockEditor(host(), old, {
    ...LANGS.javascript.opts,
    freshParseBelow: 0,
  });
  ed.view.dispatch({ changes: { from: at, insert: INSERT } });
  expect(checkLezerEditor(ed)).toEqual([]);
  const ref = createLezerBlockEditor(host(), doc, {
    ...LANGS.javascript.opts,
    freshParseBelow: 0,
  });
  expect(ed.roots().length).toBe(ref.roots().length);
  expect(ed.roots().map((r) => shape(r, new Set()))).toEqual(
    ref.roots().map((r) => shape(r, new Set()))
  );
});
