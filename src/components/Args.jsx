import React, {Component} from 'react';
import PropTypes from 'prop-types';

import {ASTNode} from '../ast';
import {DropTarget} from './DropTarget';
import {span} from '../types';

export default class Args extends Component {
  static propTypes = {
    field: PropTypes.string.isRequired,
    children: PropTypes.arrayOf(PropTypes.instanceOf(ASTNode)).isRequired,
  }

  render() {
    let {children} = this.props;
    const elems = [];
    elems.push(<DropTarget key={'drop-0'} field={this.props.field}/>);
    children.forEach((child, index) => {
      elems.push(child.reactElement({key : 'node' + index}));
      elems.push(<DropTarget key={'drop-' + (index+1)} field={this.props.field}/>);
    });
    return elems;
  }
}
