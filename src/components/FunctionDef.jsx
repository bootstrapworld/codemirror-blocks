import React from 'react';
import PropTypes from 'prop-types';
import Component from './BlockComponent';

import {FunctionDefinition as ASTFunctionDefinitionNode} from '../ast';
import Node from './Node';
import makeDropTargets from './makeDropTargets';

export default class FunctionDefinition extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTFunctionDefinitionNode).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired,
    }).isRequired,
    lockedTypes: PropTypes.instanceOf(Array).isRequired,
  }

  constructor() {
    super();
    this.state = {};
    this.DropTarget = makeDropTargets(this);
  }

  render() {
    const {node, helpers, lockedTypes} = this.props;
    const DropTarget = this.DropTarget;
    return (
      <Node node={node} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-operator">
          define (<DropTarget index={0} location={node.name.from} />
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
