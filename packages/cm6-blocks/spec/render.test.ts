import { Renderer, containsFocus } from "../src/render";
import type { BNode, Language, Slot, TreeChange } from "../src/types";

let nextId = 1;

function mkSlot(
  owner: BNode,
  name: string,
  kind: "one" | "list",
  nodes: BNode[]
): Slot {
  const slot: Slot = { name, kind, owner, nodes };
  nodes.forEach((n) => {
    n.parent = owner;
    n.slot = slot;
  });
  owner.slots.push(slot);
  return slot;
}
function raw(kind: string, extra: Partial<BNode> = {}): BNode {
  return {
    id: nextId++,
    kind,
    from: 0,
    to: 0,
    parent: null,
    slot: null,
    slots: [],
    ...extra,
  };
}
const lit = (value: string, dataType = "number"): BNode =>
  raw("literal", { value, dataType });
function call(func: BNode, ...args: BNode[]): BNode {
  const n = raw("call", { brackets: "()" });
  mkSlot(n, "func", "one", [func]);
  mkSlot(n, "args", "list", args);
  return n;
}
function iff(c: BNode, a: BNode, b: BNode): BNode {
  const n = raw("if", { keyword: "if", brackets: "()" });
  mkSlot(n, "cond", "one", [c]);
  mkSlot(n, "then", "one", [a]);
  mkSlot(n, "else", "one", [b]);
  return n;
}
function program(...roots: BNode[]): BNode {
  const p = raw("program");
  mkSlot(p, "roots", "list", roots);
  return p;
}

function descr(n: BNode): string {
  const kids = n.slots.map((s) => s.nodes.map(descr).join(",")).join(";");
  return `${n.kind}:${n.value ?? ""}[${kids}]`;
}
const language: Language = {
  parse: () => [],
  print: () => "",
  blank: () => raw("blank", { value: "..." }),
  describe: descr,
};

// the operations as the tests mirror them
function doInsert(node: BNode, slot: Slot, index: number): TreeChange {
  slot.nodes.splice(index, 0, node);
  node.parent = slot.owner;
  node.slot = slot;
  return { type: "insert", node, slot, index };
}
function doRemove(slot: Slot, index: number): TreeChange {
  const [node] = slot.nodes.splice(index, 1);
  node.parent = null;
  node.slot = null;
  return { type: "remove", node, slot, index };
}
function doReplace(slot: Slot, index: number, node: BNode): TreeChange {
  const old = slot.nodes[index];
  slot.nodes[index] = node;
  node.parent = slot.owner;
  node.slot = slot;
  old.parent = null;
  old.slot = null;
  return { type: "replace", old, node, slot, index };
}

const attr = (el: Element, n: string) => el.getAttribute(n);
const argsOf = (el: HTMLElement) =>
  el.querySelector(":scope > .blocks-args") as HTMLElement;
const gapIdx = (c: Element) =>
  Array.from(c.children)
    .filter((e) => e.classList.contains("blocks-gap"))
    .map((e) => attr(e, "data-index"));
const nodeKids = (c: Element) =>
  Array.from(c.children).filter((e) => e.classList.contains("blocks-node"));

function checkList(r: Renderer, c: HTMLElement, slot: Slot) {
  const n = slot.nodes.length;
  expect(c.children.length).toBe(2 * n + 1);
  expect(gapIdx(c)).toEqual(Array.from({ length: n + 1 }, (_, i) => String(i)));
  slot.nodes.forEach((node, i) => {
    expect(c.children[2 * i + 1]).toBe(r.element(node));
    expect(attr(r.element(node), "aria-posinset")).toBe(String(i + 1));
    expect(attr(r.element(node), "aria-setsize")).toBe(String(n));
  });
}

