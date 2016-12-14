import React, {Component, PropTypes} from 'react';

import {VariableDefinition as ASTVariableDefinitionNode} from '../ast';
import Node from './Node';
import DropTarget from './DropTarget';

export default class VariableDefinition extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTVariableDefinitionNode).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired,
    }).isRequired
  }

  render() {
    const {node, helpers} = this.props;
    return (
      <Node type="variableDef" node={node}>
        <span className="blocks-operator">define &nbsp; {helpers.renderNodeForReact(node.name)}</span>
        <span className="blocks-args">
          {helpers.renderNodeForReact(node.body)}
        </span>
      </Node>
    );
  }
}
