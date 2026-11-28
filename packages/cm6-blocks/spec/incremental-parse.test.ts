/** @jest-environment jsdom */
/*
 * Lezer's incremental parse can disagree with a fresh parse of the same text, with no error in either (found by the soak runner). The
 * document is cut down to what is needed: the fault depends on how much text there is around the edit.
 */
import { TreeFragment } from "@lezer/common";
import { checkLezerEditor, createLezerBlockEditor } from "../src/lezer-view";
import { pythonParser } from "../src/lang-python";
import { LANGS } from "./steps";

const host = (): HTMLElement =>
  document.body.appendChild(document.createElement("div"));
const MARK = "\u0001";

// soak seed 206576 (Chromium, undo): the document ends with a statement; undoing it makes the incremental parse read a `for` body
// that goes on over the statements after it (a `for` near the top then has the whole rest of the file as its body)
const PY =
  'if total(y, True) * None:\n    fact = None\n    for x in n(total, True):\n        lambda f: n([], total())\n        total(True, {2: 55 < None}, True)\n        g = fact.x({n(fact, g, fact): lambda total: None})\n        return lambda lst: total(total, None, "s0")\n    f\nx = 1 + 2\nf(x, 3)\nwhile x < 9:\n    x = x + 1\n    g(x)\ny = 2\n# a b c\nif lst(90 - True, n("s5", None), "s4" + None):\n    h = [acc(None, "s8", g(x)), acc, lambda h: 1]\n    def lst(x, total):\n        return lst("s8" == 46, "s5" < "s6")\n# TODO\n"s2"\nacc("s3" == 39, y)\ndef n(fact, fact):\n    for g in x("s9", "s5"):\n        return None\n        return {x("s9"): "s4" + None}\n    y = True\nfor acc in g(None):\n    if 56:\n        {y(): total(54, None, "s6")}\n        acc = True + y(g(None, None, None), lambda lst: 97)\n    else:\n        x.n(lst([], lambda x: True))\n    g = None == True == 37 == "s7" + None\n    lst = None\nif [{True: True}]:\n    8\nelse:\n    fact.y(g() + 38)\n    if acc(lst("s9"), y(), lst(f)):\n        h = [True, n(fact, "s4"), None]\n    else:\n        total([] + {None: 25}, "s4")\n        "s7" + (lambda y: lst)\nacc = y.fact(fact({True: acc}, y.acc(True, 6), True))\nwhile total("s9", f):\n    n(y.lst())\n    x(h, None * True + (lambda y: acc), total({"s3": "s5"}, None - total))\ntotal([lambda acc: "s5"])\nlst(70, lambda y: {True: h}, fact(True, "s9" + True, lambda h: fact))\n# note\nif {(lambda total: True): {None: 81}}:\n    while [True, "s8", "s2" - 97]:\n        y = True\n        total = "s7"\n    True\n    n(g.fact(n()), 89, n(True, total(), lst(None, 53)))\nelse:\n    {28: g(None, True)}\n    n\n    while 67:\n        acc = total(None, True) - None < acc([34, "s1"], fact())\n        n = x.g(h(n.fact(True), {None: "s5"}, True))\nn = lambda lst: acc([None], g(h), lambda x: 36)\nn()\nif {y(54, True, 60): None - 66}:\n    acc = h.total({x.lst(): g(48)})\n    n()\ng(fact("s2"), total(), [fact("s5"), n(h, True), 25 - 47])\ng = total() - "s1" - True < 19\nacc = h(True, n.lst())\nif lst.total(total < "s5"):\n    n = lambda lst: None\nelse:\n    acc = fact(f(), None == "s6", fact) + h\n    acc.acc()\n    f([], 92)\n# TODO\nif "s6":\n    n = fact(acc, ["s8" * n])\n    while fact():\n        h = total(fact(lambda lst: x, True))\nelse:\n    f = y.g(lambda h: lambda g: None)\n    "s2"\nimport turtle\n\ndemo_dir = os.path.dirname(os.path.abspath(__file__))\ndarwin = sys.platform == \'darwin\'\nx = 1 + 2\nf(x, 3)\nwhile x < 9:\n    x = x + 1\n    g(x)\ny = 2\nfor y in True * None:\n    while acc() == acc():\n        n = [True, {{f: lst}: lambda fact: True}]\n        total = True\n        y = [] * y(None) + n()\n    lambda g: lambda n: total(g, None, "s4")\nfact = lambda f: x(y(None), 63, 64)\nfor lst in h(None, "s1"):\n    while n.h(87, n) - x:\n        [[lambda h: None, None, [g, "s9", None]], h(lambda lst: "s7", f(None), g < 79), "s9" < []]\n    fact = h(None, True)\n    if 81:\n        fact = g([lst(), 15], lst("s8", lambda g: None, "s4"), True)\n        fact = True\n# TODO\n_invalid_codepoints = {\n    # 0x0001 to 0x0008\n    0x1, 0x2, 0x3, 0x4, 0x5, 0x6, 0x7, 0x8,\n    0x8b, 0x8c, 0x8d, 0x8e, 0x8f, 0x90, 0x91, 0x92, 0x93, 0x94, 0x95, 0x96,\n    0x97, 0x98, 0x99, 0x9a, 0x9b, 0x9c, 0x9d, 0x9e, 0x9f,\n    # 0xFDD0 to 0xFDEF\n    0xfdd0, 0xfdd1, 0xfdd2, 0xfdd3, 0xfdd4, 0xfdd5, 0xfdd6, 0xfdd7, 0xfdd8,\n    0xfdd9, 0xfdda, 0xfddb, 0xfddc, 0xfddd, 0xfdde, 0xfddf, 0xfde0, 0xfde1,\n    0xfde2, 0xfde3, 0xfde4, 0xfde5, 0xfde6, 0xfde7, 0xfde8, 0xfde9, 0xfdea,\n    0xfdeb, 0xfdec, 0xfded, 0xfdee, 0xfdef,\n    # others\n    0xb, 0xfffe, 0xffff, 0x1fffe, 0x1ffff, 0x2fffe, 0x2ffff, 0x3fffe, 0x3ffff,\n    0x4fffe, 0x4ffff, 0x5fffe, 0x5ffff, 0x6fffe, 0x6ffff, 0x7fffe, 0x7ffff,\n    0x8fffe, 0x8ffff, 0x9fffe, 0x9ffff, 0xafffe, 0xaffff, 0xbfffe, 0xbffff,\n    0xcfffe, 0xcffff, 0xdfffe, 0xdffff, 0xefffe, 0xeffff, 0xffffe, 0xfffff,\n    0x10fffe, 0x10ffff\n}\n\n\nfor h in y.total(True, x):\n    while x("s0" - 73, 30, 63):\n        total = [None]\n        f = lambda g: y(47 + f, 73 + True, fact(None, None, None))\nf(total(n, None), f(True, "s0" == True, None + None), fact)\nx = True\nlambda acc: 35\ndef fact(f, x):\n    g = lambda f: lst.lst("s8")\nwhile (lambda y: fact == x):\n    g = "s8"\n\u0001for x in ...:\n    ...';

