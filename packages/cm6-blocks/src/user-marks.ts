/*
 * What a page's own `Decoration.mark` does in block mode. The block layer replaces each root by a widget, so a mark inside it would not show.
 * The rule: a mark whose range is exactly one block's range styles that block (its `class`, and `style` and `title` from `attributes`),
 * as `markText` of the old editor did. Other marks have no text to sit on in block mode (they show again in text mode).
 * Widgets, line decorations and gutters of the page are not touched: CodeMirror draws them as usual.
 */
import { EditorView, Decoration, DecorationSet } from "@codemirror/view";
import type { BNode } from "./types";
import type { Renderer } from "./render";

interface Applied {
  classes: string[];
  props: string[];
  title: boolean;
}

/** the block with exactly this range (the outermost one), if it is drawn */
function blockWith(
  roots: readonly BNode[],
  from: number,
  to: number
): BNode | null {
  let lo = 0;
  let hi = roots.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (roots[m].from <= from) lo = m + 1;
    else hi = m;
  }
  let list: readonly BNode[] = roots.slice(Math.max(0, lo - 1), lo);
  for (;;) {
    const n = list.find((c) => c.from <= from && to <= c.to);
    if (!n) return null;
    if (n.from === from && n.to === to) return n;
    list = n.slots.flatMap((s) => s.nodes);
  }
}

/**
 * Returns `apply`: call it after the view has updated (and once at the start). `own` are the decoration sets the block layer itself
 * contributes (they are skipped: they hold no marks and can be long).
 */
export function userMarks(
  view: () => EditorView,
  renderer: Renderer,
  roots: () => readonly BNode[],
  own: () => DecorationSet[]
): () => void {
  const applied = new Map<HTMLElement, Applied>();
  const undo = (): void => {
    for (const [el, a] of applied) {
      el.classList.remove(...a.classes);
      for (const p of a.props) el.style.removeProperty(p);
      if (a.title) el.removeAttribute("title");
    }
    applied.clear();
  };
  return () => {
    const v = view();
    const skip = own();
    const sets = v.state.facet(EditorView.decorations).flatMap((d) => {
      const s = typeof d === "function" ? d(v) : d;
      return skip.includes(s) ? [] : [s];
    });
    const found: [HTMLElement, Decoration][] = [];
    for (const s of sets)
      s.between(0, v.state.doc.length, (from, to, d) => {
        if (d.point || from >= to) return;
        const b = blockWith(roots(), from, to);
        if (b && renderer.has(b)) found.push([renderer.element(b), d]);
      });
    undo();
    for (const [el, d] of found) {
      const spec = d.spec as {
        class?: string;
        attributes?: Record<string, string>;
      };
      const a: Applied = applied.get(el) ?? {
        classes: [],
        props: [],
        title: false,
      };
      for (const c of (spec.class ?? "").split(/\s+/).filter(Boolean))
        if (!el.classList.contains(c)) {
          el.classList.add(c);
          a.classes.push(c);
        }
      const at = spec.attributes ?? {};
      if (at.style) {
        const probe = el.ownerDocument.createElement("span");
        probe.style.cssText = at.style;
        for (let i = 0; i < probe.style.length; i++) {
          const p = probe.style[i];
          el.style.setProperty(
            p,
            probe.style.getPropertyValue(p),
            probe.style.getPropertyPriority(p)
          );
          a.props.push(p);
        }
      }
      if (at.title && !el.hasAttribute("title")) {
        el.setAttribute("title", at.title);
        a.title = true;
      }
      applied.set(el, a);
    }
  };
}
