import React, {Component, PropTypes} from 'react';

import {CondExpression as ASTCondExpressionNode} from '../ast';
import Node from './Node';
import DropTarget from './DropTarget';
import CondClause from './CondClause';

export default class CondExpression extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTCondExpressionNode).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired,
    }).isRequired
  }

  render() {
    const {node, helpers} = this.props;
    return (
      <Node type="condExpression" node={node}>
        <span className="blocks-operator">cond</span>
          <table className="blocks-cond-table">
            {node.clauses.map((clause, index) => 
               <CondClause node={clause} key={index} helpers={helpers}/>)
              }
        </table>
      </Node>
    );
  }
}