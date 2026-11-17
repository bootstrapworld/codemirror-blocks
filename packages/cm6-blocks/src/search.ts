/*
 * EXPERIMENT (eighth round). Search, as the old editor has it (src/ui/Search.tsx and src/ui/searchers/ there), without React:
 *   F3, Ctrl-F or Cmd-F        the Search Settings dialog (what should PageUp and PageDown search for?): a tab "Search by string" (the text, and
 *                              three options: ignore case, exact match = a whole word, regex) and a tab "Search by block" (a list of the types of block in the program)
 *   Enter in the dialog        close it and go to the first match after the focused block;  Escape (or Close) closes it and goes nowhere
 *   PageDown / PageUp          the next / previous match from the focused block, on from the other end when there is none (with the wrap sound);
 *                              no match: the beep. Nothing chosen yet: the beep and "No search settings have been selected"
 *   Ctrl-F3 / Shift-Ctrl-F3    the search rotor: the next / previous search TYPE (each block type in the program, then the last text searched for)
 *
 * A text match is looked for in the text of the whole program (comments, strings and brackets included) and is the innermost block that holds the
 * start of the match; a match inside a collapsed block (the block's own text is still found) is skipped, as in the old editor, and so is a
 * match that is in no block (between top-level blocks, in text that does not parse). The block that has the focus is never the match.
 * With an empty text, search steps through the blocks one by one. The type of a block is its label in the table ("call", "definition", "number").
 */
import type { LezerBlockEditor } from "./lezer-view";
import { keyOfNode } from "./lezer";
import type { BNode } from "./types";

export interface TextSetting {
  searchString: string;
  isRegex: boolean;
  isExactMatch: boolean;
  isIgnoreCase: boolean;
}
export interface BlockSetting {
  /** a label of the table: what the block is called aloud */
  blockType: string;
}
export type SearchMode = "text" | "block";
export interface SearchSettings {
  /** what PageUp and PageDown use; null until the person chooses something in the dialog */
  mode: SearchMode | null;
  text: TextSetting;
  block: BlockSetting;
}

export interface Match {
  node: BNode;
  /** went on from the other end of the document */
  wrapped: boolean;
}

export interface Search {
  /** the dialog; false if the editor is not drawing blocks */
  open(): void;
  /** close it: `go` (Enter) also goes to the first match; Escape and Close do not */
  close(go?: boolean): void;
  isOpen(): boolean;
  /** PageDown / PageUp: go to the next / previous match from the focused block; false (with a beep) if there is none */
  next(): boolean;
  previous(): boolean;
  /** the next / previous search type (Ctrl-F3, Shift-Ctrl-F3) */
  rotor(forward: boolean): void;
  settings(): SearchSettings;
  /** what the dialog does when something in it changes: also callable on its own */
  set(change: { mode?: SearchMode } & Partial<TextSetting> & Partial<BlockSetting>): void;
  /** the types of block in the program, in the order of the list: [label, label, ...] */
  types(): string[];
  /** the match `next` / `previous` would go to, without going there */
  find(forward: boolean): Match | null;
}

export const EMPTY_TEXT: TextSetting = { searchString: "", isRegex: false, isExactMatch: false, isIgnoreCase: false };

const drawable = (n: BNode): boolean => n.kind !== "error" && n.kind !== "program";
const kids = (n: BNode): BNode[] => n.slots.flatMap((s) => s.nodes);

/** the regular expression of a text search, or null for one that matches nothing (a pattern that is not finished) */
export function queryOf(s: TextSetting): RegExp | null {
  if (s.searchString === "") return null;
  let q = s.searchString;
  if (!s.isRegex) q = q.replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&");
  if (s.isExactMatch) q = "\\b" + q + "\\b";
  try {
    return new RegExp(q, "gm" + (s.isIgnoreCase ? "i" : ""));
  } catch {
    return null;
  }
}

