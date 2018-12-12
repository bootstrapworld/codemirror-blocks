import React from 'react';
import PropTypes from 'prop-types';
import Component from './BlockComponent';

import {StructDefinition as ASTStructDefinitionNode} from '../ast';
import Node from './Node';
import Args from './Args';

export default class StructDefinition extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTStructDefinitionNode).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired,
    }).isRequired,
    lockedTypes: PropTypes.instanceOf(Array).isRequired,
  }

  render() {
    // NOTE(Oak): I don't think that we need to pass down restProps here
    // because there's no adjacent DropTarget for StructDef
    const {node, helpers, lockedTypes} = this.props;
    return (
      <Node node={node} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-operator">
          define-struct
          <Args helpers={helpers}>{[node.name]}</Args>
        </span>
        {helpers.renderNodeForReact(node.fields)}
      </Node>
    );
  }
}
