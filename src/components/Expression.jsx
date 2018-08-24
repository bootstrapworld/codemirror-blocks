import React from 'react';
import PropTypes from 'prop-types';
import Component from './BlockComponent';

import {Expression as ASTExpressionNode} from '../ast';
import Node from './Node';
import DropTarget from './DropTarget';

export default class Expression extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTExpressionNode).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired,
    }).isRequired,
    lockedTypes: PropTypes.instanceOf(Array).isRequired,
  }

  render() {
    console.log('expression rendered', this.props.node);
    const {node, helpers, lockedTypes} = this.props;
    const argNodes = [];
    node.args.forEach((arg, index) => {
      argNodes.push(helpers.renderNodeForReact(arg, arg.id));
      argNodes.push(<DropTarget location={arg.to} key={'drop-'+index} />);
    });
    return (
      <Node node={node} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-operator">
          <DropTarget location={node.func.from} />
          {helpers.renderNodeForReact(node.func, node.func.id)}
          <DropTarget location={node.func.to} />
        </span>
        <span className="blocks-args">
          <DropTarget location={node.args.length ? node.args[0].from : node.func.to} />
          {argNodes}
        </span>
      </Node>
    );
  }
}
