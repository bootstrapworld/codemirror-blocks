import React from 'react';
import classNames from 'classnames';

require('./TrashCan.less');

export default React.createClass({
  displayName: 'TrashCan',
  propTypes: {
    onDrop: React.PropTypes.func.isRequired,
  },

  getDefaultProps() {
    return {
      onDrop: function(){}
    };
  },

  getInitialState() {
    return {
      isOverTrashCan: false,
    };
  },

  handleDragEnter() {
    this.setState({isOverTrashCan: true});
  },

  handleDragLeave() {
    this.setState({isOverTrashCan: false});
  },

  handleDragOver(event) {
    event.preventDefault();
  },

  handleDrop(event) {
    this.setState({isOverTrashCan: false});
    let nodeId = event.dataTransfer.getData("text/id");
    this.props.onDrop(nodeId);
  },

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
  },
});

