import React from 'react';
import PropTypes from 'prop-types';
import {Component} from 'react';
import DropTarget from './DropTarget';


export default class ComponentWithDropTargets extends Component {
  constructor() {
    super();

    this.handleSetEditableArr = {};
    this.handleSetEditable = i => {
      if (!this.handleSetEditableArr[i]) {
        this.handleSetEditableArr[i] = b => {
          this.setState({editableList: {...this.state.editableList, [i]: b}});
        };
      }
      return this.handleSetEditableArr[i];
    };

    this.state = {editableList: {}};

    let that = this;
    this.DropTarget = class DropTargetElement extends Component {
      static propTypes = {
        index: PropTypes.number.isRequired,
        location: PropTypes.instanceOf(Object).isRequired
      }
      
      render() {
        const {index, location} = this.props;
        return <DropTarget
          location = {location}
          editable = {that.state.editableList[index] || false}
          onSetEditable = {that.handleSetEditable(index)}
        />;
      }
    };
  }
}