export function createSearch(ed: LezerBlockEditor, ui: { focus: (n: BNode) => void; host: () => HTMLElement }): Search {
  const state: SearchSettings = { mode: null, text: { ...EMPTY_TEXT }, block: { blockType: "" } };
  /** the text search the rotor ends with: the last one closed with Enter */
  let lastText: TextSetting | null = null;
  let dialog: { el: HTMLElement; close(go: boolean): void } | null = null;

  const label = (n: BNode): string => (ed.options.table.nodes[keyOfNode(n) ?? ""]?.label ?? n.kind);
  /** every block in document order (pre-order), with whether it is inside a collapsed block */
  function all(): { node: BNode; hidden: boolean }[] {
    const out: { node: BNode; hidden: boolean }[] = [];
    const go = (n: BNode, hidden: boolean): void => {
      if (drawable(n)) out.push({ node: n, hidden });
      const h = hidden || (drawable(n) && ed.renderer.isCollapsed(n));
      for (const k of kids(n)) go(k, h);
    };
    go(ed.doc.program, false);
    return out;
  }
  const types = (): string[] => [...new Set(all().map((x) => label(x.node)))].sort();

  /** the innermost block that holds position `pos` (comments are blocks here too) */
  function innermost(pos: number): BNode | null {
    let n: BNode = ed.doc.program;
    for (;;) {
      const c = kids(n).find((k) => k.from <= pos && pos < k.to);
      if (!c) break;
      n = c;
    }
    return drawable(n) ? n : null;
  }

  function candidates(): { node: BNode; key: number }[] {
    const list = all();
    if (state.mode === "block") return list.filter((x) => !x.hidden && label(x.node) === state.block.blockType).map((x) => ({ node: x.node, key: x.node.from }));
    if (state.text.searchString === "") return list.filter((x) => !x.hidden).map((x) => ({ node: x.node, key: x.node.from }));
    const re = queryOf(state.text);
    if (!re) return [];
    const text = ed.view.state.doc.toString();
    const out: { node: BNode; key: number }[] = [];
    const hidden = new Set(list.filter((x) => x.hidden).map((x) => x.node));
    for (let m = re.exec(text); m; m = re.exec(text)) {
      if (m[0] === "") {
        re.lastIndex++;
        continue;
      }
      const node = innermost(m.index);
      if (node && !hidden.has(node)) out.push({ node, key: m.index });
    }
    return out;
  }

  function find(forward: boolean): Match | null {
    if (state.mode === null) return null;
    const list = candidates();
    const focus = ed.focusedNode() ?? ed.lastFocused();
    const empty = state.mode === "text" && state.text.searchString === "";
    const block = state.mode === "block" || empty;
    // where the search starts: a block search goes by the order of the blocks (a parent before its children), a text search by position
    let after: (c: { node: BNode; key: number }) => boolean;
    if (!focus) after = () => true;
    else if (block) {
      const order = new Map(all().map((x, i) => [x.node, i]));
      const at = order.get(focus) ?? -1;
      after = (c) => (forward ? (order.get(c.node) ?? -1) > at : (order.get(c.node) ?? -1) < at);
    } else after = (c) => (forward ? c.key > focus.from : c.key < focus.from);
    const ok = (c: { node: BNode }) => c.node !== focus;
    const pickFirst = (cs: { node: BNode; key: number }[]) => (forward ? cs[0] : cs[cs.length - 1]);
    const found = pickFirst(list.filter((c) => after(c) && ok(c)));
    if (found) return { node: found.node, wrapped: false };
    const wrapped = pickFirst(list.filter(ok));
    return wrapped ? { node: wrapped.node, wrapped: true } : null;
  }

  function step(forward: boolean): boolean {
    if (state.mode === null) {
      ed.say("No search settings have been selected");
      ed.sound("beep", "no-match");
      return false;
    }
    const m = find(forward);
    if (!m) {
      ed.say("No match found");
      ed.sound("beep", "no-match");
      return false;
    }
    if (m.wrapped) ed.sound("wrap", "wrapped");
    ui.focus(m.node);
    return true;
  }

  function set(change: Parameters<Search["set"]>[0]): void {
    const d: Record<string, unknown> = {};
    ed.act("search.set", null, d, () => {
      set1(change);
      d.settings = { mode: state.mode, text: { ...state.text }, block: { ...state.block } }; // (the old log keeps the setting too, with the string)
    });
  }
  function set1(change: Parameters<Search["set"]>[0]): void {
    const { mode, blockType, ...text } = change;
    if (Object.keys(text).length) state.text = { ...state.text, ...text };
    if (blockType !== undefined) state.block = { blockType };
    state.mode = mode ?? (blockType !== undefined ? "block" : Object.keys(text).length ? "text" : state.mode);
  }

  function rotor(forward: boolean): void {
    ed.act("search.rotor", null, { forward }, () => rotor1(forward));
  }
  function rotor1(forward: boolean): void {
    const ts = types();
    const count = ts.length + (lastText ? 1 : 0);
    if (count === 0) {
      ed.say("No search types available");
      return;
    }
    let at = -1;
    if (state.mode === "block") at = ts.indexOf(state.block.blockType);
    else if (state.mode === "text" && lastText && JSON.stringify(state.text) === JSON.stringify(lastText)) at = ts.length;
    const next = at < 0 ? (forward ? 0 : count - 1) : (at + (forward ? 1 : count - 1)) % count;
    const position = `${next + 1} of ${count}`;
    if (next < ts.length) {
      state.mode = "block";
      state.block = { blockType: ts[next] };
      ed.say(`Searching by ${ts[next]}, ${position}`);
    } else {
      state.mode = "text";
      state.text = { ...lastText! };
      ed.say(`Searching for text '${lastText!.searchString}', ${position}`);
    }
  }

  /* ---- the dialog */

  function open(): void {
    if (dialog) return;
    ed.act("search.open", null, {}, open1);
  }
  function open1(): void {
    const host = ui.host();
    const doc = host.ownerDocument;
    const back = ed.focusedNode() ?? ed.lastFocused();
    const el = doc.createElement("div");
    el.className = "blocks-help blocks-search";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", "Search Settings");
    el.tabIndex = -1;
    const mk = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = ""): HTMLElementTagNameMap[K] => {
      const e = doc.createElement(tag);
      if (cls) e.className = cls;
      if (text) e.textContent = text;
      return e;
    };
    el.appendChild(mk("h2", "", "Search Settings"));
    const hint = mk("i");
    hint.append("What should ", mk("kbd", "", "PgUp"), " and ", mk("kbd", "", "PgDown"), " search for?");
    el.appendChild(hint);

    // the tabs (a roving tab stop; Left and Right change the mode, Up and Down stay in it)
    const tablist = mk("div", "blocks-search-tabs");
    tablist.setAttribute("role", "tablist");
    const tabs = ["Search by string", "Search by block"].map((t, i) => {
      const b = mk("button", "", t);
      b.type = "button";
      b.setAttribute("role", "tab");
      b.id = `blocks-search-tab-${i}`;
      b.setAttribute("aria-controls", `blocks-search-panel-${i}`);
      tablist.appendChild(b);
      return b;
    });
    el.appendChild(tablist);
    const panels = [0, 1].map((i) => {
      const p = mk("div", "blocks-search-panel");
      p.setAttribute("role", "tabpanel");
      p.id = `blocks-search-panel-${i}`;
      p.setAttribute("aria-labelledby", `blocks-search-tab-${i}`);
      el.appendChild(p);
      return p;
    });
    // text panel
    const input = mk("input", "form-control search-input");
    input.type = "text";
    input.name = "searchString";
    input.setAttribute("aria-label", "Search String");
    input.spellcheck = false;
    input.value = state.text.searchString;
    panels[0].appendChild(input);
    const opts = mk("div", "search-options");
    const boxes: Record<"isIgnoreCase" | "isExactMatch" | "isRegex", HTMLInputElement> = {} as never;
    for (const [name, text] of [["isIgnoreCase", "Ignore case"], ["isExactMatch", "Exact match"], ["isRegex", "Regex"]] as const) {
      const lab = mk("label");
      const cb = mk("input");
      cb.type = "checkbox";
      cb.name = name;
      cb.checked = state.text[name];
      boxes[name] = cb;
      lab.append(cb, text);
      opts.appendChild(lab);
    }
    panels[0].appendChild(opts);
    // block panel
    const select = mk("select");
    select.name = "blockType";
    select.setAttribute("aria-label", "Block type");
    const ts = types();
    for (const t of ts) {
      const o = mk("option", "", t);
      o.value = t;
      select.appendChild(o);
    }
    if (ts.includes(state.block.blockType)) select.value = state.block.blockType;
    panels[1].appendChild(select);

    el.appendChild(
      Object.assign(mk("small", "blocks-search-foot"), {
        textContent: "Left and Right change the kind of search; Enter closes and finds the next match, Escape closes.",
      })
    );
    const closeBtn = mk("button", "closeDialog", "Close");
    el.appendChild(closeBtn);

    let tab = state.mode === "block" ? 1 : 0;
    const showTab = (i: number, focus: boolean): void => {
      tab = i;
      tabs.forEach((t, j) => {
        t.setAttribute("aria-selected", String(j === i));
        t.tabIndex = j === i ? 0 : -1;
        panels[j].hidden = j !== i;
      });
      if (focus) tabs[i].focus();
    };
    showTab(tab, false);
    // choosing the tab chooses the search (as the old editor's tabs do); a block search starts on the first type
    const choose = (i: number): void => {
      if (i === 1 && !ts.includes(state.block.blockType) && ts.length) {
        select.value = ts[0];
        state.block = { blockType: ts[0] };
      }
      state.mode = i === 1 ? "block" : "text";
    };
    tabs.forEach((t, i) =>
      t.addEventListener("click", () => {
        showTab(i, false);
        choose(i);
      })
    );
    input.addEventListener("input", () => set({ searchString: input.value, mode: "text" }));
    for (const [name, cb] of Object.entries(boxes)) cb.addEventListener("change", () => set({ [name]: cb.checked, mode: "text" }));
    select.addEventListener("change", () => set({ blockType: select.value, mode: "block" }));

    let closed = false;
    const finish = (go: boolean): void => {
      if (closed) return;
      ed.act("search.close", null, { how: go ? "enter" : "escape" }, () => finish1(go));
    };
    const finish1 = (go: boolean): void => {
      closed = true;
      dialog = null;
      el.remove();
      if (back && ed.doc.byId.get(back.id) === back) ed.focusNode(back);
      else ed.focusEditor();
      if (go) {
        if (state.mode === "text" && state.text.searchString !== "") lastText = { ...state.text };
        ed.say("Searching for next match. Use PageUp and PageDown to search forwards and backwards");
        step(true);
      }
    };
    el.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Escape") {
        e.preventDefault();
        finish(false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        finish(true);
      } else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && (e.target as Element).getAttribute("role") === "tab") {
        e.preventDefault();
        const i = e.key === "ArrowRight" ? Math.min(1, tab + 1) : Math.max(0, tab - 1);
        showTab(i, true);
        choose(i);
      } else if (e.key === "Tab") {
        // the focus stays inside while the dialog is open
        const f = Array.from(el.querySelectorAll<HTMLElement>("input, select, button")).filter((x) => x.tabIndex >= 0 && !x.closest("[hidden]"));
        const i = f.indexOf(e.target as HTMLElement);
        const to = e.shiftKey ? f[(i <= 0 ? f.length : i) - 1] : f[(i + 1) % f.length];
        e.preventDefault();
        to?.focus();
      }
    });
    closeBtn.addEventListener("click", () => finish(false));
    host.appendChild(el);
    dialog = { el, close: finish };
    (tab === 1 ? select : input).focus();
    if (tab === 0) input.select();
  }

  return {
    open,
    close: (go = false) => dialog?.close(go),
    isOpen: () => !!dialog,
    next: () => ed.act("search.next", null, {}, () => step(true)),
    previous: () => ed.act("search.previous", null, {}, () => step(false)),
    rotor,
    settings: () => ({ mode: state.mode, text: { ...state.text }, block: { ...state.block } }),
    set,
    types,
    find,
  };
}
