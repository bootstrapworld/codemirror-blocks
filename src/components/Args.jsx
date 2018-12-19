import React, {Component} from 'react';
import PropTypes from 'prop-types';

import {ASTNode} from '../ast';
import ComponentWithDropTargets from './ComponentWithDropTargets';
import {span} from '../types';

// NOTE: `location` is required in case `children` is empty!
//       Otherwise, it can be omitted.

export default class Args extends ComponentWithDropTargets {
  static propTypes = {
    children: PropTypes.arrayOf(PropTypes.instanceOf(ASTNode)).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired,
    }).isRequired,
    location: span,
  }

  render() {
    let {children, helpers} = this.props;
    let DropTarget = this.DropTarget;
    if (children.length === 0) {
      return (<DropTarget index={0} location={this.props.location} />);
    }
    const elems = [];
    elems.push(<DropTarget key={'drop-0'}
                           index={0}
                           location={children[0].from} />);
    children.forEach((child, index) => {
      elems.push(helpers.renderNodeForReact(child, 'node-'+index));
      elems.push(<DropTarget key={'drop-'+(index+1)}
                             index={index+1}
                             location={child.to} />);
    });
    return elems;
  }
}
