import React, {Component, PropTypes} from 'react';

import {Literal as ASTLiteralNode} from '../ast';
import Node from './Node';

export default class Literal extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTLiteralNode).isRequired,
    lockedTypes: PropTypes.instanceOf(Array).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired,
    }).isRequired,
  }
  render() {
    const {node, lockedTypes, helpers} = this.props;
    return (
      <Node type="literal" node={node} lockedTypes={lockedTypes} helpers={helpers}>
        <span className={`blocks-literal-${node.dataType}`}>
        {node.value.toString()}
        </span>
      </Node>
    );
  }
}
