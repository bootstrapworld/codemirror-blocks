import React, {Component} from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';

require('./TrashCan.less');

export default class TrashCan extends Component {
  static propTypes = {
    onDrop: PropTypes.func.isRequired,
  }

  static defaultProps = {
    onDrop: function(){}
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

  handleDrop = (event) => {
    this.setState({isOverTrashCan: false});
    let nodeId = event.dataTransfer.getData("text/id");
    this.props.onDrop(nodeId);
  }

  render() {
    return (
      <div className={classNames("TrashCan", {over: this.state.isOverTrashCan})}
           onDragEnter={this.handleDragEnter}
           onDragLeave={this.handleDragLeave}
           onDragOver={this.handleDragOver}
           onDrop={this.handleDrop}>
        <span className="glyphicon glyphicon-trash"></span>
        <p>drag here to delete</p>
      </div>
    );
  }
}

