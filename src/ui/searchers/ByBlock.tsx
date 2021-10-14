import React, { Component } from "react";
import { skipWhile, getNodeContainingBiased } from "../../utils";
import { AST, ASTNode, Pos } from "../../ast";
import { Searcher } from "./Searcher";

function getAllNodeTypes(ast: AST) {
  const allNodeTypes: Set<string> = new Set();
  for (const node of ast.nodeIdMap.values()) {
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
    displayName = "Search by Block";

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
  search: (cur, settings, editor, { ast, collapsedList }, forward) => {
    let startingNode = getNodeContainingBiased(cur, ast);
    if (!startingNode) {
      startingNode = forward
        ? ast.getNodeAfterCur(cur)
        : ast.getNodeBeforeCur(cur);
    }

    // handle the cursor before first / after last block
    if (!startingNode) {
      // TODO(Oak)
    }

    const collapsedNodeList = collapsedList.map(ast.getNodeById);
    const next = (node: ASTNode | null) =>
      forward ? node?.next : node && ast.getNodeBefore(node);

    // NOTE(Oak): if this is too slow, consider adding a
    // next/prevSibling attribute to short circuit navigation
    const result = skipWhile(
      (node) => {
        return (
          node &&
          (collapsedNodeList.some(
            (collapsed) => collapsed && ast.isAncestor(collapsed.id, node.id)
          ) ||
            node.type !== settings.blockType)
        );
      },
      next(startingNode),
      next
    );
    if (result) return { node: result, cursor: result.from };
    return null;
  },
};

export default ByBlock;
