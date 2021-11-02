import { createSelector } from "reselect";
import { ASTNode } from "../ast";
import { RootState } from "./reducers";

const selectNode = (state: RootState, node: ASTNode) => node;

const selectCollapsedList = (state: RootState) => state.collapsedList;
export const isCollapsed = createSelector(
  [selectCollapsedList, (state: RootState, nodeId: string) => nodeId],
  (collapsedList, nodeId) => collapsedList.includes(nodeId)
);

const selectSelections = (state: RootState) => state.selections;
export const isSelected = createSelector(
  [selectSelections, selectNode],
  (selections, node) => selections.includes(node.id)
);

const selectMarkedMap = (state: RootState) => state.markedMap;
export const getTextMarker = createSelector(
  [selectMarkedMap, selectNode],
  (markedMap, node) => markedMap[node.id]
);

export const selectAST = (state: RootState) => state.ast;

export const getNodeParent = createSelector(
  [selectAST, selectNode],
  (ast, node) => ast.getNodeParent(node)
);

export const getNodeAfter = createSelector(
  [selectAST, selectNode],
  (ast, node) => ast.getNodeAfter(node)
);
