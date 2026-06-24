/**
 * Playground store helpers.
 *
 * Every <App /> gets its own Redux store and service bag so multiple
 * playgrounds can coexist on the same page without sharing editor/runtime
 * state. Components receive the per-instance {@link AppStoreApi} through props.
 */
import { configureStore, type ThunkAction } from "@reduxjs/toolkit";

import { createServices, type Services } from "./services.ts";
import { actions, type AppAction, reducer } from "./slice.ts";

export function createAppStore(services: Services = createServices()) {
  return configureStore({
    reducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        // Inject the live service bag into every thunk's third argument.
        thunk: { extraArgument: services },
        // State holds large file blobs and the console buffer grows on every log
        // line; skip the dev-only deep traversals to keep dispatch cheap. State
        // and actions are already plain data — the non-serializable services live
        // in the thunk extra argument, not in state.
        serializableCheck: false,
        immutableCheck: false,
      }),
  });
}

export type AppStore = ReturnType<typeof createAppStore>;
/** The full state tree (the slice is mounted at the root). */
export type RootState = ReturnType<AppStore["getState"]>;
/** The store's dispatch, widened to accept thunks. */
export type AppDispatch = AppStore["dispatch"];
/** A thunk for this app (see ./operations.ts). */
export type AppThunk<Result = void> = ThunkAction<Result, RootState, Services, AppAction>;

/**
 * The store API in the same `{ getState, dispatch, services }` shape a thunk
 * receives. Handed to the non-dispatched helper functions in ./operations.ts
 * (e.g. `modelFor`) that need to read state and reach the services but aren't
 * themselves actions. Inside a thunk, the equivalent object is rebuilt from the
 * `(dispatch, getState, services)` arguments.
 */
export interface AppStoreApi {
  getState(): RootState;
  dispatch: AppDispatch;
  readonly services: Services;
}

export interface AppUiApi extends AppStoreApi {
  subscribe: AppStore["subscribe"];
}

export function createAppApi(store: AppStore, services: Services): AppUiApi {
  return {
    getState: store.getState,
    dispatch: store.dispatch,
    subscribe: store.subscribe,
    services,
  };
}

export { actions };
export type { AppAction } from "./slice.ts";
export type { Services } from "./services.ts";
export type { AppState, Diagnostic, EditorStatus, RuntimeStatus } from "./state.ts";
export { DEFAULT_ACTIVE_FILE, DEFAULT_OPEN_FILES } from "./state.ts";
export { connect, shallowEqual } from "./connect.ts";