describe("structure", () => {
  it("draws a call", () => {
    const a = lit("1");
    const b = lit("2");
    const plus = lit("+", "symbol");
    const c = call(plus, a, b);
    program(c);
    const r = new Renderer(language);
    const el = r.element(c);
    expect(el.id).toBe(`block-node-${c.id}`);
    expect(el.className).toBe("blocks-node blocks-call blocks-compound");
    expect(attr(el, "role")).toBe("treeitem");
    expect(attr(el, "tabindex")).toBe("-1");
    expect(attr(el, "contenteditable")).toBe("false");
    expect(attr(el, "aria-expanded")).toBe("true");
    expect(attr(el, "aria-label")).toBe(descr(c));
    expect(attr(el, "aria-level")).toBe("1");
    expect(attr(el, "aria-setsize")).toBe("1");
    expect(attr(el, "data-id")).toBe(String(c.id));
    const func = el.querySelector(":scope > .blocks-slot") as HTMLElement;
    expect(func.classList.contains("blocks-operator")).toBe(true);
    expect(func.firstElementChild).toBe(r.element(plus));
    const args = argsOf(el);
    expect(attr(args, "role")).toBe("group");
    checkList(r, args, c.slots[1]);
    expect(attr(r.element(a), "aria-level")).toBe("2");
    expect(attr(args.children[0], "aria-hidden")).toBe("true");
  });

  it("draws literals and blanks", () => {
    const s = lit('"hi"', "string");
    const b = raw("blank", { value: "..." });
    program(s, b);
    const r = new Renderer(language);
    expect(r.element(s).className).toBe(
      "blocks-node blocks-literal blocks-value"
    );
    const t = r.element(s).firstElementChild as HTMLElement;
    expect(t.className).toBe("blocks-literal blocks-literal-string");
    expect(t.textContent).toBe('"hi"');
    expect(r.element(b).firstElementChild!.className).toBe("blocks-blank");
    expect(attr(r.element(b), "aria-posinset")).toBe("2");
    expect(attr(r.element(b), "aria-setsize")).toBe("2");
    expect(attr(r.element(s), "aria-expanded")).toBeNull();
  });

  it("draws a compound with a keyword and nested levels", () => {
    const inner = call(lit("f", "symbol"), lit("3"));
    const n = iff(lit("true", "boolean"), inner, lit("0"));
    program(n);
    const r = new Renderer(language);
    const el = r.element(n);
    expect((el.firstElementChild as HTMLElement).className).toBe(
      "blocks-operator"
    );
    expect(el.firstElementChild!.textContent).toBe("if");
    const slots = Array.from(el.querySelectorAll(":scope > .blocks-slot"));
    expect(slots.map((s) => attr(s, "data-slot"))).toEqual([
      "cond",
      "then",
      "else",
    ]);
    expect(slots[1].classList.contains("blocks-operator")).toBe(false);
    expect(attr(r.element(inner), "aria-level")).toBe("2");
    expect(attr(r.element(inner.slots[1].nodes[0]), "aria-level")).toBe("3");
  });

  it("returns the same element twice, and throws for the program", () => {
    const c = lit("1");
    const p = program(c);
    const r = new Renderer(language);
    expect(r.has(c)).toBe(false);
    expect(r.element(c)).toBe(r.element(c));
    expect(r.has(c)).toBe(true);
    expect(() => r.element(p)).toThrow();
  });

  it("finds nodes and gaps from elements", () => {
    const x = lit("1");
    const c = call(lit("f", "symbol"), x);
    program(c);
    const r = new Renderer(language);
    const el = r.element(c);
    expect(r.nodeOf(r.element(x).firstElementChild)).toBe(x);
    expect(r.nodeOf(argsOf(el))).toBe(c);
    expect(r.nodeOf(null)).toBeNull();
    const gap = argsOf(el).children[2];
    expect(r.gapOf(gap)).toEqual({ slot: c.slots[1], index: 1 });
    expect(r.gapOf(r.element(x))).toBeNull();
  });
});

function setup(n: number) {
  const args = Array.from({ length: n }, (_, i) => lit(String(i)));
  const c = call(lit("f", "symbol"), ...args);
  const outer = call(lit("g", "symbol"), c);
  program(outer);
  const r = new Renderer(language);
  r.element(outer);
  return { c, outer, args, r, slot: c.slots[1] };
}

