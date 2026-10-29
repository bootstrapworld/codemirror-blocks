import { createAppStore } from "../../src/state/store";
import * as actions from "../../src/state/actions";
import { getReducerActivities } from "../../src/state/activityLog";
import type { ReadonlyCMBEditor } from "../../src/editor";

const fakeEditor = (item: Record<string, unknown> = {}) =>
  ({
    getTopmostAction: jest.fn(() => item),
  } as unknown as ReadonlyCMBEditor);

describe("undo/redo bookkeeping in the store", () => {
  it("stores the pending action and focus", () => {
    const store = createAppStore();
    store.dispatch(actions.setUndoableAction("deleted foo"));
    store.dispatch(actions.setActionFocus({ oldFocusNId: 1, newFocusNId: 2 }));
    expect(store.getState().undoableAction).toBe("deleted foo");
    expect(store.getState().actionFocus).toEqual({
      oldFocusNId: 1,
      newFocusNId: 2,
    });
  });

  it("never mutates a state that was already handed out", () => {
    const store = createAppStore();
    const before = store.getState();
    store.dispatch(actions.setUndoableAction("deleted foo"));
    expect(before.undoableAction).toBeUndefined();
    expect(store.getState()).not.toBe(before);
  });

  (["undo", "redo"] as const).forEach((which) => {
    it(`moves the pending state onto the opposite history item after a ${which}`, () => {
      const store = createAppStore();
      const item: Record<string, unknown> = {};
      const editor = fakeEditor(item);
      const focus = { oldFocusNId: 3 };
      store.dispatch(actions.setUndoableAction("inserted x"));
      store.dispatch(actions.setActionFocus(focus));

      store.dispatch(actions.finishUndoOrRedo(which, editor));

      expect(editor.getTopmostAction).toHaveBeenCalledWith(
        which === "undo" ? "redo" : "undo"
      );
      expect(item).toEqual({
        undoableAction: "inserted x",
        actionFocus: focus,
      });
      expect(store.getState().undoableAction).toBeUndefined();
      expect(store.getState().actionFocus).toBeUndefined();
    });
  });

  it("records undo/redo in a log that can be serialized", () => {
    const store = createAppStore();
    store.dispatch(actions.finishUndoOrRedo("undo", fakeEditor()));
    const log = getReducerActivities();
    expect(log[log.length - 1]).toEqual({ type: "UNDO" });
    expect(() => JSON.stringify(log)).not.toThrow();
  });
});
