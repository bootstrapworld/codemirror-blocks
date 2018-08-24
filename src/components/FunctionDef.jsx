import React from 'react';

import Node from './Node';
import DropTarget from './DropTarget';
import Block from './Block';

export default class FunctionDefinition extends Block {
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