describe.each([
  ["start", 0],
  ["middle", 2],
  ["end", 4],
])("insert at the %s", (_name, index) => {
  it("only adds", () => {
    const { c, outer, args, r, slot } = setup(4);
    const before = args.map((a) => r.element(a));
    const outerLabel = attr(r.element(outer), "aria-label");
    const nn = lit("new");
    r.apply(doInsert(nn, slot, index));
    const container = argsOf(r.element(c));
    checkList(r, container, slot);
    const expected = [...before];
    expected.splice(index, 0, r.element(nn));
    expect(nodeKids(container)).toEqual(expected);
    before.forEach((e, i) => expect(r.element(args[i])).toBe(e));
    expect(attr(r.element(c), "aria-label")).toBe(descr(c));
    expect(attr(r.element(outer), "aria-label")).toBe(descr(outer));
    expect(attr(r.element(outer), "aria-label")).not.toBe(outerLabel);
  });
});

describe.each([
  ["start", 0],
  ["middle", 2],
  ["end", 3],
])("remove at the %s", (_name, index) => {
  it("only takes out", () => {
    const { c, outer, args, r, slot } = setup(4);
    const els = args.map((a) => r.element(a));
    const gone = args[index];
    const outerLabel = attr(r.element(outer), "aria-label");
    r.apply(doRemove(slot, index));
    expect(r.has(gone)).toBe(false);
    const container = argsOf(r.element(c));
    checkList(r, container, slot);
    expect(container.contains(els[index])).toBe(false);
    args.forEach((a, i) => {
      if (i !== index) expect(r.element(a)).toBe(els[i]);
    });
    expect(attr(r.element(outer), "aria-label")).toBe(descr(outer));
    expect(attr(r.element(outer), "aria-label")).not.toBe(outerLabel);
  });
});

describe("replace", () => {
  it("swaps one element and leaves the siblings", () => {
    const { c, outer, args, r, slot } = setup(4);
    const els = args.map((a) => r.element(a));
    const nn = call(lit("h", "symbol"), lit("9"));
    r.apply(doReplace(slot, 1, nn));
    const container = argsOf(r.element(c));
    checkList(r, container, slot);
    expect(r.has(args[1])).toBe(false);
    expect(r.has(nn.slots[1].nodes[0])).toBe(true);
    [0, 2, 3].forEach((i) => expect(r.element(args[i])).toBe(els[i]));
    expect(attr(r.element(nn), "aria-posinset")).toBe("2");
    expect(attr(r.element(nn), "aria-level")).toBe("3");
    expect(attr(r.element(outer), "aria-label")).toBe(descr(outer));
  });

  it("replaces a node in a one slot", () => {
    const n = iff(lit("1"), lit("2"), lit("3"));
    program(n);
    const r = new Renderer(language);
    const el = r.element(n);
    const nn = lit("7");
    r.apply(doReplace(n.slots[1], 0, nn));
    expect(el.querySelector('[data-slot="then"]')!.firstElementChild).toBe(
      r.element(nn)
    );
    expect(attr(el, "aria-label")).toBe(descr(n));
  });
});

describe("roots", () => {
  it("renumbers roots that have elements and makes none", () => {
    const a = lit("1");
    const b = lit("2");
    const p = program(a, b);
    const r = new Renderer(language);
    r.element(b);
    r.takeStats();
    const nn = lit("3");
    r.apply(doInsert(nn, p.slots[0], 0));
    expect(r.has(nn)).toBe(false);
    expect(attr(r.element(b), "aria-posinset")).toBe("3");
    expect(attr(r.element(b), "aria-setsize")).toBe("3");
    r.apply(doRemove(p.slots[0], 0));
    expect(attr(r.element(b), "aria-posinset")).toBe("2");
    expect(r.takeStats().created).toBe(0);
  });

  it("does nothing for a parent that was never drawn", () => {
    const c = call(lit("f", "symbol"), lit("1"));
    program(c);
    const r = new Renderer(language);
    r.apply(doInsert(lit("2"), c.slots[1], 1));
    expect(r.takeStats().created).toBe(0);
    expect(r.has(c)).toBe(false);
  });
});

