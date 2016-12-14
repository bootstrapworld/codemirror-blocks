import React, {Component, PropTypes} from 'react';

import {IfExpression as ASTIfExpressionNode} from '../ast';
import Node from './Node';
import DropTarget from './DropTarget';

export default class IfExpression extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTIfExpressionNode).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired,
    }).isRequired
  }

  render() {
    const {node, helpers} = this.props;
    return (
      <Node type="ifExpression" node={node}>
        <span className="blocks-operator">if</span>
        <table className="blocks-cond-table">
          <tbody>
            <tr className="blocks-cond-row">
              <td className="blocks-cond-predicate">
                {helpers.renderNodeForReact(node.testExpr)}
              </td>
              <td className="blocks-cond-result">
                {helpers.renderNodeForReact(node.thenExpr)}
              </td>
            </tr>
            <tr className="blocks-cond-row">
              <td className="blocks-cond-predicate blocks-cond-else">
                else
              </td>
              <td className="blocks-cond-result">
                {helpers.renderNodeForReact(node.elseExpr)}
              </td>
            </tr>
          </tbody>
        </table>
      </Node>
    );
  }
}

