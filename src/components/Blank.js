import React, {Component, PropTypes} from 'react';
import {Blank as ASTBlankNode} from '../ast';

export default class Blank extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTBlankNode).isRequired,
    lockedTypes: PropTypes.instanceOf(Array).isRequired,
  }
  render() {
    const {node} = this.props;
    return (
      <span type="literal"
        className={`blocks-node blocks-literal`}
        tabIndex="1"
        role="treeitem"
        aria-label={node.options['aria-label']}
        id={`block-node-${node.id}`}
      >
        <span className={`blocks-literal-symbol`}>
        ...
        </span>
      </span>
    );
  }
}
