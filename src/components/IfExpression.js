import React, {Component} from 'react';
import PropTypes from 'prop-types';

import {IfExpression as ASTIfExpressionNode} from '../ast';
import Node from './Node';
import DropTarget from './DropTarget';

export default class IfExpression extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTIfExpressionNode).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired,
    }).isRequired,
    lockedTypes: PropTypes.instanceOf(Array).isRequired,
  }

  render() {
    const {node, helpers, lockedTypes} = this.props;
    return (
      <Node type="ifExpression" node={node} lockedTypes={lockedTypes} helpers={helpers}>
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

