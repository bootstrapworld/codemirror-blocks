import type { Action, Middleware } from "redux";
import { AST, ASTData } from "../ast";
import type { AppAction, RootState } from "./reducers";

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

const reducerActivities: Activity[] = [];

/**
 * Only the most recent activities are kept, so that a long session neither
 * grows without bound nor makes a bug report too big to send.
 */
export const MAX_ACTIVITIES = 200;
let dropped = 0;
/** the document as of the last activity that was dropped (undefined if none was) */
let baseCode: string | undefined;

/**
 * @internal
 * How many of the oldest activities have been forgotten, and the document as
 * it was just after them, which is where the remaining ones start from.
 */
export const getActivityBase = () => ({ dropped, baseCode });

let lastError: { message: string; stack?: string } | undefined;
/** @internal remember the latest exception that was reported, for bug reports */
export const recordError = (exception: unknown) => {
  lastError =
    exception instanceof Error
      ? { message: exception.message, stack: exception.stack }
      : { message: String(exception) };
};
/** @internal */
export const getLastError = () => lastError;

/** @internal for tests: forget everything recorded so far */
export const resetActivityLog = () => {
  reducerActivities.length = 0;
  dropped = 0;
  baseCode = undefined;
  lastError = undefined;
};

/**
 * @internal
 * Get a readonly list of all reducer actions that have taken place
 * that is suitable for serialization
 */
export const getReducerActivities = (): ReadonlyArray<Activity> =>
  reducerActivities;

function toActivity(action: AppAction, ast: ASTData): Activity {
  // Shallow-clone the action, removing the AST.
  // Then replace the AST with the source code.
  // We'll reconstruct it when replaying the log.
  // Replace focusId with nid
  switch (action.type) {
    case "SET_AST":
      return { type: action.type, code: new AST(ast).toString() };
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
export const activityLogger: Middleware<unknown, RootState> =
  (store) => (next) => (action) => {
    const result = next(action);
    reducerActivities.push(
      toActivity(action as AppAction, store.getState().astData)
    );
    if (reducerActivities.length > MAX_ACTIVITIES) {
      const [old] = reducerActivities.splice(0, 1);
      dropped++;
      if (old.type === "SET_AST") baseCode = old.code;
    }
    return result;
  };
