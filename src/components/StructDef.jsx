import React, {Component} from 'react';
import PropTypes from 'prop-types';

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
      <Node node={node} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-operator">
          define-struct 
          <DropTarget location={node.name.from} />
          {helpers.renderNodeForReact(node.name)}
          <DropTarget location={node.name.to} />
        </span>
        {helpers.renderNodeForReact(node.fields)}
      </Node>
    );
  }
}