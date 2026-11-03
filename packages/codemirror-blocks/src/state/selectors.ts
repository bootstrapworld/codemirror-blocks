import { TextMarker } from "codemirror";
import { createSelector } from "reselect";
import { AST, ASTNode } from "../ast";
import { RootState } from "./reducers";

const getNode = (state: RootState, node: ASTNode) => node;

/**
 * Get an AST object using data from the store
 */
export const getAST: (state: RootState) => AST = createSelector(
  [(state: RootState) => state.astData],
  (astData) => new AST(astData)
);

/**
 * Get the entire list of collapsed nodes.
 */
export const getCollapsedList = (state: RootState) => state.collapsedList;

type NodeSelector<T> = (state: RootState, node: ASTNode) => T;

// (for a block's own state: it only needs the id, so it can ask with a node that
// may be older than the document, see DrawnNode)
type IdSelector<T> = (state: RootState, node: { id: string }) => T;

/**
 * @param node The node to check.
 * @returns Whether or not the given node is collapsed.
 */
export const isCollapsed: IdSelector<boolean> = (state, node) =>
  asSet(getCollapsedList(state)).has(node.id);

// The lists change rarely and every block asks about them on every dispatch, so
// look them up in a set (made once per list) rather than scanning them.
const sets = new WeakMap<readonly string[], Set<string>>();
const asSet = (list: readonly string[]) => {
  let set = sets.get(list);
  if (!set) sets.set(list, (set = new Set(list)));
  return set;
};

/**
 * @returns all selected node ids
 */
export const getSelectedNodeIds = (state: RootState) => state.selections;

/**
 * Note, this will throw if the node ids in the the state
 * are not consistent across the ast and the selection list.
 *
 * @returns the selected ASTNode instances
 */
export const getSelectedNodes: (state: RootState) => ASTNode[] = createSelector(
  [getAST, getSelectedNodeIds],
  (ast, selections) =>
    selections.map((selection) => ast.getNodeByIdOrThrow(selection))
);
/**
 * Selecting a block selects everything inside it too, so copying, cutting or
 * deleting "the selected nodes" must only act on the outermost ones: otherwise
 * the contents are copied twice, and deleting a node together with its own
 * children breaks the edit.
 *
 * @returns the selected nodes that are not inside another selected node
 */
export const getOutermostSelectedNodes: (state: RootState) => ASTNode[] =
  createSelector([getAST, getSelectedNodes], (ast, nodes) =>
    nodes.filter(
      (node) => !nodes.some((other) => ast.isAncestor(other.id, node.id))
    )
  );
/**
 * Returns whether or not the given node is selected.
 * @param node The node to check.
 * @returns The selection state for the given node.
 */
export const isSelected: IdSelector<boolean> = (state, node) =>
  asSet(getSelectedNodeIds(state)).has(node.id);

const getMarkedMap = (state: RootState) => state.markedMap;

/**
 * Get the codemirror TextMarker for the given node.
 */
export const getTextMarker: IdSelector<TextMarker> = (state, node) =>
  getMarkedMap(state)[node.id];

/**
 * Returns the parent node for the given node
 */
export const getNodeParent: NodeSelector<ASTNode | null> = createSelector(
  [getAST, getNode],
  (ast, node) => ast.getNodeParent(node)
);

/**
 * Returns the next node in the AST from the given node
 */
export const getNodeAfter: NodeSelector<ASTNode | null> = createSelector(
  [getAST, getNode],
  (ast, node) => ast.getNodeAfter(node)
);

/**
 * @returns The current error id
 */
export const getErrorId = (state: RootState) => state.errorId;
/**
 * @returns Whether or not there is currently an error
 */
export const isErrorFree: (state: RootState) => boolean = createSelector(
  [getErrorId],
  (errorId) => errorId === ""
);

/**
 * @returns The currently focused node, or null if there is none.
 */
export const getFocusedNode: (state: RootState) => ASTNode | null =
  createSelector(
    [getAST, (state: RootState) => state.focusId],
    (ast, focusId) => (focusId ? (ast.getNodeById(focusId) ?? null) : null)
  );

/**
 * @returns whether the given node is the focused one. (Unlike
 * {@link getFocusedNode} this is a boolean, so a block that uses it renders
 * only when its own answer changes.)
 */
export const isFocused: IdSelector<boolean> = (state, node) =>
  state.focusId === node.id;

/**
 * @returns whether some other node than the given one is focused
 */
export const isFocusedElsewhere: IdSelector<boolean> = (state, node) =>
  !!state.focusId && state.focusId !== node.id;

/**
 * @returns the current quarantine if there is one.
 */
export const getQuarantine = (state: RootState) => state.quarantine;

/**
 * @returns whether or not block mode is enabled
 */
export const isBlockModeEnabled = (state: RootState) => state.blockMode;

/**
 * @returns a string representation of the code.
 */
export const getCode = (state: RootState) => state.code;

export const getEditable = (state: RootState) => state.editable;
