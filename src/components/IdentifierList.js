import React, {Component} from 'react';
import PropTypes from 'prop-types';

import {IdentifierList as ASTExpressionNode} from '../ast';
import Node from './Node';
import DropTarget from './DropTarget';

export default class IdentifierList extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTExpressionNode).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired,
    }).isRequired,
    lockedTypes: PropTypes.instanceOf(Array).isRequired,
  }

  render() {
    const {node, helpers, lockedTypes} = this.props;
    const idNodes = [];
    node.ids.forEach((id, index) => {
      idNodes.push(helpers.renderNodeForReact(id, 'node-'+index));
      idNodes.push(<DropTarget location={id.to} key={'drop-'+index} />);
    });
    return (
      <Node type="identifierlist" node={node} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-args">
          <DropTarget location={node.ids[0].from} />
          {idNodes}
        </span>
      </Node>
    );
  }
}