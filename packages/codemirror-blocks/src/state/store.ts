import { createStore, applyMiddleware } from "redux";
import thunk, {
  ThunkAction,
  ThunkDispatch,
  ThunkMiddleware,
} from "redux-thunk";
import * as actions from "./actions";
import { reducer } from "./reducers";
import type { RootState, AppAction } from "./reducers";

export function createAppStore(code?: string) {
  const store = createStore(
    reducer,
    undefined,
    applyMiddleware(thunk as ThunkMiddleware<RootState, AppAction>)
  );
  if (code !== undefined) {
    store.dispatch(actions.setCode(code));
  }
  return store;
}

export type AppStore = ReturnType<typeof createAppStore>;

/**
 * A dispatch function that supports calling dispatch with both
 * AppActions and thunks.
 */
export type AppDispatch = ThunkDispatch<RootState, unknown, AppAction>;

export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  AppAction
>;
