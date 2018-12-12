import React from 'react';
import PropTypes from 'prop-types';
import Component from './BlockComponent';

import DropTarget from './DropTarget';


// Construct a DropTarget class that is specialized for this component.
// The returned class is a typical React Component. It takes two properties:
//
// - index: the index of this drop target, among all of the component's drop targets
// - location: the source location span of the drop target
//
// This function also extends the `state` of `component`. It must ONLY be called
// in the constructor of the component, and only after the `state` variable is
// declared (it can be `{}` if necessary).
export default function makeDropTargets(component) {
  // Extend the component's `state` to include whether its drop targets are
  // editable.
  component.state.editableList = {};
  // Build an array of functions that set whether drop targets are editable.
  // These functions will be given to the drop targets, for their convenience.
  component.__handleSetEditableArr = [];
  component.__handleSetEditable = i => {
    if (!component.__handleSetEditableArr[i]) {
      component.__handleSetEditableArr[i] = b => {
        component.setState({editableList: {...component.state.editableList, [i]: b}});
      };
    }
    return component.__handleSetEditableArr[i];
  }
  // Return a DropTarget class, specialized for this component.
  return class MyDropTarget extends Component {
    static propTypes = {
      index: PropTypes.number.isRequired,
      location: PropTypes.instanceOf(Object).isRequired
    }

    render() {
      const {index, location} = this.props;
      return <DropTarget
        key = {'drop-' + index}
        location = {location}
        editable = {component.state.editableList[index]}
        onSetEditable = {component.__handleSetEditable[index]}
      />;
    }
  };
}
