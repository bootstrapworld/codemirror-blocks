import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {DropNodeTarget} from '../dnd';
import {dropOntoTrashCan} from '../actions';
import { ConnectDropTarget } from 'react-dnd';
require('./TrashCan.less');

type Props = {
  connectDropTarget: ConnectDropTarget
}

class TrashCan extends Component<Props> {

  state = {
    isOverTrashCan: false,
  }

  handleDragEnter = () => {
    this.setState({isOverTrashCan: true});
  }

  handleDragLeave = () => {
    this.setState({isOverTrashCan: false});
  }

  handleDragOver = (event) => {
    event.preventDefault();
  }

  render() {
    let classNames = "TrashCan" + (this.state.isOverTrashCan ? " over" : "");
    return this.props.connectDropTarget(
      <div className={classNames}
           aria-hidden={true}
           onDragEnter={this.handleDragEnter}
           onDragLeave={this.handleDragLeave}
           onDrop={this.handleDragLeave}
           onDragOver={this.handleDragOver}>
           🗑️
      </div>
    );
  }
}

export default DropNodeTarget(function(monitor) {
  return dropOntoTrashCan(monitor.getItem());
})(TrashCan);