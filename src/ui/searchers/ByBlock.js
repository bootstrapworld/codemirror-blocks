import React, {Component} from 'react';
import PropTypes from 'prop-types/prop-types';
import {skipWhile, getNodeContainingBiased} from '../../utils';

function getAllNodeTypes(ast) {
  const allNodeTypes = new Set();
  for (const node of ast.nodeIdMap.values()) {
    allNodeTypes.add(node.type);
  }
  return allNodeTypes;
}

export default {
  label: 'Search by block',
  setting: {blockType: ''},
  component: class extends Component {
    static propTypes = {
      cmbState: PropTypes.object,
      setting: PropTypes.object.isRequired,
      onChange: PropTypes.func.isRequired,
    }

    displayName = 'Search by Block'

    handleChange = e => {
      this.props.onChange({
        ...this.props.setting,
        [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
      });
    }

    render() {
      const {setting, cmbState: {ast}} = this.props;

      const allNodeTypes = getAllNodeTypes(ast);
      const types = Array.from(allNodeTypes).sort();
      return (
        <select name="blockType" value={setting.blockType} onChange={this.handleChange}>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      );
    }
  },
  search: (cur, settings, cm, {ast, collapsedList}, forward) => {
    let startingNode = getNodeContainingBiased(cur, ast);
    if (!startingNode) {
      startingNode = forward ?
        ast.getNodeAfterCur(cur) :
        ast.getNodeBeforeCur(cur);
    }

    // handle the cursor before first / after last block
    if (!startingNode) {
      // TODO(Oak)
    }

    const collapsedNodeList = collapsedList.map(ast.getNodeById);
    const next = node => forward ? node.next : node.prev;

    // NOTE(Oak): if this is too slow, consider adding a
    // next/prevSibling attribute to short circuit navigation
    const result = skipWhile(
      node => {
        return node && (collapsedNodeList.some(
          collapsed => ast.isAncestor(collapsed.id, node.id)
        ) || node.type !== settings.blockType);
      },
      next(startingNode),
      next
    );
    if (result) return {node: result, cursor: result.from};
    return null;
  }
};