describe("stats", () => {
  it("inserting into 100 arguments is O(1)", () => {
    const { r, slot } = setup(100);
    r.takeStats();
    r.apply(doInsert(lit("x"), slot, 50));
    const s = r.takeStats();
    expect(s.created).toBeLessThanOrEqual(3);
    expect(s.created).toBeGreaterThanOrEqual(2);
    // setsize on 100 siblings, posinset and data-index on 50 each, plus labels
    expect(s.attrWrites).toBeLessThanOrEqual(2 * 101 + 50 + 5);
    expect(r.takeStats()).toEqual({ created: 0, removed: 0, attrWrites: 0 });
  });
});

describe("focus", () => {
  it("an untouched focused element keeps the focus", () => {
    const { r, args, slot, c } = setup(4);
    document.body.appendChild(r.element(c.parent!));
    const el = r.element(args[3]);
    el.focus();
    expect(document.activeElement).toBe(el);
    r.apply(doInsert(lit("n"), slot, 0));
    r.apply(doRemove(slot, 1));
    expect(document.activeElement).toBe(el);
    expect(containsFocus(r.element(c))).toBe(true);
    expect(containsFocus(r.element(args[0]))).toBe(false);
    r.element(c.parent!).remove();
  });
});

// ---- the oracle

function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("oracle", () => {
  it("patched pages equal fresh drawings (200 seeds x 30 changes)", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rnd = prng(seed);
      const pick = <T>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)];
      const fresh = (depth = 0): BNode => {
        if (depth > 2 || rnd() < 0.5)
          return lit(String(Math.floor(rnd() * 100)));
        if (rnd() < 0.3)
          return iff(fresh(depth + 1), fresh(depth + 1), fresh(depth + 1));
        const k = Math.floor(rnd() * 4);
        return call(
          lit("f", "symbol"),
          ...Array.from({ length: k }, () => fresh(depth + 1))
        );
      };
      const p = program(fresh(), fresh(), fresh());
      const live = new Renderer(language);
      p.slots[0].nodes.forEach((n) => live.element(n));
      const all = (n: BNode, out: BNode[] = []): BNode[] => {
        out.push(n);
        n.slots.forEach((s) => s.nodes.forEach((c) => all(c, out)));
        return out;
      };
      const check = (step: number) => {
        const f = new Renderer(language);
        for (const root of p.slots[0].nodes) {
          if (!live.has(root)) live.element(root);
          if (!live.element(root).isEqualNode(f.element(root))) {
            throw new Error(
              `seed ${seed} step ${step}: live page differs from a fresh drawing`
            );
          }
        }
      };
      try {
        for (let step = 0; step < 30; step++) {
          const nodes = all(p);
          const lists = nodes.flatMap((n) =>
            n.slots.filter((s) => s.kind === "list")
          );
          const op = rnd();
          let change: TreeChange | null = null;
          if (op < 0.4) {
            const slot = pick(lists);
            change = doInsert(
              fresh(1),
              slot,
              Math.floor(rnd() * (slot.nodes.length + 1))
            );
          } else if (op < 0.7) {
            const full = lists.filter((s) => s.nodes.length > 0);
            if (full.length) {
              const slot = pick(full);
              change = doRemove(slot, Math.floor(rnd() * slot.nodes.length));
            }
          } else {
            const cands = nodes.filter((n) => n.kind !== "program");
            if (cands.length) {
              const target = pick(cands);
              const slot = target.slot!;
              change = doReplace(slot, slot.nodes.indexOf(target), fresh(1));
            }
          }
          if (change) live.apply(change);
          check(step);
        }
      } catch (e) {
        throw new Error(`seed ${seed}: ${(e as Error).message}`, { cause: e });
      }
    }
  });
});
