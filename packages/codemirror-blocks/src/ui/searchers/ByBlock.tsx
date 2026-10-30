import React, { Component } from "react";
import { skipWhile, getNodeContainingBiased } from "../../utils";
import { AST, ASTNode } from "../../ast";
import * as selectors from "../../state/selectors";
import { Searcher } from "./Searcher";

function getAllNodeTypes(ast: AST) {
  const allNodeTypes: Set<string> = new Set();
  for (const node of ast.getAllNodes()) {
    allNodeTypes.add(node.type);
  }
  return allNodeTypes;
}

type SearchSettings = {
  blockType: string;
};

type Props = {
  cmbState: {
    ast: AST;
  };
  setting: SearchSettings;
  onChange: (
    e: SearchSettings & { [targetName: string]: string | boolean }
  ) => void;
};

const ByBlock: Searcher<SearchSettings, Props> = {
  label: "Search by block",
  setting: { blockType: "" },
  component: class extends Component<Props> {
    static displayName = "Search by Block";

    handleChange: React.ChangeEventHandler<
      HTMLSelectElement | HTMLInputElement
    > = (e) => {
      let value: string | boolean;
      if (
        e.target instanceof HTMLInputElement &&
        e.target.type === "checkbox"
      ) {
        value = e.target.checked;
      } else {
        value = e.target.value;
      }
      this.props.onChange({
        ...this.props.setting,
        [e.target.name]: value,
      });
    };

    render() {
      const {
        setting,
        cmbState: { ast },
      } = this.props;

      const allNodeTypes = getAllNodeTypes(ast);
      const types = Array.from(allNodeTypes).sort();
      return (
        <select
          name="blockType"
          value={setting.blockType}
          onChange={this.handleChange}
        >
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      );
    }
  },
  search: (cur, settings, editor, state, forward) => {
    const ast = selectors.getAST(state);
    const { collapsedList } = state;
    const next = (node: ASTNode) =>
      forward ? ast.getNodeAfter(node) : ast.getNodeBefore(node);
    // Look for a match after the block the cursor is in. A cursor between
    // blocks is in none, so the block after it (before it, going backwards) is
    // the first to look at.
    const containing = getNodeContainingBiased(cur, ast);
    const first = containing
      ? next(containing)
      : forward
        ? ast.getNodeAfterCur(cur)
        : ast.getNodeBeforeCur(cur);

    const collapsedNodeList = collapsedList.map(ast.getNodeById);
    // NOTE(Oak): if this is too slow, consider adding a
    // next/prevSibling attribute to short circuit navigation
    const result = skipWhile(
      (node) => {
        return (
          collapsedNodeList.some(
            (collapsed) => collapsed && ast.isAncestor(collapsed.id, node.id)
          ) || node.type !== settings.blockType
        );
      },
      first,
      next
    );
    if (result) return { node: result, cursor: result.from };
    return null;
  },
};

export default ByBlock;
