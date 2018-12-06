import React, {Component} from 'react';
import PropTypes from 'prop-types';

import {ASTNode} from '../ast';
import DropTarget from './DropTarget';
import {span} from '../types';

// NOTE: `location` is required in case `children` is empty!
//       Otherwise, it can be omitted.

export default class Args extends Component {
  static propTypes = {
    children: PropTypes.arrayOf(PropTypes.instanceOf(ASTNode)).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired,
    }).isRequired,
    location: span,
  }

  state = {editableList: {}}
  handleSetEditableArr = {}
  handleSetEditable = i => {
    if (!this.handleSetEditableArr[i]) {
      this.handleSetEditableArr[i] = b => {
        this.setState({editableList: {...this.state.editableList, [i]: b}});
      };
    }
    return this.handleSetEditableArr[i];
  }

  render() {
    let {children, helpers} = this.props;
    if (children.length === 0) {
      return (
        <DropTarget
          location={this.props.location}
          editable={this.state.editableList[0]}
          onSetEditable={this.handleSetEditable(0)} />);
    }
    const elems = [];
    elems.push(<DropTarget
                   key={'drop-0'}
                   location={children[0].from}
                   editable={this.state.editableList[0]}
                   onSetEditable={this.handleSetEditable(0)} />);
    children.forEach((child, index) => {
      elems.push(helpers.renderNodeForReact(child, 'node-'+index));
      elems.push(<DropTarget
                     key={'drop-'+(index+1)}
                     location={child.to}
                     editable={this.state.editableList[index+1]}
                     onSetEditable={this.handleSetEditable(index+1)} />);
    });
    return elems;
  }
}
