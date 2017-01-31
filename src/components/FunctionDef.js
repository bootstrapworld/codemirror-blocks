import React, {Component, PropTypes} from 'react';

import {FunctionDefinition as ASTFunctionDefinitionNode} from '../ast';
import Node from './Node';
import DropTarget from './DropTarget';

export default class FunctionDefinition extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTFunctionDefinitionNode).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired,
    }).isRequired
  }

  render() {
    const {node, helpers} = this.props;
    return (
      <Node type="functionDef" node={node}>
        <span className="blocks-operator">
          define (
            <DropTarget location={node.name.from} />
            {helpers.renderNodeForReact(node.name)}
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