import React from 'react';

import Node from './Node';
import Block from './Block';
import DropTarget from './DropTarget';
import Args from './Args';

export default class Sequence extends Block {
  render() {
    const {node, helpers, lockedTypes} = this.props;
    return (
      <Node node={node} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-operator">{node.name}</span>
        <div className="blocks-sequence-exprs">
          <Args helpers={helpers} location={node.name.to}>{node.exprs}</Args>
        </div>
      </Node>
    );
  }
}
