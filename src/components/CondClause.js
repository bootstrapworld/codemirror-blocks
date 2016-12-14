import React, {Component, PropTypes} from 'react';

import {CondClause as ASTCondClauseNode} from '../ast';
import Node from './Node';
import DropTarget from './DropTarget';

export default class CondClause extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTCondClauseNode).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired,
    }).isRequired
  }

  render() {
    const {node, helpers} = this.props;
    return (
      <tbody>
        <tr>
          <td className="blocks-cond-predicate">
              {helpers.renderNodeForReact(node.testExpr)}
          </td>
          <td className="blocks-cond-result">
              {node.thenExprs.map((thenExpr, index) => (
               <span key={index}>
                 {helpers.renderNodeForReact(thenExpr)}
                 <DropTarget location={thenExpr.to} />
               </span>))}
          </td>
        </tr>
        <tr className="blocks-cond-drop-row">
          <td colSpan="2"><DropTarget location={node.from} /></td>
        </tr>
      </tbody>
    );
  }
}