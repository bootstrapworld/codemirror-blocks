import { createStore, applyMiddleware } from "redux";
import thunk, { ThunkDispatch, ThunkMiddleware } from "redux-thunk";
import { reducer } from "./reducers";
import type { RootState, AppAction } from "./reducers";

const reduxStore = createStore(
  reducer,
  undefined,
  applyMiddleware(thunk as ThunkMiddleware<RootState, AppAction>)
);

export type AppStore = typeof reduxStore;

/**
 * @deprecated do not access the store through this global
 * Instead access it through redux context
 */
export const store: AppStore = reduxStore;

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
 *
 * @deprecated Ignore the above comment. This function should not be used.
 * You should never modify the state directly, and instead always dispatch
 * an action and let the reducers handle state modification.
 */
export function isErrorFree() {
  return store.getState().errorId === "";
}
