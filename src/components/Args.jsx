import React, {Component} from 'react';
import PropTypes from 'prop-types';

import {ASTNode} from '../ast';
import DropTarget from './DropTarget';


// NOTE: `location` is required in case `children` is empty!
//       Otherwise, it can be omitted.

export default class Args extends Component {
  static propTypes = {
    location: PropTypes.shape({
      from: PropTypes.shape({line: PropTypes.number, ch: PropTypes.number}),
      to: PropTypes.shape({line: PropTypes.number, ch: PropTypes.number})
    }),
    children: PropTypes.arrayOf(PropTypes.instanceOf(ASTNode)).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired,
    }).isRequired,
  }

  render() {
    let {children, helpers} = this.props;
    let elems = [];
    console.log(children, this.props.location);
    if (children.length === 0) {
      elems.push(<DropTarget location={this.props.location} />);
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
