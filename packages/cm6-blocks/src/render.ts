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

/** the words of a comment, without its signs (the line comment sign, or the block comment brackets) */
export function plainComment(raw: string): string {
  return raw
    .trim()
    .replace(/^(#\||\/\*)/, "")
    .replace(/(\|#|\*\/)$/, "")
    .replace(/^\s*(;+|\/\/+|#+)/, "")
    .trim();
}

const FLAGS = [
  "blocks-collapsed",
  "blocks-has-comment",
  "blocks-selected",
  "blocks-attached",
];
/** switch one of the state classes, keeping them in one order (the checker compares the class attribute as a string) */
function flagClass(el: Element, name: string, on: boolean): void {
  const state = FLAGS.map((f) => (f === name ? on : el.classList.contains(f)));
  el.classList.remove(...FLAGS);
  FLAGS.forEach((f, i) => state[i] && el.classList.add(f));
}

/**
 * The nodes of a slot that count in aria-setsize / aria-posinset: no comment counts (one that goes with a block is not drawn as a block, one
 * that goes with none is drawn but is not counted), and a top-level piece of text that did not parse (an `error` root), or a root of no width (a recovered `;`), is not drawn.
 */
function counts(n: BNode, top: boolean): boolean {
  return (
    n.kind !== "comment" && !(top && (n.kind === "error" || n.to === n.from))
  );
}
function drawnIn(slot: Slot): BNode[] {
  const top = slot.owner.kind === "program";
  return slot.nodes.filter((n) => counts(n, top));
}

export class Renderer {
  /** the comment that goes with a block (the editor says which: see `commentOf` in lezer-view.ts) */
  attached: (node: BNode) => BNode | null = () => null;
  /** is the node a comment that goes with a block? It is not drawn as a block (no treeitem): the block shows it as a popup. */
  isAttached: (node: BNode) => boolean = () => false;
  /** does the block hold comments that are no blocks (it has no list to hold them)? Its children are repainted after each edit. */
  mayHaveStrays: (node: BNode) => boolean = () => false;
  /** a root's element is drawn / taken out of the page: the editor watches its height (see `heightWatch` in lezer-view.ts) */
  watch?: (el: HTMLElement) => void;
  unwatch?: (el: HTMLElement) => void;
  private els = new Map<BNode, HTMLElement>();
  private byId = new Map<number, BNode>();
  private stats: RenderStats = { created: 0, removed: 0, attrWrites: 0 };
  /** the blocks that are selected (Space): drawn with aria-selected="true" and the class `blocks-selected` */
  private selection = new Set<BNode>();

  /** the spoken label of a block: what the language says, and "with comment: ..." when a comment goes with it */
  labelOf(node: BNode): string {
    const c = this.attached(node);
    const base = this.language.describe(node);
    return c ? `${base}, with comment: ${plainComment(c.value ?? "")}` : base;
  }

  /** label and comment marker of a drawn block */
  relabel(node: BNode): void {
    const el = this.els.get(node);
    if (!el) return;
    if (node.kind === "comment") return this.paintAttached(el, node);
    this.setAttr(el, "aria-label", this.labelOf(node));
    this.paintComment(el, node);
  }

  /** the blocks drawn with a comment marker */
  private marked = new Set<BNode>();

  /** after an edit: the drawn blocks next to a comment, and those that had a marker, may have changed (a kept block is not repainted otherwise) */
  refreshComments(all = false): void {
    // (`all`: after a stay in text mode, where a comment that came with an edit had no element, so no neighbour was found through it)
    const todo = new Set<BNode>(all ? this.els.keys() : this.marked);
    for (const n of this.els.keys()) {
      if (n.kind === "comment") todo.add(n); // (it may have come to go with a block, or stopped)
      if (n.slots.length && this.mayHaveStrays(n))
        for (const s of n.slots) for (const c of s.nodes) todo.add(c);
      if (!n.slot || (n.kind !== "comment" && n.slot.nodes.length < 2))
        continue;
      const i = n.slot.nodes.indexOf(n);
      if (n.kind === "comment") {
        for (const m of [n.slot.nodes[i - 1], n.slot.nodes[i + 1]])
          if (m) todo.add(m);
      } else if (
        // (a comment next to a drawn block that is outside what CodeMirror draws has no element to be found through: the block is)
        n.slot.nodes[i - 1]?.kind === "comment" ||
        n.slot.nodes[i + 1]?.kind === "comment"
      )
        todo.add(n);
    }
    for (const n of todo) if (this.els.has(n)) this.relabel(n);
  }

  /**
   * A comment that goes with a block is not a block: no role, not focusable, not counted, hidden (the block shows its words as a popup). One
   * that goes with none is a block of its own (a treeitem, not counted in the set sizes). Both are the same element: only its attributes differ.
   */
  private paintAttached(el: HTMLElement, node: BNode): void {
    const hidden = this.isAttached(node);
    flagClass(el, "blocks-attached", hidden);
    if (hidden) {
      for (const a of [
        "role",
        "tabindex",
        "aria-label",
        "aria-selected",
        "aria-level",
        "aria-expanded",
      ])
        if (el.hasAttribute(a)) el.removeAttribute(a);
      flagClass(el, "blocks-selected", false);
      flagClass(el, "blocks-collapsed", false);
      this.setAttr(el, "aria-hidden", "true");
      return;
    }
    if (el.hasAttribute("aria-hidden")) el.removeAttribute("aria-hidden");
    this.setAttr(el, "role", "treeitem");
    this.setAttr(el, "tabindex", "-1");
    this.setAttr(el, "aria-label", this.labelOf(node));
    this.setAttr(
      el,
      "aria-selected",
      this.selection.has(node) ? "true" : "false"
    );
    flagClass(el, "blocks-selected", this.selection.has(node));
    this.setAttr(el, "aria-level", String(this.level(node)));
    this.setAttr(el, "aria-expanded", "true");
    this.paintCollapsed(el, node);
  }

  private paintComment(el: HTMLElement, node: BNode): void {
    const c = this.attached(node);
    if (c) this.marked.add(node);
    else this.marked.delete(node);
    flagClass(el, "blocks-has-comment", !!c);
    if (c) {
      const t = plainComment(c.value ?? "");
      this.setAttr(el, "data-comment", t);
      this.setAttr(el, "title", t);
      // (the popup: shown while the block has focus, hidden from a screen reader, which has the words in the block's label)
      let pop = Array.from(el.children).find((k) =>
        k.classList.contains("blocks-comment")
      ) as HTMLElement | undefined;
      if (!pop) {
        pop = this.create("span", "blocks-comment");
        pop.setAttribute("aria-hidden", "true");
        el.prepend(pop);
      }
      if (pop.textContent !== t) pop.textContent = t;
    } else if (el.hasAttribute("data-comment")) {
      el.removeAttribute("data-comment");
      el.removeAttribute("title");
      for (const k of Array.from(el.children))
        if (k.classList.contains("blocks-comment")) k.remove();
    }
  }

  /** the neighbours of a slot index: a comment that came, went or changed there may belong to them */
  private relabelAround(slot: Slot, index: number): void {
    for (let j = index - 1; j <= index + 1; j++) {
      const n = slot.nodes[j];
      if (n && this.els.has(n)) this.relabel(n);
    }
  }

  /** the blocks that are collapsed (only their head is drawn) */
  private folded = new Set<BNode>();

  constructor(private language: Language) {}

  element(node: BNode): HTMLElement {
    if (node.kind === "program")
      throw new Error("the program node is not drawn");
    const have = this.els.get(node);
    if (have) return have;
    return this.build(node);
  }

  has(node: BNode): boolean {
    return this.els.has(node);
  }

  /** is the block selected? */
  isSelected(node: BNode): boolean {
    return this.selection.has(node);
  }

  /** the selected blocks (a copy) */
  selected(): BNode[] {
    return [...this.selection];
  }

  /** make `node` selected or not (a drawn block's element is patched at once; one that is not drawn yet is drawn selected) */
  setSelected(node: BNode, on: boolean): void {
    if (on === this.selection.has(node)) return;
    if (on) this.selection.add(node);
    else this.selection.delete(node);
    const el = this.els.get(node);
    if (el) this.paintSelected(el, on);
  }

  isCollapsed(node: BNode): boolean {
    return this.folded.has(node);
  }

  collapsedNodes(): BNode[] {
    return [...this.folded];
  }

  setCollapsed(node: BNode, on: boolean): void {
    if (on === this.folded.has(node)) return;
    if (on) this.folded.add(node);
    else this.folded.delete(node);
    const el = this.els.get(node);
    if (el) this.paintCollapsed(el, node);
  }

  private paintCollapsed(el: HTMLElement, node: BNode): void {
    if (node.slots.length === 0 && node.kind !== "comment") return;
    if (el.classList.contains("blocks-attached")) return;
    const on = this.folded.has(node);
    this.setAttr(el, "aria-expanded", on ? "false" : "true");
    flagClass(el, "blocks-collapsed", on);
  }

  /** take the selection of another renderer (the checker's fresh drawing must show the same selection) */
  adoptSelection(other: Renderer): void {
    this.selection = new Set(other.selection);
    this.folded = new Set(other.folded);
  }

  private paintSelected(el: HTMLElement, on: boolean): void {
    if (el.classList.contains("blocks-attached")) return;
    this.setAttr(el, "aria-selected", on ? "true" : "false");
    flagClass(el, "blocks-selected", on);
  }

  forget(node: BNode): void {
    this.selection.delete(node);
    this.folded.delete(node);
    this.marked.delete(node);
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
    const slot = owner.slots.find(
      (s) => s.name === gap.getAttribute("data-slot")
    );
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
      // (a comment is not counted: a block that became a comment, or the other way round, changes the numbers around it)
      if (change.old.kind === "comment" || change.node.kind === "comment")
        this.renumber(slot, 0);
    } else if (change.type === "insert") {
      if (isRoot) {
        this.renumber(slot, 0);
      } else if (this.els.has(owner)) {
        const container = this.containerOf(owner, slot);
        const el = this.element(change.node);
        if (container && slot.kind === "list") {
          const gap = this.makeGap(slot.name, change.index);
          const before = this.gapsOf(container)[change.index] ?? null;
          container.insertBefore(gap, before);
          container.insertBefore(el, before);
          this.renumber(slot, change.index);
          this.renumberGaps(container, change.index + 1);
          if (slot.pieces) this.paintPieces(owner, slot, container);
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
          const gap = this.gapsOf(container)[change.index];
          if (gap) {
            gap.remove();
            this.stats.removed++;
          }
          el.remove();
          this.renumber(slot, change.index);
          this.renumberGaps(container, change.index);
          if (slot.pieces) this.paintPieces(owner, slot, container);
        }
      }
    }
    // labels of the ancestors may have changed (and the text pieces of those that have them)
    for (let n: BNode | null = owner; n && n.kind !== "program"; n = n.parent) {
      const el = this.els.get(n);
      if (el) {
        this.setAttr(el, "aria-label", this.labelOf(n));
        this.paintComment(el, n);
        this.repaintPieces(n);
      }
    }
    this.relabelAround(slot, change.index);
  }

  /** the text pieces of a node's slots (after its text or its children changed) */
  private repaintPieces(node: BNode): void {
    for (const slot of node.slots) {
      if (!slot.pieces) continue;
      const container = this.containerOf(node, slot);
      if (container) this.paintPieces(node, slot, container);
    }
  }

  /** the gaps of a `pieces` slot hold the owner's source text between its children */
  private paintPieces(owner: BNode, slot: Slot, container: Element): void {
    let src: string;
    try {
      src = this.language.print(owner);
    } catch {
      return;
    }
    const kids = slot.nodes;
    const gaps = this.gapsOf(container);
    for (let i = 0; i <= kids.length; i++) {
      const gap = gaps[i];
      if (!gap) break;
      const a = i === 0 ? owner.from : kids[i - 1].to;
      const b = i < kids.length ? kids[i].from : owner.to;
      const t = src.slice(
        Math.max(0, a - owner.from),
        Math.max(0, b - owner.from)
      );
      if (gap.textContent !== t) {
        gap.textContent = t;
        this.stats.attrWrites++;
      }
      gap.classList.add("blocks-piece");
      if (t) gap.removeAttribute("aria-hidden");
      else gap.setAttribute("aria-hidden", "true");
    }
  }

  /** the spoken label of a drawn node, after what is inside it changed */
  refresh(node: BNode): void {
    const el = this.els.get(node);
    if (el && node.kind === "comment") this.paintAttached(el, node);
    else if (el) {
      this.setAttr(el, "aria-label", this.labelOf(node));
      this.paintComment(el, node);
      this.repaintPieces(node);
    }
    if (node.kind === "comment" && node.slot)
      this.relabelAround(node.slot, node.slot.nodes.indexOf(node));
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
    for (let p: BNode | null = node; p && p.kind !== "program"; p = p.parent)
      n++;
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
    el.id = `block-node-${node.id}`;
    el.setAttribute("role", "treeitem");
    el.setAttribute("tabindex", "-1");
    el.setAttribute("contenteditable", "false");
    el.setAttribute("data-id", String(node.id));
    el.setAttribute("aria-label", this.labelOf(node));
    this.paintComment(el, node);
    el.setAttribute(
      "aria-selected",
      this.selection.has(node) ? "true" : "false"
    );
    if (this.selection.has(node)) flagClass(el, "blocks-selected", true);
    el.setAttribute("aria-level", String(this.level(node)));
    if (node.kind !== "comment") {
      // (a comment is not counted: it has no set size and no position)
      const siblings = node.slot ? drawnIn(node.slot) : [node];
      el.setAttribute("aria-setsize", String(siblings.length));
      el.setAttribute(
        "aria-posinset",
        String(Math.max(0, siblings.indexOf(node)) + 1)
      );
    }
    if (!compound) {
      const text = this.create(
        "span",
        node.kind === "blank"
          ? "blocks-blank"
          : `blocks-literal blocks-literal-${node.dataType ?? "other"}`
      );
      text.textContent = node.value ?? "";
      el.appendChild(text);
      // (a comment block collapses like the old editor's: only its emoji stays)
      if (node.kind === "comment") {
        el.setAttribute("aria-expanded", "true");
        if (this.folded.has(node)) this.paintCollapsed(el, node);
        this.paintAttached(el, node);
      }
      return el;
    }
    el.setAttribute("aria-expanded", "true");
    if (this.folded.has(node)) this.paintCollapsed(el, node);
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
          node.kind === "call" && slot.name === "func"
            ? "blocks-slot blocks-operator"
            : "blocks-slot"
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
        if (slot.pieces) this.paintPieces(node, slot, args);
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
    const top = slot.owner.kind === "program";
    const n = drawnIn(slot).length;
    let pos = 0;
    slot.nodes.forEach((c, i) => {
      if (!counts(c, top)) return;
      pos++;
      const el = this.els.get(c);
      if (!el) return;
      this.setAttr(el, "aria-setsize", String(n));
      if (i >= from) this.setAttr(el, "aria-posinset", String(pos));
    });
  }

  /** data-index of the gaps from index `from` on */
  private renumberGaps(container: Element, from: number): void {
    const gaps = this.gapsOf(container);
    for (let j = from; j < gaps.length; j++)
      this.setAttr(gaps[j], "data-index", String(j));
  }

  /** the gaps of a list, in order (an open edit box is among the children too, so a gap is not at an even position) */
  private gapsOf(container: Element): Element[] {
    return Array.from(container.children).filter((c) =>
      c.classList.contains("blocks-gap")
    );
  }
}
