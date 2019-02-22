const initialState = {
  selections: [],
  ast: null,
  focusId: null,
  collapsedList: [],
  markedMap: new Map(),
  errorId: '',
  cur: null,
  quarantine: null,
  announcer: null,
}

export const reducer = (
  state = initialState,
  action) => {
    console.log(action);
    switch (action.type) {
    case 'SET_FOCUS':
      return {...state, focusId: action.focusId};
    case 'SET_AST':
      return {...state, ast: action.ast, collapsedList: state.collapsedList.filter(action.ast.getNodeById)};
    case 'SET_SELECTIONS':
      return {...state, selections: action.selections};
    case 'SET_ERROR_ID':
      return {...state, errorId: action.errorId};
    case 'COLLAPSE':
      return {...state, collapsedList: state.collapsedList.concat([action.id])};
    case 'UNCOLLAPSE':
      return {...state, collapsedList: state.collapsedList.filter(e => e !== action.id)};
    case 'COLLAPSE_ALL':
      return {...state, collapsedList: [...state.ast.nodeIdMap.keys()]};
    case 'UNCOLLAPSE_ALL':
      return {...state, collapsedList: []};
    case 'SET_CURSOR':
      return {...state, cur: action.cur};
    case 'DISABLE_QUARANTINE':
      return {...state, quarantine: null};
    case 'CHANGE_QUARANTINE':
      return {...state, quarantine: [state.quarantine[0], state.quarantine[1], action.text]};
    case 'SET_QUARANTINE':
      return {...state, quarantine: [action.start, action.end, action.text]};
    case 'SET_ANNOUNCER':
      return {...state, announcer: action.announcer};
    case 'ADD_MARK':
      return {...state, markedMap: state.markedMap.set(action.id, action.mark)};
    case 'CLEAR_MARK':
      state.markedMap.delete(action.id);
      return {...state}; // NOTE(Emmanuel): simply returning 'state' here will NOT work!
    case 'RESET_STORE_FOR_TESTING':
      return initialState;
    default:
      return state;
    }
  };
