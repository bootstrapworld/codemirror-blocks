import React, {Component, PropTypes} from 'react';

import {Literal as ASTLiteralNode} from '../ast';
import Node from './Node';

export default class Literal extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTLiteralNode).isRequired
  }
  render() {
    const {node} = this.props;
    return (
      <Node type="literal" node={node}>
        <span className={`blocks-literal-${node.dataType}`}>
        {node.value.toString()}
        </span>
      </Node>
    );
  }
}
