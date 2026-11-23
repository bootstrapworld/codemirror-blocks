/** @jest-environment jsdom */
/*
 * aria-setsize / aria-posinset count the blocks that are drawn, and no comment is counted (thirty-seventh round): a comment that goes with a
 * block is not drawn as a block (no treeitem: it is the popup of its block), one that goes with none is drawn but has no count. Text that is
 * not drawn (an error root) is not counted either.
 */
import { make } from "./helpers";
import { a11yProblems } from "./soak-dom";
import type { BNode } from "../src/types";

const TEXTS: Record<string, Record<string, string>> = {
  scheme: {
    above: "; first\n(f 1)\n(g 2)\n",
    trailing: "(f 1) ; trailing\n(g 2)\n",
    own: "(f 1)\n\n; alone\n\n(g 2)\n",
  },
  javascript: {
    above: "// first\nf(1);\ng(2);\n",
    trailing: "f(1); // trailing\ng(2);\n",
    own: "f(1);\n\n// alone\n\ng(2);\n",
  },
  python: {
    above: "# first\nf(1)\ng(2)\n",
    trailing: "f(1)  # trailing\ng(2)\n",
    own: "f(1)\n\n# alone\n\ng(2)\n",
  },
};

/** [program, from, to, insert]: edits found by the soak that leave an `error` root among the blocks */
const BROKEN: Record<string, [string, number, number, string]> = {
  scheme: ["(define x 5)\n(f 1 2)\n(if (> x 1) 2 3)", 3, 5, ")"],
  javascript: [
    "class A {\n  m() {\n    return 1;\n  }\n}\nnew A().m();\n",
    16,
    17,
    '"',
  ],
  python: ["# c\nfact = lambda n: None\n\n", 8, 8, " g(2)"],
};

/** a comment inside a list: [text, how many blocks that are not comments the call holds] (above `2`; blank lines on both sides; alone in the list) */
const IN_LIST: Record<string, Record<string, [string, number]>> = {
  scheme: {
    above: ["(f 1\n  ; note\n  2 3)\n", 3],
    apart: ["(f 1\n\n  ; apart\n\n  2 3)\n", 3],
    alone: ["(f\n  ; only\n  )\n", 0],
  },
  javascript: {
    above: ["f(1,\n  // note\n  2, 3);\n", 3],
    apart: ["f(1,\n\n  // apart\n\n  2, 3);\n", 3],
    alone: ["f(\n  // only\n);\n", 0],
  },
  python: {
    above: ["f(1,\n  # note\n  2, 3)\n", 3],
    apart: ["f(1,\n\n  # apart\n\n  2, 3)\n", 3],
    alone: ["f(\n  # only\n)\n", 0],
  },
};

const top = (ed: ReturnType<typeof make>) =>
  Array.from(
    ed.view.dom.querySelectorAll(".cm-content > .cm-line > [role=treeitem]")
  ) as HTMLElement[];

describe.each(Object.keys(TEXTS))("aria-setsize of the top level: %s", (l) => {
  const counted = (ed: ReturnType<typeof make>) =>
    ed.roots().filter((r) => r.kind !== "comment" && r.kind !== "error");
  test.each(["above", "trailing", "own"])(
    "%s: it is the number of blocks that are not comments",
    (k) => {
      const ed = make(l, TEXTS[l][k]);
      const items = top(ed).filter(
        (el) => !el.classList.contains("blocks-comment")
      );
      expect(items.length).toBe(counted(ed).length);
      expect(items.length).toBe(2);
      items.forEach((el, i) => {
        expect(el.getAttribute("aria-setsize")).toBe("2");
        expect(el.getAttribute("aria-posinset")).toBe(String(i + 1));
      });
      expect(a11yProblems()).toEqual([]);
    }
  );
  test.each(["above", "trailing"])(
    "%s: a comment that goes with a block is not a treeitem; the block shows it",
    (k) => {
      const ed = make(l, TEXTS[l][k]);
      expect(top(ed).length).toBe(2);
      expect(
        top(ed).some((el) => el.classList.contains("blocks-comment"))
      ).toBe(false);
      const c = ed.roots().find((r) => r.kind === "comment")!;
      expect(ed.isAttachedComment(c)).toBe(true);
      const el = ed.renderer.element(c);
      expect(el.hasAttribute("role")).toBe(false);
      expect(el.hasAttribute("tabindex")).toBe(false);
      expect(el.getAttribute("aria-hidden")).toBe("true");
      expect(el.classList.contains("blocks-attached")).toBe(true);
      const owner = top(ed).find((x) =>
        x.classList.contains("blocks-has-comment")
      )!;
      expect(
        owner.querySelector(":scope > span.blocks-comment")
      ).not.toBeNull();
    }
  );
  test("a comment that goes with no block is drawn (a treeitem) but is not counted", () => {
    const ed = make(l, TEXTS[l].own);
    const items = top(ed);
    expect(items.map((el) => el.classList.contains("blocks-comment"))).toEqual([
      false,
      true,
      false,
    ]);
    expect(items[0].getAttribute("aria-setsize")).toBe("2");
    expect(items[1].hasAttribute("aria-setsize")).toBe(false);
    expect(items[1].hasAttribute("aria-posinset")).toBe(false);
    expect(items[2].getAttribute("aria-posinset")).toBe("2");
  });
  test("a comment that arrives or goes with an edit changes no number, and one that stops going with a block becomes a block", () => {
    const ed = make(l, TEXTS[l].above);
    const c = ed.roots().find((r) => r.kind === "comment")!;
    expect(ed.isAttachedComment(c)).toBe(true);
    // a blank line between the comment and the block: it goes with none
    const nl = ed.view.state.doc.toString().indexOf("\n", c.to);
    ed.view.dispatch({ changes: { from: nl, insert: "\n" } });
    const c2 = ed.roots().find((r) => r.kind === "comment")!;
    expect(ed.isAttachedComment(c2)).toBe(false);
    expect(top(ed).length).toBe(3);
    expect(top(ed)[0].hasAttribute("aria-setsize")).toBe(false);
    expect(top(ed)[1].getAttribute("aria-setsize")).toBe("2");
    expect(a11yProblems()).toEqual([]);
    ed.view.dispatch({ changes: { from: nl, to: nl + 1, insert: "" } });
    expect(top(ed).length).toBe(2);
    expect(a11yProblems()).toEqual([]);
  });
  test("text that is not a block (an error between blocks) does not count, and numbers stay in step", () => {
    const [text, from, to, insert] = BROKEN[l];
    const ed = make(l, text);
    ed.view.dispatch({ changes: { from, to, insert } });
    expect(ed.roots().some((r) => r.kind === "error")).toBe(true);
    expect(a11yProblems()).toEqual([]);
    const items = top(ed);
    expect(items.length).toBe(
      ed.roots().filter((r) => r.kind !== "error" && r.kind !== "comment")
        .length
    );
    items.forEach((el, i) => {
      expect(el.getAttribute("aria-setsize")).toBe(String(items.length));
      expect(el.getAttribute("aria-posinset")).toBe(String(i + 1));
    });
  });
});

