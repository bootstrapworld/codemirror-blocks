import React, {Component} from 'react';
import {ASTNode} from '../ast';
import PropTypes from 'prop-types';

export default class Block extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTNode).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired
    }).isRequired,
    lockedTypes: PropTypes.instanceOf(Array).isRequired
  }

  render() {
    const {node, helpers, lockedTypes} = this.props;
    throw new Error("Blocks must have a 'render' function, but the "
                    + node.type + " block lacks one.");
  }
}
