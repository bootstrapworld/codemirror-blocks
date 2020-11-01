import {topmostUndoable} from './utils';
//import SHARED from './shared'; //used only in debug statements

function loggerDebug(action, ast) { // in lieu of logger.debug
  if (!window.reducerActivities) {
    window.reducerActivities = [];
  }
  // Shallow-clone the action, removing the AST.
  // Then replace the AST with the source code.
  // We'll reconstruct it when replaying the log.
  // Replace focusId with nid
  let activity = {...action, ast: false};
  if(action.type == "SET_AST") {
    activity.code = ast.toString();
    delete activity.ast;
  }
  if(action.type == "SET_FOCUS") {
    if (ast) {
      activity.nid = ast.getNodeById(action.focusId).nid;
      delete activity.focusId;
    }
  }
  window.reducerActivities.push(activity);
}

const initialState = {
  selections: [],
  editable: {},
  ast: null,
  focusId: null,
  collapsedList: [],
  markedMap: new Map(),
  undoableAction: null,
  actionFocus: false,
  errorId: '',
  cur: null,
  quarantine: null,
  announcer: null,
};

export const reducer = (
  state = initialState,
  action) => {
  console.log(action);
  let result = null;
  let tU;
  switch (action.type) {
  case 'SET_FOCUS':
    result = {...state, focusId: action.focusId};
    break;
  case 'SET_AST':
    result = {...state, ast: action.ast, collapsedList: state.collapsedList.filter(action.ast.getNodeById)};
    break;
  case 'SET_SELECTIONS':
    result = {...state, selections: action.selections};
    break;
  case 'SET_EDITABLE':
    result = {...state, editable: {...state.editable, [action.id]: action.bool}};
    break;
  case 'SET_ERROR_ID':
    result = {...state, errorId: action.errorId};
    break;
  case 'COLLAPSE':
    result = {...state, collapsedList: state.collapsedList.concat([action.id])};
    break;
  case 'UNCOLLAPSE':
    result = {...state, collapsedList: state.collapsedList.filter(e => e !== action.id)};
    break;
  case 'COLLAPSE_ALL':
    result = {...state, collapsedList: [...state.ast.nodeIdMap.keys()]};
    break;
  case 'UNCOLLAPSE_ALL':
    result = {...state, collapsedList: []};
    break;
  case 'SET_CURSOR':
    result = {...state, cur: action.cur};
    break;
  case 'DISABLE_QUARANTINE':
    result = {...state, quarantine: null};
    break;
  case 'CHANGE_QUARANTINE':
    result = {...state, quarantine: [state.quarantine[0], state.quarantine[1], action.text]};
    break;
  case 'SET_QUARANTINE':
    result = {...state, quarantine: [action.start, action.end, action.text]};
    break;
  case 'SET_ANNOUNCER':
    result = {...state, announcer: action.announcer};
    break;
  case 'ADD_MARK':
    result = {...state, markedMap: state.markedMap.set(action.id, action.mark)};
    break;
  case 'CLEAR_MARK':
    state.markedMap.delete(action.id);
    result = {...state};
    break;

  case 'DO':
    result = {...state};
    break;
  case 'UNDO':
    tU = topmostUndoable('redo', state);
    tU.undoableAction = state.undoableAction;
    tU.actionFocus = state.actionFocus;
    state.undoableAction = null;
    state.actionFocus = null;
    result = {...state};
    break;
  case 'REDO':
    tU = topmostUndoable('undo', state);
    tU.undoableAction = state.undoableAction;
    tU.actionFocus = state.actionFocus;
    state.undoableAction = null;
    state.actionFocus = null;
    result = {...state};
    break;

  case 'RESET_STORE_FOR_TESTING':
    result =  initialState;
    break;
  default:
    console.log('unprocessed action type=', action.type);
    result =  state;
  }

//  loggerDebug(action, result.ast);
  return result;
};
