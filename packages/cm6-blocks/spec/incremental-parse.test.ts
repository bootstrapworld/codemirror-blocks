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
  });
  ed.view.dispatch({ changes: { from: at, to: old.length } });
  expect(checkLezerEditor(ed)).toEqual([]);
  const ref = createLezerBlockEditor(host(), old.slice(0, at), {
    ...LANGS.python.opts,
  });
  expect(ed.roots().length).toBe(ref.roots().length);
});
