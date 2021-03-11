import React  from 'react';
import {connect} from 'react-redux';
import PropTypes from 'prop-types/prop-types';
import {ASTNode} from '../ast';
import {partition, getRoot,
        isControl, say, skipCollapsed, getLastVisibleNode, preambleUndoRedo} from '../utils';
import {drop, delete_, copy, paste, activateByNid, setCursor,
        InsertTarget, ReplaceNodeTarget, OverwriteTarget} from '../actions';
import NodeEditable from './NodeEditable';
import BlockComponent from './BlockComponent';
import {NodeContext, DropTargetContext, findAdjacentDropTargetId} from './DropTarget';
import {isErrorFree} from '../store';
import SHARED from '../shared';
import {DragNodeSource, DropNodeTarget} from '../dnd';
import classNames from 'classnames';
import {store} from '../store';

// TODO(Oak): make sure that all use of node.<something> is valid
// since it might be cached and outdated
// EVEN BETTER: is it possible to just pass an id?

@DragNodeSource
@DropNodeTarget(function(monitor) {
  const node = store.getState().ast.getNodeById(this.props.node.id);
  return drop(monitor.getItem(), new ReplaceNodeTarget(node));
})
class Node extends BlockComponent {
  static contextType = DropTargetContext;

  static defaultProps = {
    children: null,
    normallyEditable: false,
    expandable: true,
  }

  static propTypes = {
    node: PropTypes.instanceOf(ASTNode).isRequired,
    children: PropTypes.node,

    connectDragSource: PropTypes.func.isRequired,
    isDragging: PropTypes.bool.isRequired,
    connectDropTarget: PropTypes.func.isRequired,
    isOver: PropTypes.bool.isRequired,
    inToolbar: PropTypes.bool,

    normallyEditable: PropTypes.bool,

    isSelected: PropTypes.bool.isRequired,
    expandable: PropTypes.bool,
    textMarker: PropTypes.object,

    activateByNid: PropTypes.func.isRequired,
  }

  state = {editable: false, value: null}

  componentDidMount() {
    // For testing
    this.props.node.isEditable = () => this.state.editable;
  }

  // if its a top level node (ie - it has a CM mark on the node) AND
  // its isCollapsed property has changed, call mark.changed() to
  // tell CodeMirror that the widget's height may have changed
  componentDidUpdate(prevProps) {
    if(this.props.node.mark && 
        (prevProps.isCollapsed ^ this.props.isCollapsed)) {
      this.props.node.mark.changed();
    }
  }

  handleChange = (value) => {
    this.setState({value});
  }

  // nid can be stale!! Always obtain a fresh copy of the node
  // from getState() before calling activateByNid
  handleMouseDown = e => {
    if(!this.props.inToolbar) e.stopPropagation(); // prevent ancestors to steal focus
    if (!isErrorFree()) return; // TODO(Oak): is this the best way?
    const {ast} = store.getState();
    const currentNode = ast.getNodeById(this.props.node.id);  
    //console.log('XXX Node:84 calling activateByNid');
    this.props.activateByNid(currentNode.nid, {allowMove: false});
  }

  handleClick = e => {
    const { inToolbar, isCollapsed, normallyEditable } = this.props;
    e.stopPropagation();
    if(inToolbar) return;
    if(normallyEditable) this.handleMakeEditable();
  }

  handleDoubleClick = e => {
    const {
      inToolbar, isCollapsed, normallyEditable,
      collapse, uncollapse, node
    } = this.props;
    e.stopPropagation();
    if(inToolbar) return;
    if(isCollapsed) {
      uncollapse(node.id);
    } else {
      collapse(node.id);
    }
  }

  handleMouseDragRelated = e => {
    if (e.type === 'dragstart') {
      let dt = new DataTransfer();
      dt.setData('text/plain', e.target.innerText);
    }
  }

  handleMakeEditable = () => {
    if (!isErrorFree() || this.props.inToolbar) return;
    this.setState({editable: true});
    SHARED.cm.refresh(); // is this needed?
  };

  handleDisableEditable = () => this.setState({editable: false});

  setLeft() {
    const dropTargetId = findAdjacentDropTargetId(this.props.node, true);
    if (dropTargetId) {
      this.props.setEditable(dropTargetId, true);
      return true;
    } else {
      return false;
    }
  }

