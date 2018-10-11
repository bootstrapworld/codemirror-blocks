import React, {Component} from 'react';
import PropTypes from 'prop-types';

import {ASTNode} from '../ast';
import DropTarget from './DropTarget';
import {span} from '../types';

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

  render() {
    let {children, helpers} = this.props;
    let elems = [];
    if (children.length === 0) {
      return <DropTarget location={this.props.location} />;
    } else {
      elems.push(<DropTarget location={children[0].from} key={'drop-0'} />);
      children.forEach((child, index) => {
        elems.push(helpers.renderNodeForReact(child, 'node-'+index));
        elems.push(<DropTarget location={child.to} key={'drop-'+(index+1)} />);
      });
    }

    return elems;
  }
}
