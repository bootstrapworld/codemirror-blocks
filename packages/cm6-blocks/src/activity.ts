/*
 * EXPERIMENT (eighth round). The activity log: what a person did to the editor, kept in a bounded list that a page can read
 * (`ed.activityLog()`), clear (`ed.clearActivityLog()`) and send with a bug report (`ed.exportActivity()`), and that `replay` applies to a
 * fresh editor to get the same text again. The old editor's log is `src/state/activityLog.ts` (`recordEvent`, a Redux middleware that also
 * logs every reducer action, at most 200 entries, with the document as of the oldest kept one so that a replay knows where it starts).
 *
 * An entry is {seq, t, action, target, detail, change, length}:
 *   action  what was done: a command of the key table ("next", "delete", "paste" ...), "click", "drag", "edit" (an edit box was committed),
 *           "template" (a toolbar button), "search.set", "search.next", "mode", "undo", "text" (a change of the text with no action around it
 *           it: typing in text mode, `view.dispatch`), "block-edit" (an API edit, such as `ed.insertText`)
 *   target  what it acted on: {kind, from, to} of the block, in the document as it was when the action began (the old log names a block by its
 *           `nid`, its place in document order, which also survives a reload; offsets are the same kind of thing)
 *   detail  what else it takes to understand the action: the key and modifiers, the text an edit box was committed with, the search settings
 *   change  the text change the action made, as one list of `{from, to, insert}` in the offsets of the text BEFORE it (what CodeMirror calls
 *           a transaction); only for an action that changed the text. This is what `replay` applies.
 *   length  the length of the text after it (a replay checks it)
 *
 * Privacy, as the old editor's: no keystroke is recorded as it is typed. The text of a person appears where they committed it (the edit box's
 * text on Enter or blur, a paste, a search string) and in the changes (the old log holds the WHOLE program after every change, in `SET_AST`, which
 * is more). Keys that start an edit box record the key's name, not the character it types (the box's text is recorded when it is committed).
 */
import type { Transaction } from "@codemirror/state";
import type { TextChange } from "./types";

export interface LogEntry {
  seq: number;
  /** milliseconds since 1970 (Date.now) */
  t: number;
  action: string;
  target?: { kind: string; from: number; to: number };
  detail?: Record<string, unknown>;
  change?: TextChange[];
  length?: number;
}

/** what `ed.exportActivity()` gives, and what a bug report would carry: the log and the text it starts from */
export interface ActivityExport {
  format: 1;
  /** the document just before the first entry of `entries` */
  base: string;
  /** how many older entries were dropped to keep the log bounded (their changes are already in `base`) */
  dropped: number;
  entries: LogEntry[];
}

export const DEFAULT_LIMIT = 200;

interface Ctx {
  action: string;
  target?: LogEntry["target"];
  detail?: Record<string, unknown>;
  produced: number;
}

/** a text with changes (in the offsets of the text before them) applied */
export function applyChanges(text: string, changes: TextChange[]): string {
  let out = text;
  for (const c of [...changes].sort((a, b) => b.from - a.from || b.to - a.to))
    out = out.slice(0, c.from) + c.insert + out.slice(c.to);
  return out;
}

export interface Recorder {
  /**
   * Run `fn` as one action. Text changes made inside it belong to it (one entry for each transaction); if it makes none, one entry is made when it
   * ends (unless `skip` says it did nothing worth recording). An action inside another one is part of it: only the outermost makes entries.
   */
  act<T>(
    action: string,
    target: { kind: string; from: number; to: number } | null | undefined,
    detail: Record<string, unknown> | undefined,
    fn: () => T,
    skip?: () => boolean
  ): T;
  /** a transaction went through: record it if it changed the text */
  transaction(tr: Transaction): void;
  entries(): LogEntry[];
  /** when the last entry was made (Date.now), or 0 */
  lastAt(): number;
  export(): ActivityExport;
  clear(text: string): void;
}

export function createRecorder(initialText: string, limit: number): Recorder {
  let list: LogEntry[] = [];
  let base = initialText;
  let dropped = 0;
  let seq = 0;
  const stack: Ctx[] = [];
  let last = 0;

  function push(e: Omit<LogEntry, "seq" | "t">): void {
    last = Date.now();
    list.push({ seq: seq++, t: last, ...e });
    while (list.length > Math.max(1, limit)) {
      const old = list.shift() as LogEntry;
      dropped++;
      if (old.change) base = applyChanges(base, old.change);
    }
  }

  return {
    act(action, target, detail, fn, skip) {
      if (stack.length) return fn(); // (part of the action around it)
      const ctx: Ctx = {
        action,
        target: target ?? undefined,
        detail,
        produced: 0,
      };
      stack.push(ctx);
      try {
        return fn();
      } finally {
        stack.pop();
        if (!ctx.produced && !(skip && skip()))
          push({ action, target: ctx.target, detail });
      }
    },
    transaction(tr) {
      if (!tr.docChanged) return;
      const change: TextChange[] = [];
      tr.changes.iterChanges((from, to, _fb, _tb, ins) => {
        change.push({ from, to, insert: ins.toString() });
      });
      const ctx = stack[0];
      const history = tr.isUserEvent("undo")
        ? "undo"
        : tr.isUserEvent("redo")
          ? "redo"
          : null;
      if (ctx) ctx.produced++;
      push({
        action:
          history ??
          ctx?.action ??
          (tr.isUserEvent("input.block") ? "block-edit" : "text"),
        target: history ? undefined : ctx?.target,
        detail: history ? ctx?.detail : ctx?.detail,
        change,
        length: tr.newDoc.length,
      });
    },
    entries: () => list.map((e) => ({ ...e })),
    lastAt: () => last,
    export: () => ({
      format: 1,
      base,
      dropped,
      entries: list.map((e) => ({ ...e })),
    }),
    clear(text) {
      list = [];
      base = text;
      dropped = 0;
    },
  };
}

/** minimal structure of an editor that `replay` needs (a `LezerBlockEditor`) */
export interface ReplayTarget {
  view: {
    state: { doc: { length: number; toString(): string } };
    dispatch(spec: { changes: TextChange[]; userEvent?: string }): void;
  };
}

/**
 * Apply a recorded log to a fresh editor (made by `make` from the text the log starts from: `startText`, or the export's `base`), and return
 * it. Only the entries that changed the text are applied (in order, each as one change of the text, which is what ended up in the document);
 * the rest (focus, collapse, selection, search, refusals) are context for a person reading the log. Throws if an entry's `length` is not the
 * length of the text after it, which means the log does not start from `startText`.
 */
export function replay<E extends ReplayTarget>(
  log: LogEntry[] | ActivityExport,
  startText: string | undefined,
  make: (text: string) => E
): E {
  const entries = Array.isArray(log) ? log : log.entries;
  const start = startText ?? (Array.isArray(log) ? undefined : log.base);
  if (start === undefined)
    throw new Error("replay needs the text the log starts from");
  const ed = make(start);
  for (const e of entries) {
    if (!e.change) continue;
    ed.view.dispatch({ changes: e.change, userEvent: "input.replay" });
    if (e.length !== undefined && ed.view.state.doc.length !== e.length)
      throw new Error(
        `replay diverged at entry ${e.seq} (${e.action}): the text is ${ed.view.state.doc.length} long, the log says ${e.length}`
      );
  }
  return ed;
}
