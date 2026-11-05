import wescheme from "../src/languages/wescheme";
import lambda from "../src/languages/lambda";
import example from "../src/languages/example";
import { AST } from "../src/ast";
import type { ASTNode } from "../src/ast";
import patchAst from "../src/edits/patchAst";
import { areNodesEqualish, haveSameDrawing } from "../src/ui/ToplevelBlock";
import { randomInt, seededRandom } from "./helpers/random";
const gen: (
  lines: number
) => string = require("../../../doc/experiments/profile-large-doc/gen.js");

/**
 * areNodesEqualish(x, x) answers true without looking inside x. That is only a
 * shortcut (not a change in meaning) if the full comparison, given a node and
 * itself, always says true. Every term of it is `f(x) === f(x)` for some `f`
 * that reads x and changes nothing, so the only way to get false is an `f`
 * that does not equal itself, which for a number is NaN. These tests check
 * that over many programs and languages, and that it stays true after x has
 * been changed in place (the shortcut cannot hide a change the walk would see,
 * because the walk compares x with the same, already changed, x).
 */

const everyNode = (ast: AST): ASTNode[] => [...ast.descendants()];

const wesch = (n: number) => wescheme.buildAST(gen(n));

const randomWescheme = (seed: number, forms: number) => {
  const rand = seededRandom(seed);
  const atom = () =>
    ["x", "foo", "42", "-3.5", '"a (b"', "#t", "'q", "()", "[]"][
      randomInt(rand, 9)
    ];
  const form = (depth: number): string => {
    if (depth === 0 || rand() < 0.3) return atom();
    const kids = Array.from({ length: 1 + randomInt(rand, 4) }, () =>
      form(depth - 1)
    );
    const head = ["+", "define", "cond", "let", "lambda", "f"][
      randomInt(rand, 6)
    ];
    const sep = rand() < 0.3 ? "\n  " : " ";
    return `(${head}${sep}${kids.join(sep)})`;
  };
  return Array.from({ length: forms }, () => {
    const c = rand() < 0.3 ? `; note ${randomInt(rand, 99)}\n` : "";
    const b = rand() < 0.15 ? "#| block\n comment |#\n" : "";
    return c + b + form(4);
  }).join("\n\n");
};

describe("areNodesEqualish on the same node", () => {
  const corpora: [string, AST][] = [
    ["wescheme: generated, 60 lines", wesch(60)],
    ["wescheme: generated, 400 lines", wesch(400)],
    ...[1, 2, 3, 4, 5, 6, 7, 8].map((seed): [string, AST] => [
      `wescheme: random, seed ${seed}`,
      wescheme.buildAST(randomWescheme(seed, 25)),
    ]),
    [
      "wescheme: comments, strings, quotes",
      wescheme.buildAST(
        '#| top |#\n(define (f x) ; c\n  "a b" \'(1 2) `(a ,b))\n\n; last\n(f 1)\n'
      ),
    ],
    ["wescheme: empty", wescheme.buildAST("")],
    ["lambda", lambda.buildAST("let foo (a = 1, b) foo(a); let (a = 1) a + 2")],
    ["example", example.buildAST("(+ 1 (* 2 3))")],
  ];

  it.each(corpora)("is true for every node of %s", (_name, ast) => {
    for (const node of everyNode(ast)) {
      expect(haveSameDrawing(node, node)).toBe(true);
      expect(areNodesEqualish(node, node)).toBe(true);
    }
  });

  it.each(corpora)(
    "compares only values that equal themselves, in %s",
    (_name, ast) => {
      for (const n of everyNode(ast)) {
        // (NaN is the one number that is not equal to itself)
        expect(typeof n.id).toBe("string");
        for (const v of [n.hash, n.level, n.ariaSetSize, n.ariaPosInset]) {
          expect(Number.isNaN(v)).toBe(false);
        }
        const { from, to } = n.srcRange();
        for (const v of [from.line, from.ch, to.line, to.ch]) {
          expect(Number.isFinite(v)).toBe(true);
        }
      }
    }
  );

  it("walks the same nodes in the same order each time", () => {
    for (const [, ast] of corpora) {
      for (const root of ast.rootNodes) {
        const a = [...root.descendants()].map((n) => n.id);
        const b = [...root.descendants()].map((n) => n.id);
        expect(a).toEqual(b);
      }
    }
  });

  it("is true after the node has been changed in place, as the full comparison says too", () => {
    const ast = wesch(60);
    const root = ast.rootNodes[0];
    // what annotateNodes does when a node object is put into another tree (not the id: see below)
    root.level = 7;
    root.ariaPosInset = 99;
    root.ariaSetSize = 3;
    expect(haveSameDrawing(root, root)).toBe(true);
    expect(areNodesEqualish(root, root)).toBe(true);
  });

  it("still tells two different parses apart (the shortcut is only for one object)", () => {
    const before = wescheme.buildAST("(f 1)\n(g 2)").rootNodes;
    const same = wescheme.buildAST("(f 1)\n(g 2)").rootNodes;
    const edited = wescheme.buildAST("(f 1)\n(g 3)").rootNodes;
    // new parses get new ids, so even equal text is "different" until patchAst copies the ids
    expect(areNodesEqualish(before[0], same[0])).toBe(false);
    expect(areNodesEqualish(before[1], edited[1])).toBe(false);
  });
});

