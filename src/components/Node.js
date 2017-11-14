import React, {PureComponent} from 'react';
import PropTypes from 'prop-types';

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
    // blanks, comments, and literals, can't be expanded.
    let expandable = !["blank", "comment", "literal"].includes(node.type);
    let classes = `blocks-node blocks-${type} ` + (locked? "blocks-locked" : "");
    if(node.options.comment){
      node.options.comment.id = "block-node-"+node.id+"-comment";
    }
    return (
      <span
        id              = { `block-node-${node.id}` }
        className       = { classes }
        ref             = { (el) => { node.el = el; } }
        tabIndex        = "-1"
        role            = "treeitem"
        aria-selected   = "false"
        aria-label      = { node.options['aria-label'] }
        aria-describedby= { node.options.comment? `block-node-${node.options.comment.id}`: undefined}
        aria-disabled   = { locked? "true": undefined }
        aria-expanded   = { locked? "false": expandable? (node.collapsed ? "false" : "true") : undefined}
        aria-setsize    = { node["aria-setsize"]  }
        aria-posinset   = { node["aria-posinset"] }
        aria-level      = { node["aria-level"]    }
        aria-multiselectable = "true"
      >
        {children}
        {node.options.comment? helpers.renderNodeForReact(node.options.comment) : undefined }
      </span>
    );
  }
}