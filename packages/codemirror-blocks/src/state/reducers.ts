import CodeMirror from "codemirror";
import type { Action } from "redux";
import { AST, ASTData } from "../ast";
import { Pos } from "../editor";
import { debugLog } from "../utils";

export type Quarantine = Readonly<{ from: Pos; to: Pos; value: string }>;

export type ActionFocus = Readonly<{
  oldFocusNId?: number;
  newFocusNId?: number;
}>;

export type RootState = {
  /**
   * Whether or not block mode is enabled.
   */
  readonly blockMode: boolean;

  /**
   * The code in the editor. Ideally this should be normalized
   * with astData, which represents the same thing when in block
   * mode
   */
  readonly code: string;

  readonly selections: ReadonlyArray<string>;

  /**
   * Mapping from node ids to whether or not
   * that node is currently editable.
   */
  readonly editable: Readonly<{ [nid: string]: boolean }>;
  readonly astData: ASTData;
  readonly focusId?: string;
  readonly collapsedList: ReadonlyArray<string>;
  readonly errorId: string;
  readonly quarantine: Quarantine | null;
  readonly markedMap: Readonly<{ [key: string]: CodeMirror.TextMarker }>;

  /**
   * The description and focus of the undo/redo action that is about to be
   * performed. These are copied onto CodeMirror's history item for the
   * opposite stack once the undo/redo has happened (see
   * {@link actions.finishUndoOrRedo}).
   */
  readonly undoableAction: string | undefined;
  readonly actionFocus: ActionFocus | undefined;
};

export type AppAction =
  | (Action<"SET_BLOCK_MODE"> & { enabled: boolean })
  | (Action<"SET_FOCUS"> & { focusId: string | undefined })
  | (Action<"SET_AST"> & { ast: AST })
  | (Action<"SET_CODE"> & { code: string })
  | (Action<"SET_SELECTIONS"> & { selections: string[] })
  | (Action<"SET_EDITABLE"> & { id: string; bool: boolean })
  | (Action<"SET_ERROR_ID"> & { errorId: string })
  | (Action<"COLLAPSE"> & { id: string })
  | (Action<"UNCOLLAPSE"> & { id: string })
  | Action<"COLLAPSE_ALL">
  | Action<"UNCOLLAPSE_ALL">
  | Action<"DISABLE_QUARANTINE">
  | (Action<"CHANGE_QUARANTINE"> & { text: string })
  | (Action<"SET_QUARANTINE"> & {
      start: CodeMirror.Position;
      end: CodeMirror.Position;
      text: string;
    })
  | (Action<"ADD_MARK"> & { id: string; mark: CodeMirror.TextMarker })
  | (Action<"CLEAR_MARK"> & { id: string })
  | (Action<"SET_UNDOABLE_ACTION"> & { undoableAction: string | undefined })
  | (Action<"SET_ACTION_FOCUS"> & { actionFocus: ActionFocus | undefined })
  | Action<"UNDO">
  | Action<"REDO">
  | Action<"RESET_STORE_FOR_TESTING">;

const initialState: () => RootState = () => ({
  blockMode: false,
  code: "",
  selections: [],
  editable: {},
  astData: {
    languageId: "",
    rootNodes: [],
    nodeIdMap: new Map(),
    nodeNIdMap: new Map(),
    edgeIdMap: {},
  },
  focusId: undefined,
  collapsedList: [],
  markedMap: {},
  undoableAction: undefined,
  actionFocus: undefined,
  errorId: "",
  quarantine: null,
});

function reduce(state = initialState(), action: AppAction): RootState {
  switch (action.type) {
    case "SET_CODE":
      return { ...state, code: action.code };
    case "SET_BLOCK_MODE":
      return { ...state, blockMode: action.enabled };
    case "SET_FOCUS":
      if (state.focusId !== action.focusId) {
        return { ...state, focusId: action.focusId };
      }
      return state;
    case "SET_AST":
      return {
        ...state,
        astData: action.ast.data,
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
      return {
        ...state,
        collapsedList: [...new AST(state.astData).getAllNodeIds()],
      };
    case "UNCOLLAPSE_ALL":
      return { ...state, collapsedList: [] };
    case "DISABLE_QUARANTINE":
      return { ...state, quarantine: null };
    case "CHANGE_QUARANTINE":
      if (!state.quarantine) {
        throw new Error(`Can't change quarantine that does not exist`);
      }
      return {
        ...state,
        quarantine: {
          ...state.quarantine,
          value: action.text,
        },
      };
    case "SET_QUARANTINE":
      return {
        ...state,
        quarantine: {
          from: action.start,
          to: action.end,
          value: action.text,
        },
      };
    case "ADD_MARK":
      return {
        ...state,
        markedMap: {
          ...state.markedMap,
          [action.id]: action.mark,
        },
      };
    case "CLEAR_MARK": {
      const markedMap = { ...state.markedMap };
      delete markedMap[action.id];
      return { ...state, markedMap };
    }
    case "SET_UNDOABLE_ACTION":
      return { ...state, undoableAction: action.undoableAction };
    case "SET_ACTION_FOCUS":
      return { ...state, actionFocus: action.actionFocus };
    case "UNDO":
    case "REDO":
      return { ...state, undoableAction: undefined, actionFocus: undefined };
    case "RESET_STORE_FOR_TESTING":
      return initialState();
    default:
      debugLog("unprocessed action type=", (action as Action<string>).type);
      return state;
  }
}

export const reducer = (
  state = initialState(),
  action: AppAction
): RootState => {
  debugLog(action);
  return reduce(state, action);
};