/**
 * After an edit, an unchanged block is compared as its old node object against
 * the current one, on every later render, so the answer about the ids inside
 * is kept. That is safe only if making the next AST leaves the nodes of the
 * previous one alone, and if the kept answer equals a fresh comparison.
 */
describe("the kept comparison of ids across edits", () => {
  const idsOf = (nodes: readonly ASTNode[]) =>
    nodes.map((r) =>
      [...r.descendants()].map(
        (n) => `${n.id}:${n.level}:${n.hash}:${[...n.children()].length}`
      )
    );
  const freshSameIds = (a: ASTNode, b: ASTNode) => {
    const x = [...a.descendants()].map((n) => n.id);
    const y = [...b.descendants()].map((n) => n.id);
    return x.length === y.length && x.every((id, i) => id === y[i]);
  };

  it.each([1, 2, 3, 4, 5, 6])(
    "stays right over a run of random edits, seed %i",
    (seed) => {
      const rand = seededRandom(seed * 101);
      let text = randomWescheme(seed, 12);
      let ast = wescheme.buildAST(text);
      let applied = 0;
      let keptEqual = 0;
      for (let step = 0; step < 25; step++) {
        const before = idsOf(ast.rootNodes);
        const oldRoots = [...ast.rootNodes];
        // an edit: replace a random stretch with a random form (or nothing)
        const at = randomInt(rand, text.length);
        const len = randomInt(rand, 12);
        const insert = rand() < 0.3 ? "" : randomWescheme(seed + step, 1);
        const edited = text.slice(0, at) + insert + text.slice(at + len);
        let nodes;
        try {
          nodes = wescheme.parse(edited);
        } catch {
          continue; // (the editor refuses an edit that does not parse)
        }
        // as commitChanges does: copy the ids across, then annotate
        const next = AST.from("wescheme", patchAst([...oldRoots], nodes));
        applied++;
        // 1. making the next AST left the previous AST's nodes alone
        expect(idsOf(oldRoots)).toEqual(before);
        // 2. every pair the editor would compare gives the same answer
        //    kept as it does when walked again, now and after the next edit
        for (const o of oldRoots) {
          for (const n of next.rootNodes) {
            const kept = areNodesEqualish(o, n);
            expect(areNodesEqualish(o, n)).toBe(kept);
            if (kept) {
              keptEqual++;
              expect(freshSameIds(o, n)).toBe(true);
            }
          }
        }
        text = edited;
        ast = next;
      }
      // (the run did something: edits went through, and some blocks were kept)
      expect(applied).toBeGreaterThan(3);
      expect(keptEqual).toBeGreaterThan(0);
    }
  );
});

describe("the id of a node", () => {
  it("can be set while the tree is made, even after an AST was made of it", () => {
    const nodes = wescheme.parse("(f 1)");
    nodes[0].id = "a"; // (as patchAst does)
    nodes[0].id = "b";
    AST.from("wescheme", nodes); // (the AST speculateChanges makes)
    nodes[0].id = "c"; // (patchAst, before commitChanges makes the AST that is used)
    expect(nodes[0].id).toBe("c");
  });

  it("cannot be changed once a kept answer depends on it", () => {
    const sameIds = (code: string, ids: string[]) => {
      const root = wescheme.parse(code)[0];
      [...root.descendants()].forEach((n, i) => (n.id = ids[i]));
      AST.from("wescheme", [root]);
      return root;
    };
    const ids = [
      ...wescheme.buildAST("(f (g 1))").rootNodes[0].descendants(),
    ].map((n) => n.id);
    const a = sameIds("(f (g 1))", ids);
    const b = sameIds("(f (g 1))", ids);
    expect(areNodesEqualish(a, b)).toBe(true);
    const inner = [...a.descendants()].pop()!;
    expect(() => {
      inner.id = "x";
    }).toThrow(/Cannot change the id of a node that has been relied on/);
    const same = inner.id;
    inner.id = same; // (saying the same thing is no change)
  });
});

describe("the kept answers about ids, when the tests check them", () => {
  it("fail loudly if the children of a node change after the answer was kept", () => {
    const ids = [
      ...wescheme.buildAST("(f 1 2)").rootNodes[0].descendants(),
    ].map((n) => n.id);
    const make = () => {
      const root = wescheme.parse("(f 1 2)")[0];
      [...root.descendants()].forEach((n, i) => (n.id = ids[i]));
      AST.from("wescheme", [root]);
      return root;
    };
    const before = make();
    const fresh = make();
    expect(areNodesEqualish(before, fresh)).toBe(true);
    // break the rule: a child of `fresh` is removed in place
    const fields = fresh.fields as { args: ASTNode[] };
    fields.args.pop();
    expect(() => areNodesEqualish(before, fresh)).toThrow(/ids inside a node/);
  });
});
