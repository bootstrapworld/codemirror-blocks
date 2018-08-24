import React from 'react';
import PropTypes from 'prop-types';
import Component from './BlockComponent';

import {FunctionDefinition as ASTFunctionDefinitionNode} from '../ast';
import Node from './Node';
import DropTarget from './DropTarget';

export default class FunctionDefinition extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTFunctionDefinitionNode).isRequired,
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
          define (
          <DropTarget location={node.name.from} />
          {helpers.renderNodeForReact(node.name)}
          {helpers.renderNodeForReact(node.params)}
          )
        </span>
        <span className="blocks-args">
          {helpers.renderNodeForReact(node.body)}
        </span>
      </Node>
    );
  }
}
