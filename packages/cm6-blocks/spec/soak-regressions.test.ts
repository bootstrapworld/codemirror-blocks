/** @jest-environment jsdom */
/*
 * Regressions found by the soak runner (scripts/soak.js): each case is a shrunk sequence of steps, replayed with every invariant checked
 * after every step (spec/soak-jsdom.ts). `npm run soak -w @bootstrapworld/cm6-blocks -- --promote <seed>` prints a case.
 */
import { createLezerBlockEditor } from "../src/lezer-view";
import { LANGS } from "./steps";
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

it("a multi-line string edited in its box keeps its line breaks when the box is left (a textarea, not an input)", () => {
  const code = '"""first line\n\nsecond line"""\n';
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const ed = createLezerBlockEditor(parent, code, LANGS.python.opts);
  let leaf = ed.roots()[0];
  while (leaf.slots.length) leaf = leaf.slots[0].nodes[0];
  ed.edit(leaf);
  const box = parent.querySelector(".blocks-edit") as HTMLTextAreaElement;
  expect(box.tagName).toBe("TEXTAREA");
  expect(box.value).toContain("\n\n");
  box.dispatchEvent(new FocusEvent("blur"));
  expect(ed.view.state.doc.toString()).toBe(code);
  ed.destroy();
});

it("seed 15213: an old node that the new tree uses as an anchor (the call after a comparison, which a template splits into two statements) is not given the fields of another new node: reconcile gives up the old root (Bail) and the redo is the fresh tree", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 15213,
      language: "python",
      code: 'for lst in "s3":\n    fact = fact.lst(True, lambda h: [])\n    total = {{"s1": [49]}: None}\nfor h in "s6":\n    for fact in 68:\n        acc() - g(fact, 14) < lst.h()\n        acc = {lambda y: lambda h: None: g(True, None) == True}\n    g(n.x(True) * lst())\n    g = "s2"\n{[85 < acc, acc(None, "s3", 31)]: {None * True: {None: None}}}\n',
      steps: [
        { op: "textEdit", a: 0.9585142226424068, len: 2, w: '"' },
        {
          op: "insertTemplateAt",
          t: 0.1948692286387086,
          a: 0.45953861251473427,
          b: 0.7230334531050175,
        },
      ],
      motion: "full",
    } as Sequence)
  ).toBeNull();
});

it("seed 25648: a moved node: the anchor that the old tree still holds in a `rest` slot is not changed in place as the counterpart of another new node", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 25648,
      language: "python",
      code: 'def g(n, x):\n    if n:\n        return f(27, "s5") < x()\n    if None:\n        total(True, {f: None}) == y(lambda f: acc, {"s9": 36}, y)\n        return total() + None\n    else:\n        fact = total(x - y.x())\n    n = x < None + None == "s9" + "s6"\n\nn = {f.lst(lst, n) == {None: None}: acc(49 - 31)}\n# note\nTrue\ny = {acc(True, y(True, None, 81), lambda acc: "s4"): True}\n',
      steps: [{ op: "moveNode", a: 0.8469444722868502, b: 0.6531096936669201 }],
      motion: "full",
    } as Sequence)
  ).toBeNull();
});

it("seed 51015: a pasted text and a template in a comparison chain: the same anchor rule, the `rest` slot of a binary", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 51015,
      language: "python",
      code: '67\nn = "s2"\ny = True\ndef acc(fact, g):\n    h = fact == acc.total(None) < g()\n    return lst(0, h, 89) + x("s6")\n',
      steps: [
        { op: "toggleMode", a: 0.02780469600111246 },
        { op: "toggleMode", a: 0.13880405784584582 },
        {
          op: "pasteText",
          a: 0.6671620837878436,
          text: "[1, 2]",
          before: false,
        },
        { op: "insertTemplate", t: 0.808039223542437, a: 0.473476235056296 },
      ],
      motion: "reduced",
    } as Sequence)
  ).toBeNull();
});

it("seed 25711: an error that an edit makes in the roots it touches makes the parser recover with zero-width error nodes in a root after them, whose text did not change: that root is not kept as it was (the errors of the touched roots are looked at even when the old tree had none)", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 25711,
      language: "python",
      code: 'y = acc(96, y(total.g("s8")), total())\nn = []\nfor f in lst(None, True):\n    while {"s2": [acc]}:\n        n = f(lst(y, 51, 96))\n        67\n# a b c\ndef g(y, h):\n    total = []\nfact = n(True, [])\n# a b c\nlambda n: [x, h(True), []]\nif h(None):\n    None\nelse:\n    None < n(None, 11) * []\n    for total in total():\n        acc = x.x()\n',
      steps: [
        { op: "replaceText", a: 0.20500417286530137, text: "g(2)" },
        {
          op: "insertText",
          a: 0.2864064467139542,
          b: 0.28833368909545243,
          text: "1",
        },
      ],
      motion: "full",
    } as Sequence)
  ).toBeNull();
});

