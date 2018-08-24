import React from 'react';
import PropTypes from 'prop-types';
import Component from './BlockComponent';

import {LambdaExpression as ASTLambdaExpressionNode} from '../ast';
import Node from './Node';

export default class LambdaExpression extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTLambdaExpressionNode).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired,
    }).isRequired,
    lockedTypes: PropTypes.instanceOf(Array).isRequired,
  }

  render() {
    const {node, helpers, lockedTypes} = this.props;
    return (
      <Node node={node} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-operator">
          &lambda; (
          {helpers.renderNodeForReact(node.args)}
          )
        </span>
        <span className="blocks-args">
          {helpers.renderNodeForReact(node.body)}
        </span>
      </Node>
    );
  }
}
