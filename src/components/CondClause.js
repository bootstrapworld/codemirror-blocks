import React, {Component} from 'react';
import PropTypes from 'prop-types';

import {CondClause as ASTCondClauseNode} from '../ast';
import Node from './Node';
import DropTarget from './DropTarget';

export default class CondClause extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTCondClauseNode).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired,
    }).isRequired,
    lockedTypes: PropTypes.instanceOf(Array).isRequired,
  }

  render() {
    const {node, helpers, lockedTypes} = this.props;
    return (
      <Node type="condClause" node={node} lockedTypes={lockedTypes} helpers={helpers}>
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