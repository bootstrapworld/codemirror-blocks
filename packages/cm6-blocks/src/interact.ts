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
 *                         system clipboard works); paste goes after the focused block, replaces a focused blank, or replaces the focused block when it is selected
 *   Space                 select / unselect the block (aria-selected); Escape, Ctrl-Escape or Alt-Q clear the selection;
 *                         Delete, cut, copy and a drag then use the selected blocks (none selected: copy and a drag take the focused one; Delete and cut say "Nothing selected" and beep)
 *   Cmd-Enter (Mac) / Ctrl-Enter (elsewhere)   edit the whole block as text in a box (Enter commits, Shift-Enter is a newline,
 *                         Escape cancels); text that does not parse is refused: the box stays open, red, its title the message
 *   Shift-Ctrl-]          edit the comment of the block (a comment block directly above it or after it on its line; none: written above)
 *   Home / End            first / last block;  Shift-,  jump to the root;  \  read the ancestors;  Shift-\  read the children
 * Mouse: click a block to focus it (a click on a literal opens its edit box, as in the old editor; a touch needs a second tap); click a gap to open the box for a new sibling there; drag a block (pointer events,
 * so a finger or a pen too) onto a gap, a blank, or the top or bottom edge of a top-level block to move it.
 * A box refuses text that does not parse (nothing is written; red outline, the message as the title and aloud); text typed in the document itself may still read as an error root.
 */
import { createAutoScroll } from "./autoscroll";
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
const drawable = (n: BNode): boolean =>
  n.kind !== "error" && n.kind !== "program";
/** the platform of the old editor's key map: Cmd-Enter on a Mac, Ctrl-Enter elsewhere */
const isMac = (): boolean =>
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform || "");

/**
 * The block after (or before) the text cursor, by the old editor's rule (`getNodeAfterCur` / `getNodeBeforeCur` in `ast.ts`).
 * After: the first block that ends after the cursor, if it also starts at or after it; if the cursor is inside it, the same rule
 * among its children, falling back to the block itself. Before: the last block that starts before the cursor, drilled into its
 * last such child (even when the cursor is past its end). Null when there is none.
 */
export function blockNearCursor(
  roots: BNode[],
  cur: number,
  forward: boolean
): BNode | null {
  const loop = (nodes: BNode[], fallback: BNode | null): BNode | null => {
    const ns = nodes.filter(drawable);
    if (forward) {
      const n = ns.find((x) => x.to > cur);
      if (!n) return fallback;
      if (n.from >= cur) return n;
      const k = kids(n).filter(drawable);
      return k.length === 0 ? n : loop(k, n);
    }
    const n = [...ns].reverse().find((x) => x.from < cur);
    if (!n) return fallback;
    const k = kids(n).filter(drawable);
    return k.length === 0 ? n : loop(k, n);
  };
  return loop(roots, null);
}

export function lastBlock(
  roots: BNode[],
  closed: (n: BNode) => boolean = () => false
): BNode | null {
  let n: BNode | null = [...roots].reverse().find(drawable) ?? null;
  for (
    let k = n && !closed(n) ? kids(n) : [];
    k.length;
    k = closed(n) ? [] : kids(n)
  )
    n = k[k.length - 1];
  return n;
}

