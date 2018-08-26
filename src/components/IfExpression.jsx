import React from 'react';

import Node from './Node';
import DropTarget from './DropTarget';
import Block from './Block';

export default class IfExpression extends Block {
  render() {
    const {node, helpers, lockedTypes} = this.props;
    return (
      <Node node={node} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-operator">if</span>
        <div className="blocks-cond-table">
          <div className="blocks-cond-row">
            <div className="blocks-cond-predicate">
              <DropTarget location={node.testExpr.from} />
              {helpers.renderNodeForReact(node.testExpr)}
            </div>
            <div className="blocks-cond-result">
              <DropTarget location={node.thenExpr.from} />
              {helpers.renderNodeForReact(node.thenExpr)}
            </div>
          </div>
          <div className="blocks-cond-row">
            <div className="blocks-cond-predicate blocks-cond-else">
              else
            </div>
            <div className="blocks-cond-result">
              <DropTarget location={node.elseExpr.from} />
              {helpers.renderNodeForReact(node.elseExpr)}
            </div>
          </div>
        </div>
      </Node>
    );
  }
}

