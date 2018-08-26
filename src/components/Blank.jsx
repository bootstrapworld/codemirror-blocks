import React from 'react';

import Node from './Node';
import Block from './Block';

export default class Literal extends Block {
  render() {
    const {node, lockedTypes, helpers} = this.props;
    return (
      <Node node={node} lockedTypes={lockedTypes} helpers={helpers}>
        <span className={`blocks-literal-symbol`}>
        
        </span>
      </Node>
    );
  }
}