it("seed 11430: removeNode in a Python function whose parameter has a default (`final=False`, one block since the fortieth round): the removal changes only what it removes", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 11430,
      language: "python",
      code: "class IncrementalDecoder(codecs.IncrementalDecoder):\n    def decode(self, input, final=False):\n        return codecs.charmap_decode(input,self.errors,decoding_table)[0]\n\n",
      steps: [
        { op: "removeNode", a: 0.596174577716738, b: 0.7119021683465689 },
      ],
      motion: "full",
    } as Sequence)
  ).toBeNull();
}, 120_000);
it("seed 62182: a comment that goes with a block is written on its own line above it when the block is moved inline (a line comment would swallow the rest of the line)", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 62182,
      language: "python",
      code: "",
      steps: [
        {
          op: "pasteText",
          a: 0.006176432594656944,
          text: "g(2)",
          before: false,
        },
        { op: "setComment", a: 0.011833824217319489, text: "x; y" },
        { op: "textEdit", a: 0.08497873228043318, len: 1, w: "if a:\n    b" },
        { op: "moveNode", a: 0.11347453738562763, b: 0.4890835096593946 },
        { op: "comment", a: 0.11330164573155344, text: "x; y", accept: true },
      ],
      motion: "full",
    } as Sequence)
  ).toBeNull();
});
it("seed 51778: removing the only element on a line of its own between its brackets leaves no blank before the closing bracket", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 51778,
      language: "python",
      code: 'def defproperty(klass, name, doc):\n    get = getattr(klass, ("_get_" + name))\n    def set(self, value, name=name):\n        raise xml.dom.NoModificationAllowedErr(\n            "attempt to modify read-only attribute " + repr(name))\n    assert not hasattr(klass, "_set_" + name), \\\n           "expected not to find _set_" + name\n    prop = property(get, set, doc=doc)\n    setattr(klass, name, prop)\n\n',
      steps: [
        {
          op: "removeNode",
          a: 0.5209107981063426,
          b: 0.9079988349694759,
        },
      ],
      motion: "reduced",
    })
  ).toBeNull();
}, 120_000);
it("seed 116728: the same in a JavaScript array", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 116728,
      language: "javascript",
      code: "a.b(c);\n[1, 2, 3];\nlet y = 5;",
      steps: [
        {
          op: "textEdit",
          a: 0.3239234590437263,
          len: 2,
          w: "\n",
        },
        {
          op: "removeNode",
          a: 0.7035086846444756,
          b: 0.6301844418048859,
        },
        {
          op: "removeNode",
          a: 0.5380800282582641,
          b: 0.7479404453188181,
        },
      ],
      motion: "reduced",
    })
  ).toBeNull();
}, 120_000);
it("seed 161468: the same for the only parameter of a Python def", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 161468,
      language: "python",
      code: "def f(a, b):\n    y = a\n    return y\nf(1, 2)\n",
      steps: [
        {
          op: "textEdit",
          a: 0.1464822180569172,
          len: 3,
          w: "\n    ",
        },
        {
          op: "removeNode",
          a: 0.04251516982913017,
          b: 0.1329567302018404,
        },
      ],
      motion: "reduced",
    })
  ).toBeNull();
}, 120_000);
it("seed 164059: removing a recovered error block of no width or a comment found inside a neighbour does not make an inverted change", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 164059,
      language: "python",
      code: 'total = fact(lambda fact: f < True, total.y(lambda y: True), lambda h: "s0")\n',
      steps: [
        {
          op: "insertText",
          a: 0.08443147642537951,
          b: 0.2729130282532424,
          text: "f()",
        },
        {
          op: "insertText",
          a: 0.2671851497143507,
          b: 0.2687134223524481,
          text: "True",
        },
        {
          op: "textEdit",
          a: 0.8850083558354527,
          len: 3,
          w: "    ",
        },
        {
          op: "removeNode",
          a: 0.9445901939179748,
          b: 0.9567949301563203,
        },
      ],
      motion: "reduced",
    })
  ).toBeNull();
}, 120_000);
it("seed 116885: an error block of no width at the end of a parameter list is removed without an inverted change", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 116885,
      language: "python",
      code: 'class DatagramProtocol(BaseProtocol):\n    """Interface for datagram protocol."""\n\n    def datagram_received(self, data, addr):\n        """Called when some datagram is received."""\n\n    def error_received(self, exc):\n        """Called when a send or receive operation raises an OSError.\n\n        (Other than BlockingIOError or InterruptedError.)\n        """\n\n\n',
      steps: [
        {
          op: "replaceDoc",
          text: 'for g in True:\n    def fact(x, total):\n        return "s9"\n        lst = n()\n    [f(y(fact), g), g()]\n\n# TODO\ny = []\n# note\nfor g in {True: fact}:\n    {acc(True, "s6" - 44): []}\n    h(True + h, lambda fact: 23, 74) < lambda n: {acc: "s1"}\nTrue\ndef fact(n, acc):\n    if {"s3" * None: h(None)}:\n        return "s0"\n    acc = fact(h(), g.acc(None * "s0", []), g(lambda y: "s3"))\nx = lst(None)\n# note\ndef f(y, x):\n    [lst.y()]\n    total = lambda acc: [92, "s3", True + 71]\n',
        },
        {
          op: "replaceWithTexts",
          a: 0.02652803622186184,
          texts: ["x"],
        },
        {
          op: "moveNode",
          a: 0.7342839657794684,
          b: 0.6915117071475834,
        },
        {
          op: "removeNode",
          a: 0.6872087535448372,
          b: 0.9560729069635272,
        },
      ],
      motion: "full",
    })
  ).toBeNull();
}, 120_000);
it("seed 173647: a comment in the rest slot of an if that lies inside a branch is removed without an inverted change", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 173647,
      language: "python",
      code: "if x:\n    f(1)\nelif y:\n    g()\nelse:\n    h()\n[1, 2]",
      steps: [
        {
          op: "comment",
          a: 0.3801471134647727,
          text: "a b c",
          accept: true,
        },
        {
          op: "insertText",
          a: 0.21993211819790304,
          b: 0.9613397843204439,
          text: "{1: 2}",
        },
        {
          op: "moveNode",
          a: 0.14793525962159038,
          b: 0.8988624224439263,
        },
        {
          op: "pasteText",
          a: 0.08687012013979256,
          text: "True",
          before: false,
        },
        {
          op: "textEdit",
          a: 0.8173128222115338,
          len: 2,
          w: "x",
        },
        {
          op: "replaceText",
          a: 0.7672946511302143,
          text: "{1: 2}",
        },
        {
          op: "setComment",
          a: 0.06996252364479005,
          text: "note",
        },
        {
          op: "pasteText",
          a: 0.8819503546692431,
          text: "x",
          before: false,
        },
        {
          op: "editBox",
          a: 0.40106450323946774,
          text: ")",
          accept: true,
        },
        {
          op: "redo",
        },
        {
          op: "comment",
          a: 0.7367090743500739,
          text: "TODO: fix",
          accept: true,
        },
        {
          op: "collapse",
          a: 0.24620524933561683,
          on: true,
        },
        {
          op: "moveNode",
          a: 0.18814783450216055,
          b: 0.45190474251285195,
        },
        {
          op: "topLevelType",
          a: 0.28964203293435276,
          text: "x",
          accept: false,
          how: "type",
        },
        {
          op: "moveNode",
          a: 0.9532708481419832,
          b: 0.07200144836679101,
        },
        {
          op: "typeIntoBlock",
          a: 0.6055222335271537,
          text: "7",
          accept: true,
        },
        {
          op: "removeNode",
          a: 0.039609107188880444,
          b: 0.8029510527849197,
        },
      ],
      motion: "full",
    })
  ).toBeNull();
}, 120_000);
it("seed 126177: removing the bare parameter of an arrow function keeps the blank before the =", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 126177,
      language: "javascript",
      code: "// note\nconst total = true;\n// note\nlst;",
      steps: [
        {
          op: "textEdit",
          a: 0.5799059092532843,
          len: 1,
          w: "=>",
        },
        {
          op: "removeNode",
          a: 0.8875406570732594,
          b: 0.036220253678038716,
        },
      ],
      motion: "reduced",
    })
  ).toBeNull();
}, 120_000);
it("seed 106806: removing the content of a Python grouping paren is an empty tuple, a language fact for the removal oracle", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 106806,
      language: "python",
      code: 'def defproperty(klass, name, doc):\n    get = getattr(klass, ("_get_" + name))\n    def set(self, value, name=name):\n        raise xml.dom.NoModificationAllowedErr(\n            "attempt to modify read-only attribute " + repr(name))\n    assert not hasattr(klass, "_set_" + name), \\\n           "expected not to find _set_" + name\n    prop = property(get, set, doc=doc)\n    setattr(klass, name, prop)\n\n',
      steps: [
        {
          op: "removeNode",
          a: 0.19371583359315991,
          b: 0.6721976643893868,
        },
      ],
      motion: "reduced",
    })
  ).toBeNull();
}, 120_000);
it("seed 84423: two separate changes inside one root (a block moved into a neighbour in the same root) set the root's widget again, so the lines after it are drawn", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 84423,
      language: "javascript",
      code: 'total = [];\n// TODO\n"s5";\nlet g = 55;\n\n37;',
      steps: [
        {
          op: "textEdit",
          a: 0.07934253173880279,
          len: 3,
          w: "(",
        },
        {
          op: "moveNode",
          a: 0.16912874253466725,
          b: 0.6466815716121346,
        },
      ],
      motion: "reduced",
    })
  ).toBeNull();
}, 120_000);
it("seed 62470: two separate changes inside one root (a block moved into a neighbour in the same root) set the root's widget again, so the lines after it are drawn", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 62470,
      language: "python",
      code: "20\n",
      steps: [
        {
          op: "insertTemplate",
          t: 0.551050785696134,
          a: 0.11744548217393458,
        },
        {
          op: "pasteText",
          a: 0.1693189616780728,
          text: '"s"',
          before: true,
        },
        {
          op: "replaceText",
          a: 0.4843867712188512,
          text: '"s"',
        },
        {
          op: "textEdit",
          a: 0.3555873150471598,
          len: 3,
          w: "lambda",
        },
        {
          op: "pasteText",
          a: 0.11830790992826223,
          text: "f()",
          before: false,
        },
        {
          op: "moveNode",
          a: 0.6960470560006797,
          b: 0.04023701651021838,
        },
        {
          op: "textEdit",
          a: 0.776112083112821,
          len: 2,
          w: ":",
        },
      ],
      motion: "reduced",
    })
  ).toBeNull();
}, 120_000);
it("seed 83968: two separate changes inside one root (a block moved into a neighbour in the same root) set the root's widget again, so the lines after it are drawn", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 83968,
      language: "python",
      code: '"""      turtle-example-suite:\n\n        tdemo_fractalCurves.py\n\n',
      steps: [
        {
          op: "comment",
          a: 0.7603552658110857,
          text: "a b c",
          accept: true,
        },
        {
          op: "pasteText",
          a: 0.47595615964382887,
          text: "1",
          before: false,
        },
        {
          op: "replaceWithTexts",
          a: 0.5651380964554846,
          texts: ["f()", "f()"],
        },
        {
          op: "moveNode",
          a: 0.4744549645110965,
          b: 0.025232664542272687,
        },
        {
          op: "insertTemplate",
          t: 0.4260322309564799,
          a: 0.8441470887046307,
        },
        {
          op: "insertText",
          a: 0.41147755458950996,
          b: 0.3767599770799279,
          text: '"s"',
        },
      ],
      motion: "reduced",
    })
  ).toBeNull();
}, 120_000);
it("seed 118562: two separate changes inside one root (a block moved into a neighbour in the same root) set the root's widget again, so the lines after it are drawn", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 118562,
      language: "javascript",
      code: 'describe("jsonValues", () => {\n  it("reads the pages gh prints one after another", () => {\n    expect(lib.jsonValues(\'[{"a":1}]\\n[{"a":2},{"a":3}]\\n[]\')).toEqual([\n      [{ a: 1 }],\n      [{ a: 2 }, { a: 3 }],\n      [],\n    ]);\n  });\n  it("is not fooled by brackets and quotes inside a string", () => {\n    const body = \'a ] [ " \\\\ } { b\';\n    const text = JSON.stringify([{ body }]) + "\\n" + JSON.stringify([{ body }]);\n    expect(lib.jsonValues(text)).toEqual([[{ body }], [{ body }]]);\n  });\n});\n\n',
      steps: [
        {
          op: "replaceDoc",
          text: '14 * n();\n\nvar x = "s0";\nconst acc = true;\n',
        },
        {
          op: "moveNode",
          a: 0.19346871320158243,
          b: 0.4959958225954324,
        },
        {
          op: "replaceText",
          a: 0.2383379393722862,
          text: "[1, 2]",
        },
      ],
      motion: "reduced",
    })
  ).toBeNull();
}, 120_000);
it("seed 208562: two separate changes inside one root (a block moved into a neighbour in the same root) set the root's widget again, so the lines after it are drawn", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 208562,
      language: "python",
      code: 'y("s2")\n\n',
      steps: [
        {
          op: "insertTemplate",
          t: 0.8023360313382,
          a: 0.7492189684417099,
        },
        {
          op: "removeNode",
          a: 0.0018984738271683455,
          b: 0.1092046748381108,
        },
        {
          op: "moveNode",
          a: 0.6725072739645839,
          b: 0.2642213124781847,
        },
        {
          op: "undo",
        },
        {
          op: "insertTemplate",
          t: 0.8229043197352439,
          a: 0.9477159278467298,
        },
        {
          op: "moveNode",
          a: 0.2908471131231636,
          b: 0.17446365347132087,
        },
        {
          op: "undo",
        },
        {
          op: "undo",
        },
      ],
      motion: "reduced",
    })
  ).toBeNull();
}, 120_000);
it("seed 83616: two separate changes inside one root (a block moved into a neighbour in the same root) set the root's widget again, so the lines after it are drawn", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 83616,
      language: "python",
      code: "61\n# note\nf = 79",
      steps: [
        {
          op: "pasteText",
          a: 0.05748125212267041,
          text: "f()",
          before: false,
        },
        {
          op: "removeNode",
          a: 0.37622712180018425,
          b: 0.4996540530119091,
        },
        {
          op: "moveNode",
          a: 0.5346126661170274,
          b: 0.6800179504789412,
        },
      ],
      motion: "reduced",
    })
  ).toBeNull();
}, 120_000);
it("seed 191466: two separate changes inside one root (a block moved into a neighbour in the same root) set the root's widget again, so the lines after it are drawn", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 191466,
      language: "python",
      code: "if x:\n    f(1)\nelif y:\n    g()\nelse:\n    h()\n[1, 2]",
      steps: [
        {
          op: "toggleMode",
          a: 0.7786708446219563,
        },
        {
          op: "textEdit",
          a: 0.05832287389785051,
          len: 3,
          w: '"',
        },
        {
          op: "moveNode",
          a: 0.329264625441283,
          b: 0.12130286544561386,
        },
        {
          op: "undo",
        },
        {
          op: "toggleMode",
          a: 0.1742572053335607,
        },
        {
          op: "collapse",
          a: 0.25312654208391905,
          on: true,
        },
        {
          op: "editBox",
          a: 0.7833976212423295,
          text: "x",
          accept: true,
        },
        {
          op: "replaceDoc",
          text: "",
        },
        {
          op: "select",
          a: 0.3946039453148842,
        },
        {
          op: "topLevelType",
          a: 0.5414182045497,
          text: "(f 1)",
          accept: true,
          how: "paste",
        },
        {
          op: "topLevelType",
          a: 0.9722131700254977,
          text: "foo bar",
          accept: true,
          how: "type",
        },
        {
          op: "key",
          key: "ArrowRight",
          a: 0.6914680830668658,
        },
        {
          op: "clearSelection",
        },
        {
          op: "comment",
          a: 0.5245240018703043,
          text: "x; y",
          accept: true,
        },
        {
          op: "comment",
          a: 0.6479726200923324,
          text: "x; y",
          accept: false,
        },
        {
          op: "replaceText",
          a: 0.5932663707062602,
          text: "f()",
        },
        {
          op: "moveNode",
          a: 0.6417626179754734,
          b: 0.1663635631557554,
        },
      ],
      motion: "reduced",
    })
  ).toBeNull();
}, 120_000);
it("seed 196454: a root of no width (a recovered ;) is not counted in the set size and positions, when blocks are drawn or renumbered", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 196454,
      language: "python",
      code: "71\n\n",
      steps: [
        {
          op: "pasteText",
          a: 0.17597710993140936,
          text: "1",
          before: false,
        },
        {
          op: "setComment",
          a: 0.5636834625620395,
          text: "x; y",
        },
        {
          op: "textEdit",
          a: 0.3078826814889908,
          len: 2,
          w: "",
        },
        {
          op: "textEdit",
          a: 0.31623691809363663,
          len: 1,
          w: "",
        },
        {
          op: "setComment",
          a: 0.6574691687710583,
          text: "TODO: fix",
        },
      ],
      motion: "reduced",
    })
  ).toBeNull();
}, 120_000);
it("seed 166412: a root of no width (a recovered ;) is not counted in the set size and positions, when blocks are drawn or renumbered", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 166412,
      language: "python",
      code: "7\n",
      steps: [
        {
          op: "editBox",
          a: 0.7374783239793032,
          text: "(",
          accept: true,
        },
        {
          op: "redo",
        },
        {
          op: "comment",
          a: 0.6402304717339575,
          text: "x; y",
          accept: true,
        },
        {
          op: "redo",
        },
        {
          op: "pasteText",
          a: 0.9818322891369462,
          text: "1",
          before: true,
        },
        {
          op: "topLevelType",
          a: 0.8094806971494108,
          text: "(f 1)",
          accept: true,
          how: "type",
        },
        {
          op: "toggleMode",
          a: 0.397793669719249,
        },
        {
          op: "focus",
          a: 0.45591088151559234,
        },
        {
          op: "undo",
        },
        {
          op: "insertText",
          a: 0.3445836615283042,
          b: 0.6500314269214869,
          text: "{1: 2}",
        },
        {
          op: "key",
          key: "Home",
          a: 0.06607825914397836,
        },
        {
          op: "toggleMode",
          a: 0.42165031121112406,
        },
        {
          op: "comment",
          a: 0.47738968138583004,
          text: "",
          accept: true,
        },
        {
          op: "focus",
          a: 0.3098198014777154,
        },
        {
          op: "insertTemplate",
          t: 0.5767614841461182,
          a: 0.2358887221198529,
        },
        {
          op: "editBox",
          a: 0.44232661253772676,
          text: "foo",
          accept: true,
        },
        {
          op: "pasteText",
          a: 0.4793475253973156,
          text: "x",
          before: true,
        },
        {
          op: "replaceText",
          a: 0.4738032058812678,
          text: "g(2)",
        },
        {
          op: "pasteText",
          a: 0.04524213750846684,
          text: "f()",
          before: false,
        },
      ],
      motion: "reduced",
    })
  ).toBeNull();
}, 120_000);
it("seed 110590: an edit that changes how the parser recovers makes the roots after it read again (an error beside it, errors between two touched roots, the same errors left beyond)", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 110590,
      language: "javascript",
      code: 'var fact = 92;\ny.n({a: null ? 53 : y, b: n < "s5"});\n// TODO\nconst y = [];\nvar acc = lst(lst.h(n, null) - null < true);\ntotal(n(null, fact));\n',
      steps: [
        {
          op: "textEdit",
          a: 0.3642166708596051,
          len: 0,
          w: "(",
        },
      ],
      motion: "reduced",
    })
  ).toBeNull();
}, 120_000);
it("seed 189367: an edit that changes how the parser recovers makes the roots after it read again (an error beside it, errors between two touched roots, the same errors left beyond)", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 189367,
      language: "javascript",
      code: '// a comment\nfor (const x of [1, 2, 3]) {\n  total = total + x;\n}\nconsole.log(total, "done");\n',
      steps: [
        {
          op: "replaceDoc",
          text: "if (75) {\n  const x = true ? true : (acc) => acc;\n}\n[];\n// note\nn(h);\nconst y = lst.g();\n(g) => null;\n\nconst fact = (y) => (g) => true === true;\n// TODO\nn(x, [acc()]);\n",
        },
        {
          op: "textEdit",
          a: 0.20154931233264506,
          len: 1,
          w: "}",
        },
        {
          op: "moveNode",
          a: 0.686006881063804,
          b: 0.2439013917464763,
        },
      ],
      motion: "reduced",
    })
  ).toBeNull();
}, 120_000);
it("seed 100800: an edit that changes how the parser recovers makes the roots after it read again (an error beside it, errors between two touched roots, the same errors left beyond)", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 100800,
      language: "javascript",
      code: "a.b(c);\n[1, 2, 3];\nlet y = 5;",
      steps: [
        {
          op: "pasteText",
          a: 0.030136682093143463,
          text: "true",
          before: false,
        },
        {
          op: "editBox",
          a: 0.32979863160289824,
          text: ")",
          accept: true,
        },
        {
          op: "textEdit",
          a: 0.8051465933676809,
          len: 2,
          w: "",
        },
        {
          op: "removeNode",
          a: 0.034249101066961884,
          b: 0.18531385087408125,
        },
        {
          op: "setComment",
          a: 0.4876486212015152,
          text: "x; y",
        },
        {
          op: "topLevelType",
          a: 0.8512061552610248,
          text: "foo bar",
          accept: true,
          how: "paste",
        },
        {
          op: "insertText",
          a: 0.5358822050038725,
          b: 0.3326982301659882,
          text: "[1, 2]",
        },
        {
          op: "setComment",
          a: 0.13754135579802096,
          text: "note",
        },
        {
          op: "removeNode",
          a: 0.1871915354859084,
          b: 0.6957916915416718,
        },
        {
          op: "removeNode",
          a: 0.615448051597923,
          b: 0.6046434259042144,
        },
        {
          op: "typeIntoBlock",
          a: 0.8721863895189017,
          text: "7",
          accept: false,
        },
        {
          op: "topLevelType",
          a: 0.5501355158630759,
          text: "(f 1)",
          accept: true,
          how: "type",
        },
        {
          op: "undo",
        },
        {
          op: "search",
          text: "define",
          next: false,
        },
        {
          op: "select",
          a: 0.4668796109035611,
        },
        {
          op: "key",
          key: "Backspace",
          a: 0.5518591296859086,
        },
        {
          op: "insertText",
          a: 0.9055527565069497,
          b: 0.8642652533017099,
          text: "g(2)",
        },
        {
          op: "key",
          key: "Mod+Enter",
          a: 0.5902943103574216,
        },
        {
          op: "editBox",
          a: 0.9071383941918612,
          text: "y2",
          accept: true,
        },
        {
          op: "removeNode",
          a: 0.17551913554780185,
          b: 0.5208625805098563,
        },
        {
          op: "key",
          key: "Shift+ArrowLeft",
          a: 0.47125021764077246,
        },
        {
          op: "textEdit",
          a: 0.5252554402686656,
          len: 2,
          w: " ",
        },
        {
          op: "textEdit",
          a: 0.050975498743355274,
          len: 3,
          w: '"',
        },
        {
          op: "topLevelType",
          a: 0.5817542574368417,
          text: "x",
          accept: false,
          how: "type",
        },
        {
          op: "insertTemplate",
          t: 0.7813831304665655,
          a: 0.06637405697256327,
        },
      ],
      motion: "reduced",
    })
  ).toBeNull();
}, 120_000);
it("seed 196989: an edit that changes how the parser recovers makes the roots after it read again (an error beside it, errors between two touched roots, the same errors left beyond)", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 196989,
      language: "javascript",
      code: '// note\nconst total = "s8";\n',
      steps: [
        {
          op: "textEdit",
          a: 0.45316242473199964,
          len: 2,
          w: "(",
        },
        {
          op: "topLevelType",
          a: 0.05529108224436641,
          text: "(f 1)",
          accept: true,
          how: "paste",
        },
        {
          op: "replaceText",
          a: 0.05569395120255649,
          text: "g(2)",
        },
        {
          op: "removeNode",
          a: 0.2516508169937879,
          b: 0.8765634093433619,
        },
      ],
      motion: "reduced",
    })
  ).toBeNull();
}, 120_000);
it("seed 152396: an edit that changes how the parser recovers makes the roots after it read again (an error beside it, errors between two touched roots, the same errors left beyond)", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 152396,
      language: "javascript",
      code: 'if (g(null ? true : null)) {\n  while (n(g(), "s3" ? n : null, n + "s9")) {\n    (g) => "s9" ? true : total({a: "s5", b: null}, 86);\n    var y = g(43, fact(), [] - h.y(true));\n    f = y(true + true, n);\n  }\n}\nf([75], (x) => true === f(), [null]);\n',
      steps: [
        {
          op: "editBox",
          a: 0.7312195945996791,
          text: "  ",
          accept: true,
        },
        {
          op: "undo",
        },
        {
          op: "insertTemplateAt",
          t: 0.3062992673367262,
          a: 0.5070303387474269,
          b: 0.47183117642998695,
        },
        {
          op: "key",
          key: "Space",
          a: 0.9567368975840509,
        },
        {
          op: "moveNode",
          a: 0.03854922135360539,
          b: 0.1303199203684926,
        },
        {
          op: "undo",
        },
        {
          op: "search",
          text: "1",
          next: false,
        },
        {
          op: "insertText",
          a: 0.27262712689116597,
          b: 0.6718298990745097,
          text: "true",
        },
        {
          op: "key",
          key: "Backspace",
          a: 0.8499687886796892,
        },
        {
          op: "select",
          a: 0.41484883963130414,
        },
        {
          op: "replaceText",
          a: 0.4580533972475678,
          text: "x",
        },
        {
          op: "moveSelection",
          a: 0.8838887352030724,
        },
        {
          op: "textEdit",
          a: 0.26219012145884335,
          len: 2,
          w: "{",
        },
        {
          op: "editBox",
          a: 0.3174007323104888,
          text: ")",
          accept: false,
        },
        {
          op: "removeNode",
          a: 0.9867883082479239,
          b: 0.6767240972258151,
        },
        {
          op: "moveNode",
          a: 0.958855259232223,
          b: 0.02473422233015299,
        },
      ],
      motion: "reduced",
    })
  ).toBeNull();
}, 120_000);
it("seed 191658: an edit that changes how the parser recovers makes the roots after it read again (an error beside it, errors between two touched roots, the same errors left beyond)", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 191658,
      language: "python",
      code: '"s3"\nf = h(acc, n(f("s4"), total), None < {"s3": None})\n# TODO\ny = lambda g: lambda acc: acc - True\n"s7"\nwhile h("s1", True, None) == "s2" * True:\n    acc("s9", lst(f(), True == None, True), {None: True} - fact * True)',
      steps: [
        {
          op: "moveNode",
          a: 0.2486220367718488,
          b: 0.4519062037579715,
        },
        {
          op: "textEdit",
          a: 0.8162776913959533,
          len: 1,
          w: "12",
        },
        {
          op: "replaceDoc",
          text: "def f(a, b):\n    y = a\n    return y\nf(1, 2)\n",
        },
        {
          op: "key",
          key: "Mod+Shift+z",
          a: 0.3166285159531981,
        },
        {
          op: "search",
          text: "f",
          next: true,
        },
        {
          op: "pasteText",
          a: 0.5015405188314617,
          text: "True",
          before: true,
        },
        {
          op: "key",
          key: "Home",
          a: 0.4130794124212116,
        },
        {
          op: "setComment",
          a: 0.38144653174094856,
          text: "x; y",
        },
        {
          op: "collapse",
          a: 0.5093106171116233,
          on: false,
        },
        {
          op: "key",
          key: "ArrowRight",
          a: 0.9713748600333929,
        },
        {
          op: "textEdit",
          a: 0.1552359696943313,
          len: 2,
          w: "if a:\n    b",
        },
        {
          op: "redo",
        },
        {
          op: "typeIntoBlock",
          a: 0.42301130294799805,
          text: "7",
          accept: true,
        },
        {
          op: "redo",
        },
        {
          op: "comment",
          a: 0.2363070733845234,
          text: "TODO: fix",
          accept: true,
        },
        {
          op: "insertTemplate",
          t: 0.1564259589649737,
          a: 0.5582798400428146,
        },
        {
          op: "moveNode",
          a: 0.7241625469177961,
          b: 0.7031007537152618,
        },
        {
          op: "insertTemplate",
          t: 0.2802774936426431,
          a: 0.26203350559808314,
        },
        {
          op: "undo",
        },
        {
          op: "focus",
          a: 0.3414340091403574,
        },
        {
          op: "replaceText",
          a: 0.6876044834498316,
          text: "True",
        },
        {
          op: "pasteText",
          a: 0.17064845422282815,
          text: "g(2)",
          before: false,
        },
        {
          op: "moveSelection",
          a: 0.05412997305393219,
        },
        {
          op: "select",
          a: 0.9682135847397149,
        },
        {
          op: "key",
          key: "Space",
          a: 0.6636744572315365,
        },
        {
          op: "insertTemplateAt",
          t: 0.973084069788456,
          a: 0.7799091001506895,
          b: 0.701559656765312,
        },
        {
          op: "insertText",
          a: 0.9775334557052702,
          b: 0.08480556146241724,
          text: "f()",
        },
        {
          op: "insertText",
          a: 0.45464742043986917,
          b: 0.16827837540768087,
          text: "{1: 2}",
        },
        {
          op: "redo",
        },
        {
          op: "key",
          key: "Shift+|",
          a: 0.541248818160966,
        },
        {
          op: "insertText",
          a: 0.3187273337971419,
          b: 0.4769354846794158,
          text: "{1: 2}",
        },
        {
          op: "focus",
          a: 0.02779122651554644,
        },
        {
          op: "removeNode",
          a: 0.5102774694096297,
          b: 0.80423628189601,
        },
      ],
      motion: "reduced",
    })
  ).toBeNull();
}, 120_000);

it("seed 259236: Backspace on selected blocks of a text that does not parse, where a blank and a deletion overlap, makes one change (no exception)", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 259236,
      language: "javascript",
      code: "function f(a, b) { return a * b; }\nf(1, 2);\nif (x) { f(1, 2); } else { g(); }",
      steps: [
        {
          op: "toggleMode",
          a: 0.650963586056605,
        },
        {
          op: "toggleMode",
          a: 0.3499852509703487,
        },
        {
          op: "textEdit",
          a: 0.2201427510008216,
          len: 2,
          w: "`",
        },
        {
          op: "insertText",
          a: 0.39539279928430915,
          b: 0.7781902642454952,
          text: "g(2)",
        },
        {
          op: "pasteText",
          a: 0.4924271742347628,
          text: "[1, 2]",
          before: false,
        },
        {
          op: "key",
          key: "Mod+z",
          a: 0.9194535354617983,
        },
        {
          op: "undo",
        },
        {
          op: "pasteText",
          a: 0.16597305657342076,
          text: "true",
          before: false,
        },
        {
          op: "pasteText",
          a: 0.4112097613979131,
          text: "g(2)",
          before: false,
        },
        {
          op: "setComment",
          a: 0.7979403003118932,
          text: "note",
        },
        {
          op: "replaceDoc",
          text: "var h = {a: h(n ? fact : y), b: null ? [26] : 95};\n\n",
        },
        {
          op: "collapse",
          a: 0.22280769352801144,
          on: false,
        },
        {
          op: "undo",
        },
        {
          op: "focus",
          a: 0.17188423057086766,
        },
        {
          op: "select",
          a: 0.5094033901114017,
        },
        {
          op: "textEdit",
          a: 0.8750510094687343,
          len: 2,
          w: "(",
        },
        {
          op: "select",
          a: 0.8726411641109735,
        },
        {
          op: "setComment",
          a: 0.676923583028838,
          text: "",
        },
        {
          op: "key",
          key: "Backspace",
          a: 0.6852235866244882,
        },
      ],
      motion: "full",
    })
  ).toBeNull();
}, 120_000);

