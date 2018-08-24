import React from 'react';

import Node from './Node';
import Block from './Block';
import Args from './Args';

export default class VariableDefinition extends Block {
  render() {
    const {node, helpers, lockedTypes} = this.props;
    return (
      <Node node={node} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-operator">
          define 
          <Args helpers={helpers}>{[node.name]}</Args>
        </span>
        <span className="blocks-args">
          {helpers.renderNodeForReact(node.body)}
        </span>
      </Node>
    );
  }
}
