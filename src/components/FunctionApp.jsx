import React from 'react';
import PropTypes from 'prop-types';
import Component from './BlockComponent';

import {FunctionApp as ASTFunctionApp} from '../ast';
import Node from './Node';
import Args from './Args';

export default class FunctionApp extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTFunctionApp).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired,
    }).isRequired,
    lockedTypes: PropTypes.instanceOf(Array).isRequired,
  }

  render() {
    const {node, helpers, lockedTypes} = this.props;
    return (
      <Node node={node} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-operator">
          <Args helpers={helpers}>{[node.func]}</Args>
        </span>
        <span className="blocks-args">
          <Args helpers={helpers} location={node.func.to}>{node.args}</Args>
        </span>
      </Node>
    );
  }
}
