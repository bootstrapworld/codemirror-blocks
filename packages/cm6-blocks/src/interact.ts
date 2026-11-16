/*
 * EXPERIMENT. Keyboard and mouse for the Lezer editor. Every change is a plain
 * text change made by the editor (insertText, removeNode, replaceText); nothing
 * here touches the tree. Keys, with a block focused:
 *   ArrowDown / ArrowUp   next / previous block in document order (pre-order)
 *   ArrowRight / ArrowLeft first child / parent
 *   Delete / Backspace    remove the block (a "one" slot gets the table's blank)
 *   Enter                 on a leaf: edit its text in place (Enter commits, Escape cancels)
 *   Ctrl-] / Ctrl-[       a box for a new sibling after / before (list slots)
 *   Ctrl-Z / Ctrl-Shift-Z undo / redo through CodeMirror's history
 *   Ctrl/Cmd-C / X / V    copy / cut / paste the block's source text (the browser's copy, cut and paste events, so the
 *                         system clipboard works); paste goes after the focused block, or replaces a focused blank
 * Mouse: click a block to focus it; click a gap to open the box for a new sibling there; drag a block (pointer events,
 * so a finger or a pen too) onto a gap, a blank, or the top or bottom edge of a top-level block to move it.
 * Text that does not parse cleanly is accepted: the root then shows as text.
 */
import { redo, undo } from "@codemirror/commands";
import { EditorView } from "@codemirror/view";
import type { LezerBlockEditor } from "./lezer-view";
import type { BNode, Slot } from "./types";

const kids = (n: BNode): BNode[] => n.slots.flatMap((s) => s.nodes);
const drawable = (n: BNode): boolean => n.kind !== "error" && n.kind !== "program";

export function nextBlock(n: BNode): BNode | null {
  let c: BNode | null = n;
  while (c) {
    const k = kids(c);
    let r: BNode | null = null;
    if (k.length) r = k[0];
    else {
      for (let up: BNode = c; up.parent && !r; up = up.parent) {
        const sibs = kids(up.parent);
        const i = sibs.indexOf(up);
        if (i + 1 < sibs.length) r = sibs[i + 1];
      }
    }
    c = r;
    if (c && drawable(c)) return c;
  }
  return null;
}

export function prevBlock(n: BNode): BNode | null {
  let c: BNode | null = n;
  while (c) {
    const p: BNode | null = c.parent;
    if (!p) return null;
    const sibs = kids(p);
    const i = sibs.indexOf(c);
    let r: BNode | null;
    if (i > 0) {
      r = sibs[i - 1];
      for (let k = kids(r); k.length; k = kids(r)) r = k[k.length - 1];
    } else r = p;
    c = r;
    if (c && c.kind === "program") return null;
    if (c && drawable(c)) return c;
  }
  return null;
}

