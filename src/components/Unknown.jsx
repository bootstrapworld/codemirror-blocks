import React from 'react';

import Node from './Node';
import Block from './Block';
import Args from './Args';

export default class Unknown extends Block {
  render() {
    const {node, helpers, lockedTypes} = this.props;
    let firstElt = node.elts[0];
    let restElts = node.elts.slice(1);
    return (
      <Node node={node} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-operator">{helpers.renderNodeForReact(firstElt)}</span>
        <span className="blocks-args">
          <Args helpers={helpers} location={firstElt.to}>{restElts}</Args>
        </span>
      </Node>
    );
  }
}
