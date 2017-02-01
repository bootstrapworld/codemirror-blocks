import React, {Component, PropTypes} from 'react';

import {Struct as ASTStructDefinitionNode} from '../ast';
import Node from './Node';
import DropTarget from './DropTarget';

export default class StructDefinition extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTStructDefinitionNode).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired,
    }).isRequired,
    lockedTypes: PropTypes.instanceOf(Array).isRequired,
  }

  render() {
    const {node, helpers, lockedTypes} = this.props;
    return (
      <Node type="struct" node={node} lockedTypes={lockedTypes}>
        <span className="blocks-operator">
          define-struct {helpers.renderNodeForReact(node.name)}
        </span>
        <span className="blocks-args">
          <DropTarget location={node.fields.length ? node.fields[0].from : node.name.to} />
          {node.fields.map((field, index) => (
            <span key={index}>
              {helpers.renderNodeForReact(field)}
              <DropTarget location={field.to} />
            </span>
            ))}
        </span>
      </Node>
    );
  }
}