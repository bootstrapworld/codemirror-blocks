import CodeMirror, { Editor } from "codemirror";
import type { Action } from "redux";
import { AST } from "./ast";
import { debugLog, topmostUndoable } from "./utils";
import SHARED from "./shared";

/**
 * An Activity is a shallow-clone of a reducer action, except that
 * all instances of the AST are replaced with the source code, and
 * focusIds get replaced with node ids.
 */
export type Activity =
  | Exclude<AppAction, { ast: AST } | Action<"SET_AST"> | Action<"SET_FOCUS">>
  | (Action<"SET_AST"> & { code: string })
  | (Action<"SET_FOCUS"> & { nid: number });

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
      if (ast && ast.getNodeById(action.focusId)) {
        activity = {
          type: action.type,
          nid: ast.getNodeById(action.focusId).nid,
        };
      }
      break;
    default:
      activity = { ...action };
  }

  reducerActivities.push(activity);
}

export type Quarantine = [CodeMirror.Position, CodeMirror.Position, string];

export type ActionFocus = { oldFocusNId: number; newFocusNId: number };

export type RootState = {
  selections: string[];

  /**
   * Mapping from node ids to whether or not
   * that node is currently editable.
   */
  editable: { [nid: string]: boolean };
  ast: AST | null;
  focusId: string | null;
  collapsedList: string[];
  markedMap: Map<string, CodeMirror.TextMarker>;
  undoableAction: string | null;
  actionFocus: ActionFocus | false;
  errorId: string;
  cur: CodeMirror.Position | null;
  quarantine: Quarantine | null;
};

export type AppAction =
  | (Action<"SET_FOCUS"> & { focusId: string })
  | (Action<"SET_AST"> & { ast: AST })
  | (Action<"SET_SELECTIONS"> & { selections: string[] })
  | (Action<"SET_EDITABLE"> & { id: string; bool: boolean })
  | (Action<"SET_ERROR_ID"> & { errorId: string })
  | (Action<"COLLAPSE"> & { id: string })
  | (Action<"UNCOLLAPSE"> & { id: string })
  | Action<"COLLAPSE_ALL">
  | Action<"UNCOLLAPSE_ALL">
  | (Action<"SET_CURSOR"> & { cur: CodeMirror.Position })
  | Action<"DISABLE_QUARANTINE">
  | (Action<"CHANGE_QUARANTINE"> & { text: string })
  | (Action<"SET_QUARANTINE"> & {
      start: CodeMirror.Position;
      end: CodeMirror.Position;
      text: string;
    })
  | (Action<"ADD_MARK"> & { id: string; mark: CodeMirror.TextMarker })
  | (Action<"CLEAR_MARK"> & { id: string })
  | (Action<"DO"> & { focusId: string })
  | (Action<"UNDO"> & { cm: Editor })
  | (Action<"REDO"> & { cm: Editor })
  | Action<"RESET_STORE_FOR_TESTING">;

const initialState: RootState = {
  selections: [],
  editable: {},
  ast: null,
  focusId: null,
  collapsedList: [],
  markedMap: new Map(),
  undoableAction: null,
  actionFocus: false,
  errorId: "",
  cur: null,
  quarantine: null,
};

export const reducer = (state = initialState, action: AppAction): RootState => {
  debugLog(action);
  let result = null;
  let tU;
  switch (action.type) {
    case "SET_FOCUS":
      result = { ...state, focusId: action.focusId };
      break;
    case "SET_AST":
      result = {
        ...state,
        ast: action.ast,
        collapsedList: state.collapsedList.filter(action.ast.getNodeById),
      };
      break;
    case "SET_SELECTIONS":
      result = { ...state, selections: action.selections };
      break;
    case "SET_EDITABLE":
      result = {
        ...state,
        editable: { ...state.editable, [action.id]: action.bool },
      };
      break;
    case "SET_ERROR_ID":
      result = { ...state, errorId: action.errorId };
      break;
    case "COLLAPSE":
      result = {
        ...state,
        collapsedList: state.collapsedList.concat([action.id]),
      };
      break;
    case "UNCOLLAPSE":
      result = {
        ...state,
        collapsedList: state.collapsedList.filter((e) => e !== action.id),
      };
      break;
    case "COLLAPSE_ALL":
      result = { ...state, collapsedList: [...state.ast.nodeIdMap.keys()] };
      break;
    case "UNCOLLAPSE_ALL":
      result = { ...state, collapsedList: [] };
      break;
    case "SET_CURSOR":
      result = { ...state, cur: action.cur };
      break;
    case "DISABLE_QUARANTINE":
      result = { ...state, quarantine: null };
      break;
    case "CHANGE_QUARANTINE":
      result = {
        ...state,
        quarantine: [
          state.quarantine[0],
          state.quarantine[1],
          action.text,
        ] as Quarantine,
      };
      break;
    case "SET_QUARANTINE":
      result = {
        ...state,
        quarantine: [action.start, action.end, action.text] as Quarantine,
      };
      break;
    case "ADD_MARK":
      result = {
        ...state,
        markedMap: state.markedMap.set(action.id, action.mark),
      };
      break;
    case "CLEAR_MARK":
      state.markedMap.delete(action.id);
      result = { ...state };
      break;

    case "DO":
      //debugLog('XXX reducers:100 state.focusId=', state.focusId, 'action.focusId=', action.focusId);
      if (state.focusId !== action.focusId) {
        //debugLog('XXX reducers:102 updating focusId in state');
        result = { ...state, focusId: action.focusId };
      } else {
        result = { ...state };
      }
      break;
    case "UNDO":
      tU = topmostUndoable(action.cm, "redo");
      tU.undoableAction = state.undoableAction;
      tU.actionFocus = state.actionFocus;
      state.undoableAction = null;
      state.actionFocus = null;
      result = { ...state };
      break;
    case "REDO":
      tU = topmostUndoable(action.cm, "undo");
      tU.undoableAction = state.undoableAction;
      tU.actionFocus = state.actionFocus;
      state.undoableAction = null;
      state.actionFocus = null;
      result = { ...state };
      break;

    case "RESET_STORE_FOR_TESTING":
      result = initialState;
      break;
    default:
      debugLog("unprocessed action type=", (action as Action<any>).type);
      result = state;
  }

  loggerDebug(action, result.ast);
  return result;
};
