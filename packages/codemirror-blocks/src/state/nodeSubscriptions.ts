import { useCallback, useSyncExternalStore } from "react";
import { useStore } from "react-redux";
import type { RootState } from "./reducers";

type Store = { getState(): RootState; subscribe(l: () => void): () => void };

/**
 * `useSelector` runs every selector on every store update, so with a block per
 * node (tens of thousands in a big program) each arrow key costs a few hundred
 * thousand selector calls. This hub watches the store once, works out which
 * ids an update can have changed the answer for, and wakes only those.
 *
 * It covers the per-id parts of the state: focus, collapsed, selected, marked
 * and editable ids, and (for every id) whether there is an error.
 */
class Hub {
  private listeners = new Map<string, Set<() => void>>();
  private prev: RootState;

  constructor(private store: Store) {
    this.prev = store.getState();
    store.subscribe(() => this.update());
  }

  subscribe(id: string, listener: () => void) {
    let set = this.listeners.get(id);
    if (!set) this.listeners.set(id, (set = new Set()));
    set.add(listener);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(id);
    };
  }

  private wake(id: string | undefined) {
    if (id !== undefined) this.listeners.get(id)?.forEach((l) => l());
  }

  private wakeDifferences(a: readonly string[], b: readonly string[]) {
    const inA = new Set(a);
    const inB = new Set(b);
    for (const id of a) if (!inB.has(id)) this.wake(id);
    for (const id of b) if (!inA.has(id)) this.wake(id);
  }

  private wakeKeyDifferences(
    a: Readonly<Record<string, unknown>>,
    b: Readonly<Record<string, unknown>>
  ) {
    for (const id of Object.keys(a)) if (a[id] !== b[id]) this.wake(id);
    for (const id of Object.keys(b)) if (!(id in a)) this.wake(id);
  }

  private update() {
    const prev = this.prev;
    const next = this.store.getState();
    if (prev === next) return;
    this.prev = next;
    // (collect first: a listener's re-render can't change the state, but
    // keeps this loop independent of the listener sets changing under it)
    if (prev.focusId !== next.focusId) {
      this.wake(prev.focusId);
      this.wake(next.focusId);
    }
    if (prev.collapsedList !== next.collapsedList) {
      this.wakeDifferences(prev.collapsedList, next.collapsedList);
    }
    if (prev.selections !== next.selections) {
      this.wakeDifferences(prev.selections, next.selections);
    }
    if (prev.markedMap !== next.markedMap) {
      this.wakeKeyDifferences(prev.markedMap, next.markedMap);
    }
    if (prev.editable !== next.editable) {
      this.wakeKeyDifferences(prev.editable, next.editable);
    }
    if (prev.astData !== next.astData) {
      // what an editable gap points at depends on the AST
      for (const id of Object.keys(next.editable)) {
        if (next.editable[id]) this.wake(id);
      }
    }
    if (prev.errorId !== next.errorId) {
      this.wake(prev.errorId);
      this.wake(next.errorId);
    }
    if ((prev.errorId === "") !== (next.errorId === "")) {
      for (const set of [...this.listeners.values()]) set.forEach((l) => l());
    }
  }
}

const hubs = new WeakMap<object, Hub>();
const hubFor = (store: Store) => {
  let hub = hubs.get(store);
  if (!hub) hubs.set(store, (hub = new Hub(store)));
  return hub;
};

/**
 * Like `useSelector((state) => select(state))`, for an answer about the thing
 * with this id: `select` must only change when the store's focus, collapsed,
 * selected, marked or editable state for that id (or the error state, or
 * whether it is the one with the error) does.
 */
export function useIdState<T>(id: string, select: (state: RootState) => T): T {
  const store = useStore<RootState>();
  const subscribe = useCallback(
    (listener: () => void) => hubFor(store).subscribe(id, listener),
    [store, id]
  );
  return useSyncExternalStore(subscribe, () => select(store.getState()));
}
