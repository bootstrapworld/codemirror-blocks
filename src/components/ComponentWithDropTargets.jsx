import React from 'react';
import PropTypes from 'prop-types';
import {Component} from 'react';
import DropTarget from './DropTarget';


// If a node directly contains drop targets, it should render itself with a
// subclass of this class. This class takes care of many messy details involving
// drop targets.
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
    // Use this class as a React Element to create a drop target that's a child
    // of this component. 
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

    // Use this function to render non-drop-target children of this node. Pass
    // in the node to be rendered, the index of the drop target to the left (or
    // `null` if there is none), and likewise for the right. You may also
    // optionally pass in a React `key` prop.
    this.renderNodeWithDropTargets = (node, leftIndex, rightIndex, key) => {
      const {helpers} = this.props;
      const onSetLeft = (leftIndex === null)
        ? () => {}
        : this.handleSetEditable(leftIndex);
      const onSetRight = (rightIndex === null)
        ? () => {}
        : this.handleSetEditable(rightIndex);
      const props = {
        onSetLeft: onSetLeft,
        onSetRight: onSetRight
      };
      return helpers.renderNodeForReact(node, key, props);
    }
  }
}