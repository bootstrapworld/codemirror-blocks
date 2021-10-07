import { createStore, applyMiddleware } from "redux";
import thunk, { ThunkDispatch, ThunkMiddleware } from "redux-thunk";
import { reducer } from "./reducers";
import type { RootState, AppAction } from "./reducers";

export function createAppStore() {
  return createStore(
    reducer,
    undefined,
    applyMiddleware(thunk as ThunkMiddleware<RootState, AppAction>)
  );
}

export type AppStore = ReturnType<typeof createAppStore>;

/**
 * A dispatch function that supports calling dispatch with both
 * AppActions and thunks.
 */
export type AppDispatch = ThunkDispatch<RootState, unknown, AppAction>;
