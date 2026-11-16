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
 * Mouse: click a block to focus it; click a gap to open the box for a new sibling there.
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

  function onClick(e: MouseEvent): void {
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
  return {
    edit: editLeaf,
    detach() {
      open?.cancel();
      dom.removeEventListener("keydown", onKey, true);
      dom.removeEventListener("click", onClick, true);
    },
  };
}
