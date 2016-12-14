import React, {Component, PropTypes} from 'react';

import {LambdaExpression as ASTLambdaExpressionNode} from '../ast';
import Node from './Node';
import DropTarget from './DropTarget';

export default class LambdaExpression extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTLambdaExpressionNode).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired,
    }).isRequired
  }

  render() {
    const {node, helpers} = this.props;
    return (
      <Node type="lambdaExpression" node={node}>
        <span className="blocks-operator">
          lambda &nbsp; (
            <DropTarget location={node.args.length ? node.args[0].from : node.func.to} />
            {node.args.map((arg, index) => (
              <span key={index}>
                {helpers.renderNodeForReact(arg)}
                <DropTarget location={arg.to} />
              </span>
              ))}
            )
        </span>
        <span className="blocks-args">
          {helpers.renderNodeForReact(node.body)}
        </span>
      </Node>
    );
  }
}