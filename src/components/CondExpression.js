import React, {Component, PropTypes} from 'react';

import {CondExpression as ASTCondExpressionNode} from '../ast';
import Node from './Node';

export default class CondExpression extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTCondExpressionNode).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired,
    }).isRequired,
    lockedTypes: PropTypes.instanceOf(Array).isRequired,
  }

  render() {
    const {node, helpers, lockedTypes} = this.props;
    return (
      <Node type="condExpression" node={node} lockedTypes={lockedTypes}>
        <span className="blocks-operator">cond</span>
          <table className="blocks-cond-table">
            {node.clauses.map((clause, index) => 
               helpers.renderNodeForReact(clause, index))
              }
        </table>
      </Node>
    );
  }
}