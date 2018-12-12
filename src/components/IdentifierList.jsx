import React from 'react';
import PropTypes from 'prop-types';
import Component from './BlockComponent';

import {IdentifierList as ASTExpressionNode} from '../ast';
import Node from './Node';
import Args from './Args';

export default class IdentifierList extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTExpressionNode).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired,
    }).isRequired,
    lockedTypes: PropTypes.instanceOf(Array).isRequired,
  }

  render() {
    // NOTE(Oak): I don't think that we need to pass down restProps here
    // because there's no adjacent DropTarget for FunctionDef
    const {node, helpers, lockedTypes} = this.props;
    return (
      <Node node={node} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-args">
          <Args helpers={helpers} location={node.from}>{node.ids}</Args>
        </span>
      </Node>
    );
  }
}
