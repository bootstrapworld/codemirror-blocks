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
