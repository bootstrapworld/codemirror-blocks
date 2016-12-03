import React, {PureComponent} from 'react';

export default class Node extends PureComponent {

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
