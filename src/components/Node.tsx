import React, { HTMLAttributes }  from 'react';
import {connect, ConnectedProps} from 'react-redux';
import PropTypes from 'prop-types';
import {ASTNode} from '../ast';
import {drop, delete_, copy, paste, activateByNid, setCursor,
        InsertTarget, ReplaceNodeTarget, OverwriteTarget} from '../actions';
import NodeEditable from './NodeEditable';
import BlockComponent from './BlockComponent';
import {NodeContext, DropTargetContext, findAdjacentDropTargetId} from './DropTarget';
import {AppDispatch, isErrorFree} from '../store';
import SHARED from '../shared';
import {DragNodeSource, DropNodeTarget} from '../dnd';
import classNames from 'classnames';
import {store} from '../store';
import CodeMirror from 'codemirror';
import { GetProps } from 'react-dnd';

// TODO(Oak): make sure that all use of node.<something> is valid
// since it might be cached and outdated
// EVEN BETTER: is it possible to just pass an id?

type NodeState = {editable: boolean, value: string | null};

class Node extends BlockComponent<EnhancedNodeProps, NodeState> {
  static contextType = DropTargetContext;

  static defaultProps = {
    children: null,
    normallyEditable: false,
    expandable: true,
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


  handleEditComment = () => {
    console.log('editComment called');
    this.setState({commentEditable: true});
  }

  handleDisableEditable = () => this.setState({editable: false});

  setLeft() {
    const dropTargetId = findAdjacentDropTargetId(this.props.node, true);
    if (dropTargetId) { this.props.setEditable(dropTargetId, true); }
    return !!dropTargetId;
  }

  setRight() {
    const dropTargetId = findAdjacentDropTargetId(this.props.node, false);
    if (dropTargetId) { this.props.setEditable(dropTargetId, true); }
    return !!dropTargetId;
   }

  isLocked() {
    return this.props.node.isLockedP;
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
    const locked = this.isLocked();

    const props: HTMLAttributes<HTMLSpanElement> = {
      id                : `block-node-${node.id}`,
      tabIndex          : -1,
      'aria-selected'   : isSelected,
      'aria-label'      : node.shortDescription()+',' ,
      'aria-labelledby' : `block-node-${node.id} ${comment ? comment.id : ''}`,
      'aria-disabled'   : locked ? "true" : undefined,
      'aria-expanded'   : (expandable && !locked) ? !isCollapsed : undefined,
      'aria-setsize'    : node["aria-setsize"],
      'aria-posinset'   : node["aria-posinset"],
      'aria-level'      : node.level,
    };

    const classes: Parameters<typeof classNames> = [
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
          } as any}
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
          {comment? this.renderComment(comment, passingProps, node) : null}
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

  renderComment(comment, passingProps, node) {
    console.log(comment)
    const props = {
      id                : comment.id,
      tabIndex          : "-1",
      'aria-setsize'    : 1,
      'aria-posinset'   : 1,
      'aria-level'      : node.level,
    };

    if (!this.state.commentEditable) {
      return comment.reactElement({key: comment.id});
    } else {
      return (
        <NodeEditable {...passingProps}
                      onDisableEditable={this.handleDisableEditable}
                      extraClasses={[`blocks-${comment.type}`]}
                      isInsertion={false}
                      target={new ReplaceNodeTarget(comment)}
                      value={comment.value}
                      onChange={this.handleChange}
                      contentEditableProps={props} 
        />
      );      
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

const mapDispatchToProps = (dispatch: AppDispatch) => ({
  dispatch,
  collapse: (id: string) => dispatch({type: 'COLLAPSE', id}),
  uncollapse: (id: string) => dispatch({type: 'UNCOLLAPSE', id}),
  setCursor: (cur: CodeMirror.Position) => dispatch(setCursor(cur)),
  activateByNid: (nid: number, options: {allowMove?: boolean, record?: boolean}) => dispatch(activateByNid(nid, options)),
  setEditable: (id: string, bool: boolean) => dispatch({type: 'SET_EDITABLE', id, bool}),
});

const connector = connect(mapStateToProps, mapDispatchToProps);

type EnhancedNodeProps = ConnectedProps<typeof connector> & {
  node: ASTNode;
  inToolbar?: boolean;
  normallyEditable?: boolean;
  expandable: boolean;

  // These all come from the dnd enhancers and don't need
  // to be supplied by users of the default export
  connectDragSource: Function;
  isDragging: boolean;
  connectDropTarget: Function;
  connectDragPreview: Function;
  isOver: boolean;
}

const ConnectedNode = connector(
  DragNodeSource(
    DropNodeTarget(function(monitor) {
      const node = store.getState().ast.getNodeById(this.props.node.id);
      return drop(monitor.getItem(), new ReplaceNodeTarget(node));
    })(Node)
  )
);

export type NodeProps = GetProps<typeof ConnectedNode>;

export default ConnectedNode;
