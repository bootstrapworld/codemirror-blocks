import React from 'react';

import Node from './Node';
import Block from './Block';
import Args from './Args';

export default class IdentifierList extends Block {
  render() {
    const {node, helpers, lockedTypes} = this.props;
    return (
      <Node node={node} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-args">
          <Args helpers={helpers}>{node.ids}</Args>
        </span>
      </Node>
    );
  }
}