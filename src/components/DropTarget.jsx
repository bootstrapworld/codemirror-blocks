import React from 'react';
import {Component} from 'react';
import {connect} from 'react-redux';
import PropTypes from 'prop-types';
import NodeEditable from './NodeEditable';
import SHARED from '../shared';
import {DropNodeTarget} from '../dnd';
import classNames from 'classnames';
import {isErrorFree} from '../store';
import {dropNode} from '../actions';
import BlockComponent from './BlockComponent';
import {ASTNode} from '../ast';


const DropTargetContext = React.createContext({
  isEditable: [],
  setEditable: () => {},
});


export class DropTargetContainer extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTNode).isRequired,
  }
  
  constructor(props) {
    super(props);

    this.state = {editableDropTargets: {}};

    this.setEditable = (i, b) => {
      this.setState({editableDropTargets: {...this.state.editableDropTargets, [i]: b}});
    };
  }

  render() {
    return (
      <DropTargetContext.Provider value={{
        isEditable: this.state.editableDropTargets,
        setEditable: this.setEditable,
        containingNode: this.props.node,
      }}>
      {this.props.children}
      </DropTargetContext.Provider>
    );
  }
}

// Use this class to render non-drop-target children of this node. Pass
// in the `node` to be rendered, the index of the drop target to the `left` (or
// `null` if there is none), and likewise for the `right`.
export class DropTargetSibling extends Component {
  static contextType = DropTargetContext;

  static propTypes = {
    node: PropTypes.object.isRequired,
    left: PropTypes.number,
    right: PropTypes.number,
  }

  constructor(props) {
    super(props);
    this.onSetLeft = props.left === undefined
      ? () => {}
      : (b) => this.context.setEditable(props.left, b);
    this.onSetRight = props.right === undefined
      ? () => {}
      : (b) => this.context.setEditable(props.right, b);
  }

  render() {
    let props = {
      onSetLeft: this.onSetLeft,
      onSetRight: this.onSetRight,
    };
    return this.props.node.reactElement(props);
  }
}

const mapDispatchToProps = dispatch => ({
  onDrop: (src, dest) => dispatch(dropNode(src, {...dest, isDropTarget: true})),
});

@connect(null, mapDispatchToProps)
@DropNodeTarget(({location}) => ({from: location, to: location}))
export class DropTarget extends BlockComponent {

  static contextType = DropTargetContext;
  
  static propTypes = {
    index: PropTypes.number.isRequired,
    location: PropTypes.instanceOf(Object).isRequired,

    // fulfilled by DropNodeTarget
    connectDropTarget: PropTypes.func.isRequired,
    isOver: PropTypes.bool.isRequired,
  }

  state = {value: ''}

  isEditable = () => this.context.isEditable[this.props.index];
  setEditable = (b) => this.context.setEditable(this.props.index, b);
  
  // NOTE(Oak): DropTarget should not handle click event since clicking it
  // should activate the node
  handleClick = e => {
    e.stopPropagation();
  }

  handleDoubleClick = e => {
    e.stopPropagation();
    if (!isErrorFree()) return; // TODO(Oak): is this the best way to handle this?
    
    // TODO(Justin) explain what this is all about
    this.context.containingNode.doForceUpdate();
    
    this.setEditable(true);
  }

  handleChange = (value) => {
    this.setState({value});
  }

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
    if (this.isEditable()) {
      return (
        <NodeEditable node={node}
                      value={this.state.value}
                      onChange={this.handleChange}
                      isInsertion={true}
                      contentEditableProps={props}
                      extraClasses={['blocks-node', 'blocks-white-space']}
                      onDisableEditable={() => this.setEditable(false)} />
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
        onDoubleClick = {this.handleDoubleClick}
        onClick = {this.handleClick} />
    );
  }
}