it("soak seed 10019: End on a long document keeps the focus in the editor when the focused block is scrolled out of the drawn part", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 10019,
      language: "javascript",
      code: 'config.module.rules.push(\n  {\n    test: /\\.rkt$/,\n    type: "asset/source",\n  },\n  {\n    test: /\\.tsx?$/,\n    use: [\n      {\n        loader: "ts-loader",\n        options: {\n          // Point directly to your custom tsconfig that excludes tests\n          configFile: path.resolve(__dirname, "../tsconfig.build.json"),\n        },\n      },\n    ],\n    exclude: /node_modules/,\n  }\n);\n\nfunction fact(y, f) {\n  var n = [];\n  let h = (h) => x(3) ? y.x() : null;\n}\n// TODO\nlet f = f(true);\nif (fact([])) {\n  x(null + 50, [null, 74]) ? (acc) => "s5" ? true : g : 47 * null;\n  if ("s8") {\n    x(total([true, null], y("s7", "s6"), f(true)), null, fact(fact(98, true, true), f.lst(), null ? 25 : null));\n    let fact = (lst) => fact;\n  }\n  if ({a: true === lst, b: g}) {\n    var lst = n() + fact(10 === "s2");\n  }\n}\n// a b c\nif (lst()) {\n  f(true ? 55 : null, acc.h(null)) ? f.y(true, null) ? (x) => null : {a: 0, b: null} : [true, x(null), acc(f, 67)];\n  {a: fact(fact.n(86, g), true, acc ? acc : "s1"), b: n.acc() + true - "s7"};\n  while (lst ? x : "s3" * [n]) {\n    const fact = acc("s5" ? (y) => null : {a: 65, b: f}, y([], acc(), x(null, null, "s2")), f("s5", "s8") === total(y, true, "s3"));\n  }\n} else {\n  null;\n}\ng;\ntrue * (acc) => fact(y);\nfunction acc(acc, lst) {\n  let acc = x(87 ? (lst) => null : lst, y(true, 9, true) * null, null);\n  "s1";\n  const fact = true;\n}\nwhile (null ? "s3" : null ? [] : {a: true, b: true}) {\n  if (lst(true, null, 59) ? (total) => "s6" : 67 ? "s0" : "s3") {\n    const total = true ? y.x() : y.x();\n    f(true ? h : y) + (g) => "s0" + lst();\n    const y = f;\n  }\n  if (true) {\n    var acc = "s4" < null;\n  }\n  33;\n}\n\n// a b c\nfor (const fact of true) {\n  function total(n, h) {\n    null + fact(acc(), f);\n    var lst = null;\n    return acc(true ? true : "s7", f(null));\n  }\n  [x < total(null, true, acc)];\n}\n\ng = n;\n\n(x) => (g) => "s3" < "s0";\n// note\nacc(true * (lst) => "s8", total(), "s3" - 88 < 67);\n\n["s6" + null < "s9", (lst) => "s6" ? fact : null, y];\n// TODO\nfunction f(total, y) {\n  return x("s9", null);\n  return null;\n  if (true) {\n    x = acc * null;\n  }\n}\ny(lst(40, true)) - h(null);\n\n// a b c\nconst lst = (acc) => lst();\n// a b c\nconst total = y.n();\nfunction total(total, g) {\n  [acc(), f((g) => acc, null ? true : true, "s5" ? 96 : "s9")];\n}\n\n// note\nvar total = (x) => (x) => "s6";\nconst n = acc("s0" + 49) - fact();\n// note\nconst fact = true;\ng = [];\nconst at = process.argv.indexOf("--port");\nconst port = at >= 0 ? Number(process.argv[at + 1]) : 8080;\nconst types = {\n  ".html": "text/html",\n  ".js": "text/javascript",\n  ".css": "text/css",\n  ".json": "application/json",\n  ".map": "application/json",\n  ".rkt": "text/plain",\n};\n\ncontainer.id = "app";\n\nconst editor = CodeMirrorBlocks(\n  container,\n  {\n    collapseAll: false,\n    value: exampleCode,\n  },\n  WeScheme\n);\n\n// for debugging purposes\nconst x = [(h) => 15] === x(x, true) < f(null, h);\nfunction y(g, lst) {\n  n(12);\n  let n = 63;\n}\n\nfor (const total of x(null, null, null)) {\n  for (const total of x(true)) {\n    const g = true;\n    let y = f.x(true);\n    var lst = {a: n(true + "s8", (total) => "s2"), b: total(acc(null), [true, "s4"], "s4")};\n  }\n}\n\n// note\nlet total = 52;\n\nwhile (n("s7", true, (h) => true)) {\n  var g = lst(fact(), h);\n  const lst = null;\n  let x = null;\n}\n// note\nconst g = true;\nfor (const x of g(lst, x, 37)) {\n  total.x(lst(), true ? acc : "s4") + [total, []];\n  acc = true;\n  if (lst()) {\n    let fact = f.lst(83, (y) => g(null));\n    let acc = h();\n    const y = n();\n  } else {\n    let y = x();\n    let x = 10 ? null : y.x(y) === [null, 60];\n  }\n}\nfact();\nconst fact = total;\n\ndescribe("promoting a failure to a regression test", () => {\n  const replay = JSON.stringify({\n    code: "(f x)\\n(g)",\n    steps: [{ op: "cut", r: [1, 2, 3, 4] }],\n  });\n  const records = [\n    { seed: 7, signature: "cut :: bad", problem: "bad", shrunkTo: 3, replay },\n    { seed: 9, signature: "cut :: bad", problem: "bad", shrunkTo: 1, replay },\n    { type: "crash", seed: 7 },\n  ];\n\n  it("finds a failure by seed or by signature text (the smallest)", () => {\n    expect(lib.findForPromote(records, "7").shrunkTo).toBe(3);\n    expect(lib.findForPromote(records, "CUT").seed).toBe(9);\n    expect(lib.findForPromote(records, "nothing")).toBeNull();\n  });\n\n  it("prints an it() in the format of the once-broke block", () => {\n    expect(lib.promoteCase(records[0])).toBe(\n      [\n        \'  it("seed 7: bad", () => {\',\n        "    check({",\n        \'      code: "(f x)\\\\n(g)",\',\n        "      steps: [",\n        "        {",\n        \'          "op": "cut",\',\n        \'          "r": [\',\n        "            1,",\n        "            2,",\n        "            3,",\n        "            4",\n        "          ]",\n        "        }",\n        "      ],",\n        "    });",\n        "  }, 120_000);",\n      ].join("\\n")\n    );\n  });\n});\n// TODO\n// note\nacc();\nconst y = lst(n(g("s7", 20)), true, total());\nwhile (n()) {\n  30;\n}\nacc;\nfor (const y of fact()) {\n  const g = (n) => true ? null : null + y ? null ? "s3" : n ? 13 : "s0" : fact();\n}\nconst REDUXFN =\n  /useSelector|useSyncExternalStore|selector|dispatch|subscribe|getSnapshot/i;\n\n/** Self time (ms) per bucket, plus inclusive time of some named functions. */\nvar g = "s0";\nlet lst = x();\nconst g = fact.lst(29);\nvar n = x(84 ? fact.f() : true);\n\n{a: null, b: ["s6", null]} - n;\nfunction y(x, total) {\n  if ((y) => null < "s0" ? "s2" : 34) {\n    g = f(lst(), g(), "s0" < lst);\n    (lst) => (acc) => total < fact(null, null);\n  } else {\n    y();\n  }\n  for (const fact of h(f, null)) {\n    var fact = fact(x.fact(), [] === true + g);\n    const y = h(y(true), total.g());\n  }\n  for (const g of lst < 99) {\n    f(fact(), total.h(), 67 < 1);\n  }\n}\nconst doJob = async (job, mode, from, size, steps) => {\n  const state = states[mode];\n  const { progress } = state;\n  let result = await runBatch(job, mode, from, size, steps, batchTimeoutMs);\n  if (result.crashed && hardStop) return; // ended by hand: not a finding\n  if (result.crashed) {\n    // Which seed did it? Run them one at a time. A seed that dies alone is a bug\n    // to report; if none does, the batch ran out of memory by adding up.\n    log(\n      `${mode} seeds ${from}-${from + size - 1}: ${result.kind} (log: ${result.log}); running them one at a time`\n    );\n    const crashes = [];\n    const alone = { passed: 0, failures: [] };\n    for (let seed = from; seed < from + size && !hardStop; seed++) {\n      const single = await runBatch(job, mode, seed, 1, steps, singleTimeoutMs);\n      if (single.crashed) {\n        crashes.push({ kind: single.kind, seed, steps, mode, log: single.log });\n      } else {\n        alone.passed += single.passed;\n        alone.failures.push(...single.failures);\n      }\n    }\n    if (!crashes.length) {\n      crashes.push({\n        kind: result.kind,\n        seeds: [from, from + size - 1],\n        mode,\n        log: result.log,\n        note: `no single seed does it: the batch of ${size} adds up, so the batch size is halved`,\n      });\n      state.batchSize = Math.max(5, Math.floor(size / 2));\n    }\n    for (const c of crashes) {\n      progress.crashes.push({ ...c, at: new Date().toISOString() });\n      record(mode, { type: "crash", ...c });\n    }\n    log(\n      `  ${crashes.length} crash record(s); ${alone.passed} seeds ran fine on their own`\n    );\n    result = alone;\n\n// a b c\nfunction y(h, fact) {\n  if ((n) => g(null)) {\n    null;\n    f();\n    var fact = [acc * true + 74 === f];\n  } else {\n    var fact = {a: true, b: true} === 74 ? acc : 69 ? total() : null;\n    return lst(lst, null);\n  }\n  total = f();\n  null;\n}\nfor (const g of total(true, 48)) {\n  if ((g) => 72 === g) {\n    92;\n  }\n}\n\n[[null ? "s7" : n, f ? null : 50], acc];\nif ([[x]]) {\n  if (true) {\n    ["s2"];\n    var acc = [];\n    var fact = n;\n  }\n  acc;\n}\nacc([x.y()], [true ? y : true], {a: g(true, null, 38), b: fact()});\nlet x = h.lst(n(null * null, {a: true, b: "s8"}), lst(null, null ? null : "s0"));\nfor (const fact of 80) {\n  function total(acc, total) {\n    n({a: null, b: true}, fact(null, 43, f), 54 - 22) === "s3";\n    n.lst(["s4" === 86, (acc) => 49]);\n  }\n  while (true) {\n    const x = acc;\n    h(true);\n    total = g.fact([]);\n  }\n}\n\nif ([fact()]) {\n  fact = y();\n  total = n(n(6), lst("s4", 66, null), lst);\n  if (n.h(null, acc.x(f, 34))) {\n    n(n) ? n.g() : null;\n    total.g(y(fact(null, 85), (fact) => "s1", "s4"), acc(total(64)));\n    let x = (n) => {a: null, b: x};\n  } else {\n    acc.acc(x(acc.total(), null ? total : n), lst(y, null, 52) * acc(true, true, null));\n    const x = 89;\n  }\n}\nmodule.exports = function gen(lines) {\n  const out = [];\n  for (let i = 0; out.length < lines; i++) out.push(...form(i));\n  return out.join("\\n");\n};\n\n// note\ncontainer.id = "app";\n\nconst editor = CodeMirrorBlocks(\n  container,\n  {\n    collapseAll: false,\n    value: exampleCode,\n  },\n  WeScheme\n);\n\n// for debugging purposes\n\n// a b c\nn((g) => true, fact(null, null), 40) ? x(null) - 8 : {a: fact === true, b: 32 - y};\nfunction f(a, b) { return a * b; }\nf(1, 2);\nif (x) { f(1, 2); } else { g(); }\n\n// note\nfunction fact(n, x) {\n  y = x("s3", acc, true) * true;\n  h(null, x);\n}\nlst.total(total(34 - null, y));\nif (acc(g(null, true))) {\n  lst("s4" ? true : "s6" * "s8");\n  f = x ? 27 ? x : true : "s1";\n  if (x) {\n    fact([] - x(true), 90 + h.fact(null, null), {a: (fact) => fact, b: x.total(68)});\n    acc = y(n(total, 97), x("s5", true, 91), null);\n    let g = [(g) => (n) => 14];\n  }\n}\n// a b c\nfunction n(total, y) {\n  ["s0", (x) => x("s6", "s4"), (n) => true];\n  "s2";\n  var fact = (h) => fact(null, x, null) ? h ? true : g : x("s8", lst, true);\n}\nacc = lst.acc(y.acc(null));\nmodule.exports = [devServerConfig, bundleConfig];\n\n// TODO\nconst flag = (name) => args.includes(`--${name}`);\nconst opt = (name) => {\n  const i = args.indexOf(`--${name}`);\n  return i === -1 ? undefined : args[i + 1];\n};\nn.f() ? acc : h(true, "s1", 63) + (y) => x;\nfor (const y of null ? total : null) {\n  y();\n  if ((f) => "s9" ? "s6" : 40) {\n    var f = acc.n();\n    true;\n  }\n}\nconst lst = x(total, 95, []);\nwhile (n()) {\n  [[]];\n}\nif (true ? fact("s1", null) : [g, "s1", true]) {\n  const h = {a: lst, b: [fact, null] ? acc() : acc ? true : acc};\n}\nfor (const f of 72 * lst) {\n  fact;\n}\nf();\nfor (const h of "s3") {\n  function x(total, f) {\n    return acc();\n  }\n  for (const acc of (x) => null) {\n    const f = 18 * (x) => total(50);\n    const h = total(x());\n  }\n  const acc = fact(lst(73, true < "s8", []), f(51));\n}\n\n// TODO\n[{a: 16, b: true}];\nlet total = 4;\nlet x = 1 + 2;\nf(x, 3);\nwhile (x < 9) { x = x + 1; g(x); }\n\n// TODO\nif ([(n) => 61, x, fact()]) {\n  {a: 41, b: "s6"};\n  while (y(true, (h) => true, null ? 21 : "s9")) {\n    n = 47;\n    const acc = null;\n  }\n}\n\nnull;\nif (lst(total, x(), n())) {\n  g.y(x(true, true, "s5"), x.h()) - g;\n}\ng(null);\ncontainer.id = "app";\n\nconst editor = CodeMirrorBlocks(\n  container,\n  {\n    collapseAll: false,\n    value: exampleCode,\n  },\n  WeScheme\n);\n\n// for debugging purposes\n{a: f(), b: n()};\nif (lst) {\n  while ([x("s2"), null + "s6"]) {\n    const total = [y(acc(h, n, g), h())];\n  }\n  const fact = y * acc();\n  for (const acc of true < lst) {\n    const h = g(69, f((lst) => f, null * 80, f("s5")), (y) => "s7");\n    var x = 18 < 94;\n  }\n} else {\n  x = {a: true, b: f} ? g : true - "s1";\n  const y = h.total(true, (y) => total());\n  null;\n}\n// a comment\nfor (const x of [1, 2, 3]) {\n  total = total + x;\n}\nconsole.log(total, "done");\n// a b c\nlet x = h(fact());\n\nfor (const lst of total(51, true, "s5")) {\n  let fact = ["s0" === acc, (g) => true, {a: true, b: null}] ? null : total(null);\n  n = (g) => y();\n}\n// a b c\nlst();\nfunction g(acc, n) {\n  var total = true;\n  function total(total, y) {\n    return 85;\n    53;\n  }\n  function y(total, total) {\n    return h();\n    x = g + null + h;\n    return x ? "s7" : true ? h.f() : y;\n  }\n}\n\n// TODO\nwhile (null) {\n  function h(n, n) {\n    n.g(x(true, null) - acc("s2", true));\n    "s4";\n  }\n  function n(g, fact) {\n    let acc = "s0";\n  }\n  while ((g) => n.lst()) {\n    (acc) => y();\n    var h = x(x(null) ? "s5" : total(true));\n    var acc = total(fact(h(51, "s8", "s3"), null, true - f), fact(y(), "s3", {a: 84, b: true}), []);\n  }\n}\nconfig.module.rules.push(\n  {\n    test: /\\.rkt$/,\n    type: "asset/source",\n  },\n  {\n    test: /\\.tsx?$/,\n    use: [\n      {\n        loader: "ts-loader",\n        options: {\n          // Point directly to your custom tsconfig that excludes tests\n          configFile: path.resolve(__dirname, "../tsconfig.build.json"),\n        },\n      },\n    ],\n    exclude: /node_modules/,\n  }\n);\n\n\nconst {\n  getWebpackBundleConfig,\n} = require("@bootstrapworld/cmb-toolkit/lib/webpack");\n\n// dist/codemirror-blocks-min.js: the editor, with no language, for a page that\n// loads it with a <script> tag (a language is another file: see wescheme, ...)\n// TODO\n',
      steps: [
        {
          op: "collapseAllThen",
          on: true,
          a: 0.1549821828957647,
          text: "1 2",
          accept: true,
        },
        {
          op: "key",
          key: "End",
          a: 0.5391628111246973,
        },
      ],
      motion: "reduced",
    })
  ).toBeNull();
}, 120_000);

