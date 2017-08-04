import React, {Component, PropTypes} from 'react';

import {StructDefinition as ASTStructDefinitionNode} from '../ast';
import Node from './Node';
import DropTarget from './DropTarget';

export default class StructDefinition extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTStructDefinitionNode).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired,
    }).isRequired,
    lockedTypes: PropTypes.instanceOf(Array).isRequired,
  }

  render() {
    const {node, helpers, lockedTypes} = this.props;
    return (
      <Node type="struct" node={node} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-operator">
          define-struct {helpers.renderNodeForReact(node.name)}
        </span>
        {helpers.renderNodeForReact(node.fields)}
      </Node>
    );
  }
}