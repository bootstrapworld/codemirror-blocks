import React, {Component} from 'react';
import PropTypes from 'prop-types';

import {Binop as BinopNode} from '../ast';
import Node from '../../../components/Node';
import DropTarget from '../../../components/DropTarget';

export default class Binop extends Component {
  // Boilerplate
  static propTypes = {
    node: PropTypes.instanceOf(BinopNode).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired
    }).isRequired,
    lockedTypes: PropTypes.instanceOf(Array).isRequired
  }

  // TODO: DropTarget locations
  render() {
    const {node, helpers, lockedTypes} = this.props;
    return (
      <Node node={node} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-operator">
          <DropTarget/>
          {node.op}
          <DropTarget/>
        </span>
        <span className="blocks-args">
          <DropTarget location={node.left.from} key={'drop-0'} />
          {helpers.renderNodeForReact(node.left)}
          <DropTarget location={node.left.to}   key={'drop-1'} />
          {helpers.renderNodeForReact(node.right)}
          <DropTarget location={node.right.to}  key={'drop-2'} />
        </span>
      </Node>
    );
  }
}
