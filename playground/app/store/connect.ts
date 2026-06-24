/**
 * `remix/ui` integration for the Redux store.
 *
 * A `remix/ui` component re-renders by calling `handle.update()`. Redux Toolkit
 * ships no binding for non-React apps, so {@link connect} is ours: it subscribes
 * the component to the store, recomputes a *selected slice* of state after every
 * change, and only calls `handle.update()` when that slice actually changed. The
 * subscription is torn down automatically when the component disconnects (via
 * `handle.signal`).
 *
 * Usage inside a component's setup phase:
 *
 * ```tsx
 * function StatusBar(handle: Handle) {
 *   const status = connect(handle, store, (s) => s.editorStatus);
 *   return () => <span>{status()}</span>;
 * }
 * ```
 *
 * The returned getter always reflects the latest selected value, so call it
 * during render. Selecting a narrow slice keeps re-renders surgical.
 */

/** Minimal slice of a `remix/ui` Handle that {@link connect} needs. */
interface ConnectableHandle {
  update(): Promise<unknown>;
  readonly signal: AbortSignal;
}

/** Minimal slice of a Redux store that {@link connect} needs. */
interface ReadableStore<State> {
  getState(): State;
  subscribe(listener: () => void): () => void;
}

/** Compares the previous and next selected slice; `true` means "unchanged". */
export type EqualityFn<Selected> = (a: Selected, b: Selected) => boolean;

/** Default equality: `Object.is`, matching React-Redux's `useSelector`. */
function defaultEquals<Selected>(a: Selected, b: Selected): boolean {
  return Object.is(a, b);
}

/**
 * Subscribe `handle` to `store`, re-rendering it when `selector(state)` changes.
 *
 * Returns a getter for the current selected value. The selector should be cheap
 * and return a stable reference for unchanged data (slices of state, or
 * primitives) so the equality check can skip needless re-renders. Pass a custom
 * `equals` (e.g. {@link shallowEqual}) when the selector builds a fresh
 * object/array each call.
 */
export function connect<State, Selected>(
  handle: ConnectableHandle,
  store: ReadableStore<State>,
  selector: (state: State) => Selected,
  equals: EqualityFn<Selected> = defaultEquals,
): () => Selected {
  let selected = selector(store.getState());

  if (!handle.signal.aborted) {
    const unsubscribe = store.subscribe(() => {
      const next = selector(store.getState());
      if (equals(selected, next)) return;
      selected = next;
      handle.update();
    });
    handle.signal.addEventListener("abort", unsubscribe, { once: true });
  }

  return () => selected;
}

/**
 * Shallow object/array equality, for selectors that build a fresh container of
 * otherwise-stable values each call (e.g. `(s) => ({ a: s.a, b: s.b })`).
 */
export function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) {
    return false;
  }
  const aKeys = Object.keys(a as object);
  const bKeys = Object.keys(b as object);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (
      !Object.prototype.hasOwnProperty.call(b, key) ||
      !Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
    ) {
      return false;
    }
  }
  return true;
}
