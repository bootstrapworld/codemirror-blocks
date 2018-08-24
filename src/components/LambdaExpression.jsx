import React from 'react';

import Node from './Node';
import Block from './Block';

export default class LambdaExpression extends Block {
  render() {
    const {node, helpers, lockedTypes} = this.props;
    return (
      <Node node={node} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-operator">
          &lambda; (
          {helpers.renderNodeForReact(node.args)}
          )
        </span>
        <span className="blocks-args">
          {helpers.renderNodeForReact(node.body)}
        </span>
      </Node>
    );
  }
}