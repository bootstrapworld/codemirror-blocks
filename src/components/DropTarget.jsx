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
import {NodeContext} from './Node';
import uuidv4 from 'uuid/v4';


// Use this class to render non-drop-target children of this node. Pass
// in the `node` to be rendered, the index of the drop target to the `left` (or
// `null` if there is none), and likewise for the `right`.
const mapDispatchToPropsSibling = dispatch => ({
  dispatch,
  isEditable: id => dispatch((_, getState) => getState().editable[i] || false),
  setEditable: (id, bool) => dispatch({type: 'SET_EDITABLE', id, bool}),
});
@connect(null, mapDispatchToPropsSibling)
export class DropTargetSibling extends Component {
  static contextType = NodeContext;

  static propTypes = {
    node: PropTypes.object.isRequired,
    left: PropTypes.bool,
    right: PropTypes.bool,
  }

  findAdjacentDropTarget(onLeft) {
    if (onLeft && !this.props.left || !onLeft && !this.props.right) {
      // We're not connected to a drop target on that side.
      return false;
    }

    let prevDropTargetId = null;
    let targetId = `block-node-${this.props.node.id}`;
    let ast = this.props.dispatch((_, getState) => getState().ast);
    
    function findDT(parent) {
      if (!parent.children) {
        return null;
      }
      // Convert array-like object into an Array.
      let children = [...parent.children];
      // If we want the drop-target to the right, iterate in reverse
      if (!onLeft) { children.reverse(); }
      
      for (let sibling of children) {
        if (sibling.id && sibling.id.startsWith("block-drop-target-")) {
          // We've hit a drop-target. Remember its id, in case it's adjacent to the node.
          prevDropTargetId = sibling.id.substring(18); // skip "block-drop-target-"
        } else if (sibling.id == targetId) {
          // We've found this node! Return the id of the adjacent drop target.
          return prevDropTargetId;
        } else if (sibling.id && sibling.id.startsWith("block-node-")) {
          // It's a different node. Skip it.
        } else if (sibling.children) {
          // We're... somewhere else. If it has children, traverse them to look for the node.
          let result = findDT(sibling);
          if (result !== null) {
            return result; // node found.
          }
        }
      }
      return null;
    }

    return findDT(this.context.node.element);
  }

  setLeft() {
    let dropTargetId = this.findAdjacentDropTarget(true);
    if (dropTargetId) {
      this.props.setEditable(dropTargetId, true);
    }    
  }

  setRight() {
    let dropTarget = this.findAdjacentDropTarget(false);
    if (dropTarget) {
      this.props.setEditable(dropTarget.id, true);
    }
  }
  
  render() {
    let props = {
      onSetLeft: () => this.setLeft(),
      onSetRight: () => this.setRight(),
    };
    return this.props.node.reactElement(props);
  }
}


const mapDispatchToProps = dispatch => ({
  dispatch,
  isEditable: id => dispatch((_, getState) => getState().editable[id] || false),
  setEditable: (id, bool) => dispatch({type: 'SET_EDITABLE', id, bool}),
});

@connect(null, mapDispatchToProps)
@DropNodeTarget(function(monitor) {
  let loc = this.getLocation();
  let dest = {from: loc, to: loc, isDropTarget: true};
  return this.props.dispatch(dropNode(monitor.getItem(), dest));
})
export class DropTarget extends BlockComponent {

  static contextType = NodeContext;
  
  static propTypes = {
    // fulfilled by DropNodeTarget
    connectDropTarget: PropTypes.func.isRequired,
    isOver: PropTypes.bool.isRequired,
  }

  constructor(props) {
    super(props);

    this.state = {
      value: "",
      // NOTE(Justin): This state is redundant with the `editable` Redux state.
      // It would be *really* nice if we could just use that.
      // But the only way to attach it is with mapStateToProps,
      // and AFAIK we can't get at `this.id` from within that function.
      editable: false,
    };

    // Every DropTarget has a globally unique `id` which can be used to look up
    // its corresponding DOM element.
    this.id = uuidv4(); // generate a unique ID
    
    // These methods allow DropTargetSiblings to check to see whether an
    // adjacent DropTarget is being edited, or, for when the insert-left or
    // insert-right shortcut is pressed, _set_ an adjacent DropTarget as editable.
    this.isEditable = () => this.props.isEditable(this.id);
    this.setEditable = (b) => {
      this.setState((_, __) => {
        this.props.setEditable(this.id, b);
        return {editable: b};
      });
    }
  }
  
  // NOTE(Oak): DropTarget should not handle click event since clicking it
  // should activate the node
  handleClick = e => {
    e.stopPropagation();
  }

  getLocation() {
    let prevNodeId = null;
    let targetId = `block-drop-target-${this.id}`;
    let ast = this.props.dispatch((_, getState) => getState().ast);
    let dropTargetWasFirst = false;
    
    function findLoc(parent) {
      if (!parent.children) {
        return null;
      }
      for (let sibling of parent.children) {
        if (sibling.id && sibling.id.startsWith("block-node-")) {
          // We've hit an ASTNode. Remember its id, in case it's the node just before the drop target.
          prevNodeId = sibling.id.substring(11); // skip "block-node-"
          if (dropTargetWasFirst) {
            // Edge case: the drop target was literally the first thing, so we
            // need to return the `from` of its _next_ sibling. That's this one.
            return ast.getNodeById(prevNodeId).from;
          }
        } else if (sibling.id == targetId) {
          // We've found this drop target! Return the `to` location of the previous ASTNode.
          if (prevNodeId) {
            return ast.getNodeById(prevNodeId).to;
          } else {
            // Edge case: nothing is before the drop target.
            dropTargetWasFirst = true;
          }
        } else if (sibling.id && sibling.id.startsWith("block-drop-target")) {
          // It's a different drop target. Skip it.
        } else if (sibling.children) {
          // We're... somewhere else. If it has children, traverse them to look for the drop target.
          let result = findLoc(sibling);
          if (result !== null) {
            return result; // drop target found.
          }
        }
      }
      return null;
    }
    
    let loc = findLoc(this.context.node.element);
    if (!loc) {
      console.warn("Could not find drop target location");
    }
    return loc;
  }

  handleDoubleClick = e => {
    e.stopPropagation();
    if (!isErrorFree()) return; // TODO(Oak): is this the best way to handle this?
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
      id                : `block-drop-target-${this.id}`,
    };
    if (this.isEditable()) {
      let loc = this.getLocation();
      const nodeProps = {
        id: 'editing', // TODO(Oak): error focusing is going to be wrong
        from: loc,
        to: loc,
      };
      return (
        <NodeEditable node={nodeProps}
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
        id={`block-drop-target-${this.id}`}
        className={classNames(classes)}
        onDoubleClick = {this.handleDoubleClick}
        onClick = {this.handleClick} />
    );
  }
}
