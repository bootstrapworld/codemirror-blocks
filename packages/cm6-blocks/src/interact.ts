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
import { Command, commandOf } from "./keys";
import { Help, openHelp } from "./help";
import { createSearch, Search } from "./search";
import type { BNode, Slot } from "./types";
import type { SoundEvent } from "./sound";

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

export function attachInteraction(ed: LezerBlockEditor): { detach(): void; edit(node: BNode, typed?: string): void; beginTemplateDrag(e: PointerEvent, name: string): void; search: Search } {
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

  const search = createSearch(ed, { focus: focusSoon, host: () => view.dom.parentElement ?? view.dom });

  /** a text box, placed by `put`; Enter or blur calls `commit(text)` (an empty text on blur does not), Escape or Alt-Q cancels */
  type Log = { action: string; target: BNode | null };
  function box(log: Log, initial: string, put: (input: Field) => void, done: () => void, commit: (text: string) => void, select = true, multiline = false): void {
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
        ed.act(log.action, log.target, { how: "enter", text: t }, () => commit(t));
      } else if (e.key === "Escape" || (e.altKey && e.code === "KeyQ")) {
        e.preventDefault();
        ed.act(log.action + "Cancel", log.target, {}, finish);
      }
    }) as EventListener);
    // (blur commits, as in the old editor, unless the text is empty: that cancels. Focus goes where the click put it)
    input.addEventListener("blur", (e) => {
      if (finished) return;
      const t = input.value;
      const to = (e as FocusEvent).relatedTarget as HTMLElement | null;
      finish();
      if (t.trim() !== "") ed.act(log.action, log.target, { how: "blur", text: t }, () => commit(t));
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
      { action: "edit", target: node },
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
        else {
          ed.replaceText(node, t);
          ed.say(`changed ${t}`);
        }
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
      { action: "editAll", target: node },
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
          ed.say(`changed ${v.replace(/\s+/g, " ")}`);
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
      beep("comment-of-comment");
      return;
    }
    const host = ed.commentHost(node);
    if (renderer.isCollapsed(host)) ed.collapse(host, false);
    const c = ed.commentOf(host);
    const raw = c ? view.state.doc.sliceString(c.from, c.to) : "";
    const words = c ? plainComment(raw) : "";
    ed.say(c ? `editing comment: ${words}.  Use Enter to save, and Alt-Q to cancel` : "adding a comment.  Use Enter to save, and Alt-Q to cancel");
    box(
      { action: "comment", target: host },
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
    box({ action: "insert", target: anchor }, "", put, () => ed.focusNode(anchor), (t) => {
      if (t.trim() === "") return;
      try {
        ed.insertText(slot, index, t);
        ed.say(`inserted ${t}`);
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

  type Handler = (node: BNode, e: KeyboardEvent, handled: () => void) => void;
  let help: Help | null = null;
  /** one handler for each command of the key table (keys.ts): a command without one does not compile */
  const run: Record<Command, Handler> = {
    clearSelection: (_n, _e, handled) => {
      handled();
      ed.clearSelection();
    },
    editComment: (n, _e, handled) => {
      handled();
      editComment(n);
    },
    help: (n, _e, handled) => {
      handled();
      if (help) return;
      const back = n;
      help = openHelp(view.dom.parentElement ?? view.dom, isMac(), () => {
        help = null;
        ed.focusNode(back);
      });
    },
    // the old editor's "Shift Focus": the focus goes to the toolbar (Tab from there comes back: the page's toolbar calls `focusEditor`)
    focusToolbar: (_n, _e, handled) => {
      if (!ed.options.focusToolbar) return;
      handled();
      ed.options.focusToolbar();
    },
    // collapse / expand: all blocks, or the current root and what is in it; focus goes to the root
    collapseAll: (n, _e, handled) => {
      handled();
      ed.collapseAll(true);
      focusSoon(rootsOf(n));
    },
    expandAll: (n, _e, handled) => {
      handled();
      ed.collapseAll(false);
      focusSoon(rootsOf(n));
    },
    collapseRoot: (n, _e, handled) => {
      handled();
      // (the old editor: a top-level block that is collapsed already or has nothing in it only beeps)
      if (n.parent && n.parent.kind === "program" && (renderer.isCollapsed(n) || n.slots.length === 0)) return beep("collapse-root");
      ed.collapseRoot(rootsOf(n), true);
      focusSoon(rootsOf(n));
    },
    expandRoot: (n, _e, handled) => {
      handled();
      ed.collapseRoot(rootsOf(n), false);
      focusSoon(rootsOf(n));
    },
    editAll: (n, _e, handled) => {
      handled();
      editAll(n);
    },
    undo: (_n, _e, handled) => {
      handled();
      undo(view);
    },
    redo: (_n, _e, handled) => {
      handled();
      redo(view);
    },
    // (the paste event that follows is a paste before, or after: the browser makes the event)
    pasteBefore: () => {
      pasteBefore = true;
    },
    paste: () => {
      pasteBefore = false;
    },
    copy: () => undefined,
    cut: () => undefined,
    search: (_n, _e, handled) => {
      handled();
      search.open();
    },
    searchNext: (_n, _e, handled) => {
      handled();
      search.next();
    },
    searchPrevious: (_n, _e, handled) => {
      handled();
      search.previous();
    },
    nextSearchType: (_n, _e, handled) => {
      handled();
      search.rotor(true);
    },
    previousSearchType: (_n, _e, handled) => {
      handled();
      search.rotor(false);
    },
    insertBefore: (n, _e, handled) => {
      handled();
      siblingBox(n, false);
    },
    insertAfter: (n, _e, handled) => {
      handled();
      siblingBox(n, true);
    },
    jumpToRoot: (n, _e, handled) => {
      handled();
      const r = rootsOf(n);
      if (r !== n) focusSoon(r);
    },
    readChildren: (n, _e, handled) => {
      handled();
      const c = kids(n).map((k) => ed.language.describe(k));
      ed.say(c.length ? c.join(", ") : "no children");
    },
    toggleSelection: (n, _e, handled) => {
      handled();
      if (ed.toggleSelect(n) === "refused") beep("select-refused");
    },
    readAncestors: (n, _e, handled) => {
      handled();
      const parts = [ed.language.describe(n)];
      for (let p = n.parent; p && p.kind !== "program"; p = p.parent) parts.push(ed.language.describe(p) + ", at level " + level(p));
      if (parts.length > 1) ed.say(parts.join(", inside "));
      else beep("no-ancestors");
    },
    first: (_n, _e, handled) => {
      handled();
      const f = ed.roots().find(drawable);
      if (f) focusSoon(f);
    },
    last: (_n, _e, handled) => {
      handled();
      const l = lastBlock(ed.roots(), isClosed);
      if (l) focusSoon(l);
    },
    next: (n, _e, handled) => {
      handled();
      const x = nextBlock(n, isClosed);
      if (x) focusSoon(x);
      else beep("no-next");
    },
    previous: (n, _e, handled) => {
      handled();
      const x = prevBlock(n, isClosed);
      if (x) focusSoon(x);
      else beep("no-previous");
    },
    expandOrChild: (n, _e, handled) => {
      handled();
      if (renderer.isCollapsed(n)) ed.collapse(n, false);
      else {
        const c = kids(n)[0];
        if (c) focusSoon(c);
        else beep("no-child");
      }
    },
    collapseOrParent: (n, _e, handled) => {
      handled();
      if (n.slots.length > 0 && !renderer.isCollapsed(n)) ed.collapse(n, true);
      else if (n.parent && n.parent.kind !== "program") focusSoon(n.parent);
      else beep("no-parent");
    },
    delete: (_n, _e, handled) => {
      handled();
      const sel = ed.selectedBlocks();
      if (sel.length) {
        ed.say("deleted " + sel.map((x) => ed.language.describe(x)).join(" and "));
        ed.clearSelection();
        ed.removeNodes(sel);
      } else {
        // (the old editor: "Nothing selected", and nothing is deleted; Cut and Copy do take the focused block)
        ed.say("Nothing selected");
        beep("delete-nothing");
      }
    },
    enter: (n, _e, handled) => {
      handled();
      if (n.slots.length === 0) editLeaf(n);
      else ed.collapse(n, !renderer.isCollapsed(n)); // (the old editor: Enter on a compound block collapses or expands it)
    },
    typeIntoHole: (n, e, handled) => {
      if (n.slots.length !== 0 || n.value !== (ed.options.table.blank ?? "...")) return;
      handled();
      editLeaf(n, e.key);
    },
  };

  function onKey(e: KeyboardEvent): void {
    const t = e.target as Element;
    if (t.closest?.(".blocks-edit")) return;
    const node = renderer.nodeOf(t);
    if (!node) return;
    const cmd = commandOf(e, isMac());
    if (!cmd) return;
    // (logged when the key did something; the character that starts a box is not recorded: the box's text is, when it is committed)
    let did = false;
    const mods = [e.ctrlKey && "Ctrl", e.metaKey && "Cmd", e.altKey && "Alt", e.shiftKey && "Shift"].filter(Boolean).join("-");
    ed.act(cmd, node, cmd === "typeIntoHole" ? { mods } : { key: e.key, mods }, () =>
      run[cmd](node, e, () => {
        did = true;
        e.preventDefault();
        e.stopPropagation();
      }), () => !did);
  }

  /** a short sound is the old editor's way to say "no" (sound.ts lists the events) */
  const beep = (event: SoundEvent): void => ed.sound("beep", event);
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
  function onCopy(e: ClipboardEvent, cut: boolean, d: Record<string, unknown>): void {
    const node = active(e);
    if (!node) return;
    const nodes = takes(node);
    if (!nodes.length) return;
    clipItems = ed.copyTexts(nodes);
    clip = clipItems.join("\n");
    d.text = clip; // (the old editor's log keeps what was copied: "CLIP")
    e.clipboardData?.setData("text/plain", clip);
    e.preventDefault();
    e.stopPropagation();
    ed.say((cut ? "cut " : "copied ") + nodes.map((n) => ed.language.describe(n)).join(" and "));
    if (cut) {
      ed.clearSelection();
      ed.removeNodes(nodes, true);
    }
  }
  function onPaste(e: ClipboardEvent, d: Record<string, unknown>): void {
    const node = active(e);
    if (!node) return;
    const text = e.clipboardData?.getData("text/plain") || clip;
    e.preventDefault();
    e.stopPropagation();
    if (!text.trim()) return;
    const before = pasteBefore;
    pasteBefore = false;
    d.text = text;
    d.before = before;
    try {
      // several blocks were copied and the clipboard still holds them: they go in as separate elements
      if (clipItems.length > 1 && text === clip) ed.pasteTexts(node, clipItems, before);
      else ed.pasteText(node, text, before);
      ed.clearSelection();
    } catch (err) {
      ed.lastError = (err as Error).message;
      ed.say(`Cannot paste ${before ? "before" : "after"} this node.`);
      beep("paste-refused");
    }
  }
  const onCopyEv = (e: Event) => {
    const d: Record<string, unknown> = {};
    ed.act("copy", active(e), d, () => onCopy(e as ClipboardEvent, false, d), () => !d.text);
  };
  const onCutEv = (e: Event) => {
    const d: Record<string, unknown> = {};
    ed.act("cut", active(e), d, () => onCopy(e as ClipboardEvent, true, d), () => !d.text);
  };
  const onPasteEv = (e: Event) => {
    const d: Record<string, unknown> = {};
    ed.act("paste", active(e), d, () => onPaste(e as ClipboardEvent, d), () => !d.text);
  };

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
  function targetAt(x: number, y: number, node: BNode | null): { target: Target; mark: Element } | null {
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
  /** where a drop went, for the log: a gap (the slot and index) or a hole (its place) */
  const describeTarget = (t: Target): Record<string, unknown> => ("blank" in t ? { blank: { from: t.blank.from, to: t.blank.to } } : { slot: t.slot.name, owner: { kind: t.slot.owner.kind, from: t.slot.owner.from }, index: t.index });
  /** a drag let go over the editor but not over a place that takes it (the old editor beeps there; let go elsewhere, it does nothing) */
  const overEditor = (e: PointerEvent): boolean => {
    const el = doc.elementFromPoint(e.clientX, e.clientY);
    return !!el && dom.contains(el);
  };
  /* a template dragged out of the toolbar: the same targets (gaps, blanks, the edges of top-level blocks), the same marks; the block is made where it is let go */
  interface TDrag { name: string; x: number; y: number; on: boolean; mark: Element | null; id: number }
  let tdrag: TDrag | null = null;
  function tdone(): void {
    tdrag?.mark?.classList.remove("blocks-drop-target");
    dom.classList.remove("blocks-dragging");
    tdrag = null;
    doc.removeEventListener("pointermove", tMove, true);
    doc.removeEventListener("pointerup", tUp, true);
    doc.removeEventListener("pointercancel", tdone, true);
  }
  function tMove(e: PointerEvent): void {
    const d = tdrag;
    if (!d || e.pointerId !== d.id) return;
    if (!d.on) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) return;
      d.on = true;
      dom.classList.add("blocks-dragging");
    }
    e.preventDefault();
    const hit = targetAt(e.clientX, e.clientY, null);
    if (hit?.mark !== d.mark) {
      d.mark?.classList.remove("blocks-drop-target");
      hit?.mark.classList.add("blocks-drop-target");
    }
    d.mark = hit?.mark ?? null;
  }
  function tUp(e: PointerEvent): void {
    const d = tdrag;
    if (!d || e.pointerId !== d.id) return;
    if (d.on) {
      const hit = targetAt(e.clientX, e.clientY, null);
      // (the click that ends the drag must not press the button)
      const stop = (ev: Event): void => {
        ev.preventDefault();
        ev.stopPropagation();
      };
      doc.addEventListener("click", stop, { capture: true, once: true });
      setTimeout(() => doc.removeEventListener("click", stop, true), 0);
      tdone();
      ed.act("templateDrop", null, { name: d.name, to: hit ? describeTarget(hit.target) : null, touch: e.pointerType === "touch" }, () => {
        if (hit) {
          try {
            ed.insertTemplateAt(d.name, hit.target);
          } catch (err) {
            ed.lastError = (err as Error).message;
            ed.say((err as Error).message);
            beep("drop-refused");
          }
        } else if (overEditor(e)) beep("drop-nowhere");
      });
    } else tdone();
  }
  function beginTemplateDrag(e: PointerEvent, name: string): void {
    if (e.button !== 0) return;
    tdone();
    tdrag = { name, x: e.clientX, y: e.clientY, on: false, mark: null, id: e.pointerId };
    doc.addEventListener("pointermove", tMove, true);
    doc.addEventListener("pointerup", tUp, true);
    doc.addEventListener("pointercancel", tdone, true);
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
      ed.act("drag", d.node, { to: hit ? describeTarget(hit.target) : null, count: d.group.length, touch: d.touch }, () => {
        if (hit) {
          try {
            ed.moveNodes(d.group, hit.target);
          } catch (err) {
            ed.lastError = (err as Error).message;
            beep("drop-refused");
          }
        } else if (overEditor(e)) beep("drop-nowhere");
      });
    } else clearDrag();
  }
  function onCancel(): void {
    clearDrag();
  }

  function onClick(e: MouseEvent): void {
    const t0 = e.target as Element;
    const touch0 = (e as PointerEvent).pointerType === "touch";
    if (swallowClick || t0.closest?.(".blocks-edit")) return clicked(e);
    const g = renderer.gapOf(t0);
    ed.act(g ? "gapClick" : "click", g ? g.slot.owner : renderer.nodeOf(t0), g ? { slot: g.slot.name, index: g.index, touch: touch0 } : { touch: touch0, shift: e.shiftKey, detail: e.detail }, () => clicked(e), () => !g && !renderer.nodeOf(t0));
  }
  function clicked(e: MouseEvent): void {
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
    ed.act("dblclick", node, {}, () => ed.collapse(node, !renderer.isCollapsed(node)));
  }
  dom.addEventListener("dblclick", onDblClick, true);
  dom.addEventListener("click", onClick, true);
  dom.addEventListener("copy", onCopyEv, true);
  dom.addEventListener("cut", onCutEv, true);
  dom.addEventListener("paste", onPasteEv, true);
  dom.addEventListener("pointerdown", onDown as EventListener, true);
  return {
    edit: editLeaf,
    beginTemplateDrag,
    search,
    detach() {
      open?.cancel();
      search.close();
      dom.removeEventListener("keydown", onKey, true);
      dom.removeEventListener("click", onClick, true);
      dom.removeEventListener("dblclick", onDblClick, true);
      dom.removeEventListener("copy", onCopyEv, true);
      dom.removeEventListener("cut", onCutEv, true);
      dom.removeEventListener("paste", onPasteEv, true);
      dom.removeEventListener("pointerdown", onDown as EventListener, true);
      clearDrag();
      tdone();
    },
  };
}