export function attachInteraction(ed: LezerBlockEditor): { detach(): void; edit(node: BNode, typed?: string): void } {
  const { view, renderer } = ed;
  const dom = view.dom;
  let open: { cancel(): void } | null = null;

  function focusSoon(n: BNode): void {
    ed.focusNode(n);
    if (ed.focusedNode() === n) return;
    // a root that is not drawn yet (outside the viewport): scroll to it, then try again
    view.dispatch({ effects: EditorView.scrollIntoView(n.from, { y: "center" }) });
    const again = (left: number) => () => {
      ed.focusNode(n);
      if (ed.focusedNode() !== n && left > 0) setTimeout(again(left - 1), 30);
    };
    setTimeout(again(5), 0);
  }

  /** a text box, placed by `put`; Enter calls `commit(text)`, Escape or blur cancels */
  function box(initial: string, put: (input: HTMLInputElement) => void, done: () => void, commit: (text: string) => void, select = true): void {
    open?.cancel();
    const input = dom.ownerDocument.createElement("input");
    input.className = "blocks-edit";
    input.value = initial;
    const fit = () => (input.size = Math.max(2, input.value.length + 1));
    fit();
    input.addEventListener("input", fit);
    let finished = false;
    const finish = (): void => {
      if (finished) return;
      finished = true;
      open = null;
      input.remove();
      done();
    };
    const self = { cancel: finish };
    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        const t = input.value;
        finish();
        commit(t);
      } else if (e.key === "Escape") {
        e.preventDefault();
        finish();
      }
    });
    input.addEventListener("blur", () => finish());
    put(input);
    open = self;
    input.focus();
    if (select) input.select();
    else input.setSelectionRange(input.value.length, input.value.length);
  }

  function editLeaf(node: BNode, typed?: string): void {
    ed.focusNode(node);
    const el = renderer.element(node);
    // a node that is not drawn (outside the viewport) has no place for a box: it would sit in a detached element and show up later
    if (!el.isConnected) return;
    const text = el.firstElementChild as HTMLElement | null;
    const back = () => {
      if (text) text.removeAttribute("style");
      ed.focusNode(node);
    };
    box(
      typed ?? (node.kind === "blank" ? "" : node.value ?? ""),
      (input) => {
        if (text) {
          text.style.display = "none";
          el.insertBefore(input, text);
        } else el.appendChild(input);
      },
      back,
      (t) => {
        if (t === (node.value ?? "") ) return;
        if (t.trim() === "") ed.removeNode(node);
        else ed.replaceText(node, t);
      },
      typed === undefined
    );
  }

  /** a box for a new element at `index` of `slot`, shown by `put`; focus goes to `anchor` first */
  function insertBox(slot: Slot, index: number, anchor: BNode, put: (input: HTMLInputElement) => void): void {
    box("", put, () => ed.focusNode(anchor), (t) => {
      if (t.trim() === "") return;
      try {
        ed.insertText(slot, index, t);
      } catch (e) {
        ed.lastError = (e as Error).message;
      }
    });
  }

  function siblingBox(node: BNode, after: boolean): void {
    const slot = node.slot;
    if (!slot || slot.kind !== "list") return;
    const i = slot.nodes.indexOf(node);
    const el = renderer.element(node);
    insertBox(slot, after ? i + 1 : i, node, (input) => {
      if (node.parent && node.parent.kind !== "program" && el.parentElement) {
        el.parentElement.insertBefore(input, after ? el.nextSibling : el);
      } else {
        // a root: the box goes inside its own element (the line belongs to CodeMirror)
        if (after) el.appendChild(input);
        else el.insertBefore(input, el.firstChild);
      }
    });
  }

  function onKey(e: KeyboardEvent): void {
    const t = e.target as Element;
    if (t.closest?.(".blocks-edit")) return;
    const node = renderer.nodeOf(t);
    if (!node) return;
    const mod = e.ctrlKey || e.metaKey;
    const handled = (): void => {
      e.preventDefault();
      e.stopPropagation();
    };
    const k = e.key;
    if (mod && !e.altKey) {
      if (k === "z" || k === "Z") {
        handled();
        if (e.shiftKey) redo(view);
        else undo(view);
      } else if (k === "y") {
        handled();
        redo(view);
      } else if (k === "]" || k === "[") {
        handled();
        siblingBox(node, k === "]");
      }
      return;
    }
    if (e.altKey || e.shiftKey) return;
    if (k === "ArrowDown") {
      handled();
      const n = nextBlock(node);
      if (n) focusSoon(n);
    } else if (k === "ArrowUp") {
      handled();
      const n = prevBlock(node);
      if (n) focusSoon(n);
    } else if (k === "ArrowRight") {
      handled();
      const c = kids(node)[0];
      if (c) focusSoon(c);
    } else if (k === "ArrowLeft") {
      handled();
      if (node.parent && node.parent.kind !== "program") focusSoon(node.parent);
    } else if (k === "Delete" || k === "Backspace") {
      handled();
      ed.removeNode(node);
    } else if (k === "Enter") {
      handled();
      if (node.slots.length === 0) editLeaf(node);
    } else if (k.length === 1 && node.slots.length === 0 && node.value === (ed.options.table.blank ?? "...")) {
      // typing into a hole replaces it
      handled();
      editLeaf(node, k);
    }
  }

  /* ---- clipboard */

  let clip = "";
  const active = (e: Event): BNode | null => {
    const t = e.target as Element | null;
    if (!t || !t.closest || t.closest(".blocks-edit")) return null;
    return renderer.nodeOf(t);
  };
  function onCopy(e: ClipboardEvent, cut: boolean): void {
    const node = active(e);
    if (!node || !node.slot) return;
    clip = ed.copyText(node);
    e.clipboardData?.setData("text/plain", clip);
    e.preventDefault();
    e.stopPropagation();
    if (cut) ed.removeNode(node);
  }
  function onPaste(e: ClipboardEvent): void {
    const node = active(e);
    if (!node) return;
    const text = e.clipboardData?.getData("text/plain") || clip;
    e.preventDefault();
    e.stopPropagation();
    if (!text.trim()) return;
    try {
      ed.pasteText(node, text);
    } catch (err) {
      ed.lastError = (err as Error).message;
    }
  }
  const onCopyEv = (e: Event) => onCopy(e as ClipboardEvent, false);
  const onCutEv = (e: Event) => onCopy(e as ClipboardEvent, true);
  const onPasteEv = (e: Event) => onPaste(e as ClipboardEvent);

  /* ---- drag and drop (pointer events: mouse, finger, pen) */

  type Target = { slot: Slot; index: number } | { blank: BNode };
  interface Drag {
    node: BNode;
    x: number;
    y: number;
    on: boolean;
    target: Target | null;
    mark: Element | null;
  }
  let drag: Drag | null = null;
  let swallowClick = false;
  const doc = dom.ownerDocument;
  const rootsOf = (n: BNode): BNode => {
    let r = n;
    while (r.parent && r.parent.kind !== "program") r = r.parent;
    return r;
  };

  /** what a drop at (x, y) would mean: a gap, a blank, or the top or bottom edge of a top-level block */
  function targetAt(x: number, y: number, node: BNode): { target: Target; mark: Element } | null {
    const el = doc.elementFromPoint(x, y);
    if (!el || !dom.contains(el)) return null;
    const gap = renderer.gapOf(el);
    if (gap) return { target: gap, mark: el.closest(".blocks-gap") as Element };
    const hit = renderer.nodeOf(el);
    if (!hit) return null;
    if (ed.isBlank(hit) && hit !== node) return { target: { blank: hit }, mark: renderer.element(hit) };
    const root = rootsOf(hit);
    if (root !== node && root.parent && root.slot) {
      const r = renderer.element(root).getBoundingClientRect();
      const i = root.slot.nodes.indexOf(root);
      if (r.height > 0 && y < r.top + r.height * 0.3) return { target: { slot: root.slot, index: i }, mark: renderer.element(root) };
      if (r.height > 0 && y > r.bottom - r.height * 0.3) return { target: { slot: root.slot, index: i + 1 }, mark: renderer.element(root) };
    }
    return null;
  }
  function clearDrag(): void {
    if (drag) {
      drag.mark?.classList.remove("blocks-drop-target");
      if (renderer.has(drag.node)) renderer.element(drag.node).classList.remove("blocks-drag-source");
    }
    dom.classList.remove("blocks-dragging");
    drag = null;
    doc.removeEventListener("pointermove", onMove, true);
    doc.removeEventListener("pointerup", onUp, true);
    doc.removeEventListener("pointercancel", onCancel, true);
  }
  function onDown(e: PointerEvent): void {
    if (e.button !== 0 || (e.target as Element).closest?.(".blocks-edit")) return;
    const node = renderer.nodeOf(e.target as Element);
    if (!node || !node.slot || renderer.gapOf(e.target as Element)) return;
    drag = { node, x: e.clientX, y: e.clientY, on: false, target: null, mark: null };
    doc.addEventListener("pointermove", onMove, true);
    doc.addEventListener("pointerup", onUp, true);
    doc.addEventListener("pointercancel", onCancel, true);
  }
  function onMove(e: PointerEvent): void {
    if (!drag) return;
    if (!drag.on) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 5) return;
      drag.on = true;
      dom.classList.add("blocks-dragging");
      renderer.element(drag.node).classList.add("blocks-drag-source");
    }
    e.preventDefault();
    const hit = targetAt(e.clientX, e.clientY, drag.node);
    if (hit?.mark !== drag.mark) {
      drag.mark?.classList.remove("blocks-drop-target");
      hit?.mark.classList.add("blocks-drop-target");
    }
    drag.target = hit?.target ?? null;
    drag.mark = hit?.mark ?? null;
  }
  function onUp(e: PointerEvent): void {
    if (!drag) return;
    const d = drag;
    if (d.on) {
      const hit = targetAt(e.clientX, e.clientY, d.node);
      swallowClick = true;
      setTimeout(() => (swallowClick = false), 0);
      clearDrag();
      if (hit) {
        try {
          ed.moveNode(d.node, hit.target);
        } catch (err) {
          ed.lastError = (err as Error).message;
        }
      }
    } else clearDrag();
  }
  function onCancel(): void {
    clearDrag();
  }

  function onClick(e: MouseEvent): void {
    if (swallowClick) {
      swallowClick = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const t = e.target as Element;
    if (t.closest?.(".blocks-edit")) return;
    const gap = renderer.gapOf(t);
    if (gap) {
      const owner = gap.slot.owner;
      const gapEl = t.closest(".blocks-gap") as HTMLElement;
      insertBox(gap.slot, gap.index, owner, (input) => gapEl.parentElement?.insertBefore(input, gapEl));
      return;
    }
    const node = renderer.nodeOf(t);
    if (node) ed.focusNode(node);
  }

  dom.addEventListener("keydown", onKey, true);
  dom.addEventListener("click", onClick, true);
  dom.addEventListener("copy", onCopyEv, true);
  dom.addEventListener("cut", onCutEv, true);
  dom.addEventListener("paste", onPasteEv, true);
  dom.addEventListener("pointerdown", onDown as EventListener, true);
  return {
    edit: editLeaf,
    detach() {
      open?.cancel();
      dom.removeEventListener("keydown", onKey, true);
      dom.removeEventListener("click", onClick, true);
      dom.removeEventListener("copy", onCopyEv, true);
      dom.removeEventListener("cut", onCutEv, true);
      dom.removeEventListener("paste", onPasteEv, true);
      dom.removeEventListener("pointerdown", onDown as EventListener, true);
      clearDrag();
    },
  };
}
