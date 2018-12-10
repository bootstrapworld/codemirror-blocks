import React, {Component} from 'react';
import PropTypes from 'prop-types';

import {ASTNode} from '../ast';
import {span} from '../types';
import makeDropTargets from './makeDropTargets';

// NOTE: `location` is required in case `children` is empty!
//       Otherwise, it can be omitted.

export default class Args extends Component {
  static propTypes = {
    children: PropTypes.arrayOf(PropTypes.instanceOf(ASTNode)).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired,
    }).isRequired,
    location: span,
  }

  constructor() {
    super();
    this.state = {}
    this.DropTarget = makeDropTargets(this);
  }

  render() {
    const DropTarget = this.DropTarget;
    let {children, helpers} = this.props;
    if (children.length === 0) {
      return (
        <DropTarget index={0} location={this.props.location} />);
    }
    const elems = [];
    elems.push(<DropTarget index={0} location={children[0].from} />);
    children.forEach((child, index) => {
      elems.push(helpers.renderNodeForReact(child, 'node-'+index));
      elems.push(<DropTarget index={index+1} location={child.to} />);
    });
    return elems;
  }
}
