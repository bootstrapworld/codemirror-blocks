import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {DropNodeTarget} from '../dnd';
import {dropOntoTrashCan} from '../actions';
require('./TrashCan.less');


@DropNodeTarget(function(monitor) {
  return dropOntoTrashCan(monitor.getItem());
})
export default class TrashCan extends Component {
  static propTypes = {
    connectDropTarget: PropTypes.func.isRequired, // from dnd.js
  }

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
      <button className={classNames}
              onClick={this.handleToggle}
              onDragEnter={this.handleDragEnter}
              onDragLeave={this.handleDragLeave}
              onDragOver={this.handleDragOver}>
        <span className="glyphicon glyphicon-trash"></span>
        <p>drag here to delete</p>
      </button>
    );
  }
}
