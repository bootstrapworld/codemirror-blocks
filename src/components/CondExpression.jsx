import React from 'react';

import Node from './Node';
import Block from './Block';

export default class CondExpression extends Block {
  render() {
    const {node, helpers, lockedTypes} = this.props;
    return (
      <Node node={node} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-operator">cond</span>
        <div className="blocks-cond-table">
          {node.clauses.map((clause, index) => helpers.renderNodeForReact(clause, index)) }
        </div>
      </Node>
    );
  }
}