describe.each(Object.keys(IN_LIST))("a comment in a list: %s", (l) => {
  const call = (ed: ReturnType<typeof make>) =>
    ed.roots().find((r) => r.kind !== "comment")!;
  /** the node that holds the comment in a list of its own (the call, under a statement in JavaScript and Python) */
  const holder = (ed: ReturnType<typeof make>): BNode => {
    const find = (n: BNode): BNode | null => {
      if (
        n.slots.some(
          (s) => s.kind === "list" && s.nodes.some((c) => c.kind === "comment")
        )
      )
        return n;
      for (const s of n.slots)
        for (const c of s.nodes) {
          const f = find(c);
          if (f) return f;
        }
      return null;
    };
    const findCall = (n: BNode): BNode | null =>
      n.kind === "call"
        ? n
        : (n.slots
            .flatMap((s) => s.nodes)
            .map(findCall)
            .find(Boolean) ?? null);
    return (find(call(ed)) ?? findCall(call(ed)))!;
  };
  const args = (ed: ReturnType<typeof make>) =>
    holder(ed).slots.flatMap((s) => s.nodes);
  test.each(["above", "apart", "alone"])(
    "%s: the call's arguments, positions and spoken count leave the comment out",
    (k) => {
      const [text, n] = IN_LIST[l][k];
      const ed = make(l, text);
      const kids = args(ed).filter((c) => c.kind === "comment");
      // (a comment alone in an empty list is no node at all: it stays in the call's text)
      expect(kids.length).toBe(k === "alone" ? 0 : 1);
      // (a comment above `2` goes with it; with blank lines around it, it goes with none)
      if (kids.length)
        expect(ed.isAttachedComment(kids[0])).toBe(k === "above");
      const el = ed.renderer.element(holder(ed));
      const items = (
        Array.from(el.querySelectorAll("[role=treeitem]")) as HTMLElement[]
      )
        .filter((x) => x.getAttribute("data-slot") !== "func")
        .filter((x) => !x.classList.contains("blocks-comment"))
        .filter((x) => x.parentElement?.closest("[role=treeitem]") === el)
        .filter((x) => x.parentElement?.getAttribute("role") === "group");
      expect(items.length).toBe(n);
      items.forEach((x, i) => {
        expect(x.getAttribute("aria-setsize")).toBe(String(n));
        expect(x.getAttribute("aria-posinset")).toBe(String(i + 1));
      });
      const label = el.getAttribute("aria-label")!;
      expect(label).toMatch(
        n === 0
          ? /with 0 (inputs|arguments)/
          : new RegExp(`with ${n} (inputs|arguments)`)
      );
      // drawn (a treeitem) only when it goes with none
      if (kids.length) {
        const ce = ed.renderer.element(kids[0]);
        expect(ce.getAttribute("role") === "treeitem").toBe(k !== "above");
        expect(ce.hasAttribute("aria-setsize")).toBe(false);
      }
      expect(a11yProblems()).toEqual([]);
    }
  );
});

test("python: an error root (text that does not parse) is not counted, with a comment above and a block after", () => {
  const ed = make("python", "# a comment\ntotal = 0\nprint(total)\n");
  ed.view.dispatch({ changes: { from: 17, insert: " 1" } }); // "total 1 = 0"
  const roots = ed.roots();
  expect(roots.some((r) => r.kind === "error")).toBe(true);
  expect(a11yProblems()).toEqual([]);
  const items = top(ed);
  expect(items.length).toBe(
    roots.filter((r) => r.kind !== "error" && r.kind !== "comment").length
  );
  expect(items[0].getAttribute("aria-setsize")).toBe(String(items.length));
});
