

export const reducer = (
  state = {
    selections: [],
    ast: null,
    focusId: null,
    collapsedList: [],
    markedList: new Map(),
    errorId: '',
    cur: null,
    quarantine: null,
    announcer: null,
  },
  action) => {
    console.log(action);
    switch (action.type) {
    case 'SET_FOCUS':
      return {...state, focusId: action.focusId};
    case 'SET_AST':
      return {...state, ast: action.ast, 
        collapsedList: state.collapsedList.filter(action.ast.getNodeById),
        markedMap: state.markedMap.forEach((v, k) => action.ast.getNodeById(k))};
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
      return {...state, quarantine: [state.quarantine[0], action.text]};
    case 'SET_QUARANTINE':
      return {...state, quarantine: [action.pos, action.text]};
    case 'SET_ANNOUNCER':
      return {...state, announcer: action.announcer};
    case 'ADD_MARK':
      return {...state, markedMap: state.markedMap.set(action.id, action.mark)};
    case 'CLEAR_MARK':
      return {...state, markedMap: state.markedMap.delete(action.id)};
    default:
      return state;
    }
  };
