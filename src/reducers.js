const initialState = {
  selections: [],
  editable: {},
  ast: null,
  focusId: null,
  collapsedList: [],
  markedMap: new Map(),
  undoFocusStack: [],
  redoFocusStack: [],
  errorId: '',
  cur: null,
  quarantine: null,
  announcer: null,
};

const activities = [];

export const reducer = (
  state = initialState,
  action) => {
  console.log(action);
    let result = null;
  switch (action.type) {
  case 'SET_FOCUS':
    result = {...state, focusId: action.focusId};
    activities.push(result);
    return result;
  case 'SET_AST':
    result = {...state, ast: action.ast, collapsedList: state.collapsedList.filter(action.ast.getNodeById)};
    activities.push(result);
    return result;
  case 'SET_SELECTIONS':
    result = {...state, selections: action.selections};
    activities.push(result);
    return result;
  case 'SET_EDITABLE':
    result = {...state, editable: {...state.editable, [action.id]: action.bool}};
    activities.push(result);
    return result;
  case 'SET_ERROR_ID':
    result = {...state, errorId: action.errorId};
    activities.push(result);
    return result;
  case 'COLLAPSE':
    result = {...state, collapsedList: state.collapsedList.concat([action.id])};
    activities.push(result);
    return result;
  case 'UNCOLLAPSE':
    result = {...state, collapsedList: state.collapsedList.filter(e => e !== action.id)};
    activities.push(result);
    return result;
  case 'COLLAPSE_ALL':
    result = {...state, collapsedList: [...state.ast.nodeIdMap.keys()]};
    activities.push(result);
    return result;
  case 'UNCOLLAPSE_ALL':
    result = {...state, collapsedList: []};
    activities.push(result);
    return result;
  case 'SET_CURSOR':
    result = {...state, cur: action.cur};
    activities.push(result);
    return result;
  case 'DISABLE_QUARANTINE':
    result = {...state, quarantine: null};
    activities.push(result);
    return result;
  case 'CHANGE_QUARANTINE':
    result = {...state, quarantine: [state.quarantine[0], state.quarantine[1], action.text]};
    activities.push(result);
    return result;
  case 'SET_QUARANTINE':
    result = {...state, quarantine: [action.start, action.end, action.text]};
    activities.push(result);
    return result;
  case 'SET_ANNOUNCER':
    result = {...state, announcer: action.announcer};
    activities.push(result);
    return result;
  case 'ADD_MARK':
    result = {...state, markedMap: state.markedMap.set(action.id, action.mark)};
    activities.push(result);
    return result;
  case 'CLEAR_MARK':
    state.markedMap.delete(action.id);
    result = {...state};
    activities.push(result);
    return result;
  case 'DO':
    result = {...state, undoFocusStack: [...state.undoFocusStack, action.focus], redoFocusStack: []};
    activities.push(result);
    return result;
  case 'UNDO':
    state.redoFocusStack.push(state.undoFocusStack.pop());
    result = {...state};
    activities.push(result);
    return result;
  case 'REDO':
    state.undoFocusStack.push(state.redoFocusStack.pop());
    result = {...state};
    activities.push(result);
    return result;
  case 'RESET_STORE_FOR_TESTING':
    result =  initialState;
    activities.push(result);
    return result;
  default:
    result =  state;
    activities.push(result);
    return result;
  }
};
