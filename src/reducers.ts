import CodeMirror from "codemirror";
import type { Action } from "redux";
import { AST } from "./ast";
import { ReadonlyCMBEditor } from "./editor";
import { debugLog } from "./utils";

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

function loggerDebug(action: AppAction, ast: AST) {
  // Shallow-clone the action, removing the AST.
  // Then replace the AST with the source code.
  // We'll reconstruct it when replaying the log.
  // Replace focusId with nid
  let activity: Activity;
  switch (action.type) {
    case "SET_AST":
      activity = { type: action.type, code: ast.toString() };
      break;
    case "SET_FOCUS":
      activity = {
        type: action.type,
        nid: action.focusId ? ast.getNodeByIdOrThrow(action.focusId).nid : null,
      };
      break;
    default:
      activity = { ...action };
  }

  reducerActivities.push(activity);
}

export type Quarantine = Readonly<
  [CodeMirror.Position, CodeMirror.Position, string]
>;

export type ActionFocus = {
  oldFocusNId: number | null;
  newFocusNId: number | null;
};

export type RootState = {
  readonly selections: string[];

  /**
   * Mapping from node ids to whether or not
   * that node is currently editable.
   */
  readonly editable: { [nid: string]: boolean };
  readonly ast: AST;
  readonly focusId: string | null;
  readonly collapsedList: string[];
  readonly errorId: string;
  readonly cur: CodeMirror.Position | null;
  readonly quarantine: Quarantine | null;

  // TODO(pcardune): make these readonly
  undoableAction: string | undefined;
  actionFocus: ActionFocus | undefined;

  // TODO(pcardune): make this a ReadonlyMap
  readonly markedMap: Map<string, CodeMirror.TextMarker>;
};

export type AppAction =
  | (Action<"SET_FOCUS"> & { focusId: string | null })
  | (Action<"SET_AST"> & { ast: AST })
  | (Action<"SET_SELECTIONS"> & { selections: string[] })
  | (Action<"SET_EDITABLE"> & { id: string; bool: boolean })
  | (Action<"SET_ERROR_ID"> & { errorId: string })
  | (Action<"COLLAPSE"> & { id: string })
  | (Action<"UNCOLLAPSE"> & { id: string })
  | Action<"COLLAPSE_ALL">
  | Action<"UNCOLLAPSE_ALL">
  | (Action<"SET_CURSOR"> & { cur: CodeMirror.Position | null })
  | Action<"DISABLE_QUARANTINE">
  | (Action<"CHANGE_QUARANTINE"> & { text: string })
  | (Action<"SET_QUARANTINE"> & {
      start: CodeMirror.Position;
      end: CodeMirror.Position;
      text: string;
    })
  | (Action<"ADD_MARK"> & { id: string; mark: CodeMirror.TextMarker })
  | (Action<"CLEAR_MARK"> & { id: string })
  | (Action<"DO"> & { focusId: RootState["focusId"] })
  | (Action<"UNDO"> & { cm: ReadonlyCMBEditor })
  | (Action<"REDO"> & { cm: ReadonlyCMBEditor })
  | Action<"RESET_STORE_FOR_TESTING">;

const initialState: RootState = {
  selections: [],
  editable: {},
  ast: new AST([]),
  focusId: null,
  collapsedList: [],
  markedMap: new Map(),
  undoableAction: undefined,
  actionFocus: undefined,
  errorId: "",
  cur: null,
  quarantine: null,
};

function reduce(state = initialState, action: AppAction): RootState {
  switch (action.type) {
    case "SET_FOCUS":
      return { ...state, focusId: action.focusId };
    case "SET_AST":
      return {
        ...state,
        ast: action.ast,
        collapsedList: state.collapsedList.filter(action.ast.getNodeById),
      };
    case "SET_SELECTIONS":
      return { ...state, selections: action.selections };
    case "SET_EDITABLE":
      return {
        ...state,
        editable: { ...state.editable, [action.id]: action.bool },
      };
    case "SET_ERROR_ID":
      return { ...state, errorId: action.errorId };
    case "COLLAPSE":
      return {
        ...state,
        collapsedList: state.collapsedList.concat([action.id]),
      };
    case "UNCOLLAPSE":
      return {
        ...state,
        collapsedList: state.collapsedList.filter((e) => e !== action.id),
      };
    case "COLLAPSE_ALL":
      return { ...state, collapsedList: [...state.ast.nodeIdMap.keys()] };
    case "UNCOLLAPSE_ALL":
      return { ...state, collapsedList: [] };
    case "SET_CURSOR":
      return { ...state, cur: action.cur };
    case "DISABLE_QUARANTINE":
      return { ...state, quarantine: null };
    case "CHANGE_QUARANTINE":
      if (!state.quarantine) {
        throw new Error(`Can't change quarantine that does not exist`);
      }
      return {
        ...state,
        quarantine: [
          state.quarantine[0],
          state.quarantine[1],
          action.text,
        ] as Quarantine,
      };
    case "SET_QUARANTINE":
      return {
        ...state,
        quarantine: [action.start, action.end, action.text] as Quarantine,
      };
    case "ADD_MARK":
      return {
        ...state,
        markedMap: state.markedMap.set(action.id, action.mark),
      };
    case "CLEAR_MARK":
      state.markedMap.delete(action.id);
      return { ...state };
    case "DO":
      if (state.focusId !== action.focusId) {
        return { ...state, focusId: action.focusId };
      }
      return state;
    case "UNDO": {
      const historyItem = action.cm.getTopmostUndoable("redo");
      historyItem.undoableAction = state.undoableAction;
      historyItem.actionFocus = state.actionFocus;
      return {
        ...state,
        undoableAction: undefined,
        actionFocus: undefined,
      };
    }
    case "REDO": {
      const historyItem = action.cm.getTopmostUndoable("undo");
      historyItem.undoableAction = state.undoableAction;
      historyItem.actionFocus = state.actionFocus;
      return {
        ...state,
        undoableAction: undefined,
        actionFocus: undefined,
      };
    }
    case "RESET_STORE_FOR_TESTING":
      return initialState;
    default:
      debugLog("unprocessed action type=", (action as Action<any>).type);
      return state;
  }
}

export const reducer = (state = initialState, action: AppAction): RootState => {
  debugLog(action);
  let result = reduce(state, action);
  loggerDebug(action, result.ast);
  return result;
};
