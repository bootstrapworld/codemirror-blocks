/** @jest-environment jsdom */
// Thirteenth round: difference 11 (content hash), cut with nothing selected, finding 13, paste over a selection, the define shape
import { contentHash } from "../src/hash";
import { walk } from "../src/doc";
import { checkLezerEditor } from "../src/lezer-view";
import { LANGS, mulberry32, randomStep } from "./steps";
import { make } from "./helpers";

describe("11. the content hash", () => {
  const h = (ed: ReturnType<typeof make>, n: Parameters<typeof contentHash>[0]) => contentHash(n, ed.view.state.doc);

  test("equal content, equal hash, whatever the place and the id; different content, different hash", () => {
    const ed = make("scheme", "(f 1 2)\n(f 1 2)\n(f 1 3)\n  (f  1   2)");
    const [a, b, c, d] = ed.roots();
    expect(a.id).not.toBe(b.id);
    expect(a.from).not.toBe(b.from);
    expect(h(ed, a)).toBe(h(ed, b));
    expect(h(ed, a)).toBe(h(ed, d));
    expect(h(ed, a)).not.toBe(h(ed, c));
  });

  test("a change gives the node and its ancestors a new hash, and leaves the others', in place", () => {
    const ed = make("scheme", "(f (g 1) (h 2))\n(k 3)");
    const [r0, r1] = ed.roots();
    const call = r0.slots.flatMap((s) => s.nodes);
    const before = [h(ed, r0), h(ed, r1), ...call.map((n) => h(ed, n))];
    const one = call.find((n) => n.kind === "call")!.slots.flatMap((s) => s.nodes).find((n) => n.value === "1")!;
    ed.view.dispatch({ changes: { from: one.from, to: one.to, insert: "7" } });
    expect(checkLezerEditor(ed)).toEqual([]);
    const after = [h(ed, ed.roots()[0]), h(ed, ed.roots()[1])];
    expect(after[0]).not.toBe(before[0]); // the root changed
    expect(after[1]).toBe(before[1]); // another root did not
    // and a text change back gives the first hash again
    ed.view.dispatch({ changes: { from: one.from, to: one.from + 1, insert: "1" } });
    expect(h(ed, ed.roots()[0])).toBe(before[0]);
  });

  test.each(Object.keys(LANGS))("%s: after random edits every node's hash is a fresh parse's (the oracle checks it after each step)", (name) => {
    const L = LANGS[name];
    for (let seed = 1; seed <= 40; seed++) {
      const rnd = mulberry32(seed * 31 + name.length);
      const ed = make(name, L.start[seed % L.start.length]);
      const log: string[] = [];
      for (let i = 0; i < 20; i++) {
        for (const r of ed.roots()) walk(r, (n) => h(ed, n)); // fill the cache before the step, so a stale entry would show
        randomStep(ed, L, rnd, log);
        const problems = checkLezerEditor(ed);
        if (problems.length) throw new Error(`seed ${seed} step ${i}: ${problems.join("; ")}\n${log.join("\n")}`);
        const fresh = ed.language.parse(ed.view.state.doc.toString());
        const roots = ed.roots();
        expect(roots.length).toBe(fresh.length);
        const v = {};
        roots.forEach((r, k) => expect(h(ed, r)).toBe(contentHash(fresh[k], v)));
      }
    }
  });
});
