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
  | (Action<"SET_FOCUS"> & { nid: number | null });

const reducerActivities: Activity[] = [];

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
    return result;
  };