export function nextBlock(
  n: BNode,
  closed: (n: BNode) => boolean = () => false
): BNode | null {
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

export function prevBlock(
  n: BNode,
  closed: (n: BNode) => boolean = () => false
): BNode | null {
  let c: BNode | null = n;
  while (c) {
    const p: BNode | null = c.parent;
    if (!p) return null;
    const sibs = kids(p);
    const i = sibs.indexOf(c);
    let r: BNode | null;
    if (i > 0) {
      r = sibs[i - 1];
      for (
        let k = closed(r) ? [] : kids(r);
        k.length;
        k = closed(r) ? [] : kids(r)
      )
        r = k[k.length - 1];
    } else r = p;
    c = r;
    if (c && c.kind === "program") return null;
    if (c && drawable(c)) return c;
  }
  return null;
}

type Field = HTMLInputElement | HTMLTextAreaElement;

export function attachInteraction(ed: LezerBlockEditor): {
  detach(): void;
  edit(node: BNode, typed?: string): void;
  beginTemplateDrag(e: PointerEvent, name: string): void;
  search: Search;
} {
  const { view, renderer } = ed;
  const dom = view.dom;
  let open: { cancel(): void; commit(): void } | null = null;
  const isClosed = (n: BNode): boolean => renderer.isCollapsed(n);

  function focusSoon(n: BNode): void {
    ed.focusNode(n);
    if (ed.focusedNode() === n) return;
    // a root that is not drawn yet (outside the viewport): scroll to it, then try again
    view.dispatch({
      effects: EditorView.scrollIntoView(n.from, { y: "center" }),
    });
    const again = (left: number) => () => {
      ed.focusNode(n);
      if (ed.focusedNode() !== n && left > 0) setTimeout(again(left - 1), 30);
    };
    setTimeout(again(5), 0);
  }

  const search = createSearch(ed, {
    focus: focusSoon,
    host: () => view.dom.parentElement ?? view.dom,
  });

  /** a text box, placed by `put`; Enter or blur calls `commit(text)` (an empty text on blur does not), Escape or Alt-Q cancels */
  /** `emptyEnterCommits`: Enter on an empty box commits (the comment box: emptying it removes the comment, a feature of this editor) */
  type Log = {
    action: string;
    target: BNode | null;
    emptyEnterCommits?: boolean;
  };
  function box(
    log: Log,
    initial: string,
    put: (input: Field) => void,
    done: () => void,
    commit: (text: string) => void,
    select = true,
    multiline = false,
    check?: (text: string) => string | null,
    initialError?: string
  ): void {
    open?.cancel();
    ed.clearSelection(); // (the old editor clears the selection when a box opens)
    const input = multiline
      ? dom.ownerDocument.createElement("textarea")
      : dom.ownerDocument.createElement("input");
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
    // a text that does not parse is refused (as in the old editor): nothing is written, the box stays open and red, and its title is
    // the message (also `aria-invalid`, and said aloud). Editing the text again clears it
    // (and shown as a small red line under the box: `blocks-error-message`, aria-hidden since the message is spoken)
    let line: HTMLElement | null = null;
    const clearRefusal = () => {
      line?.remove();
      line = null;
      input.classList.remove("blocks-error");
      input.removeAttribute("title");
      input.removeAttribute("aria-invalid");
    };
    const refuse = (message: string) => {
      input.classList.add("blocks-error");
      input.title = message;
      input.setAttribute("aria-invalid", "true");
      if (!line) {
        line = dom.ownerDocument.createElement("div");
        line.className = "blocks-error-message";
        line.setAttribute("aria-hidden", "true");
        input.insertAdjacentElement("afterend", line);
      }
      line.textContent = message;
      ed.say(message);
    };
    input.addEventListener("input", () => {
      fit();
      clearRefusal();
    });
    let finished = false;
    const finish = (): void => {
      if (finished) return;
      finished = true;
      open = null;
      line?.remove();
      input.remove();
      done();
    };
    // (commit: what a drag does to an open box: what was typed is written first, as when the box loses focus)
    const self = {
      cancel: finish,
      commit: () => input.dispatchEvent(new FocusEvent("blur")),
    };
    input.addEventListener("keydown", ((e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Enter" && !(multiline && e.shiftKey)) {
        e.preventDefault();
        const t = input.value;
        const message = t.trim() === "" ? null : (check?.(t) ?? null);
        if (message) {
          refuse(message);
          return;
        }
        finish();
        // an emptied box does nothing, as in the old editor (`NodeEditable`: "no insertion value": the box closes, the block stays) and as
        // the blur below: the same for a leaf's box, the Cmd/Ctrl-Enter box and an insertion box (the comment box keeps its own rule: see `emptyEnterCommits`)
        if (t.trim() === "" && !log.emptyEnterCommits)
          ed.act(
            log.action + "Cancel",
            log.target,
            { how: "enter-empty" },
            () => {}
          );
        else
          ed.act(log.action, log.target, { how: "enter", text: t }, () =>
            commit(t)
          );
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
      const message = t.trim() === "" ? null : (check?.(t) ?? null);
      if (message) {
        refuse(message);
        queueMicrotask(() => {
          if (!finished && input.isConnected) input.focus();
        });
        return;
      }
      finish();
      if (t.trim() !== "")
        ed.act(log.action, log.target, { how: "blur", text: t }, () =>
          commit(t)
        );
      if (to && to.isConnected && to.focus) to.focus();
    });
    put(input);
    open = self;
    input.focus();
    if (select) input.select();
    else input.setSelectionRange(input.value.length, input.value.length);
    if (initialError) refuse(initialError);
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
    ed.say(
      `editing ${typed ?? node.value ?? ""}.  Use Enter to save, and Alt-Q to cancel`
    );
    box(
      { action: "edit", target: node },
      typed ?? (node.kind === "blank" ? "" : (node.value ?? "")),
      (input) => {
        if (text) {
          text.classList.add("blocks-text-hidden");
          el.insertBefore(input, text);
        } else el.appendChild(input);
      },
      back,
      (t) => {
        if (t === (node.value ?? "")) return;
        ed.replaceText(node, t);
        ed.say(`changed ${t}`);
      },
      typed === undefined,
      false,
      (t) => (t === (node.value ?? "") ? null : ed.refuseReplace(node, t))
    );
  }

  /** Cmd-Enter / Ctrl-Enter: the whole text of the block in a box (a textarea sized to it); Enter commits, Shift-Enter is a newline */
  function editAll(
    node: BNode,
    pasted?: { text: string; message: string }
  ): void {
    ed.focusNode(node);
    const el = renderer.element(node);
    if (!el.isConnected) return;
    const initial = ed.copyText(node);
    const line = view.state.doc.lineAt(node.from);
    const indent = (
      line.text
        .slice(0, node.from - line.from)
        .match(/^[ \t]*/) as RegExpMatchArray
    )[0];
    ed.say(
      `editing ${ed.language.describe(node)}.  Use Enter to save, and Alt-Q to cancel`
    );
    // the text to write for what was typed (null: nothing to change)
    const allText = (t: string) => {
      const v = t.replace(/\r\n?/g, "\n").replace(/\s+$/, "");
      if (v.trim() === "" || v === initial) return null;
      // (a Python statement's range ends with its newline: the text typed does not, so what the old range ended with stays)
      const tail = (
        view.state.doc
          .sliceString(node.from, node.to)
          .match(/\s*$/) as RegExpMatchArray
      )[0];
      return { v, snippet: v.replace(/\n/g, "\n" + indent) + tail };
    };
    box(
      { action: "editAll", target: node },
      pasted?.text ?? initial,
      (field) => {
        el.classList.add("blocks-editing");
        field.setAttribute(
          "aria-label",
          `editing ${ed.language.describe(node)}`
        );
        el.appendChild(field);
      },
      () => {
        el.classList.remove("blocks-editing");
        ed.focusNode(node);
      },
      (t) => {
        const r = allText(t);
        if (!r) return;
        try {
          ed.replaceText(node, r.snippet);
          ed.say(`changed ${r.v.replace(/\s+/g, " ")}`);
        } catch (err) {
          ed.lastError = (err as Error).message;
        }
      },
      false,
      true,
      (t) => {
        const r = allText(t);
        return r ? ed.refuseReplace(node, r.snippet) : null;
      },
      pasted?.message
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
    ed.say(
      c
        ? `editing comment: ${words}.  Use Enter to save, and Alt-Q to cancel`
        : "adding a comment.  Use Enter to save, and Alt-Q to cancel"
    );
    box(
      { action: "comment", target: host, emptyEnterCommits: true },
      words,
      (input) =>
        renderer
          .element(host)
          .insertBefore(input, renderer.element(host).firstChild),
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
  function insertBox(
    slot: Slot,
    index: number,
    anchor: BNode,
    put: (input: Field) => void,
    pasted?: { text: string; message: string }
  ): void {
    ed.say("inserting.  Use Enter to save, and Alt-Q to cancel");
    box(
      { action: "insert", target: anchor },
      pasted?.text ?? "",
      put,
      () => ed.focusNode(anchor),
      (t) => {
        if (t.trim() === "") return;
        try {
          const had = slot.nodes.length;
          ed.insertText(slot, index, t);
          // focus goes to the block that was inserted, as in the old editor (its edit's focus hint), so that a redo comes back to it too
          const made = slot.nodes.length > had ? slot.nodes[index] : null;
          if (made && made.kind !== "error") ed.focusNode(made);
          ed.say(`inserted ${t}`);
        } catch (e) {
          ed.lastError = (e as Error).message;
        }
      },
      !pasted,
      pasted?.text.includes("\n") ?? false,
      (t) => (t.trim() === "" ? null : ed.refuseInsert(slot, index, t)),
      pasted?.message
    );
  }

  function siblingBox(
    node: BNode,
    after: boolean,
    pasted?: { text: string; message: string }
  ): void {
    const slot = node.slot;
    if (!slot || slot.kind !== "list" || slot.pieces) return;
    const i = slot.nodes.indexOf(node);
    const el = renderer.element(node);
    // as in the old editor, Insert Left / Right also put the text cursor at the block's start / end
    ed.view.dispatch({
      selection: { anchor: after ? node.to : node.from },
    });
    insertBox(
      slot,
      after ? i + 1 : i,
      node,
      (input) => {
        if (node.parent && node.parent.kind !== "program" && el.parentElement) {
          el.parentElement.insertBefore(input, after ? el.nextSibling : el);
        } else {
          // a root: the box goes inside its own element (the line belongs to CodeMirror)
          if (after) el.appendChild(input);
          else el.insertBefore(input, el.firstChild);
        }
      },
      pasted
    );
  }

  /**
   * Top level typing (the old editor's "quarantine"): text typed or pasted where no block is goes into a box at that place, and is
   * written, as one change, when it parses (Enter, or blur); text that does not parse is refused, as in any box. Escape discards it.
   */
  function pendingBox(
    from: number,
    to: number,
    text: string,
    message?: string
  ): void {
    const slot = ed.doc.program.slots[0];
    let at = from;
    const indexAt = (pos: number) =>
      slot.nodes.filter((r) => r.to <= pos).length;
    ed.say("inserting.  Use Enter to save, and Alt-Q to cancel");
    const host = ed.pendingHost(from);
    box(
      { action: "insert", target: null },
      text,
      (input) => host.appendChild(input),
      () => {
        at = ed.pendingAt() ?? at;
        ed.clearPending();
        // (a block takes focus, as when the old editor's quarantine closes; an editor with none keeps it itself)
        ed.focusEditor();
        if (!ed.focusedNode()) view.focus();
      },
      (t) => {
        try {
          const index = indexAt(at);
          const had = slot.nodes.length;
          ed.insertText(slot, index, t);
          const made = slot.nodes.length > had ? slot.nodes[index] : null;
          if (made && made.kind !== "error") ed.focusNode(made);
          ed.say(`inserted ${t}`);
        } catch (e) {
          ed.lastError = (e as Error).message;
        }
      },
      false,
      text.includes("\n"),
      (t) =>
        t.trim() === ""
          ? null
          : ed.refuseInsert(slot, indexAt(ed.pendingAt() ?? at), t),
      message
    );
    void to;
  }
  ed.topLevelInput = (from, to, text, how) => {
    if (!ed.isBlockMode()) return;
    if (how === "paste" && text.trim() !== "") {
      // a paste that parses is committed at once (one undo step) and drawn; one that does not is shown in the box, red, with the message
      const slot = ed.doc.program.slots[0];
      const index = slot.nodes.filter((r) => r.to <= from).length;
      const message = ed.refuseInsert(slot, index, text);
      if (!message) {
        try {
          const had = slot.nodes.length;
          ed.insertText(slot, index, text);
          const made = slot.nodes.length > had ? slot.nodes[index] : null;
          if (made && made.kind !== "error") ed.focusNode(made);
          ed.say(`inserted ${text}`);
          return;
        } catch (e) {
          ed.lastError = (e as Error).message;
        }
      }
      return pendingBox(from, to, text, message ?? undefined);
    }
    pendingBox(from, to, text);
  };

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
      if (
        n.parent &&
        n.parent.kind === "program" &&
        (renderer.isCollapsed(n) || n.slots.length === 0)
      )
        return beep("collapse-root");
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
      for (let p = n.parent; p && p.kind !== "program"; p = p.parent)
        parts.push(ed.language.describe(p) + ", at level " + level(p));
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
        ed.say(
          "deleted " + sel.map((x) => ed.language.describe(x)).join(" and ")
        );
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
      if (n.slots.length !== 0 || n.value !== (ed.options.table.blank ?? "..."))
        return;
      handled();
      editLeaf(n, e.key);
    },
  };

  function onKey(e: KeyboardEvent): void {
    const t = e.target as Element;
    if (t.closest?.(".blocks-edit")) return;
    const node = renderer.nodeOf(t);
    if (!node) {
      // no block has the focus, the text does: Down and Up activate the block after / before the cursor, as in the old editor
      // (in block mode; it keeps the key from moving the text cursor, as there, and beeps when there is no such block)
      if (
        ed.isBlockMode() &&
        view.contentDOM.contains(t) &&
        commandOf(e, isMac()) === "editAll"
      ) {
        // Ctrl/Cmd-Enter has no block to edit: the old editor's handler returns and its CodeMirror 5 has no binding for the key, so nothing
        // happens; CodeMirror 6's own `Mod-Enter` (insert a blank line) must not (Ctrl/Cmd-X is the same in both: the native cut, of the line)
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      // the search keys work from the text too (the old handlers do not need a block: `goToMatch` goes "from the focused block, or else from
      // the cursor"; the rotor and the dialog need nothing)
      const textCmd =
        ed.isBlockMode() && view.contentDOM.contains(t)
          ? commandOf(e, isMac())
          : null;
      if (
        textCmd === "search" ||
        textCmd === "searchNext" ||
        textCmd === "searchPrevious" ||
        textCmd === "nextSearchType" ||
        textCmd === "previousSearchType"
      ) {
        e.preventDefault();
        e.stopPropagation();
        const at = view.state.selection.main.head;
        if (textCmd === "search") search.open(at);
        else if (textCmd === "searchNext") search.next(at);
        else if (textCmd === "searchPrevious") search.previous(at);
        else search.rotor(textCmd === "nextSearchType");
        return;
      }
      if (
        !ed.isBlockMode() ||
        !view.contentDOM.contains(t) ||
        (e.key !== "ArrowDown" && e.key !== "ArrowUp")
      )
        return;
      if (
        commandOf(e, isMac()) !== (e.key === "ArrowDown" ? "next" : "previous")
      )
        return;
      const forward = e.key === "ArrowDown";
      const found = blockNearCursor(
        ed.roots(),
        view.state.selection.main.head,
        forward
      );
      ed.act(
        forward ? "next" : "previous",
        found,
        { key: e.key, mods: "", fromCursor: true },
        () => {
          e.preventDefault();
          e.stopPropagation();
          if (found) focusSoon(found);
          else beep(forward ? "no-next" : "no-previous");
        }
      );
      return;
    }
    const cmd = commandOf(e, isMac());
    if (!cmd) return;
    // (logged when the key did something; the character that starts a box is not recorded: the box's text is, when it is committed)
    let did = false;
    const mods = [
      e.ctrlKey && "Ctrl",
      e.metaKey && "Cmd",
      e.altKey && "Alt",
      e.shiftKey && "Shift",
    ]
      .filter(Boolean)
      .join("-");
    ed.act(
      cmd,
      node,
      cmd === "typeIntoHole" ? { mods } : { key: e.key, mods },
      () =>
        run[cmd](node, e, () => {
          did = true;
          e.preventDefault();
          e.stopPropagation();
        }),
      () => !did
    );
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
  function onCopy(
    e: ClipboardEvent,
    cut: boolean,
    d: Record<string, unknown>
  ): void {
    const node = active(e);
    if (!node) return;
    if (cut && !ed.selectedBlocks().length) {
      // CHANGED from the old editor, which says "Nothing selected" without a sound (thirteenth round, the owner): cut takes only the
      // selected blocks, and with none it says so, beeps, and does nothing (the clipboard and the text stay as they are, no history entry)
      e.preventDefault();
      e.stopPropagation();
      ed.say("Nothing selected");
      beep("cut-nothing");
      return;
    }
    const nodes = takes(node);
    if (!nodes.length) return;
    clipItems = ed.copyTexts(nodes);
    clip = clipItems.join("\n");
    d.text = clip; // (the old editor's log keeps what was copied: "CLIP")
    e.clipboardData?.setData("text/plain", clip);
    e.preventDefault();
    e.stopPropagation();
    ed.say(
      (cut ? "cut " : "copied ") +
        nodes.map((n) => ed.language.describe(n)).join(" and ")
    );
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
    // text that does not parse opens a box at the place the paste would have gone (the box is the feedback: no beep)
    const items = clipItems.length > 1 && text === clip ? clipItems : [text];
    const over = renderer.isSelected(node);
    try {
      const message = ed.refusePaste(node, items, before, over);
      if (message) {
        const pasted = { text: items.join("\n"), message };
        ed.clearSelection();
        if (over || ed.isBlank(node)) editAll(node, pasted);
        else siblingBox(node, !before, pasted);
        if (open) return;
        throw new Error("no box");
      }
    } catch {
      // (nowhere for it to go: the paste below says so)
    }
    try {
      // the focused block is selected (or inside a selected one): the paste REPLACES that block (the old editor's Case 1, `ReplaceNodeTarget`:
      // only the focused block, not the other selected ones; the whole selection is cleared afterwards; one undo step; nothing is announced)
      if (renderer.isSelected(node)) {
        d.over = true;
        ed.replaceWithTexts(
          node,
          clipItems.length > 1 && text === clip ? clipItems : [text]
        );
        ed.clearSelection();
        return;
      }
      // several blocks were copied and the clipboard still holds them: they go in as separate elements
      if (clipItems.length > 1 && text === clip)
        ed.pasteTexts(node, clipItems, before);
      else ed.pasteText(node, text, before);
      ed.clearSelection();
    } catch (err) {
      ed.lastError = (err as Error).message;
      ed.say(
        d.over
          ? "Cannot paste over this node."
          : `Cannot paste ${before ? "before" : "after"} this node.`
      );
      beep("paste-refused");
    }
  }
  const onCopyEv = (e: Event) => {
    const d: Record<string, unknown> = {};
    ed.act(
      "copy",
      active(e),
      d,
      () => onCopy(e as ClipboardEvent, false, d),
      () => !d.text
    );
  };
  const onCutEv = (e: Event) => {
    const d: Record<string, unknown> = {};
    ed.act(
      "cut",
      active(e),
      d,
      () => onCopy(e as ClipboardEvent, true, d),
      () => !d.text
    );
  };
  const onPasteEv = (e: Event) => {
    const d: Record<string, unknown> = {};
    ed.act(
      "paste",
      active(e),
      d,
      () => onPaste(e as ClipboardEvent, d),
      () => !d.text
    );
  };

  /* ---- drag and drop (pointer events: mouse, finger, pen) */

  type Target = { slot: Slot; index: number } | { blank: BNode };
  /** the trash can: an element of the page (class `TrashCan`, outside the editor) that takes the dragged blocks away */
  type Trash = { trash: Element };
  type AnyTarget = Target | Trash;
  interface Drag {
    node: BNode;
    /** what moves: the selected blocks when the dragged one is selected, else just it */
    group: BNode[];
    x: number;
    y: number;
    on: boolean;
    target: AnyTarget | null;
    mark: Element | null;
    /** a finger: the drag starts after a long press (a quick swipe scrolls the page) */
    touch: boolean;
    timer: ReturnType<typeof setTimeout> | null;
    /** the picture that follows the pointer (a copy of the block, as the old editor's drag preview) */
    ghost?: HTMLElement | null;
    /** where in the block the pointer took hold of it */
    grab?: { dx: number; dy: number };
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
  function targetAt(
    x: number,
    y: number,
    node: BNode | null
  ): { target: AnyTarget; mark: Element } | null {
    const el = doc.elementFromPoint(x, y);
    const can = el?.closest(".TrashCan");
    if (can) return { target: { trash: can }, mark: can };
    if (!el || !dom.contains(el)) return null;
    const gap = renderer.gapOf(el);
    if (gap && gap.slot.pieces) return null;
    if (gap) return { target: gap, mark: el.closest(".blocks-gap") as Element };
    const hit = renderer.nodeOf(el);
    if (!hit) return null;
    if (ed.isBlank(hit) && hit !== node)
      return { target: { blank: hit }, mark: renderer.element(hit) };
    const root = rootsOf(hit);
    if (root !== node && root.parent && root.slot) {
      const r = renderer.element(root).getBoundingClientRect();
      const i = root.slot.nodes.indexOf(root);
      if (r.height > 0 && y < r.top + r.height * 0.3)
        return {
          target: { slot: root.slot, index: i },
          mark: renderer.element(root),
        };
      if (r.height > 0 && y > r.bottom - r.height * 0.3)
        return {
          target: { slot: root.slot, index: i + 1 },
          mark: renderer.element(root),
        };
    }
    // a drop on a value inside a top-level block replaces it: in the old editor only the nodes that are "normally editable" (a literal, a blank) are drop targets, a compound block is not; the top-level block itself takes drops at its edges only
    if (
      hit !== root &&
      hit !== node &&
      hit.slots.length === 0 &&
      hit.kind !== "comment" &&
      !(node && isInside(hit, node))
    )
      return { target: { blank: hit }, mark: renderer.element(hit) };
    return null;
  }
  const isInside = (n: BNode, of: BNode): boolean => {
    for (let c: BNode | null = n; c; c = c.parent) if (c === of) return true;
    return false;
  };
  /** where a drop went, for the log: a gap (the slot and index) or a hole (its place) */
  const describeTarget = (t: AnyTarget): Record<string, unknown> =>
    "trash" in t
      ? { trash: true }
      : "blank" in t
        ? { blank: { from: t.blank.from, to: t.blank.to } }
        : {
            slot: t.slot.name,
            owner: { kind: t.slot.owner.kind, from: t.slot.owner.from },
            index: t.index,
          };
  /** a drag let go over the editor but not over a place that takes it (the old editor beeps there; let go elsewhere, it does nothing) */
  const overEditor = (e: PointerEvent): boolean => {
    const el = doc.elementFromPoint(e.clientX, e.clientY);
    return !!el && dom.contains(el);
  };
  /* a template dragged out of the toolbar: the same targets (gaps, blanks, the edges of top-level blocks), the same marks; the block is made where it is let go */
  interface TDrag {
    name: string;
    x: number;
    y: number;
    on: boolean;
    mark: Element | null;
    id: number;
    touch: boolean;
    timer: ReturnType<typeof setTimeout> | null;
    ghost: HTMLElement | null;
    cx: number;
    cy: number;
  }
  let tdrag: TDrag | null = null;
  /** a small label that follows the pointer, above a finger (so that the finger does not hide it); it takes no pointer events, so it never swallows `elementFromPoint` */
  function moveGhost(d: TDrag): void {
    if (!d.ghost) return;
    d.ghost.style.left = `${d.cx + (d.touch ? 0 : 14)}px`;
    d.ghost.style.top = `${d.cy + (d.touch ? -52 : 14)}px`;
  }
  /** while a finger drags: the holes (what a drop can replace) get a class, so that they can grow to a finger-sized target (a language's hole is a literal that says `...`, not a kind of its own) */
  function markHoles(on: boolean): void {
    if (!on) {
      for (const el of Array.from(dom.querySelectorAll(".blocks-hole")))
        el.classList.remove("blocks-hole");
      return;
    }
    // (only what is drawn: CodeMirror draws the viewport, so the walk is over the elements that exist now; auto-scroll calls this again as blocks come into view)
    for (const el of Array.from(dom.querySelectorAll(".blocks-node"))) {
      const n = renderer.nodeOf(el);
      if (
        n &&
        renderer.has(n) &&
        renderer.element(n) === el &&
        n.slots.length === 0 &&
        n.kind !== "error" &&
        ed.isBlank(n)
      )
        el.classList.add("blocks-hole");
    }
  }
  /*
   * Auto-scroll (ninth round; the old editor has none). While a drag is on, a pointer within 40 px of an edge of the editor's scroller moves it;
   * after every frame the drop target under the pointer is found again, and what a drag marks on DOM that was made after it began (holes,
   * the dragged blocks) is marked again.
   */
  const pointer = { x: 0, y: 0 };
  const auto = createAutoScroll({
    scroller: () => ed.view.scrollDOM,
    onFrame: () => {
      if (drag?.on) {
        if (drag.touch) markHoles(true);
        for (const g of drag.group)
          if (renderer.has(g))
            renderer.element(g).classList.add("blocks-drag-source");
        retarget(drag, pointer.x, pointer.y);
      } else if (tdrag?.on) {
        if (tdrag.touch) markHoles(true);
        retarget(tdrag, pointer.x, pointer.y);
      }
    },
  });
  function retarget(
    d: { mark: Element | null; target?: AnyTarget | null },
    x: number,
    y: number
  ): void {
    const hit = targetAt(x, y, drag?.on ? drag.node : null);
    if (hit?.mark !== d.mark) {
      d.mark?.classList.remove("blocks-drop-target", "blocks-drop-replace");
      hit?.mark.classList.add("blocks-drop-target");
      // (a value or hole that the drop would replace: its own colour, as in the old editor)
      if (hit && "blank" in hit.target)
        hit.mark.classList.add("blocks-drop-replace");
    }
    if ("target" in d) d.target = hit?.target ?? null;
    d.mark = hit?.mark ?? null;
  }
  /** Escape cancels a drag in progress (nothing is written; the click that the let-go would make is swallowed) */
  const onEscape = (e: KeyboardEvent): void => {
    if (e.key !== "Escape" || !((drag && drag.on) || (tdrag && tdrag.on)))
      return;
    e.preventDefault();
    e.stopPropagation();
    const stop = (ev: Event): void => {
      ev.preventDefault();
      ev.stopPropagation();
    };
    doc.addEventListener("click", stop, { capture: true, once: true });
    setTimeout(() => doc.removeEventListener("click", stop, true), 300);
    clearDrag();
    tdone();
  };
  doc.addEventListener("keydown", onEscape, true);
  function tbegin(d: TDrag): void {
    d.on = true;
    dom.classList.add("blocks-dragging");
    if (d.touch) {
      // a finger: gaps and holes grow to a size a finger can hit; no scrolling, no menu, no selection until it is let go
      dom.classList.add("blocks-touch-drag");
      markHoles(true);
      doc.addEventListener("contextmenu", noScroll, true);
      doc.addEventListener("selectstart", noScroll, true);
    }
    const g = doc.createElement("div");
    g.className = "blocks-drag-ghost";
    g.textContent = d.name;
    g.setAttribute("aria-hidden", "true");
    (doc.body ?? dom).appendChild(g);
    d.ghost = g;
    moveGhost(d);
  }
  function tdone(): void {
    auto.stop();
    if (tdrag?.timer) clearTimeout(tdrag.timer);
    tdrag?.ghost?.remove();
    tdrag?.mark?.classList.remove("blocks-drop-target", "blocks-drop-replace");
    dom.classList.remove("blocks-dragging");
    dom.classList.remove("blocks-touch-drag");
    markHoles(false);
    tdrag = null;
    doc.removeEventListener("contextmenu", noScroll, true);
    doc.removeEventListener("selectstart", noScroll, true);
    doc.removeEventListener("pointermove", tMove, true);
    doc.removeEventListener("pointerup", tUp, true);
    doc.removeEventListener("pointercancel", tdone, true);
  }
  function tMove(e: PointerEvent): void {
    const d = tdrag;
    if (!d || e.pointerId !== d.id) return;
    d.cx = e.clientX;
    d.cy = e.clientY;
    if (!d.on) {
      const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
      // a finger that moves before the long press is over is swiping the toolbar: not a drag
      if (d.touch) {
        if (moved > 8) tdone();
        return;
      }
      if (moved < 5) return;
      tbegin(d);
    }
    e.preventDefault();
    moveGhost(d);
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    retarget(d, e.clientX, e.clientY);
    auto.update(e.clientX, e.clientY);
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
      ed.act(
        "templateDrop",
        null,
        {
          name: d.name,
          to: hit ? describeTarget(hit.target) : null,
          touch: d.touch,
        },
        () => {
          const to = hit?.target;
          if (to && "trash" in to) {
            // nothing made yet, nothing to throw away
          } else if (to) {
            try {
              ed.insertTemplateAt(d.name, to);
            } catch (err) {
              ed.lastError = (err as Error).message;
              ed.say((err as Error).message);
              beep("drop-refused");
            }
          } else if (overEditor(e)) beep("drop-nowhere");
        }
      );
    } else tdone();
  }
  /**
   * Call from a `pointerdown` on a toolbar button. A mouse or pen drags after moving 5 px. A finger drags after a long press (350 ms without moving
   * more than 8 px), because a finger that moves at once is swiping the toolbar, which scrolls; a tap is the button's own click.
   */
  function beginTemplateDrag(e: PointerEvent, name: string): void {
    if (e.button !== 0) return;
    tdone();
    const d: TDrag = {
      name,
      x: e.clientX,
      y: e.clientY,
      cx: e.clientX,
      cy: e.clientY,
      on: false,
      mark: null,
      id: e.pointerId,
      touch: e.pointerType === "touch",
      timer: null,
      ghost: null,
    };
    tdrag = d;
    doc.addEventListener("pointermove", tMove, true);
    doc.addEventListener("pointerup", tUp, true);
    doc.addEventListener("pointercancel", tdone, true);
    if (d.touch) {
      d.timer = setTimeout(() => {
        d.timer = null;
        if (tdrag === d) tbegin(d);
      }, LONG_PRESS_MS);
    }
  }

  /** a finger that is dragging must not scroll the page (this is only reached after a long press, before any movement) */
  const noScroll = (e: Event): void => {
    if (e.cancelable) e.preventDefault();
  };
  /*
   * The listener that holds a finger's scrolling off is registered ONCE, here, before any touch begins, not when the long press is over: iOS Safari
   * only lets a touchmove listener prevent scrolling if it was there when the touch started (and treats document-level ones as passive unless
   * they say `passive: false`). It does nothing unless a finger drag is on.
   */
  const holdScroll = (e: Event): void => {
    if ((drag && drag.on && drag.touch) || (tdrag && tdrag.on && tdrag.touch))
      noScroll(e);
  };
  doc.addEventListener("touchmove", holdScroll, {
    passive: false,
    capture: true,
  });
  /** a copy of the dragged block (more than one selected: the first, with a count) that follows the pointer, as the old editor's drag preview */
  function makeBlockGhost(d: Drag): HTMLElement | null {
    if (!renderer.has(d.node)) return null;
    const src = renderer.element(d.node);
    const copy = src.cloneNode(true) as HTMLElement;
    copy.removeAttribute("id");
    copy.querySelectorAll("[id]").forEach((e) => e.removeAttribute("id"));
    copy.classList.remove("blocks-drag-source", "blocks-selected");
    const box = doc.createElement("div");
    box.className = `blocks-drag-preview ${dom.className.match(/blocks-lang-\S+/)?.[0] ?? ""}`;
    const style = getComputedStyle(src);
    box.style.fontFamily = style.fontFamily;
    box.style.fontSize = style.fontSize;
    box.style.lineHeight = style.lineHeight;
    box.setAttribute("aria-hidden", "true"); // a picture, not a second block
    box.appendChild(copy);
    if (d.group.length > 1) {
      const n = doc.createElement("span");
      n.className = "blocks-drag-count";
      n.textContent = `+${d.group.length - 1}`;
      box.appendChild(n);
    }
    (doc.body ?? dom).appendChild(box);
    return box;
  }
  function moveBlockGhost(d: Drag, x: number, y: number): void {
    if (!d.ghost || !d.grab) return;
    d.ghost.style.left = `${x - d.grab.dx}px`;
    d.ghost.style.top = `${y - d.grab.dy - (d.touch ? 60 : 0)}px`;
  }
  function begin(d: Drag): void {
    open?.commit();
    d.on = true;
    d.ghost = makeBlockGhost(d);
    moveBlockGhost(d, d.x, d.y);
    dom.classList.add("blocks-dragging");
    for (const g of d.group)
      if (renderer.has(g))
        renderer.element(g).classList.add("blocks-drag-source");
    if (d.touch) {
      dom.classList.add("blocks-touch-drag");
      markHoles(true);
      doc.addEventListener("contextmenu", noScroll, true);
      doc.addEventListener("selectstart", noScroll, true);
    }
  }
  function clearDrag(): void {
    if (!tdrag?.on) auto.stop();
    if (drag?.timer) clearTimeout(drag.timer);
    doc.removeEventListener("contextmenu", noScroll, true);
    doc.removeEventListener("selectstart", noScroll, true);
    dom.classList.remove("blocks-touch-drag");
    markHoles(false);
    if (drag) {
      drag.ghost?.remove();
      drag.mark?.classList.remove("blocks-drop-target", "blocks-drop-replace");
      for (const g of drag.group)
        if (renderer.has(g))
          renderer.element(g).classList.remove("blocks-drag-source");
    }
    dom.classList.remove("blocks-dragging");
    drag = null;
    doc.removeEventListener("pointermove", onMove, true);
    doc.removeEventListener("pointerup", onUp, true);
    doc.removeEventListener("pointercancel", onCancel, true);
  }
  function onDown(e: PointerEvent): void {
    if (e.button !== 0 || (e.target as Element).closest?.(".blocks-edit"))
      return;
    const node = renderer.nodeOf(e.target as Element);
    // (the press focuses the block before the click comes: remember whether it already had the focus)
    pressedFocused = !!node && ed.focusedNode() === node;
    if (!node || !node.slot || renderer.gapOf(e.target as Element)) return;
    const touch = e.pointerType === "touch";
    drag = {
      touch,
      timer: null,
      node,
      group:
        renderer.isSelected(node) && ed.selectedBlocks().length
          ? ed.selectedBlocks()
          : [node],
      x: e.clientX,
      y: e.clientY,
      on: false,
      target: null,
      mark: null,
      grab: (() => {
        const r = renderer.element(node).getBoundingClientRect();
        return { dx: e.clientX - r.left, dy: e.clientY - r.top };
      })(),
    };
    doc.addEventListener("pointermove", onMove, true);
    doc.addEventListener("pointerup", onUp, true);
    doc.addEventListener("pointercancel", onCancel, true);
    if (touch) {
      // The touch goes on being sent to the element it began on, even after CodeMirror takes that element out of the page (it only draws
      // what is in view, so a block that auto-scroll has moved out of view is gone). Events at a removed element do not reach the document,
      // so the `touchmove` that holds the scrolling off must also be on that element, or the browser takes the touch for a scroll (pointercancel).
      const held = e.target as Element;
      held.addEventListener("touchmove", holdScroll, { passive: false });
      const release = (): void => {
        held.removeEventListener("touchmove", holdScroll);
        held.removeEventListener("touchend", release);
        held.removeEventListener("touchcancel", release);
      };
      held.addEventListener("touchend", release);
      held.addEventListener("touchcancel", release);
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
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    retarget(drag, e.clientX, e.clientY);
    moveBlockGhost(drag, e.clientX, e.clientY);
    auto.update(e.clientX, e.clientY);
  }
  function onUp(e: PointerEvent): void {
    if (!drag) return;
    const d = drag;
    if (d.on) {
      const hit = targetAt(e.clientX, e.clientY, d.node);
      swallowClick = true;
      setTimeout(() => (swallowClick = false), 0);
      clearDrag();
      ed.act(
        "drag",
        d.node,
        {
          to: hit ? describeTarget(hit.target) : null,
          count: d.group.length,
          touch: d.touch,
        },
        () => {
          const to = hit?.target;
          if (to && "trash" in to) {
            // the blocks go (with their comments) in one step, as a cut does
            const typing = doc.activeElement;
            if (typing instanceof HTMLElement && typing.matches(".blocks-edit"))
              typing.blur();
            ed.clearSelection();
            ed.removeNodes(
              d.group.filter((n) => renderer.has(n)),
              true
            );
          } else if (to) {
            try {
              ed.moveNodes(d.group, to);
            } catch (err) {
              ed.lastError = (err as Error).message;
              beep("drop-refused");
            }
          } else if (overEditor(e)) beep("drop-nowhere");
        }
      );
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
    ed.act(
      g ? "gapClick" : "click",
      g ? g.slot.owner : renderer.nodeOf(t0),
      g
        ? { slot: g.slot.name, index: g.index, touch: touch0 }
        : { touch: touch0, shift: e.shiftKey, detail: e.detail },
      () => clicked(e),
      () => !g && !renderer.nodeOf(t0)
    );
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
      insertBox(gap.slot, gap.index, owner, (input) =>
        gapEl.parentElement?.insertBefore(input, gapEl)
      );
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
    if (
      !touch &&
      node.slots.length === 0 &&
      node.kind !== "program" &&
      e.detail <= 1 &&
      !(e.shiftKey || e.ctrlKey || e.metaKey || e.altKey)
    ) {
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
    ed.act("dblclick", node, {}, () =>
      ed.collapse(node, !renderer.isCollapsed(node))
    );
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
      ed.topLevelInput = null;
      open?.cancel();
      search.close();
      help?.close();
      doc.removeEventListener("touchmove", holdScroll, true);
      doc.removeEventListener("keydown", onEscape, true);
      auto.stop();
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
