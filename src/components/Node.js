import React, {PureComponent, PropTypes} from 'react';

import {ASTNode} from '../ast';

export default class Node extends PureComponent {
  static propTypes = {
    type: PropTypes.string.isRequired,
    node: PropTypes.instanceOf(ASTNode),
    children: PropTypes.node.isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired,
    }).isRequired,
    lockedTypes: PropTypes.instanceOf(Array).isRequired,
  }
  render() {
    const {type, node, lockedTypes, helpers, children} = this.props;
    let locked = lockedTypes.includes(type);
    let classes = `blocks-node blocks-${type} ` + (locked? "blocks-locked" : "");
    return (
      <span
        className={classes}
        tabIndex="1"
        role="treeitem"
        aria-label={node.options['aria-label']}
        aria-selected="false"
        aria-multiselectable="true"
        id={`block-node-${node.id}`}
        aria-describedby={node.options.comment? `block-node-${node.options.comment.id}`: undefined}
        aria-disabled={locked? "true": undefined}
        aria-expanded={locked? "false": undefined}
        ref = {(el) => node.el = el }
      >
        {children}
        {node.options.comment? helpers.renderNodeForReact(node.options.comment) : undefined }
      </span>
    );
  }
}