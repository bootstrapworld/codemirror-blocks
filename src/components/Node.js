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

  constructor() {
    super();
    this.state = {
      expanded: true
    };
  }

  render() {
    const {type, node, lockedTypes, helpers, children} = this.props;
    let locked = lockedTypes.includes(type);
    // blanks, comments, and literals, can't be expanded.
    let expandable = !["blank", "comment", "literal"].includes(node.type);
    let classes = `blocks-node blocks-${type} ` + (locked? "blocks-locked" : "");
    let comment = node.options.comment;
    return (
      <span
        className={classes}
        tabIndex="-1"
        role="treeitem"
        aria-label={node.options['aria-label']}
        aria-selected="false"
        aria-multiselectable="true"
        id={`block-node-${node.id}`}
        aria-describedby={node.options.comment? `block-node-${node.options.comment.id}`: undefined}
        aria-disabled={locked? "true": undefined}
        aria-expanded={locked? "false": expandable? "true" : undefined}
        aria-setsize = { node["aria-setsize"] }
        aria-posinset = { node["aria-posinset"] }
        aria-level = { node["aria-level"] }
        ref = {(el) => node.el = el }
      >
        {children}
        {comment? helpers.renderNodeForReact(comment) : undefined }
      </span>
    );
  }
}