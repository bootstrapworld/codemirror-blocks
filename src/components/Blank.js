import React, {Component, PropTypes} from 'react';

import {Blank as ASTBlankNode} from '../ast';
import Node from './Node';

export default class Literal extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTBlankNode).isRequired,
    lockedTypes: PropTypes.instanceOf(Array).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired,
    }).isRequired,
  }
  render() {
    const {node, lockedTypes, helpers} = this.props;
    return (
      <Node type="literal" node={node} lockedTypes={lockedTypes} helpers={helpers}>
        <span className={`blocks-literal-symbol`}>
        ...
        </span>
      </Node>
    );
  }
}
