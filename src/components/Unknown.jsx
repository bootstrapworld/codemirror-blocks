import React from 'react';
import PropTypes from 'prop-types';
import Component from './BlockComponent';

import {Unknown as ASTUnknownNode} from '../ast';
import Node from './Node';
import Args from './Args';

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
    const firstElt = node.elts[0];
    const restElts = node.elts.slice(1);
    return (
      <Node node={node} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-operator">{helpers.renderNodeForReact(firstElt)}</span>
        <span className="blocks-args">
          <Args helpers={helpers} location={firstElt.to}>{restElts}</Args>
        </span>
      </Node>
    );
  }
}
