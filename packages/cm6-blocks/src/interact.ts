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
 *   Space                 select / unselect the block (aria-selected); Escape, Ctrl-Escape or Alt-Q clear the selection;
 *                         Delete, cut, copy and a drag then use the selected blocks (none selected: the focused one)
 *   Cmd-Enter (Mac) / Ctrl-Enter (elsewhere)   edit the whole block as text in a box (Enter commits, Shift-Enter is a newline,
 *                         Escape cancels); text that does not parse is accepted
 *   Shift-Ctrl-]          edit the comment of the block (a comment block directly above it or after it on its line; none: written above)
 *   Home / End            first / last block;  Shift-,  jump to the root;  \  read the ancestors;  Shift-\  read the children
 * Mouse: click a block to focus it (a click on a literal opens its edit box, as in the old editor; a touch needs a second tap); click a gap to open the box for a new sibling there; drag a block (pointer events,
 * so a finger or a pen too) onto a gap, a blank, or the top or bottom edge of a top-level block to move it.
 * Text that does not parse cleanly is accepted: the root then shows as text.
 */
import { redo, undo } from "@codemirror/commands";
import { EditorView } from "@codemirror/view";
import type { LezerBlockEditor } from "./lezer-view";
import { plainComment } from "./render";
import type { BNode, Slot } from "./types";

const kids = (n: BNode): BNode[] => n.slots.flatMap((s) => s.nodes);
const drawable = (n: BNode): boolean => n.kind !== "error" && n.kind !== "program";
/** the platform of the old editor's key map: Cmd-Enter on a Mac, Ctrl-Enter elsewhere */
const isMac = (): boolean => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || "");

export function lastBlock(roots: BNode[], closed: (n: BNode) => boolean = () => false): BNode | null {
  let n: BNode | null = [...roots].reverse().find(drawable) ?? null;
  for (let k = n && !closed(n) ? kids(n) : []; k.length; k = closed(n) ? [] : kids(n)) n = k[k.length - 1];
  return n;
}

