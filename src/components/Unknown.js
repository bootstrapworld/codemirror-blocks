import React, {Component, PropTypes} from 'react';

import {Unknown as ASTUnknownNode} from '../ast';
import Node from './Node';
import DropTarget from './DropTarget';

export default class Unknown extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTUnknownNode).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired,
    }).isRequired
  }

  render() {
    const {node, helpers} = this.props;
    let firstElt = node.elts[0];
    let restElts = node.elts.slice(1);
    return (
      <Node type="Unknown" node={node}>
        <span className="blocks-operator">{helpers.renderNodeForReact(firstElt)}</span>
        <span className="blocks-args">
          <DropTarget location={restElts.length ? firstElt.from : firstElt.to} />
          {restElts.map((elt, index) => (
             <span key={index}>
               {helpers.renderNodeForReact(elt)}
               <DropTarget location={elt.to} />
             </span>
           ))}
        </span>
      </Node>
    );
  }
}
