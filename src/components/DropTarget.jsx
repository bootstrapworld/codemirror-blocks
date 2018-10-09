import React from 'react';
import {connect} from 'react-redux';
import PropTypes from 'prop-types';
import Component from './BlockComponent';
import NodeEditable from './NodeEditable';
import global from '../global';
import {DropNodeTarget} from '../dnd';
import classNames from 'classnames';
import {isErrorFree} from '../store';
import {dropNode} from '../actions';

@DropNodeTarget(({location}) => ({from: location, to: location}))
class DropTarget extends Component {

  static propTypes = {
    location: PropTypes.instanceOf(Object).isRequired,
    connectDropTarget: PropTypes.func.isRequired,
    isOver: PropTypes.bool.isRequired,
  }

  state = {editable: false, value: ''}

  handleDisableEditable = () => this.setState({editable: false});

  handleDoubleClick = e => {
    e.stopPropagation();
    this.handleMakeEditable();
  }

  handleMakeEditable = () => {
    if (!isErrorFree()) return;
    this.setState({editable: true});
    global.cm.refresh(); // is this needed?
  }

  handleChange = (value) => {
    this.setState({value});
  }

  editableWillInsert = (value, node) => global.options.willInsertNode(
    global.cm,
    value,
    undefined, // TODO(Oak): just only for the sake of backward compat. Get rid if possible
    node.from,
  )

  render() {
    // TODO: take a look at this and make sure props is right
    const props = {
      tabIndex          : "-1",
      role              : 'textbox',
      'aria-setsize'    : '1',
      'aria-posinset'   : '1',
      'aria-level'      : '1',
    };
    const {location} = this.props;
    const node = {
      from: location,
      to: location,
      id: 'editing', // TODO(Oak): error focusing is going to be wrong
    };
    if (this.state.editable) {
      return (
        <NodeEditable node={node}
                      value={this.state.value}
                      onChange={this.handleChange}
                      dropTarget={true}
                      willInsertNode={this.editableWillInsert}
                      contentEditableProps={props}
                      extraClasses={['blocks-node', 'blocks-white-space']}
                      onDisableEditable={this.handleDisableEditable} />
      );
    }
    const classes = [
      'blocks-drop-target',
      'blocks-white-space',
      {'blocks-over-target' : this.props.isOver}
    ];
    return this.props.connectDropTarget(
      <span
        className={classNames(classes)}
        onDoubleClick = {this.handleDoubleClick} />
    );
  }
}

const mapDispatchToProps = dispatch => ({
  onDrop: (src, dest) => dispatch(dropNode(src, {...dest, isDropTarget: true})),
});

export default connect(null, mapDispatchToProps)(DropTarget);
