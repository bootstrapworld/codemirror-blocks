import React, {PureComponent, PropTypes} from 'react';

import {ASTNode} from '../ast';

export default class Node extends PureComponent {
  static propTypes = {
    type: PropTypes.string.isRequired,
    node: PropTypes.instanceOf(ASTNode),
    children: PropTypes.node.isRequired,
  }
  render() {
    const {type, node, children} = this.props;
    return (
      <span
        className={`blocks-node blocks-${type}`}
        tabIndex="1"
        role="treeitem"
        aria-label={node.options['aria-label']}
        id={`block-node-${node.id}`}
      >
        {children}
      </span>
    );
  }
}
