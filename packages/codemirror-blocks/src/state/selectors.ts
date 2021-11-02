import { createSelector } from "reselect";
import { AST, ASTNode } from "../ast";
import { RootState } from "./reducers";

const selectNode = (state: RootState, node: ASTNode) => node;

export const selectCollapsedList = (state: RootState) => state.collapsedList;

/**
 * Returns whether or not the given node is collapsed.
 * @param node The node to check.
 * @returns Whether or not the given node is collapsed.
 */
export const isCollapsed = createSelector(
  [selectCollapsedList, selectNode],
  (collapsedList, node) => collapsedList.includes(node.id)
);

export const selectSelections = (state: RootState) => state.selections;

/**
 * Returns whether or not the given node is selected.
 * @param node The node to check.
 * @returns The selection state for the given node.
 */
export const isSelected = createSelector(
  [selectSelections, selectNode],
  (selections, node) => selections.includes(node.id)
);

const selectMarkedMap = (state: RootState) => state.markedMap;
export const getTextMarker = createSelector(
  [selectMarkedMap, selectNode],
  (markedMap, node) => markedMap[node.id]
);

export const selectAST = (state: RootState) => new AST(state.astData);

/**
 * Returns the parent node for the given node
 */
export const getNodeParent = createSelector(
  [selectAST, selectNode],
  (ast, node) => ast.getNodeParent(node)
);

/**
 * Returns the next node in the AST from the given node
 */
export const getNodeAfter = createSelector(
  [selectAST, selectNode],
  (ast, node) => ast.getNodeAfter(node)
);

export const getErrorId = (state: RootState) => state.errorId;
export const isErrorFree = createSelector(
  [getErrorId],
  (errorId) => errorId === ""
);
