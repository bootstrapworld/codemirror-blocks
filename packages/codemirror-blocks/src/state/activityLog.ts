import type { Action, Middleware } from "redux";
import { AST, ASTData } from "../ast";
import type { AppAction, RootState } from "./reducers";

/**
 * What a person did to the editor, in a form a replay can drive again (see
 * spec/helpers/fieldReplay.ts). Blocks are named by their `nid` (their place in
 * the document, which survives a reload), never by an id. Text appears only
 * where a person typed or pasted it: the string an edit box was committed with,
 * the string pasted, a search.
 */
export type UIEvent =
  | { type: "KEY"; key: string; mods?: string; nid: number | null }
  | { type: "MOUSE"; nid: number }
  | {
      type: "DRAG";
      from: { nid: number } | { tool: string };
      /** a block, the n-th gap between blocks, a spot of whitespace, the trash can */
      to?: { nid: number } | { gap: number } | { ws: Loc } | { trash: true };
      touch?: true;
    }
  | { type: "EDIT"; text: string; how: "enter" | "blur" }
  | { type: "EDIT_CANCEL" }
  | { type: "TYPE"; char: string; sel: Sel }
  | { type: "PASTE"; text: string; sel: Sel }
  | { type: "CLIP"; text: string }
  | { type: "MODE"; blocks: boolean }
  | { type: "SEARCH"; key?: string; set?: unknown };
type Loc = { line: number; ch: number };
type Sel = { from: Loc; to: Loc };

/**
 * An Activity is a shallow-clone of a reducer action, except that
 * all instances of the AST are replaced with the source code, and
 * focusIds get replaced with node ids.
 */
export type Activity =
  | Exclude<AppAction, { ast: AST } | Action<"SET_AST"> | Action<"SET_FOCUS">>
  | (Action<"SET_AST"> & { code: string })
  | (Action<"SET_FOCUS"> & { nid: number | null })
  | (Action<"COLLAPSE" | "UNCOLLAPSE"> & { id: string; nid?: number });

/** Everything that is kept, in order: reducer actions and what people did */
export type LogEntry = Activity | UIEvent;
const isEvent = (e: LogEntry): e is UIEvent =>
  EVENT_TYPES.has(e.type as UIEvent["type"]);
const EVENT_TYPES = new Set<UIEvent["type"]>([
  "KEY",
  "MOUSE",
  "DRAG",
  "EDIT",
  "EDIT_CANCEL",
  "TYPE",
  "PASTE",
  "CLIP",
  "MODE",
  "SEARCH",
]);
const log: LogEntry[] = [];

/**
 * Only the most recent activities are kept, so that a long session neither
 * grows without bound nor makes a bug report too big to send.
 */
export const MAX_ACTIVITIES = 200;
let dropped = 0;
/**
 * the document as of the last activity that was dropped (undefined if none was)
 * or the SET_AST that holds it, which prints it only when it is asked for
 */
let baseSource: string | { code: string } | undefined;
const baseCodeOf = () =>
  typeof baseSource === "string" ? baseSource : baseSource?.code;

/**
 * A document with more nodes than this is not printed whenever it changes
 * (printing a big one costs tens of milliseconds an edit): the log holds the
 * parsed document, and prints it if the log is ever read. So that holding them
 * costs little, at most MAX_UNPRINTED of them are held, and what came before
 * the oldest is forgotten (it starts the log, whole, so nothing is needed of
 * what was before it).
 */
export const BIG_DOCUMENT = 3000;
export const MAX_UNPRINTED = 12;
const unprinted: LogEntry[] = [];
const isUnprinted = new WeakSet<object>();

/** Tells the log what the document is now, so it can say where its record starts. */
let currentCode: (() => string) | undefined;
const noteStart = () => {
  if (!log.length && dropped === 0 && baseSource === undefined) {
    baseSource = currentCode?.();
  }
};

let lastActivityAt = 0;
/** @internal whether a person has done something to the editor in the last couple of seconds */
export const wasRecentlyActive = () => Date.now() - lastActivityAt < 2000;

const push = (activity: LogEntry) => {
  lastActivityAt = Date.now();
  log.push(activity);
  if (log.length > MAX_ACTIVITIES) {
    const [old] = log.splice(0, 1);
    dropped++;
    if (old.type === "SET_AST") baseSource = old;
    const at = unprinted.indexOf(old);
    if (at >= 0) unprinted.splice(at, 1);
  }
};

