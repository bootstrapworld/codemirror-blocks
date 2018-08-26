import React from 'react';

import Node from './Node';
import Args from './Args';
import Block from './Block';

export default class Expression extends Block {
  render() {
    const {node, helpers, lockedTypes} = this.props;
    return (
      <Node node={node} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-operator">
          <Args helpers={helpers}>{[node.func]}</Args>
        </span>
        <span className="blocks-args">
          <Args helpers={helpers} location={node.func.to}>{node.args}</Args>
        </span>
      </Node>
    );
  }
}