it("soak seed 10596: a document with a parse error is not held to a fresh parse's blocks (Lezer's incremental parse recovers from an error differently)", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 10596,
      language: "python",
      code: 'if x:\n    f(1)\nelif y:\n    g()\nelse:\n    h()\n[1, 2]\n# TODO\ny()\nlambda total: [{None: 72}]\nif True == None:\n    x = None\n    lambda x: {[None]: g("s1", lst)}\n    if acc(acc):\n        fact = ["s5", {total(None, True): True}, h(lst())]\n        True\n\n# TODO\ntotal.x()\nfor n in ["s7", True, True]:\n    def f(total, x):\n        35\n# TODO\nif True:\n    fact = "s2"\n    while 6:\n        g = []\nwhile fact(x(True, None, True), lst(), lambda y: None):\n    y()\n    g(lambda total: f(None, "s9"), 10 < n(lst), True)\n{True - None * h: 20}\n\ndef remoteref(obj):\n    oid = id(obj)\n    objecttable[oid] = obj\n    return RemoteProxy(oid)\n\n\nTrue\nlst = []\n# TODO\ny(g(), "s3")\n# TODO\nlambda g: lambda g: total()\nNone\n\nh = [True - lambda g: n, fact.h(34) - f]\nn(g())\n\nn = f\ny = total.total(None + "s5") - None\nif g.g():\n    [f * True, lambda f: 95] - "s4"\ndef lst(fact, n):\n    while 20:\n        g = h(acc([total, 44, lst], 79 == 17), n(), 88 + h("s0", h))\n        lambda acc: fact("s2", None) * 19\n        lst = {{f: x(None, fact)}: g}\n    fact = 35\ndef h(total, f):\n    y = h.total(None)\n    if n.lst(None + "s2", h < "s0"):\n        acc(28)\n        True\n        return g(True + 14, "s1", 25 * lst)\n    else:\n        "s1"\n        return f(None) < None - None\n        return acc.total("s1", lst(None, acc, 2))\n    n = [total]\nn = None\nNone\nif total(None * lst):\n    for f in acc:\n        g = "s1"\n        g = [21, lst(h.acc())]\n    if fact(total.g(29, "s3")):\n        lambda lst: x.total()\n        acc = True\n    else:\n        x = "s1"\n        acc = None\n        g = None * None == None + fact()\nelse:\n    True\n    while [None, lambda n: "s9", True]:\n        y = True\n        acc = 91\n        [acc(y, True), lambda n: g] + "s4"\ndef lst(h, lst):\n    x = x\n    total.g("s7")\nx = []\nlambda f: [{None: n}]\nfact(f(17))\n# a b c\n"s8"\ntotal()\n# a b c\nfact(70)\nNone\n# a b c\nwhile None == lst:\n    if "s7":\n        h = lambda x: total\nif 75:\n    g(lst(h.n(None), {None: 34}))\nwhile g():\n    if None:\n        f = total\n    f = y("s4")\n    while "s2":\n        n = h\n        acc = lambda h: x.total()\n        f = n(acc(90 - None))\n# TODO\nn = fact(y(), [lambda n: True], h)\nf = lambda lst: g(True, True)\n\nh = "s3"\n\n# a b c\n{x(): True}\n\nif f("s9", y, g) + None < None:\n    x = f.lst(y(), h())\nelse:\n    def acc(lst, f):\n        n = lambda lst: []\n        return h.x({"s8": 74})\n        n = True\n    fact = 73\n\nwhile lambda lst: {True: True}:\n    def total(h, lst):\n        return [None, n(n, f, fact)]\n        return g(None, lambda g: "s3")\n    lambda total: {y + True: lst.total(True)}\nlst\nwhile lambda x: total(None, lst):\n    lambda lst: "s7" * "s4" * total\n    n = lambda f: lambda fact: True + 88\n    None\nwhile "s2":\n    n(g(), {lambda acc: "s5": lst()})\nx = lst()\ndef acc(lst, g):\n    f = [lst(n, True, None), lst(True, None, f) < n]\n    while None:\n        f = [46, lambda acc: g(34, 73, None)]\nTrue\nx = {y({n: "s8"}, h("s7")): lambda fact: "s3" - fact}\n[x + lst < acc()]\nclass A:\n    def m(self):\n        return 1\nA().m()\ng.h(19)\nacc = y(y())\nlst = y({lambda g: h: "s5"}, None, n(None, None) < 2 + True)\n\ng = 59\nif True:\n    if lambda x: "s8" < True:\n        n = lambda fact: None\n        y = []\nelse:\n    [lambda g: [None]]\n    fact = True\n\nacc = []\nif []:\n    y = lambda h: y\nelse:\n    for total in fact(x, "s0", lst):\n        x(n(lambda acc: y), None, lambda acc: lambda g: n)\n    g = g(lambda x: acc(66), "s5")\n    {acc("s0", True) < x.n(33): lambda fact: [True, 59, "s5"]}\n# TODO\n[[], "s9", g()]\nacc([], True * [True, "s5"], None)\n# note\nlst = n.acc(total.y(), lambda total: True)\nwhile total(lst("s5"), x(3)):\n    if g("s0"):\n        lst = {h(): acc}\n        "s5"\n# note\n64\nlst = lst\nfact(n([79, 19]))\n# note\nwhile h(None * None, 16, lst(84)):\n    while True:\n        fact = lambda total: h(h(f), fact, y())\n        lst = g(None, lambda y: lambda lst: "s8")\n        y = h("s5")\nwhile x():\n    for lst in []:\n        "s0" + 12 == [True] == f(f, None)\n        acc = "s3"\n        lambda y: "s2"\n    y = h(None, lst(y, "s7", 54), True) + [f(23), acc]\n# a b c\n[h, n(h("s7"), f(True, lst))]\n# note\ndef total(acc, f):\n    True\n    acc = lambda y: acc\n\n# a b c\nn = 23\nn(h.n(90), "s6" == n(True), True + acc())\nh\nfor h in None:\n    while fact("s0", None) + acc + acc:\n        h = x(x.x(lambda y: g))\n        h = None\n        acc = {lambda acc: "s3" * None == "s4": lst}\n\n\ntotal = None\n"s2"\n{h: True}\ng = [g(n("s1", n), {"s6": None}, {"s4": None})]\n',
      steps: [
        {
          op: "multiSelect",
          a: 0.8206275752745569,
          n: 4,
          then: "cutPaste",
          b: 0.18233666336163878,
        },
      ],
      motion: "reduced",
    })
  ).toBeNull();
}, 120_000);

