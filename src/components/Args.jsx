import React, {Component} from 'react';
import PropTypes from 'prop-types';

import {ASTNode} from '../ast';
import {DropTarget, DropTargetContainer, DropTargetSibling} from './DropTarget';
import {span} from '../types';

export default class Args extends Component {
  static propTypes = {
    children: PropTypes.arrayOf(PropTypes.instanceOf(ASTNode)).isRequired,
  }

  render() {
    let {children} = this.props;
    const elems = [];
    elems.push(<DropTarget key={'drop-0'} />);
    children.forEach((child, index) => {
      elems.push(<DropTargetSibling node={child} left={true} right={true} key={'node'+index} />);
      elems.push(<DropTarget key={'drop-'+(index+1)} />);
    });
    return elems;
  }
}
