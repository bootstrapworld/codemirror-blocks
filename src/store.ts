import {createStore, applyMiddleware, Store} from 'redux';
import thunk from 'redux-thunk';
import {reducer} from './reducers';
import type { RootState, AppAction } from './reducers';

type AppStore =
  Store<RootState, AppAction> &
  // TODO(pcardune): this onKeyDown property gets set by
  // BlockEditor and used by the Node component for no apparent
  // reason. It's effectively a global variable and should be
  // stored somewhere else.
  {onKeyDown?: Function};

export const store: AppStore = createStore(reducer, undefined, applyMiddleware(thunk));
export type AppDispatch = typeof store.dispatch;

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
