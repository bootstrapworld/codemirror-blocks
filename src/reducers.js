//var log4js = require(`${log4js}`);
//var logger = log4js.getLogger();

//logger.level = 'ALL';

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
//    logger.debug(result);
    return result;
  case 'SET_AST':
    result = {...state, ast: action.ast, collapsedList: state.collapsedList.filter(action.ast.getNodeById)};
//    logger.debug(result);
    return result;
  case 'SET_SELECTIONS':
    result = {...state, selections: action.selections};
//    logger.debug(result);
    return result;
  case 'SET_EDITABLE':
    result = {...state, editable: {...state.editable, [action.id]: action.bool}};
//    logger.debug(result);
    return result;
  case 'SET_ERROR_ID':
    result = {...state, errorId: action.errorId};
//    logger.debug(result);
    return result;
  case 'COLLAPSE':
    result = {...state, collapsedList: state.collapsedList.concat([action.id])};
//    logger.debug(result);
    return result;
  case 'UNCOLLAPSE':
    result = {...state, collapsedList: state.collapsedList.filter(e => e !== action.id)};
//    logger.debug(result);
    return result;
  case 'COLLAPSE_ALL':
    result = {...state, collapsedList: [...state.ast.nodeIdMap.keys()]};
//    logger.debug(result);
    return result;
  case 'UNCOLLAPSE_ALL':
    result = {...state, collapsedList: []};
//    logger.debug(result);
    return result;
  case 'SET_CURSOR':
    result = {...state, cur: action.cur};
//    logger.debug(result);
    return result;
  case 'DISABLE_QUARANTINE':
    result = {...state, quarantine: null};
//    logger.debug(result);
    return result;
  case 'CHANGE_QUARANTINE':
    result = {...state, quarantine: [state.quarantine[0], state.quarantine[1], action.text]};
//    logger.debug(result);
    return result;
  case 'SET_QUARANTINE':
    result = {...state, quarantine: [action.start, action.end, action.text]};
//    logger.debug(result);
    return result;
  case 'SET_ANNOUNCER':
    result = {...state, announcer: action.announcer};
//    logger.debug(result);
    return result;
  case 'ADD_MARK':
    result = {...state, markedMap: state.markedMap.set(action.id, action.mark)};
//    logger.debug(result);
    return result;
  case 'CLEAR_MARK':
    state.markedMap.delete(action.id);
    result = {...state};
//    logger.debug(result);
    return result;
  case 'DO':
    result = {...state, undoFocusStack: [...state.undoFocusStack, action.focus], redoFocusStack: []};
//    logger.debug(result);
    return result;
  case 'UNDO':
    state.redoFocusStack.push(state.undoFocusStack.pop());
    result = {...state};
//    logger.debug(result);
    return result;
  case 'REDO':
    state.undoFocusStack.push(state.redoFocusStack.pop());
    result = {...state};
//    logger.debug(result);
    return result;
  case 'RESET_STORE_FOR_TESTING':
    result =  initialState;
//    logger.debug(result);
    return result;
  default:
    result =  state;
//    logger.debug(result);
    return result;
  }
};