import { TextMarker } from "codemirror";
import { createSelector } from "reselect";
import { AST, ASTNode } from "../ast";
import { RootState } from "./reducers";

const getNode = (state: RootState, node: ASTNode) => node;

/**
 * Get an AST object using data from the store
 */
export const getAST = (state: RootState) => new AST(state.astData);

/**
 * Get the entire list of collapsed nodes.
 */
const getCollapsedList = (state: RootState) => state.collapsedList;

/**
 * @param node The node to check.
 * @returns Whether or not the given node is collapsed.
 */
export const isCollapsed: (state: RootState, node: ASTNode) => boolean =
  createSelector([getCollapsedList, getNode], (collapsedList, node) =>
    collapsedList.includes(node.id)
  );

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
 * Returns whether or not the given node is selected.
 * @param node The node to check.
 * @returns The selection state for the given node.
 */
export const isSelected: (state: RootState, node: ASTNode) => boolean =
  createSelector([getSelectedNodeIds, getNode], (selections, node) =>
    selections.includes(node.id)
  );

const getMarkedMap = (state: RootState) => state.markedMap;

/**
 * Get the codemirror TextMarker for the given node.
 */
export const getTextMarker: (state: RootState, node: ASTNode) => TextMarker =
  createSelector(
    [getMarkedMap, getNode],
    (markedMap, node) => markedMap[node.id]
  );

/**
 * Returns the parent node for the given node
 */
export const getNodeParent = createSelector([getAST, getNode], (ast, node) =>
  ast.getNodeParent(node)
);

/**
 * Returns the next node in the AST from the given node
 */
export const getNodeAfter = createSelector([getAST, getNode], (ast, node) =>
  ast.getNodeAfter(node)
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
    (ast, focusId) => (focusId ? ast.getNodeById(focusId) ?? null : null)
  );
