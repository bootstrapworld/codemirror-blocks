import React, {Component, PropTypes} from 'react';

import {Unknown as ASTUnknownNode} from '../ast';
import Node from './Node';
import DropTarget from './DropTarget';

export default class Unknown extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTUnknownNode).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired,
    }).isRequired,
    lockedTypes: PropTypes.instanceOf(Array).isRequired,
  }

  render() {
    const {node, helpers, lockedTypes} = this.props;
    let firstElt = node.elts[0];
    let restElts = node.elts.slice(1);
    const childNodes = [];
    restElts.forEach((arg, index) => {
      childNodes.push(helpers.renderNodeForReact(arg, 'node-'+index));
      childNodes.push(<DropTarget location={arg.to} key={'drop-'+index} />);
    });
    return (
      <Node type="Unknown" node={node} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-operator">{helpers.renderNodeForReact(firstElt)}</span>
        <span className="blocks-args">
          <DropTarget location={restElts.length ? firstElt.from : firstElt.to} />
          {childNodes}
        </span>
      </Node>
    );
  }
}