/** A SET_AST whose code is printed when it is first read, not before */
const unprintedSetAst = (ast: ASTData): Activity => {
  let data: ASTData | undefined = ast;
  let code: string | undefined;
  const activity = { type: "SET_AST" } as Activity & { code: string };
  Object.defineProperty(activity, "code", {
    enumerable: true,
    get() {
      if (code === undefined) {
        code = new AST(data!).toString();
        data = undefined;
      }
      return code;
    },
  });
  isUnprinted.add(activity);
  return activity;
};

/** Forget what came before the oldest of the unprinted documents that are kept */
const forgetBeforeOldestKept = () => {
  if (unprinted.length <= MAX_UNPRINTED) return;
  unprinted.splice(0, unprinted.length - MAX_UNPRINTED);
  const first = log.indexOf(unprinted[0]);
  if (first > 0) {
    log.splice(0, first);
    dropped += first;
  }
  // (the first thing in the log is a whole document, so it needs no base)
  baseSource = undefined;
};

/** @internal record something a person did (see UIEvent); costs nothing until they do it */
export const recordEvent = (event: UIEvent) => {
  noteStart();
  push(event);
};

/**
 * @internal
 * How many of the oldest activities have been forgotten, and the document as
 * it was just after them, which is where the remaining ones start from.
 */
export const getActivityBase = () => ({ dropped, baseCode: baseCodeOf() });

let lastError: { message: string; stack?: string } | undefined;
/** @internal remember the latest exception that was reported, for bug reports */
export const recordError = (exception: unknown) => {
  lastError =
    exception instanceof Error
      ? { message: exception.message, stack: exception.stack }
      : { message: String(exception) };
  errorListeners.forEach((listener) => listener());
};
const errorListeners = new Set<() => void>();
/** @internal call `listener` whenever an error is recorded; returns how to stop */
export const onErrorRecorded = (listener: () => void) => {
  errorListeners.add(listener);
  return () => {
    errorListeners.delete(listener);
  };
};
/** @internal */
export const getLastError = () => lastError;

/** @internal for tests: forget everything recorded so far */
export const resetActivityLog = () => {
  log.length = 0;
  dropped = 0;
  baseSource = undefined;
  unprinted.length = 0;
  lastError = undefined;
};

/**
 * @internal
 * Get a readonly list of all reducer actions that have taken place
 * that is suitable for serialization
 */
export const getReducerActivities = (): ReadonlyArray<Activity> =>
  log.filter((e): e is Activity => !isEvent(e));

/** @internal the reducer actions and the events, in the order they happened */
export const getLog = (): ReadonlyArray<LogEntry> => log;

function toActivity(action: AppAction, ast: ASTData): Activity {
  // Shallow-clone the action, removing the AST.
  // Then replace the AST with the source code.
  // We'll reconstruct it when replaying the log.
  // Replace focusId with nid
  switch (action.type) {
    case "SET_AST":
      return ast.nodeIdMap.size > BIG_DOCUMENT
        ? unprintedSetAst(ast)
        : { type: action.type, code: new AST(ast).toString() };
    case "SET_FOCUS":
      return {
        type: action.type,
        nid: action.focusId
          ? new AST(ast).getNodeByIdOrThrow(action.focusId).nid
          : null,
      };
    case "COLLAPSE":
    case "UNCOLLAPSE": {
      // (ids belong to one session; the nid tells another session which node)
      const node = new AST(ast).getNodeById(action.id);
      return node ? { ...action, nid: node.nid } : { ...action };
    }
    default:
      return { ...action };
  }
}

/**
 * Redux middleware that records every action that reaches the reducer, so
 * that sessions can be downloaded and replayed (see toolkit/debug.ts).
 * Thunks are handled before this middleware sees them, so only plain
 * actions are recorded.
 */
export const activityLogger: Middleware<unknown, RootState> = (store) => {
  currentCode = () => new AST(store.getState().astData).toString();
  return (next) => (action) => {
    noteStart();
    const result = next(action);
    const activity = toActivity(action as AppAction, store.getState().astData);
    push(activity);
    if (isUnprinted.has(activity)) {
      unprinted.push(activity);
      forgetBeforeOldestKept();
    }
    return result;
  };
};
