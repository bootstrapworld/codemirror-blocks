import React, {Component, PropTypes} from 'react';

import {VariableDefinition as ASTVariableDefinitionNode} from '../ast';
import Node from './Node';

export default class VariableDefinition extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTVariableDefinitionNode).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired,
    }).isRequired,
    lockedTypes: PropTypes.instanceOf(Array).isRequired,
  }

  render() {
    const {node, helpers, lockedTypes} = this.props;
    return (
      <Node type="variableDef" node={node} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-operator">define {helpers.renderNodeForReact(node.name)}</span>
        <span className="blocks-args">
          {helpers.renderNodeForReact(node.body)}
        </span>
      </Node>
    );
  }
}
