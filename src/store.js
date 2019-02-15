import {createStore, applyMiddleware} from 'redux';
import thunk from 'redux-thunk';
import {reducer} from './reducers';

export const store = createStore(reducer, undefined, applyMiddleware(thunk));

/**
 * isErrorFree: (-> Boolean)
 *
 * Indicating whether there is no error. Note that this function has side-effect.
 * It should not be used in rendering, since React should be notified by changes directly
 * Only use this function in event handlers.
 */
export function isErrorFree() {
  return store.getState().errorId === '';
}
