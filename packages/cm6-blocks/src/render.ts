/*
 * EXPERIMENT. Draws nodes as plain DOM and patches the page for one TreeChange.
 * No framework, no virtual DOM: an operation says what changed and only that
 * is touched.
 */
import type { BNode, Language, Slot, TreeChange } from "./types";

/** Does the element, or one inside it, have the focus? */
export function containsFocus(el: Element): boolean {
  const active = el.ownerDocument.activeElement;
  return !!active && el.contains(active);
}

export interface RenderStats {
  created: number;
  removed: number;
  attrWrites: number;
}

export class Renderer {
  private els = new Map<BNode, HTMLElement>();
  private byId = new Map<number, BNode>();
  private stats: RenderStats = { created: 0, removed: 0, attrWrites: 0 };

  constructor(private language: Language) {}

  element(node: BNode): HTMLElement {
    if (node.kind === "program") throw new Error("the program node is not drawn");
    const have = this.els.get(node);
    if (have) return have;
    return this.build(node);
  }

  has(node: BNode): boolean {
    return this.els.has(node);
  }

  forget(node: BNode): void {
    const el = this.els.get(node);
    if (el) {
      this.els.delete(node);
      this.byId.delete(node.id);
      this.stats.removed++;
    }
    for (const slot of node.slots) for (const c of slot.nodes) this.forget(c);
  }

  nodeOf(el: Element | null): BNode | null {
    const hit = el ? el.closest(".blocks-node[data-id]") : null;
    if (!hit) return null;
    return this.byId.get(Number(hit.getAttribute("data-id"))) ?? null;
  }

  gapOf(el: Element | null): { slot: Slot; index: number } | null {
    const gap = el ? el.closest(".blocks-gap") : null;
    if (!gap) return null;
    const owner = this.nodeOf(gap);
    if (!owner) return null;
    const slot = owner.slots.find((s) => s.name === gap.getAttribute("data-slot"));
    if (!slot) return null;
    return { slot, index: Number(gap.getAttribute("data-index")) };
  }

  takeStats(): RenderStats {
    const s = this.stats;
    this.stats = { created: 0, removed: 0, attrWrites: 0 };
    return s;
  }

  apply(change: TreeChange): void {
    const slot = change.slot;
    const owner = slot.owner;
    const isRoot = owner.kind === "program";
    if (change.type === "replace") {
      const oldEl = this.els.get(change.old);
      this.forget(change.old);
      if (oldEl) {
        const el = this.element(change.node);
        oldEl.replaceWith(el);
      }
    } else if (change.type === "insert") {
      if (isRoot) {
        this.renumber(slot, 0);
      } else if (this.els.has(owner)) {
        const container = this.containerOf(owner, slot);
        const el = this.element(change.node);
        if (container && slot.kind === "list") {
          const gap = this.makeGap(slot.name, change.index);
          const before = container.children[2 * change.index] ?? null;
          container.insertBefore(gap, before);
          container.insertBefore(el, before);
          this.renumber(slot, change.index);
          this.renumberGaps(container, change.index + 1);
        }
      }
    } else {
      const el = this.els.get(change.node);
      this.forget(change.node);
      if (isRoot) {
        this.renumber(slot, 0);
      } else if (this.els.has(owner)) {
        const container = this.containerOf(owner, slot);
        if (container && slot.kind === "list" && el) {
          const gap = container.children[2 * change.index];
          if (gap) {
            gap.remove();
            this.stats.removed++;
          }
          el.remove();
          this.renumber(slot, change.index);
          this.renumberGaps(container, change.index);
        }
      }
    }
    // labels of the ancestors may have changed
    for (let n: BNode | null = owner; n && n.kind !== "program"; n = n.parent) {
      const el = this.els.get(n);
      if (el) this.setAttr(el, "aria-label", this.language.describe(n));
    }
  }

  /** the spoken label of a drawn node, after what is inside it changed */
  refresh(node: BNode): void {
    const el = this.els.get(node);
    if (el) this.setAttr(el, "aria-label", this.language.describe(node));
  }

  /** aria-setsize / aria-posinset of every drawn node of a slot (after nodes were added or removed around them) */
  renumberSlot(slot: Slot): void {
    this.renumber(slot, 0);
  }

  // ---- building

