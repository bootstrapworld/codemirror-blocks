import React, {Component} from 'react';
import PropTypes from 'prop-types';

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
      <Node node={node} lockedTypes={lockedTypes} helpers={helpers}>
        <span className={`blocks-literal-symbol`}>
        </span>
      </Node>
    );
  }
}