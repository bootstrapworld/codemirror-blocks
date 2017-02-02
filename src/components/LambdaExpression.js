import React, {Component, PropTypes} from 'react';

import {LambdaExpression as ASTLambdaExpressionNode} from '../ast';
import Node from './Node';
import DropTarget from './DropTarget';

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
    const argNodes = [];
    node.args.forEach((arg, index) => {
      argNodes.push(helpers.renderNodeForReact(arg, 'node-'+index));
      argNodes.push(<DropTarget location={arg.to} key={'drop-'+index} />);
    });
    return (
      <Node type="lambdaExpression" node={node} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-operator">
            &lambda; (
            <DropTarget location={node.args.length ? node.args[0].from : node.func.to} />
            {argNodes}
            )
        </span>
        <span className="blocks-args">
          {helpers.renderNodeForReact(node.body)}
        </span>
      </Node>
    );
  }
}