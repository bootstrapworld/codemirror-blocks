import {createStore, applyMiddleware} from 'redux';
import thunk, { ThunkDispatch, ThunkMiddleware } from 'redux-thunk';
import {reducer} from './reducers';
import type { RootState, AppAction } from './reducers';
import { InputEnv } from './keymap';

const reduxStore = createStore(
  reducer,
  undefined,
  applyMiddleware(thunk as ThunkMiddleware<RootState, AppAction>)
);

export type AppStore =
  typeof reduxStore &
  // TODO(pcardune): these additional properties are tacked onto the store
  // in random places, but shouldn't be.
  {
    // TODO(pcardune): this onKeyDown property gets set by
    // BlockEditor and used by the Node component for no apparent
    // reason. It's effectively a global variable and should be
    // stored somewhere else.
    onKeyDown?: (e:React.KeyboardEvent, env: InputEnv)=>void,
  };

export const store: AppStore = reduxStore

/**
 * A dispatch function that supports calling dispatch with both
 * AppActions and thunks.
 */
export type AppDispatch = ThunkDispatch<RootState, unknown, AppAction>;

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
