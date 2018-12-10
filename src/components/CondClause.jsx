import React from 'react';
import PropTypes from 'prop-types';
import Component from './BlockComponent';

import {CondClause as ASTCondClauseNode} from '../ast';
import Node from './Node';
import makeDropTargets from './makeDropTargets';

export default class CondClause extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTCondClauseNode).isRequired,
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
    const {node, helpers, lockedTypes} = this.props;
    const DropTarget = this.DropTarget;
    return (
      <Node node={node} lockedTypes={lockedTypes} helpers={helpers}>
        <div className="blocks-cond-row">
          <div className="blocks-cond-predicate">
            <DropTarget index={0} location={node.testExpr.from} />
             {helpers.renderNodeForReact(node.testExpr)}
          </div>
          <div className="blocks-cond-result">
            {node.thenExprs.map((thenExpr, index) => (
              <span key={index}>
                <DropTarget index={index+1} location={thenExpr.from} />
                {helpers.renderNodeForReact(thenExpr)}
              </span>))}
          </div>
        </div>
        <DropTarget index={node.thenExprs.length + 1} location={node.from} />
      </Node>
    );
  }
}
