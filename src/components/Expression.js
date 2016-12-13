import React, {Component, PropTypes} from 'react';

import {Expression as ASTExpressionNode} from '../ast';
import Node from './Node';
import DropTarget from './DropTarget';

export default class Expression extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTExpressionNode).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired,
    }).isRequired
  }

  render() {
    const {node, helpers} = this.props;
    return (
      <Node type="expression" node={node}>
        <span className="blocks-operator">{helpers.renderNodeForReact(node.func)}</span>
        <span className="blocks-args">
          <DropTarget location={node.args.length ? node.args[0].from : node.func.to} />
          {node.args.map((arg, index) => (
             <span key={index}>
               {helpers.renderNodeForReact(arg)}
               <DropTarget location={arg.to} />
             </span>
           ))}
        </span>
      </Node>
    );
  }
}
