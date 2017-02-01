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
        aria-selected="false"
        aria-multiselectable="true"
        id={`block-node-${node.id}`}
        aria-describedby={node.options.comment? `block-node-${node.options.comment.id}`: undefined}
      >
        {children}
      </span>
    );
  }
}