  private create(tag: string, cls?: string): HTMLElement {
    this.stats.created++;
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    return el;
  }

  private makeGap(slotName: string, index: number): HTMLElement {
    const gap = this.create("span", "blocks-gap");
    gap.setAttribute("data-slot", slotName);
    gap.setAttribute("data-index", String(index));
    gap.setAttribute("aria-hidden", "true");
    return gap;
  }

  private level(node: BNode): number {
    let n = 0;
    for (let p: BNode | null = node; p && p.kind !== "program"; p = p.parent) n++;
    return n;
  }

  private build(node: BNode): HTMLElement {
    const compound = node.slots.length > 0;
    const el = this.create(
      "span",
      `blocks-node blocks-${node.kind} ${compound ? "blocks-compound" : "blocks-value"}`
    );
    this.els.set(node, el);
    this.byId.set(node.id, node);
    el.id = `cmb6-node-${node.id}`;
    el.setAttribute("role", "treeitem");
    el.setAttribute("tabindex", "-1");
    el.setAttribute("contenteditable", "false");
    el.setAttribute("data-id", String(node.id));
    el.setAttribute("aria-label", this.language.describe(node));
    el.setAttribute("aria-level", String(this.level(node)));
    const siblings = node.slot ? node.slot.nodes : [node];
    el.setAttribute("aria-setsize", String(siblings.length));
    el.setAttribute("aria-posinset", String(Math.max(0, siblings.indexOf(node)) + 1));
    if (!compound) {
      const text = this.create(
        "span",
        node.kind === "blank"
          ? "blocks-blank"
          : `blocks-literal blocks-literal-${node.dataType ?? "other"}`
      );
      text.textContent = node.value ?? "";
      el.appendChild(text);
      return el;
    }
    el.setAttribute("aria-expanded", "true");
    if (node.modifier) {
      const md = this.create("span", "blocks-operator blocks-modifier");
      md.textContent = node.modifier;
      el.appendChild(md);
    }
    if (node.keyword) {
      const kw = this.create("span", "blocks-operator");
      kw.textContent = node.keyword;
      el.appendChild(kw);
    }
    for (const slot of node.slots) {
      if (slot.glue && (slot.kind === "one" || slot.nodes.length)) {
        const g = this.create("span", "blocks-glue");
        g.textContent = slot.glue;
        g.setAttribute("aria-hidden", "true");
        el.appendChild(g);
      }
      if (slot.kind === "one") {
        const wrap = this.create(
          "span",
          node.kind === "call" && slot.name === "func" ? "blocks-slot blocks-operator" : "blocks-slot"
        );
        wrap.setAttribute("data-slot", slot.name);
        for (const c of slot.nodes) wrap.appendChild(this.element(c));
        el.appendChild(wrap);
      } else {
        const args = this.create("span", "blocks-args");
        args.setAttribute("data-slot", slot.name);
        args.setAttribute("role", "group");
        slot.nodes.forEach((c, i) => {
          args.appendChild(this.makeGap(slot.name, i));
          args.appendChild(this.element(c));
        });
        args.appendChild(this.makeGap(slot.name, slot.nodes.length));
        el.appendChild(args);
      }
    }
    return el;
  }

  // ---- patching

  private containerOf(owner: BNode, slot: Slot): Element | null {
    const el = this.els.get(owner);
    if (!el) return null;
    for (const child of Array.from(el.children)) {
      if (child.getAttribute("data-slot") === slot.name) return child;
    }
    return null;
  }

  private setAttr(el: Element, name: string, value: string): void {
    if (el.getAttribute(name) !== value) {
      el.setAttribute(name, value);
      this.stats.attrWrites++;
    }
  }

  /** setsize on every sibling, posinset on those from `from` on */
  private renumber(slot: Slot, from: number): void {
    const n = slot.nodes.length;
    slot.nodes.forEach((c, i) => {
      const el = this.els.get(c);
      if (!el) return;
      this.setAttr(el, "aria-setsize", String(n));
      if (i >= from) this.setAttr(el, "aria-posinset", String(i + 1));
    });
  }

  /** data-index of the gaps from index `from` on */
  private renumberGaps(container: Element, from: number): void {
    const kids = container.children;
    for (let j = from; 2 * j < kids.length; j++) {
      this.setAttr(kids[2 * j], "data-index", String(j));
    }
  }
}
