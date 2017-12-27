import React, {Component} from 'react';
import PropTypes from 'prop-types';

import {LetLikeExpr as ASTLetLikeExprNode} from '../ast';
import Node from '../../../components/Node';

export default class LetLikeExpr extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTLetLikeExprNode).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired,
    }).isRequired,
    lockedTypes: PropTypes.instanceOf(Array).isRequired,
  }

  render() {
    const {node, helpers, lockedTypes} = this.props;
    return (
      <Node type="letLikeExpr" node={node} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-operator">{node.form}</span>
        {helpers.renderNodeForReact(node.bindings)}
        {helpers.renderNodeForReact(node.expr)}
      </Node>
    );
  }
}