export function nextBlock(n: BNode, closed: (n: BNode) => boolean = () => false): BNode | null {
  let c: BNode | null = n;
  while (c) {
    const k: BNode[] = closed(c) ? [] : kids(c);
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

export function prevBlock(n: BNode, closed: (n: BNode) => boolean = () => false): BNode | null {
  let c: BNode | null = n;
  while (c) {
    const p: BNode | null = c.parent;
    if (!p) return null;
    const sibs = kids(p);
    const i = sibs.indexOf(c);
    let r: BNode | null;
    if (i > 0) {
      r = sibs[i - 1];
      for (let k = closed(r) ? [] : kids(r); k.length; k = closed(r) ? [] : kids(r)) r = k[k.length - 1];
    } else r = p;
    c = r;
    if (c && c.kind === "program") return null;
    if (c && drawable(c)) return c;
  }
  return null;
}

type Field = HTMLInputElement | HTMLTextAreaElement;

export function attachInteraction(ed: LezerBlockEditor): { detach(): void; edit(node: BNode, typed?: string): void } {
  const { view, renderer } = ed;
  const dom = view.dom;
  let open: { cancel(): void } | null = null;
  const isClosed = (n: BNode): boolean => renderer.isCollapsed(n);

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

  /** a text box, placed by `put`; Enter or blur calls `commit(text)` (an empty text on blur does not), Escape or Alt-Q cancels */
  function box(initial: string, put: (input: Field) => void, done: () => void, commit: (text: string) => void, select = true, multiline = false): void {
    open?.cancel();
    ed.clearSelection(); // (the old editor clears the selection when a box opens)
    const input = multiline ? dom.ownerDocument.createElement("textarea") : dom.ownerDocument.createElement("input");
    input.className = multiline ? "blocks-edit blocks-edit-all" : "blocks-edit";
    input.value = initial;
    const fit = () => {
      if (input instanceof HTMLTextAreaElement) {
        const lines = input.value.split("\n");
        input.rows = lines.length;
        input.cols = Math.max(2, ...lines.map((l) => l.length + 1));
      } else input.size = Math.max(2, input.value.length + 1);
    };
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
    input.addEventListener("keydown", ((e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Enter" && !(multiline && e.shiftKey)) {
        e.preventDefault();
        const t = input.value;
        finish();
        commit(t);
      } else if (e.key === "Escape" || (e.altKey && e.code === "KeyQ")) {
        e.preventDefault();
        finish();
      }
    }) as EventListener);
    // (blur commits, as in the old editor, unless the text is empty: that cancels. Focus goes where the click put it)
    input.addEventListener("blur", (e) => {
      if (finished) return;
      const t = input.value;
      const to = (e as FocusEvent).relatedTarget as HTMLElement | null;
      finish();
      if (t.trim() !== "") commit(t);
      if (to && to.isConnected && to.focus) to.focus();
    });
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
      if (text) text.classList.remove("blocks-text-hidden");
      ed.focusNode(node);
    };
    ed.say(`editing ${typed ?? node.value ?? ""}.  Use Enter to save, and Alt-Q to cancel`);
    box(
      typed ?? (node.kind === "blank" ? "" : node.value ?? ""),
      (input) => {
        if (text) {
          text.classList.add("blocks-text-hidden");
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

  /** Cmd-Enter / Ctrl-Enter: the whole text of the block in a box (a textarea sized to it); Enter commits, Shift-Enter is a newline */
  function editAll(node: BNode): void {
    ed.focusNode(node);
    const el = renderer.element(node);
    if (!el.isConnected) return;
    const initial = ed.copyText(node);
    const line = view.state.doc.lineAt(node.from);
    const indent = (line.text.slice(0, node.from - line.from).match(/^[ \t]*/) as RegExpMatchArray)[0];
    ed.say(`editing ${ed.language.describe(node)}.  Use Enter to save, and Alt-Q to cancel`);
    box(
      initial,
      (field) => {
        el.classList.add("blocks-editing");
        field.setAttribute("aria-label", `editing ${ed.language.describe(node)}`);
        el.appendChild(field);
      },
      () => {
        el.classList.remove("blocks-editing");
        ed.focusNode(node);
      },
      (t) => {
        const v = t.replace(/\r\n?/g, "\n").replace(/\s+$/, "");
        if (v.trim() === "" || v === initial) return;
        // (a Python statement's range ends with its newline: the text typed does not, so what the old range ended with stays)
        const tail = (view.state.doc.sliceString(node.from, node.to).match(/\s*$/) as RegExpMatchArray)[0];
        try {
          ed.replaceText(node, v.replace(/\n/g, "\n" + indent) + tail);
        } catch (err) {
          ed.lastError = (err as Error).message;
        }
      },
      false,
      true
    );
  }

  /** Shift-Ctrl-]: a box for the comment of a block (the old editor's "Edit Comment") */
  function editComment(node: BNode): void {
    if (node.kind === "comment") {
      ed.say("Press Enter to edit a comment block");
      beep();
      return;
    }
    const host = ed.commentHost(node);
    if (renderer.isCollapsed(host)) ed.collapse(host, false);
    const c = ed.commentOf(host);
    const raw = c ? view.state.doc.sliceString(c.from, c.to) : "";
    const words = c ? plainComment(raw) : "";
    ed.say(c ? `editing comment: ${words}.  Use Enter to save, and Alt-Q to cancel` : "adding a comment.  Use Enter to save, and Alt-Q to cancel");
    box(
      words,
      (input) => renderer.element(host).insertBefore(input, renderer.element(host).firstChild),
      () => ed.focusNode(host),
      (t) => {
        try {
          ed.setComment(host, t);
        } catch (err) {
          ed.lastError = (err as Error).message;
        }
      }
    );
  }

  /** a box for a new element at `index` of `slot`, shown by `put`; focus goes to `anchor` first */
  function insertBox(slot: Slot, index: number, anchor: BNode, put: (input: Field) => void): void {
    ed.say("inserting.  Use Enter to save, and Alt-Q to cancel");
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
    if (!slot || slot.kind !== "list" || slot.pieces) return;
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
    if (k === "Escape" || (e.altKey && !mod && e.code === "KeyQ")) {
      handled();
      ed.clearSelection();
      return;
    }
    if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && (e.code === "BracketRight" || k === "}" || k === "]")) {
      handled();
      editComment(node);
      return;
    }
    if (!mod && e.shiftKey && (k === "ArrowLeft" || k === "ArrowRight")) {
      // collapse / expand: all blocks (Shift), or the current root (Shift-Alt); focus goes to the root
      handled();
      const root = rootsOf(node);
      if (e.altKey) ed.collapseRoot(root, k === "ArrowLeft");
      else ed.collapseAll(k === "ArrowLeft");
      focusSoon(root);
      return;
    }
    if (mod && !e.altKey) {
      if (k === "v" || k === "V") pasteBefore = e.shiftKey; // the paste event that follows is a paste before
      if (k === "Enter" && (isMac() ? e.metaKey && !e.ctrlKey : e.ctrlKey)) {
        handled();
        editAll(node);
      } else if (k === "z" || k === "Z") {
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
    if (e.altKey) return;
    if (e.shiftKey) {
      if (k === "<" || k === ",") {
        handled();
        const r = rootsOf(node);
        if (r !== node) focusSoon(r);
      } else if (k === "|" || k === "\\") {
        handled();
        const c = kids(node).map((n) => ed.language.describe(n));
        ed.say(c.length ? c.join(", ") : "no children");
      }
      return;
    }
    if (k === " ") {
      handled();
      if (ed.toggleSelect(node) === "refused") beep();
    } else if (k === "\\") {
      handled();
      const parts = [ed.language.describe(node)];
      for (let p = node.parent; p && p.kind !== "program"; p = p.parent) parts.push(ed.language.describe(p) + ", at level " + level(p));
      if (parts.length > 1) ed.say(parts.join(", inside "));
      else beep();
    } else if (k === "Home") {
      handled();
      const f = ed.roots().find(drawable);
      if (f) focusSoon(f);
    } else if (k === "End") {
      handled();
      const l = lastBlock(ed.roots(), isClosed);
      if (l) focusSoon(l);
    } else if (k === "ArrowDown") {
      handled();
      const n = nextBlock(node, isClosed);
      if (n) focusSoon(n);
    } else if (k === "ArrowUp") {
      handled();
      const n = prevBlock(node, isClosed);
      if (n) focusSoon(n);
    } else if (k === "ArrowRight") {
      handled();
      if (renderer.isCollapsed(node)) ed.collapse(node, false);
      else {
        const c = kids(node)[0];
        if (c) focusSoon(c);
      }
    } else if (k === "ArrowLeft") {
      handled();
      if (node.slots.length > 0 && !renderer.isCollapsed(node)) ed.collapse(node, true);
      else if (node.parent && node.parent.kind !== "program") focusSoon(node.parent);
    } else if (k === "Delete" || k === "Backspace") {
      handled();
      const sel = ed.selectedBlocks();
      if (sel.length) {
        ed.say("deleted " + sel.map((n) => ed.language.describe(n)).join(" and "));
        ed.clearSelection();
        ed.removeNodes(sel);
      } else {
        // (the old editor: "Nothing selected", and nothing is deleted; Cut and Copy do take the focused block)
        ed.say("Nothing selected");
        beep();
      }
    } else if (k === "Enter") {
      handled();
      if (node.slots.length === 0) editLeaf(node);
      else ed.collapse(node, !renderer.isCollapsed(node)); // (the old editor: Enter on a compound block collapses or expands it)
    } else if (k.length === 1 && node.slots.length === 0 && node.value === (ed.options.table.blank ?? "...")) {
      // typing into a hole replaces it
      handled();
      editLeaf(node, k);
    }
  }

  /** a short sound is the old editor's way to say "no": here, only the words said already */
  const beep = (): void => undefined;
  let pasteBefore = false;
  const level = (n: BNode): number => {
    let c = 0;
    for (let p: BNode | null = n; p && p.kind !== "program"; p = p.parent) c++;
    return c;
  };

  /* ---- clipboard */

  let clip = "";
  let clipItems: string[] = [];
  const active = (e: Event): BNode | null => {
    const t = e.target as Element | null;
    if (!t || !t.closest || t.closest(".blocks-edit")) return null;
    return renderer.nodeOf(t);
  };
  /** the selected blocks, else the focused one: what copy and cut take (in document order) */
  const takes = (node: BNode): BNode[] => {
    const sel = ed.selectedBlocks();
    return sel.length ? sel : node.slot ? [node] : [];
  };
  function onCopy(e: ClipboardEvent, cut: boolean): void {
    const node = active(e);
    if (!node) return;
    const nodes = takes(node);
    if (!nodes.length) return;
    clipItems = ed.copyTexts(nodes);
    clip = clipItems.join("\n");
    e.clipboardData?.setData("text/plain", clip);
    e.preventDefault();
    e.stopPropagation();
    ed.say((cut ? "cut " : "copied ") + nodes.map((n) => ed.language.describe(n)).join(" and "));
    if (cut) {
      ed.clearSelection();
      ed.removeNodes(nodes, true);
    }
  }
  function onPaste(e: ClipboardEvent): void {
    const node = active(e);
    if (!node) return;
    const text = e.clipboardData?.getData("text/plain") || clip;
    e.preventDefault();
    e.stopPropagation();
    if (!text.trim()) return;
    const before = pasteBefore;
    pasteBefore = false;
    try {
      // several blocks were copied and the clipboard still holds them: they go in as separate elements
      if (clipItems.length > 1 && text === clip) ed.pasteTexts(node, clipItems, before);
      else ed.pasteText(node, text, before);
      ed.clearSelection();
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
    /** what moves: the selected blocks when the dragged one is selected, else just it */
    group: BNode[];
    x: number;
    y: number;
    on: boolean;
    target: Target | null;
    mark: Element | null;
    /** a finger: the drag starts after a long press (a quick swipe scrolls the page) */
    touch: boolean;
    timer: ReturnType<typeof setTimeout> | null;
  }
  const LONG_PRESS_MS = 350;
  let pressedFocused = false;
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
    if (gap && gap.slot.pieces) return null;
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
  /** a finger that is dragging must not scroll the page (this is only reached after a long press, before any movement) */
  const noScroll = (e: Event): void => {
    if (e.cancelable) e.preventDefault();
  };
  function begin(d: Drag): void {
    d.on = true;
    dom.classList.add("blocks-dragging");
    for (const g of d.group) if (renderer.has(g)) renderer.element(g).classList.add("blocks-drag-source");
    if (d.touch) {
      doc.addEventListener("touchmove", noScroll, { passive: false, capture: true });
      doc.addEventListener("contextmenu", noScroll, true);
    }
  }
  function clearDrag(): void {
    if (drag?.timer) clearTimeout(drag.timer);
    doc.removeEventListener("touchmove", noScroll, true);
    doc.removeEventListener("contextmenu", noScroll, true);
    if (drag) {
      drag.mark?.classList.remove("blocks-drop-target");
      for (const g of drag.group) if (renderer.has(g)) renderer.element(g).classList.remove("blocks-drag-source");
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
    // (the press focuses the block before the click comes: remember whether it already had the focus)
    pressedFocused = !!node && ed.focusedNode() === node;
    if (!node || !node.slot || renderer.gapOf(e.target as Element)) return;
    const touch = e.pointerType === "touch";
    drag = { touch, timer: null, node, group: renderer.isSelected(node) && ed.selectedBlocks().length ? ed.selectedBlocks() : [node], x: e.clientX, y: e.clientY, on: false, target: null, mark: null };
    doc.addEventListener("pointermove", onMove, true);
    doc.addEventListener("pointerup", onUp, true);
    doc.addEventListener("pointercancel", onCancel, true);
    if (touch) {
      const d = drag;
      d.timer = setTimeout(() => {
        d.timer = null;
        if (drag === d) begin(d);
      }, LONG_PRESS_MS);
    }
  }
  function onMove(e: PointerEvent): void {
    if (!drag) return;
    if (!drag.on) {
      const moved = Math.hypot(e.clientX - drag.x, e.clientY - drag.y);
      if (drag.touch) {
        // a finger that moves before the long press is over is scrolling the page: not a drag
        if (moved > 8) clearDrag();
        return;
      }
      if (moved < 5) return;
      begin(drag);
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
          ed.moveNodes(d.group, hit.target);
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
    if (gap && gap.slot.pieces) return; // (the gaps of a template string hold its text)
    if (gap) {
      const owner = gap.slot.owner;
      const gapEl = t.closest(".blocks-gap") as HTMLElement;
      insertBox(gap.slot, gap.index, owner, (input) => gapEl.parentElement?.insertBefore(input, gapEl));
      return;
    }
    const node = renderer.nodeOf(t);
    if (!node) return;
    // a tap on the block that already has the focus edits it (a finger has no Enter key): a leaf its text, any other block its whole text
    const touch = (e as PointerEvent).pointerType === "touch";
    const again = touch && pressedFocused;
    pressedFocused = false;
    ed.focusNode(node);
    // a click (not a drag: that one is swallowed above; not a touch: that is the second-tap rule below; not the second click of a
    // double click) on a literal opens its edit box, focused or not, as in the old editor (`normallyEditable`); a compound block only gets focus
    if (!touch && node.slots.length === 0 && node.kind !== "program" && e.detail <= 1 && !(e.shiftKey || e.ctrlKey || e.metaKey || e.altKey)) {
      editLeaf(node);
      return;
    }
    if (again && node.kind !== "program") {
      if (node.slots.length === 0) editLeaf(node);
      else editAll(node);
    }
  }

  dom.addEventListener("keydown", onKey, true);
  function onDblClick(e: MouseEvent): void {
    const t = e.target as Element;
    if (t.closest?.(".blocks-edit")) return;
    const node = renderer.nodeOf(t);
    if (!node || node.slots.length === 0) return;
    e.preventDefault();
    ed.collapse(node, !renderer.isCollapsed(node));
  }
  dom.addEventListener("dblclick", onDblClick, true);
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
      dom.removeEventListener("dblclick", onDblClick, true);
      dom.removeEventListener("copy", onCopyEv, true);
      dom.removeEventListener("cut", onCutEv, true);
      dom.removeEventListener("paste", onPasteEv, true);
      dom.removeEventListener("pointerdown", onDown as EventListener, true);
      clearDrag();
    },
  };
}
