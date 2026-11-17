/** stands for the old redux `src/state/actions`: this editor has no store, so these only say so */
export const setQuarantine = (..._a: unknown[]): never => {
  throw new Error("not in the compat layer: store.dispatch(actions.setQuarantine(...)) (a quarantine is a redux state of the old editor)");
};