it("soak seed 10569: a comment next to a block that is drawn, outside the drawn part of a long document, still marks the block after undo and redo", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 10569,
      language: "javascript",
      code: 'null ? fact("s3", null) : (acc) => null ? h() : fact(40, null, true) ? ["s2", null] : (h) => true;\nfunction lst(n, acc) {\n  f;\n  (total) => total(g("s3", "s5", null));\n}\nfunction f(total, n) {\n  while (lst("s3" - "s9")) {\n    const acc = h(null, null) - {a: lst, b: true} * true;\n    const g = acc;\n    total();\n  }\n  function g(lst, lst) {\n    return (x) => true - h(true, true);\n  }\n  const fact = [56];\n}\nacc();\n// a b c\nfunction f(g, f) {\n  const g = h;\n  if (acc()) {\n    return "s8";\n    x(acc.acc(total(true, n, null), null), y(true, "s8") - n(null), x(["s2", y]));\n    total() ? f([null, f], lst(true, true), 87 - true) : n(n(true, 14, n), [null, null, 5]);\n  } else {\n    return acc(acc(lst, fact, "s1"));\n    return 58;\n  }\n}\ntrue;\n// note\n["s5", f - null, x(true * null, f("s3", 77))];\n\n// a b c\nconst x = null;\ny();\nwhile (fact(acc(true, null))) {\n  while ({a: true, b: y ? h : f}) {\n    y(null);\n    const total = n;\n  }\n  true * x.n((g) => true);\n  true;\n}\nvar y = total();\nx = [];\n[];\n\n(x) => "s3";\nif (f(x())) {\n  acc = x;\n  let fact = null;\n} else {\n  fact = y(true);\n  while (h) {\n    [y((g) => true, 47 - 49), [], acc(true ? 84 : null)];\n  }\n  if (g(h.f(), (h) => 42)) {\n    var total = "s6";\n  } else {\n    y(lst(null));\n  }\n}\n// a b c\nconst f = true;\nconst g = g();\nfor (const n of 74) {\n  g = n(true, true, 9) ? null - null : "s0" ? 72 : "s9";\n  let x = acc;\n}\ny = (g) => "s9";\nnull ? fact ? true : null < {a: null, b: f} : {a: 24, b: true};\n// TODO\nif (f(fact + true, fact)) {\n  let h = total;\n  while ("s2") {\n    const n = {a: {a: true ? null : g, b: x.fact()}, b: null};\n    var g = null;\n    var x = "s6" ? g() : {a: x(f, "s2"), b: n(null, true)};\n  }\n}\n\nwhile (true) {\n  var lst = null;\n  for (const total of "s0") {\n    var total = y(lst.g(47, null) - n(true), [true, "s8"] ? fact(true, 23) : 80, x);\n  }\n  if (88) {\n    f(f(), y, acc(y(), f.x()));\n  } else {\n    let h = total;\n    var total = null;\n  }\n}\nh;\n// TODO\nwhile (fact(null, f) + true) {\n  while (null - null === y ? 51 : null) {\n    const f = 50;\n    let acc = lst(86 ? null : "s9" ? true ? 76 : null : fact);\n  }\n  if (total(null, (n) => 69)) {\n    const f = [true];\n    h = {a: "s9", b: true} * true ? true : "s7";\n    var f = fact({a: ["s1", null], b: x}, h(g(47, 67, 8), y(8, null, true)), (x) => 67 ? "s2" : "s0");\n  }\n}\n\nfunction f(a, b) { return a * b; }\nf(1, 2);\nif (x) { f(1, 2); } else { g(); }\nconst at = process.argv.indexOf("--port");\nconst port = at >= 0 ? Number(process.argv[at + 1]) : 8080;\nconst types = {\n  ".html": "text/html",\n  ".js": "text/javascript",\n  ".css": "text/css",\n  ".json": "application/json",\n  ".map": "application/json",\n  ".rkt": "text/plain",\n};\n\n// a comment\nfor (const x of [1, 2, 3]) {\n  total = total + x;\n}\nconsole.log(total, "done");\n\na.b(c);\n[1, 2, 3];\nlet y = 5;\n// TODO\nconst at = process.argv.indexOf("--port");\nconst port = at >= 0 ? Number(process.argv[at + 1]) : 8080;\nconst types = {\n  ".html": "text/html",\n  ".js": "text/javascript",\n  ".css": "text/css",\n  ".json": "application/json",\n  ".map": "application/json",\n  ".rkt": "text/plain",\n};\n\nh.fact(true, null === true) + y(g ? true : fact, true * n, null);\nlst();\nif (f(f(), y(null, "s4"), "s9")) {\n  if (x(g.acc("s7", 77), {a: 59, b: fact})) {\n    const total = [];\n    fact;\n    var lst = fact(["s1", true], total.x(24)) ? null : "s0";\n  }\n  28 + [null, null] ? y({a: true, b: true}, 71, lst(null)) : 89;\n  const n = fact(true ? 34 : f, [true], "s6") ? h() : y(lst) === total(true, g);\n}\nvar lst = acc(h, n, n(68)) ? 42 === "s0" + acc : x(null, null) - "s4" * null;\n\n// a b c\nif (true) {\n  var lst = h;\n  for (const f of null) {\n    fact(acc.total(63, h(true)));\n  }\n  while (36) {\n    const total = fact < [true, "s9", true] + "s2" + x(true, 28, true);\n    let y = "s5";\n  }\n}\n// a b c\n82;\nfunction f(a, b) { return a * b; }\nf(1, 2);\nif (x) { f(1, 2); } else { g(); }\n// TODO\nwhile (fact.x(y(), (y) => f)) {\n  {a: f("s4", true) ? (y) => "s4" : f ? null : x, b: y};\n  if (acc((x) => null, 75, y(total))) {\n    const lst = null + null === 78 + g.lst();\n    const y = x(n.total(true, y(true, "s7", 65)));\n  } else {\n    let x = null;\n    const total = 73;\n    x(n(n(null)), {a: x(null, 70, "s5"), b: h}, (y) => acc());\n  }\n}\nfact(x.acc(n("s9", true, 31), x("s3", 74, lst)));\n// note\nwhile (fact({a: "s3", b: true}, 65)) {\n  let x = acc.n(f(g)) + [fact];\n  var f = 10 ? null - 53 : fact(acc(h, "s4"));\n}\nf = [total(59)];\nlet x = h;\n// a b c\na.b(c);\n[1, 2, 3];\nlet y = 5;\nwhile (g.x(f("s5", "s2"), n("s3"))) {\n  true;\n  (f) => lst();\n}\nacc = null;\nvar h = {a: lst, b: total()} < "s7";\n\nconst g = [{a: h(fact, "s2", true), b: lst(3, "s5", "s8")}];\nconst fact = total;\nfor (const x of 64) {\n  lst((x) => 67);\n}\n\ng = fact(fact(true), null + null);\n\nmodule.exports = require("../codemirror-blocks/.babelrc.js");\n\n(g) => null + null ? acc(true, null, null) : (fact) => null;\nif (y) {\n  true;\n  total = fact(fact(null, true), x);\n} else {\n  let n = fact();\n  const n = f(x);\n}\n// TODO\nif (h.total() ? h(true, 28, null) : {a: null, b: 26}) {\n  null;\n}\nif ((f) => total("s7", 2, "s4")) {\n  while ([true * y, null === 16, 3 ? y : null]) {\n    const lst = g(35, fact, fact("s5") + true);\n    true;\n    x = n(null ? f : null, [null], h);\n  }\n}\ntrue;\nif (g.n(y.n(n, 57))) {\n  while (h) {\n    let fact = "s2";\n  }\n  for (const y of true) {\n    n(y(lst("s0"), true), n.g(), [true ? true : null, "s2" ? h : true]);\n  }\n} else {\n  true;\n}\n// TODO\n50 + fact < "s0" - h.fact();\nf("s3");\nf(true + "s9" + null, h([acc], null));\n\n',
      steps: [
        {
          op: "setComment",
          a: 0.5381187163293362,
          text: "TODO: fix",
        },
      ],
      motion: "reduced",
    })
  ).toBeNull();
}, 120_000);
it("seed 25338: a block removed from a list whose recovered blocks are out of order (a text that does not parse) does not make a change that ends before it starts", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 25338,
      language: "python",
      code: "def _format_pipe(fd):\n    if fd == subprocess.PIPE:\n        return '<pipe>'\n    elif fd == subprocess.STDOUT:\n        return '<stdout>'\n    else:\n        return repr(fd)\n\n\n",
      steps: [
        {
          op: "multiSelect",
          a: 0.2867485862225294,
          n: 2,
          then: "cutPaste",
          b: 0.8163717177230865,
        },
        {
          op: "pasteText",
          a: 0.07092454773373902,
          text: "1",
          before: false,
        },
        {
          op: "insertTemplate",
          t: 0.7347870701923966,
          a: 0.19509052205830812,
        },
        {
          op: "insertText",
          a: 0.17380753438919783,
          b: 0.48145601782016456,
          text: "[1, 2]",
        },
        {
          op: "textEdit",
          a: 0.45606922870501876,
          len: 2,
          w: "f(",
        },
        {
          op: "insertText",
          a: 0.8378749657422304,
          b: 0.7708620433695614,
          text: '"s"',
        },
        {
          op: "undoRun",
          n: 5,
          redo: false,
        },
        {
          op: "replaceText",
          a: 0.09540216205641627,
          text: '"s"',
        },
        {
          op: "undo",
        },
        {
          op: "textEdit",
          a: 0.2447069357149303,
          len: 3,
          w: "lambda",
        },
        {
          op: "collapseBurst",
          a: 0.21199007472023368,
          n: 5,
          on: true,
        },
        {
          op: "multiSelect",
          a: 0.5664089899510145,
          n: 3,
          then: "cutPaste",
          b: 0.44846663996577263,
        },
        {
          op: "removeNode",
          a: 0.6697500410955399,
          b: 0.569190019974485,
        },
      ],
      motion: "full",
    })
  ).toBeNull();
}, 120_000);
it("seed 48326: the replaceDoc step sets the selection (CodeMirror maps a selection inside the replaced text to a range that ends before it starts, and its own Delete throws: not the editor's)", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 48326,
      language: "python",
      code: 'def __dict_replace(s, d):\n    """Replace substrings of a string using a dictionary."""\n    for key, value in d.items():\n        s = s.replace(key, value)\n    return s\n\n',
      steps: [
        {
          op: "collapseAllThen",
          on: false,
          a: 0.11496339668519795,
          text: "y2",
          accept: false,
        },
        {
          op: "brokenText",
          a: 0.22915910300798714,
          w: "  stray",
          nl: false,
          back: true,
        },
        {
          op: "key",
          key: "Shift+ArrowRight",
          a: 0.7951876241713762,
        },
        {
          op: "replaceDoc",
          text: '# a comment\ntotal = 0\nfor x in [1, 2, 3]:\n    total = total + x\nprint(total, "done")\n',
        },
        {
          op: "key",
          key: "Delete",
          a: 0.40757811814546585,
        },
      ],
      motion: "reduced",
    })
  ).toBeNull();
}, 120_000);
it("seed 21837: a text mended after a parse error is read again from nothing (an incremental parse from the error's recovery left a Python body going on past its dedent)", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 21837,
      language: "python",
      code: 'from _collections_abc import *\nfrom _collections_abc import __all__\n\n# a comment\ntotal = 0\nfor x in [1, 2, 3]:\n    total = total + x\nprint(total, "done")\n\ndef __dict_replace(s, d):\n    """Replace substrings of a string using a dictionary."""\n    for key, value in d.items():\n        s = s.replace(key, value)\n    return s\n\n# TODO\ntotal = 88 == {acc: True}\n"s3"\nif None:\n    f()\n    [lst(["s5", "s1", None]), acc]\nelse:\n    [[]] + (lambda x: [29, 44])\n    acc = 20\n\ndef fact(fact, g):\n    None\n    f = y(x(), [lambda n: None])\nlambda h: fact.g(75, True * 75)\nfact = y.acc(42)\nf = y(f.total(), acc("s7", fact()), h.lst())\n10 - None * h(lambda fact: x, h)\n\nwhile fact:\n    g = x()\n    h = lambda h: f.total()\n    {g.n(lambda fact: None): lst(None)}\nNone - None\n# note\nacc(lst, lambda fact: n("s1", None), h(87, acc, total) < fact)\nwhile n():\n    n.total()\n    "s6"\n# a b c\nx == [] * n("s9", True)\nn(None, 16)\n# TODO\nNone\nencoding_table = codecs.charmap_build(decoding_table)\n\n(lambda acc: lambda h: 1) < []\n{x * 0 < {77: True}: n + {None: 45}}\n\nwhile "s6":\n    acc = lambda g: f()\n    h = lambda n: g(True, total(x, "s7"))\n    lst = n([], total(fact(True, acc)))\n26 < 49\n\n54\n\n# TODO\n[h(lst(y, 36), "s5"), n - (lambda f: "s8")]\n# note\nfor g in [fact, 3]:\n    h = (lambda acc: 38) * y(12, n(81, True, None), lambda f: None)\nif "s5" + None * fact.x():\n    for acc in f(45, g):\n        acc = [h.y(29), f()]\n    for lst in x - None:\n        fact = lst + None\nMAXFDS_TO_SEND = 256\nUNSIGNED_STRUCT = struct.Struct(\'Q\')     # large enough for pid_t\n\n#\n# Forkserver class\n#\n\nh = h\n\ndef f(a, b):\n    y = a\n    return y\nf(1, 2)\n\nlambda g: f(lambda total: "s6")\n\n# a b c\nfact(26 == [y, True])\n# a b c\nwhile h(n(n, None), "s1", 78):\n    y = y()\n    if (lambda f: x()):\n        [] - True\n    "s8"\n# a b c\nh = h.total(None, total(x, ["s0", "s7", None]))\nacc([], x(64))\n\ndef y(n, g):\n    g("s1", []) == total(lst(31), "s3", [61])\n    if total():\n        h = acc < f(None, h == True, lambda h: True)\n        [x(None + "s5")]\n    else:\n        n = lambda acc: lambda x: f(68, True)\n        lambda n: {fact.n(True, 56): n.lst()}\n        return lst(True == "s8", total("s5", None, 76))\n    if fact:\n        return h(None, "s4", None)\n        {"s7": {n(): True - None}}\n        return g.f(acc.x(), True + None)\ndef f(a, b):\n    y = a\n    return y\nf(1, 2)\n{{None: 20}: n(fact - None, {g: g})}\n[]\nif {x.lst(): "s8"}:\n    total = acc.fact(lst(acc.fact(None, None)), [])\nwhile y(lst):\n    if lst(h(None), 54, 83):\n        lst = y(total)\n    else:\n        y = {g(lst("s6"), {True: None}): h(f)}\n        acc = total()\n    lambda x: h(None, 61) == [None]\ndef remoteref(obj):\n    oid = id(obj)\n    objecttable[oid] = obj\n    return RemoteProxy(oid)\n\n\nif [None, 78] - g(True, 27):\n    g = [18]\n    fact\nelse:\n    def x(lst, lst):\n        return acc()\n        g(None, 14, {{fact: 34}: lst(None)})\ndef x(f, acc):\n    lst = True\n\nfrom turtle import Shape, Turtle, mainloop, Vec2D as Vec\n\nG = 8\n\nwhile [None * x, lst("s3", None)]:\n    True\n    for f in True:\n        1\n    while (lambda total: 60):\n        g\nh.x("s7", {93 * 36: n()})\nf(True)\n# TODO\nfor total in 60:\n    y(total(True, acc()), lambda lst: None, "s9")\n    def lst(x, fact):\n        return "s2"\n        lambda x: lambda y: 13 == True\n    {lst(None, True, n): 9 + "s5"} == "s2"\n# TODO\nif acc:\n    while x():\n        fact = fact(acc(True, acc, True)) < g()\n        x(56, (lambda x: True) * 77)\n\n[y("s3" == "s0")]\nif x:\n    f(1)\nelif y:\n    g()\nelse:\n    h()\n[1, 2]\n# a b c\nn = f(h(), fact([], x()))\nwhile {f(True): []}:\n    g\n    x\n    def total(f, f):\n        acc = h\n"s5"\nacc = ["s2", {30: 44} + None]\n# TODO\nx = x(x)\n{True: fact({None: True})}\nif h.g(None):\n    def x(f, h):\n        return {y(True): 27 - True}\n        x = None\n        return lambda fact: 81\n# a b c\nn = g(g(g(96, True)), {x(True, True): y()}, x(x, n(56, "s1"), lst))\n\nfor acc in (lambda fact: None):\n    fact(x(g(), "s8"), n("s8" - "s4", None), n("s8"))\n    f = {None: fact}\n    total = "s7"\ntotal = {fact(None < 68, True, 1): [True]}\n# note\nx = None\ny\n# note\nf()\n\n# note\nwhile g.lst("s2" < None, g.f(None, None)):\n    y(True, [91, True, True] * x.n("s7"))\n    if n():\n        lst = f(g({True: True}, fact(45, None, lst), "s6"))\n        n = {None == "s8": lambda f: None} + lst.x(y(True))\n        x = h.n(fact, n(None)) + "s3"\n    if g.f(None):\n        n = lst(43 - None * lst.total(), fact(h(True), {72: None}), n(lambda n: True, y(n, True, None), True))\n        [acc, f.fact(), lambda lst: {True: None}]\n        None\n"s7"\n\ng = x\nfact = f.x(g(None + 79), True)\n# note\nwhile total():\n    acc = 30\nif "s0":\n    f.lst(lambda f: total == None, y())\nNone\ng = 17\ndef y(f, fact):\n    f = y(lambda total: fact(), True)\n    if 16:\n        fact(None < "s6", [y(True, None, True)])\n        return {True: True} * (lambda total: "s5")\n        return acc.fact(lambda n: None)\n    lst = g(fact.y({"s9": None}, ["s6"]), acc.x([], []))\n# note\ng({None: "s7"} + n(True, True))\nfor y in {None: x}:\n    60 * (lambda fact: g)\n    for total in h(None):\n        lst = x.n(64, lst(True, None, f))\n    for h in x():\n        total = None\n        None\n        y = 91\nwhile lst():\n    for h in None * 84:\n        h = (lambda fact: [total, acc]) - True\n        x(g("s3") * True * None, lst(), fact(True) * (lambda y: 79))\n        x = acc(51, None < total + acc(True, n), y(h))\n\nimport hashlib\n\nwebbrowser.open("https://xkcd.com/353/")\n\nwhile [76]:\n    [True - True]\n    def y(x, fact):\n        return n\n        return 70\n# TODO\nfact = True\nacc(n(lst("s1"), fact()), n)\n\nwhile y([50, True], True):\n    f = 44 == (lambda h: True) + y\n    acc(total(lst, 83), True, [True, True, True]) * (lambda acc: n == True)\nlst({["s6", "s3"]: n()}, acc)\nlambda acc: lambda total: lambda n: 7\nlst = fact(n(fact(13, fact)), [], g(True < "s9", acc.fact(True, lst)))\n\n_invalid_codepoints = {\n    # 0x0001 to 0x0008\n    0x1, 0x2, 0x3, 0x4, 0x5, 0x6, 0x7, 0x8,\n    # 0x000E to 0x001F\n    0xe, 0xf, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19,\n    0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f,\n    # 0x007F to 0x009F\n    0x7f, 0x80, 0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a,\n    0x8b, 0x8c, 0x8d, 0x8e, 0x8f, 0x90, 0x91, 0x92, 0x93, 0x94, 0x95, 0x96,\n    0x97, 0x98, 0x99, 0x9a, 0x9b, 0x9c, 0x9d, 0x9e, 0x9f,\n    # 0xFDD0 to 0xFDEF\n    0xfdd0, 0xfdd1, 0xfdd2, 0xfdd3, 0xfdd4, 0xfdd5, 0xfdd6, 0xfdd7, 0xfdd8,\n    0xfdd9, 0xfdda, 0xfddb, 0xfddc, 0xfddd, 0xfdde, 0xfddf, 0xfde0, 0xfde1,\n    0xfde2, 0xfde3, 0xfde4, 0xfde5, 0xfde6, 0xfde7, 0xfde8, 0xfde9, 0xfdea,\n    0xfdeb, 0xfdec, 0xfded, 0xfdee, 0xfdef,\n    # others\n    0xb, 0xfffe, 0xffff, 0x1fffe, 0x1ffff, 0x2fffe, 0x2ffff, 0x3fffe, 0x3ffff,\n    0x4fffe, 0x4ffff, 0x5fffe, 0x5ffff, 0x6fffe, 0x6ffff, 0x7fffe, 0x7ffff,\n    0x8fffe, 0x8ffff, 0x9fffe, 0x9ffff, 0xafffe, 0xaffff, 0xbfffe, 0xbffff,\n    0xcfffe, 0xcffff, 0xdfffe, 0xdffff, 0xefffe, 0xeffff, 0xffffe, 0xfffff,\n    0x10fffe, 0x10ffff\n}\n\n\nif (lambda f: 42 + lst):\n    lambda y: total(lambda g: None, y.x(True), y(True, x))\n    if (lambda fact: None):\n        h = lst(y, total(30, "s8") == x(), True)\ng = "s2" * (lambda n: g.x(True, None))\n\nlst = lambda total: [acc("s2", "s7", 84)]\nif [["s6", None, "s7"]]:\n    h = fact.acc([y]) == f(y("s5", fact), h(), h)\nelse:\n    lambda n: total\n    fact = []\n    h(n.g(x("s3", None), ["s7"]), x(True, 68) - ["s8", None], None == {True: acc})\n\ny = "s8" + True < None - True\nfor y in "s7":\n    lst = "s9"\ntotal = g(fact(None, 85) + 70 * "s4")\n"""Find modules used by a script, using introspection."""\n\nimport dis\nimport importlib._bootstrap_external\nif x:\n    f(1)\nelif y:\n    g()\nelse:\n    h()\n[1, 2]\n\n65\n\ny\nn = 99\n\nf(h(x, fact, 96), f.g(95)) < None\nfor g in g(g):\n    for n in acc.h():\n        n = "s4"\n    lambda n: x.acc()\n    g\ny = g(fact - y == acc(), 8, x.g(True < True))\nif None:\n    if f:\n        g({(lambda fact: None): y()}, acc)\n    else:\n        total = lst({True: h}) * y\n        h = None + {acc: "s3"} + (lambda lst: 36 == True)\nelse:\n    h.n(lst() * x("s6", 81, True), f.total(lst(16), y(acc, True, lst)))\n    fact = y(lambda n: f(), "s9")\n    while f(lambda fact: True, "s6"):\n        total = y({None: None} * "s7", lambda lst: f, lambda h: None)\n        f = None\n        f = []\ng = acc()\nlst = ["s3", n()]\n# TODO\nNone == True * [True, 71]\n# note\nif [lambda g: "s9"]:\n    n = y()\nelse:\n    x = g()\nfor h in None:\n    if fact(total(), lambda x: True):\n        x = g() * f("s1", total + 79)\n        x(71)\n    for acc in n(acc):\n        x = fact(39, 63)\n        fact = g() == [total(fact, 9, 59)]\n        h = n(lambda total: [None, total, None], x({77: "s1"}, None, 52), lst(n(True, "s9", True), "s9", acc(77, "s4")))\n    g = f.h()\n\nlst = n("s4", lambda n: n("s3"))\n\n# TODO\nwhile (lambda y: f) < total:\n    total(n(lambda total: "s9", x(lst, "s3")), 5 * "s7")\n64 < y\n\nwhile y:\n    if g.total():\n        f = g(f.h(), [lst(), {"s9": acc}, [85, "s3", "s2"]])\n    [None < "s3", n(None)] * (lambda fact: "s5" - 59)\n    acc = h < "s8"\n# note\nclass A:\n    def m(self):\n        return 1\nA().m()\nif {(lambda n: "s7"): []}:\n    if "s9":\n        lambda fact: "s7"\n        total = [acc, x(y(), acc < total), lst("s5")]\n    else:\n        lambda fact: 21\n        (lambda lst: [True, None, "s1"]) < True\n        "s9" + {x: lambda y: "s3"}\n    x = []\n    n = y.y(16, lst.x())\nif None:\n    acc = None\n    if fact(x < None, {None: 43}, None):\n        lst()\n        y\n        x()\n\nif None:\n    fact = True\n    if x(lambda lst: True, h.acc(None, None), h):\n        lambda g: True\n        f = y\n    else:\n        g = fact("s9", y([], total))\n        None\n        fact("s9", [f(49), None, h], total(total()))\n    lambda g: [lst(79), None * 66]\n\ny.n((lambda total: 22) - f(51, n))\n# TODO\nif True:\n    while []:\n        fact = None\n# TODO\nif [51]:\n    acc = h({fact(None): None == "s1"})\nelse:\n    f.h(True, f(lambda x: None, total, {"s8": 13}))\n# TODO\n{True: y(None)} - fact("s0" * lst)\ndef fact(g, fact):\n    return {f(True, 90, True): [g]}\nif x:\n    f(1)\nelif y:\n    g()\nelse:\n    h()\n[1, 2]\n# a comment\ntotal = 0\nfor x in [1, 2, 3]:\n    total = total + x\nprint(total, "done")\nclass IncrementalDecoder(codecs.IncrementalDecoder):\n    def decode(self, input, final=False):\n        return codecs.charmap_decode(input,self.errors,decoding_table)[0]\n\ndef _format_pipe(fd):\n    if fd == subprocess.PIPE:\n        return \'<pipe>\'\n    elif fd == subprocess.STDOUT:\n        return \'<stdout>\'\n    else:\n        return repr(fd)\n\n\n# note\nwhile (lambda y: h(63, None)):\n    while lst():\n        n = (lambda fact: {"s5": "s8"}) + lst(lst(None), lst)\n    h = g(total.x(81 == True), [])\n# a b c\nwhile (lambda lst: None):\n    def lst(g, acc):\n        acc.total((lambda y: None) < [True, total, "s0"], 3)\n        return {total(True, fact, True): fact(2, "s0")}\n        return lambda total: "s6"\n    for h in "s6":\n        h = lst.n("s2", lst)\n        n = None\n        fact = fact([True, None] * total.h(y), total(x()))\ndef f(a, b):\n    y = a\n    return y\nf(1, 2)\nacc.g()\nNone\n# a b c\ndef g(f, acc):\n    while 61:\n        n = "s6"\n        return 57\n        return fact(n("s2"))\n[None, h.h(fact(None), "s8"), total(lambda g: "s2")]\ntotal = True\ng = total([], (lambda f: 89) - y())\ndef lst(total, fact):\n    def x(fact, f):\n        n = True\n        g = fact(True - acc, acc(True, 32)) + f(True)\n        {63: None}\n    def g(h, y):\n        return "s7"\n\ndef fixb2context(root):\n    \'\'\'Removed bad AquaTk Button-2 (right) and Paste bindings.\n\n    They prevent context menu access and seem to be gone in AquaTk8.6.\n    See issue #24801.\n    \'\'\'\n    root.unbind_class(\'Text\', \'<B2>\')\n    root.unbind_class(\'Text\', \'<B2-Motion>\')\n    root.unbind_class(\'Text\', \'<<PasteSelection>>\')\n\nNone == f(n(None), "s6" == None, fact("s9"))\nif {91: g(None, "s9")}:\n    while (lambda f: 22):\n        total = 98\n        n = [acc(24, [True, True, "s3"]), acc(x(None))]\n    def y(x, f):\n        fact = None + h(59)\n        fact = acc.h(82, True) * 2 < True\n        total = [lambda x: x(None, "s1"), n.h("s6" * True), lst(lst, True) < acc("s8", "s5", True)]\ndef http2time(text):\n    """Returns time in seconds since epoch of time represented by a string.\n\n    Return value is an integer.\n\n    None is returned if the format of str is unrecognized, the time is outside\n    the representable range, or the timezone string is not recognized.  If the\n    string contains no timezone, UTC is assumed.\n\n    The timezone in the string may be numerical (like "-0800" or "+0100") or a\n    string timezone (like "UTC", "GMT", "BST" or "EST").  Currently, only the\n    timezone strings equivalent to UTC (zero offset) are known to the function.\n\n    The function loosely parses the following formats:\n\n    Wed, 09 Feb 1994 22:23:32 GMT       -- HTTP format\n    Tuesday, 08-Feb-94 14:15:29 GMT     -- old rfc850 HTTP format\n    Tuesday, 08-Feb-1994 14:15:29 GMT   -- broken rfc850 HTTP format\n    09 Feb 1994 22:23:32 GMT            -- HTTP format (no weekday)\n    08-Feb-94 14:15:29 GMT              -- rfc850 format (no weekday)\n    08-Feb-1994 14:15:29 GMT            -- broken rfc850 format (no weekday)\n\n    The parser ignores leading and trailing whitespace.  The time may be\n    absent.\n\n    If the year is given with only 2 digits, the function will select the\n    century that makes the year closest to the current date.\n\n    """\n    # fast exit for strictly conforming string\n    m = STRICT_DATE_RE.search(text)\n    if m:\n        g = m.groups()\n        mon = MONTHS_LOWER.index(g[1].lower()) + 1\n        tt = (int(g[2]), mon, int(g[0]),\n              int(g[3]), int(g[4]), float(g[5]))\n        return _timegm(tt)\n\n    # No, we need some messy parsing...\n\nacc.n(None)\n\nacc = n.f(True) < acc.x()\n# TODO\nTrue\n# note\nf([])\n# note\ntotal = acc(n.acc())\nNone < [66, None, acc] - acc(lambda x: True)\n',
      steps: [
        {
          op: "pasteText",
          a: 0.7787982316222042,
          text: "{1: 2}",
          before: true,
        },
        {
          op: "undo",
        },
      ],
      motion: "reduced",
    })
  ).toBeNull();
}, 120_000);
it("seed 193771: the check lets the editor's own parse differ from a fresh one in where Lezer puts a comment (a statement that ends without a semicolon)", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 193771,
      language: "javascript",
      code: 'y = fact.x();\nconst total = x;\ntotal = (acc) => true;\nvar h = n(null, "s5");\nlst({a: {a: true, b: "s0"}, b: g(null)}, null, h());\nfact;\nwhile (f()) {\n  ({a: f(), b: total(f.x())});\n  var total = "s9";\n  while (null ? lst(true, true, null) : "s0" === "s2") {\n    var y = 89;\n    null;\n    const x = null;\n  }\n}\n\n// a b c\ny.total() ? fact(fact.g(acc), total, fact("s4", lst)) : g(h.h(84), f(null, acc), 4 ? "s2" : lst);\nmodule.exports = [devServerConfig, bundleConfig];\n\ny = x();\n// TODO\nfunction f(a, b) { return a * b; }\nf(1, 2);\nif (x) { f(1, 2); } else { g(); }\n// note\nmodule.exports = [devServerConfig, bundleConfig];\n\nlet g = "s4";\nfor (const h of null) {\n  h(73, h) ? y() : "s3" - g < h(fact, null) - h("s6", "s4", true);\n}\nvar h = null;\n\nvar h = x();\nif ("s6" ? n("s0", 61) : lst(11)) {\n  for (const f of h) {\n    let acc = "s0";\n    let f = 43;\n  }\n} else {\n  function n(n, acc) {\n    n((y) => 23);\n    62;\n  }\n}\nwhile ((g) => f) {\n  var y = h([] * fact(null, null));\n}\n\nfor (const fact of (total) => true) {\n  x = "s8";\n  var fact = acc ? true : [];\n  for (const f of f.lst()) {\n    const lst = f(acc.g(), 55);\n  }\n}\n// note\nif (total) {\n  while (y()) {\n    x ? lst : h() < fact(74, true);\n    "s7";\n  }\n  const lst = h((x) => h ? acc.n() : "s6", x(f(n), lst.fact("s5")), 18 === (y) => "s2");\n}\n[15, null];\n({a: x("s2" * h, 22, lst ? lst : "s9"), b: (x) => g(null, true)});\nfor (const lst of h(fact, true, total)) {\n  if (h(lst(true, null, 87))) {\n    let n = 77;\n    const fact = true;\n  }\n}\nlet x = "s1";\nif (y + total.y(null)) {\n  lst({a: null, b: lst(null)}, lst(x(true, 3, null)), f());\n} else {\n  true;\n  if (x(n.total(true, "s9"))) {\n    const g = (x) => [];\n    const fact = total;\n    (total) => y(41) < h();\n  }\n}\nacc = "s8";\nlet y = "s3";\n({a: g, b: {a: "s6", b: acc("s6")}});\n// note\nfunction h(g, g) {\n  fact(fact(x("s9", x, n)), h, {a: x.lst(acc), b: 0 ? null : null});\n}\ntrue;\nmodule.exports = function gen(lines) {\n  const out = [];\n  for (let i = 0; out.length < lines; i++) out.push(...form(i));\n  return out.join("\\n");\n};\n\ng();\n// a b c\nwhile (h(true, h)) {\n  function n(h, lst) {\n    return n(acc < null, lst("s0", true, lst), (n) => null);\n    const y = n.f(true - acc(null, 40, 45), true);\n  }\n  75 ? n() : f(n());\n}\n"s8";\nlet x = null;\n// TODO\n(g) => "s2";\n// note\nh(fact("s1" ? true : fact, y(53, lst), y()));\n\nvar fact = (g) => 11;\nacc = (g) => x.y();\nfact = 35;\nf(f() ? n(null, "s0", "s7") : [25, true, 24], "s9", total(null === "s0", (h) => true));\nf = true;\n\nwhile (n()) {\n  const n = [];\n}\nnull;\n// note\nif (null) {\n  let h = [acc({a: true, b: "s7"}, true)];\n} else {\n  true < null === null === fact;\n  f();\n  for (const lst of true ? true : 79) {\n    var acc = x(n());\n    const h = "s5";\n  }\n}\nvar fact = y([(h) => 20]);\ny((g) => 25) < h(true, []);\nlet y = acc(x("s6", x.n()), x("s5", n(null), total(acc, "s2")));\nacc("s0");\n\n// TODO\ntotal.h() ? total.f() : null * f ? [f] : "s6";\n[[], acc() * total(), "s0"];\n// TODO\nnull;\nif (f.f()) {\n  [];\n}\nvar y = null;\n({a: acc.n(), b: [acc(fact, "s6", null), 50]});\nfor (const lst of ["s7", 5]) {\n  for (const g of null === true) {\n    let n = f(n - [], total(), y() + true);\n  }\n}\nlet g = g;\n// note\nfunction n(lst, f) {\n  let h = lst(56);\n  const total = acc;\n  for (const n of n()) {\n    (g) => g;\n    return x() - {a: f, b: true};\n    total();\n  }\n}\nwhile (true) {\n  while (g(y(true, true, 92), f(), (fact) => 61)) {\n    true ? (lst) => true ? 75 : 12 : g;\n    "s1" ? h : true;\n    let g = 72;\n  }\n}\n\nfor (const y of true ? lst : fact) {\n  let fact = (y) => true ? y("s8", true, true) : total() ? null : true;\n  g("s5", true - "s3", {a: y(11), b: n.h("s3")});\n  while (["s3", "s2"] ? g(50, null) : "s7") {\n    f(h(acc(), acc(true, 22)), true, n(8 ? n : 75, n(true, null)));\n  }\n}\n// a b c\ntotal;\n\nclass A {\n  m() {\n    return 1;\n  }\n}\nnew A().m();\n// TODO\nfunction f(a, b) { return a * b; }\nf(1, 2);\nif (x) { f(1, 2); } else { g(); }\n// note\n8;\n// note\nnull;\n// a b c\nacc(true ? x - null : ["s1"]);\n\nwhile ((y) => h.x("s5", 67)) {\n  var lst = n.f(n(true * "s8", acc(lst)));\n}\n\nlst();\nf();\n\n// TODO\nx();\nconst total = g("s5", lst(x(56, true), y(53), [true, true]), h);\nwhile ({a: (x) => true, b: y(30, acc, null)}) {\n  "s3";\n}\n(acc) => fact(true);\nconst acc = [n("s6", x, 5) ? g() : {a: true, b: acc}, [null, x(null, 97, true), "s4"]];\n// note\nmodule.exports = require("../codemirror-blocks/.babelrc.js");\n\nif (f(x.g("s2"))) {\n  function n(lst, y) {\n    const n = null + lst() === n(true, null, 34);\n  }\n  const acc = n(acc("s5", lst), null, fact.total(null));\n  true;\n} else {\n  let total = lst() - (fact) => "s3";\n  var g = y();\n}\n// note\ng;\nif (y()) {\n  null;\n}\n67;\nacc = n;\n// TODO\nvar total = lst.f(g("s7", true) * 21 ? null : "s6");\nconst total = [[f], [], h] * (n) => g + acc;\nlet g = f.total();\nlet acc = n(y("s1" + true, "s2" * 55, acc("s2")));\nfunction g(n, y) {\n  if ({a: true, b: h} * h(null)) {\n    [21, h(total(2, h)), x < 82 === fact.f(34, "s9")];\n  } else {\n    return {a: null, b: true} ? null : f();\n  }\n}\nfor (const x of fact < 53) {\n  const n = null;\n}\nlet x = n.acc(f.lst(), null);\nacc(g(h), "s1", total) - true;\nconst REDUXFN =\n  /useSelector|useSyncExternalStore|selector|dispatch|subscribe|getSnapshot/i;\n\n/** Self time (ms) per bucket, plus inclusive time of some named functions. */\nif ([] * fact(null)) {\n  fact(y(), g(2 ? x : "s7", {a: true, b: "s7"}), x.acc());\n  true;\n  for (const acc of y.lst(84, n)) {\n    n = x({a: 91, b: true}, ["s5", "s7", 19]);\n  }\n}\nvar lst = "s4";\n\n58;\ntotal ? g.x("s4") : n(fact());\ntrue ? total(true, null, true) : total() - [];\n// note\ng([h.acc(true, 60)], fact.fact(42 ? lst : 14));\n({a: "s1", b: n});\n\nif ({a: h(true), b: fact}) {\n  const acc = f(total.g(), [g.x(10), h(acc, "s1", null)]);\n}\nacc(y(acc(true), true < true));\n// note\nfor (const f of fact(lst, true)) {\n  let total = fact.n(total, true + true * "s2");\n  let acc = g(fact + y(f));\n}\na.b(c);\n[1, 2, 3];\nlet y = 5;\nfunction parseJsdomFailure(title, message) {\n  const text = stripAnsi(message);\n  if (!text.includes("A randomized sequence of operations broke the editor")) {\n    return null;\n  }\n  const seed = /seed (\\d+)/.exec(title)?.[1];\n  const at = /failed at: (.*)/.exec(text)?.[1] ?? "?";\n  const problem = (\n    /problem:\\s+([^\\n]*(?:\\n {13}[^\\n]*)*)/.exec(text)?.[1] ?? "?"\n  )\n    .split(/\\n\\s+/)\n    .join(" | ")\n    .trim();\n  const shrunk = /Shrunk to (\\d+) of (\\d+) steps/.exec(text);\n  const replay = /CMB_RANDOM_REPLAY=\'(.*)\' npx jest/.exec(text)?.[1];\n  const ops = [...text.matchAll(/^\\s+\\d+\\. (.*)$/gm)].map((m) => m[1]);\n  return {\n    kind: "jsdom",\n    seed: seed === undefined ? undefined : Number(seed),\n    steps: Number(/\\((\\d+) steps\\)/.exec(title)?.[1]) || undefined,\n    failedAt: at,\n    problem,\n    shrunkTo: shrunk ? Number(shrunk[1]) : undefined,\n    trace: ops.slice(0, 40),\n    replay,\n  };\n}\n\n/** Failures of the same kind get the same signature, whatever the ids and numbers */\n// a b c\nfor (const fact of [true, "s2", 11]) {\n  const n = "s1" < 21 === (acc) => (total) => true;\n  let n = g(g(total(), 82));\n}\n\ng();\nfunction f(acc, f) {\n  let fact = 6;\n  [acc ? null : null ? acc.x() : {a: true, b: null}, {a: true, b: n()}];\n}\n\nlet y = {a: fact(null, "s6" * x, g("s2", 24)), b: "s7"};\n// TODO\nvar n = y();\ng(lst(total()));\nfor (const x of true ? true : 58) {\n  function g(x, acc) {\n    return true;\n    return (y) => "s0" ? fact : null;\n  }\n}\nlet x = 1 + 2;\nf(x, 3);\nwhile (x < 9) { x = x + 1; g(x); }\n"s2" < 58;\nconst lst = acc(y(null), ["s3" ? true : lst, acc(y, lst), true], [] + [f]);\nlet total = true;\nfunction h(total, n) {\n  (g) => y(null < 37, h("s2", f));\n}\n// note\nconst h = fact(y, h.f(40, 36));\n// TODO\nnull;\n// a b c\nfunction acc(h, h) {\n  g = [null, f(y, 69)];\n  const x = null;\n}\n// TODO\n// TODO\nvar h = true;\n({a: lst, b: []} + []);\n\n// TODO\nf;\n[];\nif (null) {\n  function y(h, lst) {\n    return [h(50, true), g(90), g(7, total)];\n  }\n  x(total());\n  var lst = lst(acc()) * null;\n} else {\n  var fact = lst;\n}\nn(f(fact(), true), g(fact(), "s3" * 0));\nlst;\n\n',
      steps: [
        {
          op: "pasteMulti",
          a: 0.8284541994798928,
          text: 'g(2)\n"s"\n1\n1',
          accept: false,
        },
        {
          op: "toggleMode",
          a: 0.6949956382159144,
        },
        {
          op: "toggleMode",
          a: 0.7699474038090557,
        },
        {
          op: "textEdit",
          a: 0.7873193523846567,
          len: 1,
          w: "",
        },
      ],
      motion: "reduced",
    })
  ).toBeNull();
}, 120_000);
it("seed 150348: the check lets the editor's own parse differ from a fresh one after an unterminated comment (no error node, a comment that holds the blocks after it)", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 150348,
      language: "javascript",
      code: '// a comment\nfor (const x of [1, 2, 3]) {\n  total = total + x;\n}\nconsole.log(total, "done");\n// TODO\nx = {a: total("s7", h), b: [2, true, true]};\nlet lst = f(lst(true), x * (x) => 79, lst([], y("s4", true, 1)));\nlet y = y();\nconst g = 37;\n72;\n\nif (true) {\n  (total) => [[]];\n  if (lst.h() ? x * fact : [null]) {\n    let y = x({a: null * null, b: g()}, "s4");\n  }\n}\n\nvar g = total(true, "s2", 76) - [null, "s3"] ? total(null) ? f ? "s4" : true : lst(62, "s0") : null;\ntrue;\n({a: (total) => "s9", b: ["s5", total, null]} - 22 - 87 ? true : 69);\nconst y = 34 < null ? "s0" - null : y("s6") ? [fact] - 92 + 85 : [[null]];\n// TODO\ntrue;\nwhile (null ? "s7" : y ? y < true : true === null) {\n  let total = {a: g(g(true, null, 21), (fact) => g), b: true};\n}\nvar lst = fact;\nconst fact = fact(51);\n\nh(total(), fact((x) => null), (acc) => null);\ny(h(null, total, true ? y : 42), null, n(true, total.lst(32)));\n\nnull;\nlet fact = {a: total(null, 48, 3) ? "s0" * "s0" : h < total, b: {a: (lst) => "s5", b: []}};\n\nx = lst.y(true, 68);\n// a b c\nconst g = lst();\n// note\nh.y(f, n(null, "s4", total)) < null;\n\n// a b c\nwhile (x(94 ? true : null)) {\n  x = null;\n}\nfunction g(total, h) {\n  [];\n}\nconst f = "s4";\n\n// note\nfor (const acc of "s2") {\n  for (const fact of {a: true, b: 63}) {\n    let fact = "s4";\n    var lst = [[true, true], null, n.total()] * x("s6" + true, {a: true, b: true}, null === null);\n  }\n}\n// a b c\nlet x = lst;\nvar acc = 66;\nfor (const y of fact(null, 63)) {\n  y = 28;\n}\nfunction lst(h, f) {\n  function fact(f, fact) {\n    y = (g) => "s1" * true;\n    var g = "s7";\n    x();\n  }\n  for (const total of "s7") {\n    [y ? h() : 59, [] ? x(x, true, f) : true];\n    var lst = total(fact(17 ? n : g));\n    return (y) => h(48, null);\n  }\n  h();\n}\nfunction acc(lst, f) {\n  acc = total(null === g, null);\n  g();\n}\n// note\nh(total.acc(true, "s6") - acc(true, 28));\nvar f = g(total, g(true, null)) ? x() : true ? (h) => 99 : true ? null : true;\n// a comment\nfor (const x of [1, 2, 3]) {\n  total = total + x;\n}\nconsole.log(total, "done");\na.b(c);\n[1, 2, 3];\nlet y = 5;\nwhile (null ? true : "s1" ? fact() : g("s0")) {\n  while (lst("s7", total(null, true, "s1"), [])) {\n    var acc = {a: acc(lst(), acc(43, null), 24), b: null};\n  }\n  lst;\n  const y = lst(y);\n}\n// a b c\nif (y) {\n  "s7";\n} else {\n  [lst(null ? true : 53), acc < true];\n  while (x("s8") * 50 - 55) {\n    let lst = n([(fact) => null]);\n    let g = "s3";\n    let y = y(total(n(8, true), g), null ? "s8" : null ? y : h < null);\n  }\n}\n// TODO\nif (acc("s1" === "s2", null, {a: n, b: null})) {\n  let acc = x;\n  var g = "s4" - f(x) ? [{a: "s0", b: lst}] : [true, true] < true;\n} else {\n  true === 39 ? f : fact ? "s2" - null + (lst) => true : null;\n  total.h() ? y(n(true)) : acc(g(true, null, h));\n}\nif (98 ? "s7" ? "s6" : null : null) {\n  for (const x of null) {\n    let f = x;\n  }\n  total((total) => true);\n}\n"s6" < fact(true, n(85));\nif ((total) => true + acc) {\n  while (g(48, h, fact)) {\n    let lst = total;\n  }\n  lst = f(f) ? lst ? "s6" : null : "s2" + g;\n}\n// a b c\nx.x();\n// TODO\ny.x(true);\nfunction n(y, y) {\n  null;\n  f() ? true - true ? 7 - 2 : {a: "s1", b: "s8"} : f;\n}\nconst h = g;\n(y) => null;\nfor (const n of total.f(null, total)) {\n  const lst = total();\n  98;\n  while (acc("s9" ? 63 : null)) {\n    [f(n("s2", true), null ? acc : "s5"), 27];\n    true;\n    var g = 0 ? h.total(null, x) : h(true, true, g) + fact.h();\n  }\n}\n"s0";\ntrue;\nvar x = acc(true, total((x) => true), lst());\n// TODO\nh = y(true ? 86 : lst, null, h(36, "s7"));\ntrue;\n// TODO\nfunction x(g, f) {\n  return fact(f(28, acc, fact));\n}\n// a b c\nfact((f) => "s4", null) ? f("s6", true, h.g()) : y(true, fact - 83);\n\n// TODO\nfor (const n of "s2") {\n  [[true ? null : null, 55, (y) => acc]];\n}\nfor (const total of y(null, true)) {\n  ({a: fact("s6", g(y, 72)), b: 63 ? true : fact ? {a: "s2", b: 35} : fact("s4", true)});\n  let f = "s2";\n}\nnull + g();\ntrue;\nif (acc((acc) => lst, {a: true, b: 45}, lst(true, 38))) {\n  h = true;\n  function n(lst, g) {\n    return total();\n  }\n} else {\n  for (const n of "s9") {\n    let g = fact(y ? 36 ? "s6" : true : x(true));\n    let n = true ? fact ? 34 - true : fact : [];\n    ({a: (g) => x(null, 97, 45), b: g});\n  }\n}\nwhile (true + "s6" ? (acc) => "s7" : null) {\n  total = true;\n  let h = fact(61, 89 ? g(y) : 98 ? null : true);\n  function n(n, total) {\n    68;\n    return "s9";\n  }\n}\nacc();\nacc.y();\n// note\nvar y = true ? n.fact() : (y) => [h, "s9"];\nimport "codemirror/lib/codemirror.css";\nimport "../lib/css/codemirror-blocks.css";\nimport "@bootstrapworld/wescheme/css/wescheme.css";\nimport "@bootstrapworld/routine/css/routine.css";\n// TODO\n75;\n[true, total(true, "s2", f) ? fact() : acc(null, "s7", "s2")];\nconst fact = n("s9" < null, lst.f());\n\n// TODO\n({a: acc(55), b: null});\n// a b c\nvar x = "s5";\nif (fact(true, total("s2", "s1", 13), n)) {\n  true < true;\n}\n// note\n[true];\n(fact) => total - 41 ? true : acc(n.g(), h.lst("s0", null), (f) => true);\nconst fact = n(lst(37, "s1", "s1")) - true + true * f(99, null);\n"s9";\nfunction parseJsdomFailure(title, message) {\n  const text = stripAnsi(message);\n  if (!text.includes("A randomized sequence of operations broke the editor")) {\n    return null;\n  }\n  const seed = /seed (\\d+)/.exec(title)?.[1];\n  const at = /failed at: (.*)/.exec(text)?.[1] ?? "?";\n  const problem = (\n    /problem:\\s+([^\\n]*(?:\\n {13}[^\\n]*)*)/.exec(text)?.[1] ?? "?"\n  )\n    .split(/\\n\\s+/)\n    .join(" | ")\n    .trim();\n  const shrunk = /Shrunk to (\\d+) of (\\d+) steps/.exec(text);\n  const replay = /CMB_RANDOM_REPLAY=\'(.*)\' npx jest/.exec(text)?.[1];\n  const ops = [...text.matchAll(/^\\s+\\d+\\. (.*)$/gm)].map((m) => m[1]);\n  return {\n    kind: "jsdom",\n    seed: seed === undefined ? undefined : Number(seed),\n    steps: Number(/\\((\\d+) steps\\)/.exec(title)?.[1]) || undefined,\n    failedAt: at,\n    problem,\n    shrunkTo: shrunk ? Number(shrunk[1]) : undefined,\n    trace: ops.slice(0, 40),\n    replay,\n  };\n}\n\n/** Failures of the same kind get the same signature, whatever the ids and numbers */\nconst dir = path.join(__dirname, "..", "assets", "sounds");\nconst url = (name) =>\n  "data:audio/mpeg;base64," +\n  fs.readFileSync(path.join(dir, name)).toString("base64");\n\nvar total = fact({a: acc(), b: "s2" + true});\nfor (const y of 69 ? "s7" : 27) {\n  let x = [null];\n  total(f(x));\n  77;\n}\nfact(true, total ? null : "s5", fact ? {a: true, b: null} : total(null, null, null));\nvar acc = "s1" ? (acc) => null * 93 : x(y - true, x(n, 90, 78), "s2");\nfunction n(f, acc) {\n  if (acc(g ? null : null, y.n(), n(total))) {\n    return n();\n    (g) => 3;\n    return "s7";\n  }\n  let fact = (n) => null;\n  [{a: n(null), b: null < true}, [9 + g, true]];\n}\n[x, true, null];\n// TODO\nvar fact = {a: (total) => (total) => 95, b: h()};\nnull ? (acc) => n : y.total() - acc("s6", null);\n[n(), (x) => f("s6", "s1"), fact.g()];\n// note\nx = "s6" < null * 60 ? true : null;\nconst x = fact("s3" * {a: "s8", b: true}, {a: [true, g, 22], b: total(true, g)}, 30);\n// TODO\nif (79) {\n  const f = g ? {a: 3, b: h(28)} : lst();\n}\n// note\nfunction h(g, x) {\n  function n(x, x) {\n    84;\n  }\n  if (acc(null, x(x, 22, f))) {\n    fact([] === h, {a: 83 < 54, b: []});\n    var n = total(lst, "s0", h(true, x) - f());\n  }\n}\n// a b c\nwhile (h(f(true), ["s5", null, 11], x("s1", "s1"))) {\n  [lst ? [true, lst] : {a: h, b: "s4"}];\n}\n\n// TODO\nfunction total(h, h) {\n  fact = fact(true, true, "s2") ? [82] : "s0" < true;\n  if (g()) {\n    return {a: 51, b: "s5"} === total();\n    acc.acc() ? n() : x(72) ? true : true === null;\n    x(true, null, true) ? x : y(true, g) === g;\n  } else {\n    return acc(fact.g(true));\n    return 77;\n  }\n  if ({a: [true, 64, null], b: 58}) {\n    lst(total);\n    n;\n    return "s7";\n  }\n}\n// a b c\nfunction h(fact, lst) {\n  function h(x, fact) {\n    return g();\n    const h = total(g(fact(g, lst), null), (n) => [31], h());\n    return f(y, lst, 42) * null;\n  }\n  var lst = x(null, x(g(), acc(), f), 36);\n  (x) => true;\n}\nconst f = 80;\n// note\nlet g = {a: (lst) => total("s2", true, true), b: acc(null ? true : true, null, [])};\nfor (const total of fact.lst(null)) {\n  function g(f, g) {\n    var f = fact() < h();\n  }\n}\nlet total = [n(true, total), "s9", (f) => 44] ? 22 : null;\n\nvar acc = (y) => "s6" ? g : 77 ? "s4" < 60 : 39 + acc;\n\nvar f = "s5";\nif ([] ? g(true, null, null) : [true, null]) {\n  var y = null + total(f) ? total() : acc(41 ? g : n, f(null, true));\n} else {\n  while (75) {\n    x.y(33);\n    acc(21, g() ? [null, "s5", x] : true - true);\n  }\n  true;\n}\nif (y) {\n  const acc = "s3";\n  if ((x) => y(n, null)) {\n    let fact = x(n.n(), h.n(acc(true), []), {a: [], b: {a: 63, b: 31}});\n    const g = 68 === 61;\n    var y = (x) => 61;\n  }\n} else {\n  let fact = acc(f("s8") - null);\n}\nlet fact = [null];\ny();\nlet y = 59;\n\n\n// a comment\nfor (const x of [1, 2, 3]) {\n  total = total + x;\n}\nconsole.log(total, "done");\nlet g = f({a: f(), b: total("s4")}, acc);\n\n// TODO\n(lst) => n;\nn = x.total();\n\nif (acc("s5", ["s2"])) {\n  if (acc) {\n    [40];\n  }\n  while (f([], 70 === n)) {\n    acc(f(y(), true ? null : "s3"));\n    const acc = 77;\n    let h = 58;\n  }\n} else {\n  if (n) {\n    var n = ["s4"];\n    (total) => n("s0", null);\n  } else {\n    const lst = "s9";\n    y = [15 - "s1", lst()];\n    let lst = (lst) => true;\n  }\n}\n"s8";\nfact(f.x(), 38, true);\ny();\nconst opsOf = (rs) =>\n  rs[0]?.ops.map((o) => o.op).filter((o) => !o.startsWith("0.")) ?? [];\nconst pick = (rs, size, op, f) =>\n  rs\n    .filter((r) => r.size === size)\n    .map((r) => f(r.ops.find((o) => o.op === op)));\n\nvar y = n(lst(total - 13, "s9", null), n(true));\nfunction n(y, x) {\n  if (x("s3", 88 < lst, n.acc(81, 53))) {\n    return 21;\n    fact(true);\n    ({a: null, b: f});\n  } else {\n    lst.acc((h) => ({a: 27, b: 28}));\n  }\n  while (fact(true, "s3", 73) < "s1") {\n    return lst();\n    let h = g(10);\n    var h = [g([lst, "s3"], 72, true), "s1" ? true : g - null, null];\n  }\n}\nvar n = g(null);\nfunction g(f, x) {\n  function h(x, total) {\n    var x = "s8" + 86;\n    g(acc(true), 94, true);\n  }\n}\nlet fact = null;\n// TODO\nwhile (null === true ? fact(null) : {a: "s6", b: 6}) {\n  while (lst.lst("s2", (h) => null)) {\n    [{a: null ? true : null, b: [true, 9, true]}];\n    const acc = h;\n    var total = x(1, "s6", n(null, lst("s1", 47, true), "s3" + 93));\n  }\n  for (const y of "s4") {\n    const g = 94;\n    const y = (y) => null + x ? {a: true, b: g} : "s9";\n    let n = lst(x * g(), true < [], (lst) => "s0" === f(43, "s9", "s2"));\n  }\n}\nfunction h(h, total) {\n  g(46);\n}\n\nfunction y(f, h) {\n  fact = y(y.g(), null, null);\n}\n// note\nfunction parseJsdomFailure(title, message) {\n  const text = stripAnsi(message);\n  if (!text.includes("A randomized sequence of operations broke the editor")) {\n    return null;\n  }\n  const seed = /seed (\\d+)/.exec(title)?.[1];\n  const at = /failed at: (.*)/.exec(text)?.[1] ?? "?";\n  const problem = (\n    /problem:\\s+([^\\n]*(?:\\n {13}[^\\n]*)*)/.exec(text)?.[1] ?? "?"\n  )\n    .split(/\\n\\s+/)\n    .join(" | ")\n    .trim();\n  const shrunk = /Shrunk to (\\d+) of (\\d+) steps/.exec(text);\n  const replay = /CMB_RANDOM_REPLAY=\'(.*)\' npx jest/.exec(text)?.[1];\n  const ops = [...text.matchAll(/^\\s+\\d+\\. (.*)$/gm)].map((m) => m[1]);\n  return {\n    kind: "jsdom",\n    seed: seed === undefined ? undefined : Number(seed),\n    steps: Number(/\\((\\d+) steps\\)/.exec(title)?.[1]) || undefined,\n    failedAt: at,\n    problem,\n    shrunkTo: shrunk ? Number(shrunk[1]) : undefined,\n    trace: ops.slice(0, 40),\n    replay,\n  };\n}\n\n/** Failures of the same kind get the same signature, whatever the ids and numbers */\n// a b c\nlet total = null;\n66;\n\nwhile (g((g) => "s4", true)) {\n  function acc(n, acc) {\n    true;\n  }\n  let n = "s6";\n}\ntotal() + f;\n// note\nwhile (null) {\n  const acc = fact("s2", acc(n(null, fact), g(null, 58, 27), "s7" === true));\n}\nmodule.exports = getLanguageBundleConfig({\n  name: "routine",\n  global: "CMBRoutine",\n  entry: "./src/index.ts",\n});\n\n\nfact;\n// a b c\nfor (const n of g()) {\n  if (null) {\n    f = 43;\n    var acc = h(true ? 98 : 50) + true;\n    x.fact();\n  } else {\n    acc(n(null, true), 9 * 20) ? n("s1", null, true) ? y.acc(total, null) : total.acc(null, fact) : (x) => lst();\n  }\n  const lst = null === lst({a: "s0", b: x}, lst < "s4", true * "s0");\n  for (const x of acc) {\n    const lst = 75 - true;\n    let f = h({a: 72, b: null}, f("s3", "s9", f)) * [59, fact(true, 45, "s9"), g(true)];\n  }\n}\ny = lst();\n(total) => x("s0", g(null));\nfunction total(g, fact) {\n  let f = n.f(lst(y, fact), f) ? h(fact(44, "s6")) : null;\n  (y) => null;\n  fact = n(true) ? true : n("s8");\n}\nif (fact(acc(76, "s2", f))) {\n  lst("s5") ? lst(null, "s8") - fact === null : [{a: null, b: f}];\n} else {\n  let n = x([["s6", 86, f]], y(total ? "s0" : 17, f ? "s6" : 12), lst(true, null));\n}\ny = (h) => "s8" * true;\nwhile (n(64 ? true : null, n + null, h)) {\n  while ((n) => null) {\n    let total = (h) => ({a: [], b: true ? null : true});\n  }\n  g = [h.lst()];\n}\nlet f = "s3";\n// note\n[true, null, g];\n// note\nif (g(x())) {\n  function acc(lst, f) {\n    const acc = h(69) + h((n) => true, y, {a: true, b: null});\n    return (n) => ({a: n, b: 88});\n  }\n  if ("s5") {\n    [];\n  }\n} else {\n  g.h() < 1;\n  function y(y, g) {\n    g({a: g(49, true, "s4"), b: [null, f, lst]});\n    37;\n    null;\n  }\n}\nwhile ((lst) => x ? true : true) {\n  fact = h(true ? "s1" : true);\n  true;\n}\n(lst) => total();\nif (x() - "s2") {\n  const fact = [38];\n  ({a: (y) => n, b: g({a: h, b: x}, lst.g(), n())});\n  acc();\n}\nf(null);\ntrue;\nfor (const h of true) {\n  34;\n}\nif (n) {\n  while (f) {\n    true;\n    var acc = acc("s6" ? true : null) - "s9";\n  }\n  let n = {a: f.x(), b: y};\n}\nvar acc = {a: total.y(55), b: null * "s6"} === (acc) => 68 < null;\nfunction g(n, n) {\n  function g(acc, lst) {\n    [[(h) => h], 95];\n  }\n  [] ? y(true, null, null) ? n(lst, 20, h) : [true] : null;\n  y = true;\n}\n\nacc() === total("s8" + true);\ng = x.lst();\n\nacc;\n// TODO\nif (y) {\n  const h = "s7";\n  [x(), null, h.total()];\n}\n\n[h, null, lst((h) => "s0", true === "s4")];\nfunction h(f, g) {\n  let f = 39;\n  return g - acc(true, true);\n  function f(fact, fact) {\n    return h;\n    x(null, {a: 4 * 18, b: (y) => fact}, "s2");\n  }\n}\nvar total = null;\nfor (const lst of fact.acc(70, lst)) {\n  if (n("s5")) {\n    const n = 94;\n    let g = {a: y(fact(acc, true, null), (h) => acc), b: f()};\n    var y = {a: n("s0", null) === (fact) => "s0", b: null};\n  }\n  function acc(f, h) {\n    return lst.g(true);\n  }\n}\nvar f = ["s0" ? f(y, "s3") : true];\n\nimport * as compat from "preact/compat";\n\noptions.requestAnimationFrame = (callback) => queueMicrotask(callback);\n\n// TODO\n46;\nlst();\ny((total) => n, f) - 69 + (x) => null;\n\nconst {\n  getLanguageBundleConfig,\n} = require("@bootstrapworld/cmb-toolkit/lib/webpack");\n\n// dist/lambda-min.js: this language, for a page that loads it with a <script>\n// tag after the editor\'s (the global `CMBLambda` is the language, which is\n// also added to the editor, to be asked for by its id: "lambda")\nclass A {\n  m() {\n    return 1;\n  }\n}\nnew A().m();\ndescribe("results of a worker", () => {\n  const lines =\n    JSON.stringify({ seed: 1, ok: true }) +\n    "\\n" +\n    JSON.stringify({ seed: 2, invariant: "focus", steps: [{ op: "key" }] }) +\n    "\\n" +\n    \'{"seed": 3, "ok"\'; // (cut: the worker was killed in the middle of a line)\n  test("passed, failed, and what was done", () => {\n    const r = lib.readResults(lines);\n    expect(r.passed).toBe(1);\n    expect(r.failures.map((f) => f.seed)).toEqual([2]);\n    expect([...r.done]).toEqual([1, 2]);\n  });\n  test("the first seed that was not done is the one that was running", () => {\n    expect(lib.missingSeeds([1, 2, 3, 4], lib.readResults(lines).done)).toEqual(\n      [3, 4]\n    );\n    expect(lib.readResults("").done.size).toBe(0);\n  });\n});\n\nfunction x(n, f) {\n  fact.y();\n  return "s2";\n  if (true ? 26 : null - [58, lst]) {\n    var g = null;\n    fact;\n    var acc = lst(total(), true, {a: y, b: fact.total()});\n  } else {\n    "s6";\n    return "s0" - true ? f.h(lst) : n("s2", "s3");\n  }\n}\nfunction fact(y, y) {\n  "s4";\n}\n[(h) => 35, true ? true : true ? "s6" : "s1"];\nn();\n(lst) => (fact) => true;\n39 ? total(fact(), null) : 81;\n72;\nnull ? (x) => true : g(null) + (fact) => true;\nif (acc < h - "s5" * "s9") {\n  let f = lst(true);\n  f = f(total === "s1", {a: true, b: null}, true);\n}\n// TODO\nconst x = (h) => null ? fact : 80 ? f(true) : h;\nx(fact(fact(true, null, acc), "s7"), 42, acc);\n// TODO\n"s7";\n// TODO\nwhile ([]) {\n  y = total((total) => 22);\n}\nvar y = lst.acc(true, g < {a: true, b: true});\nconst lst = "s9";\n\n// TODO\nconst total = 8;\nfunction x(y, x) {\n  if ((n) => null) {\n    g = 24 ? [36] : true;\n    return true;\n  }\n  ({a: (fact) => n(75, 97), b: n(x(), lst(true, true, null))});\n  if (acc.g(null + "s9", n(n, h, "s4"))) {\n    h = lst(h("s3", 96, lst), fact(), fact("s7"));\n    acc() ? "s6" : {a: null, b: true} ? true : lst();\n  } else {\n    return true;\n    var f = y();\n  }\n}\nif (acc(x(47), g("s5", "s3"))) {\n  var x = {a: 41 ? {a: total, b: null} : g.total(), b: "s8"};\n  [{a: 94 === null, b: h("s1", null)}];\n}\n// note\n({a: n(null, true), b: y} - f(["s7"]));\n// note\nf(h(lst(), x));\n\n// note\nx(f(47) ? true ? h : n : y(), y());\n// TODO\nvar acc = "s6";\nlet f = n(y - n, lst(true), null + true) === 47;\n({a: [], b: [true]});\nfunction acc(total, lst) {\n  let lst = true;\n  lst = null;\n}\n\nvar f = 12;\nfor (const h of g(true, acc)) {\n  let total = x([null]) - acc(null ? "s6" : "s2", h("s9"));\n  while (true) {\n    let h = true;\n    let f = true;\n  }\n}\nvar y = g;\n// a b c\nlet h = g;\nfunction acc(total, n) {\n  while (null ? null : x(null, "s7", true)) {\n    return fact("s7") * null + 88;\n    return true;\n  }\n  for (const lst of "s7" < "s2") {\n    true;\n    let h = n;\n    y([h(g, true, true)], (lst) => ({a: "s3", b: acc}), (acc) => true);\n  }\n  h(x(true, "s6" * lst, true), n * null * x.n(null, 15), g);\n}\n\n// a b c\n"s9";\n\n({a: {a: true - 41, b: null === null}, b: 23});\nwhile (h(null, 60, true + "s2")) {\n  null;\n}\nfunction total(g, fact) {\n  function h(g, h) {\n    return [n ? y : 83];\n    return total({a: g, b: null}, n(n, null, true));\n  }\n}\nlet total = y;\nfunction total(total, lst) {\n  [h(null, true), (acc) => null];\n  ({a: null, b: null});\n}\nfor (const g of n(null, 43, y)) {\n  if (h(n(true, 60), "s1", [])) {\n    let x = "s6";\n    let x = true;\n  }\n}\ny(acc(), f(g ? true : acc, "s4"));\n({a: total, b: true});\nfor (const acc of lst()) {\n  if (y.fact("s0", n("s4", null))) {\n    var acc = [x(true, "s8"), "s0"] + "s2";\n    [];\n    const acc = [g() ? "s5" ? 26 : null : fact];\n  } else {\n    y(16);\n    lst("s3", null);\n  }\n}\n// note\nlet h = true;\nacc(null < (x) => total, lst);\nif (h()) {\n  f([acc ? lst : null, g(), lst], (f) => 16);\n  const f = (x) => acc(f * null);\n}\n// a comment\nfor (const x of [1, 2, 3]) {\n  total = total + x;\n}\nconsole.log(total, "done");\nfor (const acc of g(true)) {\n  function y(f, x) {\n    n.x();\n    null;\n    n(total(n, total, null) ? fact : f());\n  }\n  g(true, f ? [true, null, "s0"] : x(), lst());\n  fact = f();\n}\nwhile ([]) {\n  if (true ? "s3" : null - "s7" + lst) {\n    let h = x.total();\n    const y = null;\n  }\n  for (const fact of total + true) {\n    var total = h({a: g(g), b: 87 === true}, n({a: "s6", b: true}, null), y.x(true ? true : f, f()));\n    lst = f(null, f("s4"), null - 56);\n  }\n}\nlet fact = n ? {a: [], b: "s6" - "s1"} : y();\nlet f = 71;\n\n// note\nconst x = x();\n\n// TODO\nvar fact = h((fact) => (y) => 65, 40);\nfunction fact(n, h) {\n  function g(x, lst) {\n    return lst;\n  }\n  g = true ? g(acc, true, true) : 5;\n  while (lst("s5", n(), true + null)) {\n    return n(null, null) - true;\n  }\n}\nfor (const fact of h(47, true)) {\n  y = {a: lst(), b: null};\n  if (n) {\n    [g.g() * n(acc, 57)];\n  } else {\n    var h = null;\n  }\n}\na.b(c);\n[1, 2, 3];\nlet y = 5;\nwhile (lst(f(null, 17, true), acc("s2", lst, true))) {\n  function fact(h, lst) {\n    return [];\n  }\n  x(y);\n  23;\n}\n"s7";\nmodule.exports = getLanguageBundleConfig({\n  name: "example",\n  global: "CMBExample",\n  entry: "./src/index.ts",\n});\n\nvar n = n;\n\nconst y = null;\nif (true ? lst : acc("s2", "s1")) {\n  while (f(true, true + x)) {\n    true;\n    let y = total();\n    [total()];\n  }\n  const g = f;\n}\n\nwhile ("s0") {\n  function fact(y, n) {\n    let n = 45;\n    return {a: fact(58), b: total ? "s6" : true};\n  }\n  var g = total.x();\n  ({a: 67, b: y(96 === "s1", x === "s0")});\n}\nlet g = x;\ny = {a: [], b: "s1" ? g : "s8"};\nlst("s1", total) - total() ? lst() : "s9";\nconst f = g();\n// TODO\nn = "s9";\n// a comment\nfor (const x of [1, 2, 3]) {\n  total = total + x;\n}\nconsole.log(total, "done");\nvar h = "s8";\n\nconst total = (h) => n.lst();\n(total) => true ? fact(null < true, n()) : 79 ? null : acc(37);\nf((h) => fact(32, "s0"), []);\nfor (const x of acc) {\n  fact = h();\n}\n// TODO\nfor (const f of 49) {\n  total = x.y();\n  if ([true, g, "s5"] < (n) => null) {\n    lst.h(y, n.x("s8")) === lst(null, true, acc);\n    57 < true;\n    let y = "s0" + [[true, 84, null], true, null ? "s2" : "s3"];\n  }\n}\nfunction replayCommand(record, file) {\n  return `npm run soak -w @bootstrapworld/cm6-blocks -- --replay ${file ?? record.seed}`;\n}\n\n/** A readable summary: new failures first, most common first, then the known ones */\n',
      steps: [
        {
          op: "brokenText",
          a: 0.5587567030452192,
          w: "/* open",
          nl: false,
          back: true,
        },
        {
          op: "textEdit",
          a: 0.8414490597788244,
          len: 2,
          w: "",
        },
      ],
      motion: "reduced",
    })
  ).toBeNull();
}, 120_000);
it("seed 118026: a block built alone inside a root that is not drawn (the hole of a template opened for editing) is built with the root, so its numbers follow the edits that come after (undo)", () => {
  expect(
    runJsdom({
      engine: "jsdom",
      seed: 118026,
      language: "scheme",
      code: '(local [(define a 1) (define b 2)] (+ a b))\n(define (sq n) (* n n))\n(sq 4)\n\n(define (n fact) (f (if #t (cond [#f #f] [else g]) #f) "s3"))\n(define (g n) (h "s2" (y) (if #f \'(#f #t #t) (if 28 "s8" \'a))))\n#f\n(h (< #t \'((if \'a "s7" #f))) (g (x (let ([h 51]) "s6") \'a (g "s0" 46)) "s1" (lst)))\n(define (g h) (g (cond [(= n x) (g #t \'a)] [else #f]) f (n)))\n(define n \'a)\n(h (lst (n (let ([lst 95]) "s5") (n)) (total (lst 85 \'a) (lst #f #f)) (cond [(y 0 36) (lambda (h) #t)] [else total])))\n; TODO\n(define acc (g \'((acc "s9" 55) (fact))))\n; note\n(h (if 36 (let ([g (cond ["s1" f] [else #t])]) (y #f #f)) (- \'a (acc))) (let ([n "s5"]) (cond [(y) 60] [else (* 6 \'a)])) (- "s5" (n (+ \'a "s1") (let ([g 0]) total))))\n; note\n(if (g \'(#f (n "s7" #f)) (lambda (fact) (fact)) #f) (let ([y 13]) (< lst (- \'a 55))) (x "s8" (if (h) \'(49 #t \'a) (+ \'a fact))))\n(define (g total) (< x g))\n#f\n\'(\'a (n (let ([x (if "s4" "s4" #f)]) (if #t "s1" g))))\n(define (acc y) #t)\n(define n (total y #f (cond [\'(35 17) \'a] [else (< #f \'a)])))\n(define n (lambda (h) \'a))\n(if (acc (- (if lst #t \'a) (acc \'a)) (fact (g #t)) (lambda (lst) (f 71 \'a))) (let ([g #t]) (g)) (x \'a (x (= #t "s9") #f) #t))\n(define (h n) (x))\n(fact \'((acc (if g #t #f)) (* (lambda (y) "s6") (h #f))))\n(define x \'(44 (x #t) (- (= n \'a) (cond [29 #t] [else #t]))))\n(define h (fact (g (lst) (fact 99 #f)) (lambda (h) (< 46 x))))\n(define (x lst) (< (- (g "s9" 15 \'a) \'(18)) (+ (- "s4" #t) (if #t "s6" 89))))\n(define (total acc) #t)\nacc\n\n(define (y f) (cond [(< "s1" (g #t #t y)) (h)] [else (lambda (fact) (x))]))\n(define f fact)\n(define (h f) (= #t (< (n #t "s8") #f)))\n(f x)\n\n; apart\n\n(block (let a) (block (let b)))\n(if (> x 3) "big" "small")\n(define y (let ([lst (lst)]) #f))\n; note\n(define (lst acc) "s2")\n; TODO\n(x #f)\n; TODO\n(define g (x (if \'("s1") (fact "s4") (n 79 78)) "s0" #f))\n; TODO\n(define (y y) (total (let ([y (let ([g 71]) "s0")]) (- fact #t))))\n; a b c\n(define y (- (lambda (f) f) (n)))\n\n; TODO\n(f fact fact 68)\n(define lst (lst #t (total (cond [#t "s1"] [else #t]) (= #t \'a) n)))\n(define (y lst) (let ([y #f]) (lambda (lst) (lambda (h) \'a))))\n; TODO\n\'a\n; note\n(define (n h) (n (h) "s4" (lambda (h) (cond [10 #f] [else "s4"]))))\n(define (fact lst) (fact (acc) \'((total) (acc)) (total (if f 57 87) "s9" (x fact))))\n; note\n(h (h (y (lst x) (if g lst \'a)) (h (lambda (y) #f)) #f) #f (x (= x (acc #t))))\n(n (y #f (h 79 (y 13 #f) n) (cond [f (if #f \'a g)] [else 11])) (if (fact (n \'a) "s2") (y 48 (g #f "s0")) h) \'a)\n(define f (= (g 46 (y "s8") (lambda (total) n)) (if (let ([f #f]) "s3") (if #t \'a #t) (y #t "s8"))))\n(define g (= (fact (cond [#f 58] [else #t])) #f))\n(define acc (n (y)))\n; note\n4\n(define h #t)\n(define lst (if (- (g \'a) (h "s6" #f 92)) "s8" \'a))\n(define y (y (if \'(#f) (let ([x #t]) 55) "s8") 27 #t))\n\n; a b c\n(f x)\n#| the second one |#\n(g y)\n(define x 5)\n(f 1 2)\n(if (> x 1) 2 3)\n(define total (cond [(y) #f] [else (fact (g \'a) (= \'a 21) (h #f #f))]))\n(define f (let ([h (cond [(let ([acc \'a]) #t) (lambda (x) 38)] [else (h #f)])]) (lambda (n) (n 79 total))))\n(define n (* (* (if acc "s2" #t) (let ([h "s7"]) 60)) 90))\n(define lst (total #f))\n\n(let ([x (f)]) (x (n (fact "s8" 32)) (y (let ([acc 18]) \'a) (n)) (x (* "s6" "s6") (- g #t) (lambda (total) "s2"))))\n(define (h f) \'((* (if 93 #t #f) (n #t))))\n(define lst (if (if (n \'a #f #f) (lst x \'a) (y \'a #t)) (y fact (y \'a)) (let ([lst (n #f #f)]) (let ([n y]) "s4"))))\n; a b c\n(n (< (f (lambda (g) #t) #t \'(x \'a #t)) \'a) (h \'a g))\n; a b c\n28\n\'(\'((x 96 (* #f #t) (* "s3" #t)) (if (- #t #t) (fact #t "s8" "s1") #f) #f) "s2")\n(define (h g) (f (* \'a (n #f #t \'a)) (g (x #t #t) (lambda (n) \'a)) (if (acc #t 49) (if #f 4 f) (if \'a 23 46))))\n(define (acc acc) lst)\n(a b c)\n(d)\n(e (f g) (h i))\n\n(a b c)\n(d)\n(e (f g) (h i))\n(define (y g) \'a)\n(define acc (cond [77 "s9"] [else acc]))\n(define y (acc))\n; note\n(define x (acc))\n\n(define g total)\n(define x (f #t (if (g) (< #t #t) (f h)) 48))\n\n(define g (total \'a \'(73) (* #t (lst "s2"))))\n(define total #t)\n(block a (block b x c) d)\n(provide (struct-out p))\n(define (sq x) (* x x))\n(sq 3)\n(cond [(= x 2) 3] [else 4])\n42\n; TODO\n#t\n\n(define (x lst) (fact))\n13\n; a b c\n(define acc #f)\n; a b c\n(define acc (x \'a (y (if \'a 96 47) (x #f 14 #t))))\n; TODO\n(define fact #t)\n(define lst #t)\n(let ([x (if (total) (< (cond [\'a "s4"] [else "s6"]) (* \'a 2)) (if (x lst #t #f) (if \'a 12 #f) (cond [#f 33] [else #t])))]) \'((fact (cond [#t "s0"] [else 97]) (total)) \'a))\n(define (f n) (f (x (acc) (cond [#t 58] [else #t])) (if (fact) (lambda (y) #t) (lambda (acc) 67)) (g total)))\n(g \'((+ \'a (+ \'a 90)) (let ([x acc]) (h)) fact) \'((n \'a (x \'a "s1") "s5") (lambda (fact) (lst "s3"))) 3)\n; note\n(lambda (total) (let ([f (if \'a (total #f \'a 54) total)]) 99))\n(define fact (< (n (y #f) (lst 25 x) (+ "s1" 86)) (n (total) (cond ["s3" #f] [else 93]))))\n\n; note\n(let ([lst #t]) (cond [acc #t] [else fact]))\n(show (+ a 2))\n(define (h f) "s0")\n; note\n(define (h total) (total))\n\n(define f (if 29 (cond [(n total "s3" #f) (n)] [else \'a]) (= (y \'a 15 #t) #f)))\n; TODO\n(define total (total (< (f 14 17 fact) (lst #t)) (total (cond [\'a \'a] [else "s0"]) (if #f #t y))))\n\n(define (total total) (- (if (h #t) \'(#t) (let ([lst #f]) \'a)) (cond [y 13] [else (f #f #f lst)])))\n(define (fact n) \'((acc (if h \'a \'a) total) \'a))\n; TODO\n(f "say \\"hi\\" now" "a\\tb")\n(a b c)\n(d)\n(e (f g) (h i))\n(when ; note\n a b c)\n; a b c\n(define (y lst) (if (acc \'(acc #t #t)) (if (lambda (y) #f) (if \'a #t #t) (- \'a 7)) (n (g g "s9") "s9")))\n(define lst 39)\n(* #f (h (total (* #t 59)) (x (cond [\'a "s0"] [else #f]) (h h #t)) (fact)))\n(define g (let ([fact (x)]) (f (n #t))))\n; a b c\n(define f (x #t))\n(define (f x) (- (acc \'a) lst))\n#t\n(define f (h (y lst 6 (let ([y lst]) #t))))\n; note\n(define y (g))\nh\n(total \'(x #f (f (* #f #t))) n (fact \'a))\n(define lst (lst (x) (lambda (lst) (x "s4" "s8"))))\n(define (sq x) (* x x))\n(sq 3)\n(cond [(= x 2) 3] [else 4])\n42\n(f ... x)\n(cond [... 1] [else ...])\n(define x (- (= (y n) \'a) g))\n"s9"\n(define lst #t)\n(define x \'(#t h (h (acc))))\n(define (sq x) (* x x))\n(sq 3)\n(cond [(= x 2) 3] [else 4])\n42\n\n(fact #t #f (total (acc) (lambda (y) (lst #f h)) (if y (let ([lst x]) #t) (cond [fact \'a] [else #t]))))\n(define acc (y))\n(cond [(f) (y "s6")] [else \'a])\n(define (n y) 96)\n\n(define (fact g) (let ([acc "s6"]) #f))\n; note\n(< (g (f) (if (total \'a) (if 14 f 25) \'(g))) (f))\n(define (h h) #f)\n(cond [(cond [(y (f) (if #f #t \'a) (acc)) (* #f (n \'a g))] [else (h (f) (lambda (total) "s3") (h \'a #t))]) (h (n (total \'a x)) (n (lambda (f) total) (total "s9" x) 40) fact)] [else (let ([fact g]) (cond [(fact \'a #f) (cond [#t #f] [else "s0"])] [else (lst "s0")]))])\n\n; note\n(x \'a g)\n(define (fact n) "s8")\n(define y (lambda (g) n))\n(define y (lambda (y) (n \'(x) (lst) (+ "s5" x))))\n(define (y lst) \'a)\n(define (h n) (lambda (fact) (if total (cond [total 12] [else #t]) (lst))))\n(y total (let ([h y]) #t) #f)\n; a b c\n(acc (n x))\n(define lst (lst "s9" (g 73 (let ([x #f]) g)) "s1"))\n(define (n total) #f)\n\n(define (y y) "s3")\n(local [(define a 1) (define b 2)] (+ a b))\n\n(define (f g) (y))\n; note\n(define (total g) 88)\n(define h (lst))\n(define (total fact) (= (if (y "s9" 21 x) (- "s0" lst) (if \'a n 25)) (acc)))\n(define (lst y) \'(\'a))\n(define (total f) (f (lambda (g) (g #f #f \'a))))\n(define (h x) #f)\n\n\'a\n(doSomething (add 34 foo 5234) param2)\n(doOtherThing param3)\n\n\n(define fact (* (h "s2" \'a) (if (n \'a n "s5") \'a (g "s7" y \'a))))\n(define lst \'a)\n\n(define (lst g) #f)\n; note\n(< (if (cond [(h acc \'a #t) (if acc "s0" 56)] [else (- x "s8")]) (let ([h (lambda (f) "s8")]) (let ([h "s6"]) #t)) (x (fact h) (fact "s3") #f)) (h))\n\n(define (h y) (< (x) (acc (lambda (n) \'a) (= "s7" n))))\n; a b c\n(if (if (+ (acc) (cond [\'a #t] [else "s9"])) (acc \'(91 #f \'a) 99 (if \'a "s5" 1)) #t) (if \'a \'a (< x \'(fact #t))) (if (= (< 61 \'a) (x 54 11)) (if (f) #t (g "s8")) (if \'(\'a lst) "s6" (cond [#f #f] [else #t]))))\n"s2"\n(cond\n  [(positive? -5) (error "doesn\'t get here")]\n  [(zero? -5) (error "doesn\'t get here, either")]\n  [(positive? 5) #t])\n(define x 5)\n(f 1 2)\n(if (> x 1) 2 3)\n(g y)\n; a b c\n(cond\n  [(positive? -5) (error "doesn\'t get here")]\n  [(zero? -5) (error "doesn\'t get here, either")]\n  [(positive? 5) #t])\n(define (acc n) (cond [27 (h "s0" (let ([total #t]) total) (lambda (n) #f))] [else (+ (lst #t 0) (lst \'a \'a #f))]))\n(define (x total) #t)\n; note\n(define (n n) (= (let ([total (= 99 #f)]) (if 30 g 83)) (y)))\n(g (f (if (if "s9" \'a h) "s0" (let ([acc #t]) f))) (total) (fact))\n(if \'a total (fact))\n; a b c\n(define fact (x \'((g) (let ([g #t]) \'a) (g))))\n(define x 94)\n(define total (< (acc (= "s3" #f)) \'(y (total 19))))\n(define fact \'a)\n(* x (let ([f (fact "s6" (if f n "s7") "s8")]) (if (cond [#t fact] [else "s1"]) total #f)))\n(define (n g) (lambda (y) (let ([g (lst "s7" #t 67)]) (f))))\n; a b c\n(define (f lst) (* \'((let ([x 3]) y) (fact 27) y) (if #f y \'(f total "s2"))))\n(define total y)\n; TODO\n#f\n(define x (lambda (y) "s9"))\n\n(define n (f (cond [f \'a] [else #f]) (total (cond [70 y] [else \'a]) (- #f #t)) (let ([fact (cond [\'a fact] [else #f])]) (if 12 50 #f))))\n(define fact 58)\n(fact (if (+ (h #t #f) "s2") #t total) (lambda (acc) y) (* (lambda (acc) (n 20 \'a #f)) (acc (lst 66 \'a) fact (acc 94 #f))))\n(y 84)\n(define x 5)\n(f 1 2)\n(if (> x 1) 2 3)\n(define y (n (y (let ([lst \'a]) \'a))))\n(define (f n) (let ([n (< (lst) (+ 32 f))]) "s1"))\n(lambda (x y) (+ x y))\n(define (sq x) (* x x))\n(sq 3)\n(cond [(= x 2) 3] [else 4])\n42\n',
      steps: [
        {
          op: "insertTemplate",
          t: 0.9227902286220342,
          a: 0.9945187589619309,
        },
        {
          op: "undo",
        },
      ],
      motion: "full",
    })
  ).toBeNull();
}, 120_000);
