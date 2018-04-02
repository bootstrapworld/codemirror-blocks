import React, {Component} from 'react';
import PropTypes from 'prop-types';

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
      <Node node={node} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-operator">cond</span>
        <div className="blocks-cond-table">
          {node.clauses.map((clause, index) => helpers.renderNodeForReact(clause, index)) }
        </div>
      </Node>
    );
  }
}