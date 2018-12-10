import React from 'react';
import PropTypes from 'prop-types';
import Component from './BlockComponent';

import {IfExpression as ASTIfExpressionNode} from '../ast';
import Node from './Node';
import makeDropTargets from './makeDropTargets';

export default class IfExpression extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTIfExpressionNode).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired,
    }).isRequired,
    lockedTypes: PropTypes.instanceOf(Array).isRequired,
  }

  constructor() {
    super();
    this.state = {};
    this.DropTarget = makeDropTargets(this);
  }

  render() {
    const DropTarget = this.DropTarget;
    const {node, helpers, lockedTypes} = this.props;
    return (
      <Node node={node} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-operator">if</span>
        <div className="blocks-cond-table">
          <div className="blocks-cond-row">
            <div className="blocks-cond-predicate">
              <DropTarget index={0} location={node.testExpr.from} />
              {helpers.renderNodeForReact(node.testExpr)}
            </div>
            <div className="blocks-cond-result">
              <DropTarget index={1} location={node.thenExpr.from} />
              {helpers.renderNodeForReact(node.thenExpr)}
            </div>
          </div>
          <div className="blocks-cond-row">
            <div className="blocks-cond-predicate blocks-cond-else">
              else
            </div>
            <div className="blocks-cond-result">
              <DropTarget index={2} location={node.elseExpr.from} />
              {helpers.renderNodeForReact(node.elseExpr)}
            </div>
            <div className="blocks-cond-result">
              <DropTarget index={3} location={node.elseExpr.to} />
            </div>
          </div>
        </div>
      </Node>
    );
  }
}