it("soak seed 206576: an undo that makes Lezer read a loop's body over the statements after it is read again from nothing", () => {
  const at = PY.indexOf(MARK);
  const old = PY.replace(MARK, "");
  const fresh = pythonParser.parse(old.slice(0, at));
  const incremental = pythonParser.parse(
    old.slice(0, at),
    TreeFragment.applyChanges(TreeFragment.addTree(pythonParser.parse(old)), [
      { fromA: at, toA: old.length, fromB: at, toB: at },
    ])
  );
  // (the fault is Lezer's: if a newer Lezer reads this right, the test no longer shows anything)
  expect(incremental.toString()).not.toBe(fresh.toString());

  const ed = createLezerBlockEditor(host(), old, {
    ...LANGS.python.opts,
    freshParseBelow: 0,
  });
  ed.view.dispatch({ changes: { from: at, to: old.length } });
  expect(checkLezerEditor(ed)).toEqual([]);
  const ref = createLezerBlockEditor(host(), old.slice(0, at), {
    ...LANGS.python.opts,
    freshParseBelow: 0,
  });
  expect(ed.roots().length).toBe(ref.roots().length);
});

// soak seed 400160 (Chromium, paste at the top level): the document has an `else:` with no body far below the paste; the incremental parse then
// gives the `if` after the paste a body that goes on over the statements after it (443 roots, a fresh parse has 478)
const PRE_400160 =
  'demo_dir = os.path.dirname(os.path.abspath(__file__))\ndarwin = sys.platform == \'darwin\'\n# a b c\nclass IncrementalDecoder(codecs.IncrementalDecoder):\n    def decode(self, input, final=False):\n        return codecs.charmap_decode(input,self.errors,decoding_table)[0]\n\ndef fixb2context(root):\n    \'\'\'Removed bad AquaTk Button-2 (right) and Paste bindings.\n\n    They prevent context menu access and seem to be gone in AquaTk8.6.\n    See issue #24801.\n    \'\'\'\n    root.unbind_class(\'Text\', \'<B2>\')\n    root.unbind_class(\'Text\', \'<B2-Motion>\')\n    root.unbind_class(\'Text\', \'<<PasteSelection>>\')\n\n# a comment\ntotal = 0\nfor x in [1, 2, 3]:\n    total = total + x\nprint(total, "done")\n{fact(): n(y)}\nNone\n\ng(lst.acc(total(24, total), [n]), True + n(None, None, h), acc({total: 67}, lambda lst: True))\nwhile x(lst.total(), g(), y()):\n    def acc(acc, x):\n        return None\n\nwhile f.x(True, lambda n: 74):\n    lambda fact: y.y(f(True, "s3"))\n    while fact():\n        lambda acc: lambda acc: [True, True]\n        []\n    while f:\n        lst = None\n[lst(True * "s4", fact(62), "s5" == None), acc(fact, 80) < lst * True]\n# TODO\ndef h(fact, g):\n    return y(True) * [True, True]\n    "s2"\nn\ng.lst(None)\n[]\n\nfor f in True:\n    y(None)\n    fact = "s2"\n\ny = total(y(lst), {{fact: "s7"}: f("s3", 34, acc)})\n# note\ndef lst(fact, n):\n    y(x(x(True, "s8", None), "s9" < None), True * None, "s0")\n    None\n    [n(lambda total: True, f(total))]\ng = y([], [70, None, "s1"], x(None, lst, True)) * "s6"\ng = True\nfact = True\n\ndef total(x, total):\n    {total: lambda x: lambda y: True}\n    def fact(n, fact):\n        f = lambda y: 12\n        n.lst(x.h(g()), fact(10, True) + x(lst, x, True))\nNone\n# TODO\n[fact(acc.lst(True)), h.n(), 7]\n# a b c\nif acc([10], f("s5", "s9")):\n    if g.x():\n        lst()\n# note\nacc(None - "s6" == y(None, total, lst))\n# TODO\nwhile fact:\n    f = {x({"s9": None}, total(n), 2): []}\n    f(y(y, True), "s1" < y) * {{True: True}: n(True, acc, "s0")}\n    while ["s9", lst, None] < None:\n        y = None * {None: fact} == total - n(g)\n[]';
