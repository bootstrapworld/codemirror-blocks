import React from 'react';

import Node from './Node';
import DropTarget from './DropTarget';
import Block from './Block';

export default class CondClause extends Block {
  render() {
    const {node, helpers, lockedTypes} = this.props;
    return (
      <Node node={node} lockedTypes={lockedTypes} helpers={helpers}>
        <div className="blocks-cond-row">
          <div className="blocks-cond-predicate">
            <DropTarget location={node.testExpr.from} />
            {helpers.renderNodeForReact(node.testExpr)}
          </div>
          <div className="blocks-cond-result">
            {node.thenExprs.map((thenExpr, index) => (
              <span key={index}>
                <DropTarget location={thenExpr.from} />
                {helpers.renderNodeForReact(thenExpr)}
              </span>))}
          </div>
        </div>
        <div className="blocks-cond-drop-row">
          <DropTarget location={node.from} />
        </div>
      </Node>
    );
  }
}