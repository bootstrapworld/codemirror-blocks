import React from 'react';
import PropTypes from 'prop-types';
import Component from './BlockComponent';

import {Sequence as ASTSequenceNode} from '../ast';
import Node from './Node';
import Args from './Args';

export default class Sequence extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTSequenceNode).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired,
    }).isRequired,
    lockedTypes: PropTypes.instanceOf(Array).isRequired,
  }

  render() {
    const {node, helpers, lockedTypes} = this.props;
    return (
      <Node node={node} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-operator">{node.name}</span>
        <div className="blocks-sequence-exprs">
          <Args helpers={helpers} location={node.name.to}>{node.exprs}</Args>
        </div>
      </Node>
    );
  }
}