  setRight() {
    const dropTargetId = findAdjacentDropTargetId(this.props.node, false);
    if (dropTargetId) {
      this.props.setEditable(dropTargetId, true);
      return true;
    } else {
      return false;
    }
  }

  isLocked() {
    if (SHARED.options?.renderOptions) {
      const lockedList = SHARED.options.renderOptions.lockNodesOfType;
      return lockedList.includes(this.props.node.type);
    }
    return false;
  }

  render() {
    const {
      isSelected,
      isCollapsed,
      expandable,
      textMarker,
      children,
      inToolbar,
      node,
      ...passingProps
    } = this.props;

    let comment = node.options.comment;
    if(comment) comment.id = `block-node-${node.id}-comment`;
    const locked = this.isLocked();

    const props = {
      id                : `block-node-${node.id}`,
      tabIndex          : "-1",
      'aria-selected'   : isSelected,
      'aria-label'      : node.options['aria-label']+',' ,
      'aria-labelledby' : `block-node-${node.id} ${comment ? comment.id : ''}`,
      'aria-disabled'   : locked ? "true" : undefined,
      'aria-expanded'   : (expandable && !locked) ? !isCollapsed : undefined,
      'aria-setsize'    : node["aria-setsize"],
      'aria-posinset'   : node["aria-posinset"],
      'aria-level'      : node.level,
      'aria-multiselectable' : "true"
    };

    const classes = [
      {'blocks-locked': locked},
      `blocks-${node.type}`
    ];

    if (this.state.editable) {
      // TODO: combine passingProps and contentEditableProps
      return (
        <NodeEditable {...passingProps}
                      onDisableEditable={this.handleDisableEditable}
                      extraClasses={classes}
                      isInsertion={false}
                      target={new ReplaceNodeTarget(node)}
                      value={this.state.value}
                      onChange={this.handleChange}
                      onDragStart={this.handleMouseDragRelated}
                      onDragEnd={this.handleMouseDragRelated}
                      onDrop={this.handleMouseDragRelated}
                      contentEditableProps={props} />
      );
    } else {
      const {
        connectDragSource, isDragging,
        connectDropTarget, isOver,
        connectDragPreview
      } = this.props;
      classes.push({'blocks-over-target': isOver, 'blocks-node': true});
      if(textMarker?.options.className) classes.push(textMarker.options.className);
      let result = (
        <span
          {...props}
          className     = {classNames(classes)}
          ref           = {el => node.element = el}
          role          = {inToolbar? "listitem" : "treeitem"}
          style={{
            opacity: isDragging ? 0.5 : 1,
            cssText : textMarker? textMarker.options.css : null,
          }}
          title         = {textMarker? textMarker.options.title : null}
          onMouseDown   = {this.handleMouseDown}
          onClick       = {this.handleClick}
          onDoubleClick = {this.handleDoubleClick}
          onDragStart   = {this.handleMouseDragRelated}
          onDragEnd     = {this.handleMouseDragRelated}
          onDrop        = {this.handleMouseDragRelated}
          onKeyDown     = {e => store.onKeyDown(e, this)}
          >
          {children}
          {comment && comment.reactElement()}
        </span>
      );
      if (this.props.normallyEditable) {
        result = connectDropTarget(result);
      }
      result = connectDragPreview(connectDragSource(result), {offsetX: 1, offsetY: 1});
      result = (<NodeContext.Provider value={{node: this.props.node}}>{result}</NodeContext.Provider>);
      return result;
    }
  }
}

const mapStateToProps = (
  {selections, collapsedList, markedMap},
  {node}
  // be careful here. Only node's id is accurate. Use getNodeById
  // to access accurate info
) => {
  return {
    isSelected: selections.includes(node.id),
    isCollapsed: collapsedList.includes(node.id),
    textMarker: markedMap.get(node.id)
  };
};

const mapDispatchToProps = dispatch => ({
  dispatch,
  collapse: id => dispatch({type: 'COLLAPSE', id}),
  uncollapse: id => dispatch({type: 'UNCOLLAPSE', id}),
  setCursor: cur => dispatch(setCursor(cur)),
  activateByNid: (nid, options) => dispatch(activateByNid(nid, options)),
  setEditable: (id, bool) => dispatch({type: 'SET_EDITABLE', id, bool}),
});

export default connect(mapStateToProps, mapDispatchToProps)(Node);
