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
import uuidv4 from 'uuid/v4';


const DropTargetContext = React.createContext({
  isEditable: [],
  setEditable: () => {},
});

export class DropTargetContainer extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTNode).isRequired,
    children: PropTypes.node,
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
        children: this.props.children,
        node: this.props.node,
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

const mapDispatchToProps = dispatch => ({dispatch});

@connect(null, mapDispatchToProps)
@DropNodeTarget(function(monitor) {
  let loc = this.getLocation();
  let dest = {from: loc, to: loc, isDropTarget: true};
  return this.props.dispatch(dropNode(monitor.getItem(), dest));
})
export class DropTarget extends BlockComponent {

  static contextType = DropTargetContext;
  
  static propTypes = {
    index: PropTypes.number.isRequired,
    location: PropTypes.instanceOf(Object).isRequired,

    // fulfilled by DropNodeTarget
    connectDropTarget: PropTypes.func.isRequired,
    isOver: PropTypes.bool.isRequired,
  }

  constructor(props) {
    super(props);

    this.state = {value: ''};

    // Every DropTarget has a globally unique `id` which can be used to look up
    // its corresponding DOM element.
    this.id = uuidv4(); // generate a unique ID
    
    // These methods allow DropTargetSiblings to check to see whether an
    // adjacent DropTarget is being edited, or, for when the insert-left or
    // insert-right shortcut is pressed, _set_ an adjacent DropTarget as editable.
    this.isEditable = () => this.context.isEditable[this.props.index];
    this.setEditable = (b) => this.context.setEditable(this.props.index, b);
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
      throw "Could not find drop target location";
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
      id                : `block-drop-target-${this.id}!!`,
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