const PASTE_400160 = "f()\nf()\ng(2)\nTrue";
const POST_400160 =
  '\nif (lambda h: []):\n    x(total(lambda y: None, None, 24), y(acc("s1", True), f.total(n, None), True), True)\n    if True + True:\n        y = True\nelse:\n    for total in None == 14:\n        n()\n        h()\n        g(9)\nwhile True:\n    n(acc(fact)) * True\nfact = h(h(lst(41)))\n# TODO\nx = 1 + 2\nf(x, 3)\nwhile x < 9:\n    x = x + 1\n    g(x)\ny = 2\n\ndef _format_pipe(fd):\n    if fd == subprocess.PIPE:\n        return \'<pipe>\'\n    elif fd == subprocess.STDOUT:\n        return \'<stdout>\'\n    else:\n        return repr(fd)\n# note\n# note\n[lambda lst: g.x(True)]\nfor fact in 66 < 45:\n    lst = 5\n    h = 34\n    for total in 89:\n        fact.x(f("s1"))\n        "s1"\n\n# a b c\n17\n# TODO\n58\n\nif lst(None, lst.total("s7"), None * "s2"):\n    None\n    total = 71\nelse:\n    lambda f: y(x(), ["s7", total, 98])\n# TODO\nn.f("s2", 43) + "s7" + y\n# note\nfact = [24, True, n(f, True * lst, "s1" < None)]\n\nif fact(None, 17):\n    def lst(fact, lst):\n        total(n(fact(None)))\n    while g:\n        total = fact([None], acc(fact(), True, y(32)), [])\n    while h(None):\n        acc = lambda y: f(None - True, True * None)\n        x = "s9"\nelse:\nwhile lst(lambda lst: "s0"):\n    n = [h, "s8"]\n    g = x.total()\n    for lst in (lambda n: None):\n        None\n        38\n        total = f\n# a b c\nif total(x, "s7", 34) < 23:\n    None\n    if acc(lst("s0")):\n        f = g() + {19 - 60: x(74, "s9")}\n        g = lambda acc: {n(): lambda fact: 78}\n    g = lst\nelse:\n    total = acc(acc(g), 82, "s8") + None\n    f\n    while [] == 55 * "s8":\n        None - []\n        total = None\nfor h in y:\n    g(fact("s7", f, "s9") - True * "s3", "s5", n("s8") < y(True, True, None))\n    while (lambda acc: lst(True, fact, True)):\n        {acc(): fact({4: n}, None, y.acc(48))}\n        lambda n: y()\n        n = True\n    fact = True\nx(lst.lst(), True, fact(g(88), g("s1", 83, True)))\nfact = lst.x("s7")\nfact = True\n# note\nwhile "s6":\n    if x("s0"):\n        y = [] == n\n        lambda n: lambda total: 65 * True\n    lambda total: 33\n    49 * {(lambda total: g): 23}\nif ...:\n    ...\nelse:\n    ...';

it("soak seed 400160: a statement after the change that Lezer reads over what follows it is read again from nothing", () => {
  const old = PRE_400160 + POST_400160;
  const at = PRE_400160.length;
  const doc = PRE_400160 + PASTE_400160 + POST_400160;
  const incremental = pythonParser.parse(
    doc,
    TreeFragment.applyChanges(TreeFragment.addTree(pythonParser.parse(old)), [
      { fromA: at, toA: at, fromB: at, toB: at + PASTE_400160.length },
    ])
  );
  // (the fault is Lezer's: if a newer Lezer reads this right, the test no longer shows anything)
  expect(incremental.toString()).not.toBe(pythonParser.parse(doc).toString());

  const ed = createLezerBlockEditor(host(), old, {
    ...LANGS.python.opts,
    freshParseBelow: 0,
  });
  ed.view.dispatch({ changes: { from: at, insert: PASTE_400160 } });
  expect(checkLezerEditor(ed)).toEqual([]);
  const ref = createLezerBlockEditor(host(), doc, {
    ...LANGS.python.opts,
    freshParseBelow: 0,
  });
  expect(ed.roots().length).toBe(ref.roots().length);
});
