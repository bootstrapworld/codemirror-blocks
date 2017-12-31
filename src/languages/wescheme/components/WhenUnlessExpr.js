import React, {Component} from 'react';
import PropTypes from 'prop-types';

import {WhenUnless as ASTWhenUnlessNode} from '../ast';
import Node from '../../../components/Node';

export default class WhenUnlessExpr extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTWhenUnlessNode).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired,
    }).isRequired,
    lockedTypes: PropTypes.instanceOf(Array).isRequired,
  }

  render() {
    const {node, helpers, lockedTypes} = this.props;
    return (
      <Node type="whenUnlessExpr" node={node} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-operator">{node.form}</span>
        {helpers.renderNodeForReact(node.predicate)}
        {helpers.renderNodeForReact(node.exprs)}
      </Node>
    );
  }
}
