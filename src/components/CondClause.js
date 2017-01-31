import React, {Component, PropTypes} from 'react';

import {CondClause as ASTCondClauseNode} from '../ast';
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
      <tbody 
        type="condClause" 
        className={`blocks-node blocks-${node.type}`}
        tabIndex="1"
        role="treeitem"
        aria-label={node.options['aria-label']}
        id={`block-node-${node.id}`}>
        <tr>
          <td className="blocks-cond-predicate">
              <DropTarget location={node.testExpr.from} />
              {helpers.renderNodeForReact(node.testExpr)}
          </td>
          <td className="blocks-cond-result">
              {node.thenExprs.map((thenExpr, index) => (
               <span key={index}>
                 <DropTarget location={thenExpr.from} />
                 {helpers.renderNodeForReact(thenExpr)}
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