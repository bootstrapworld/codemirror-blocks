import React  from 'react';
import {connect} from 'react-redux';
import PropTypes from 'prop-types';
import {ASTNode} from '../ast';
import {BACKSPACE, LEFT, RIGHT, SPACE, UP, DOWN, ENTER, DELETE} from '../keycode';
import {dropNode, toggleSelection, focusNextNode, focusNode, deleteNodes} from '../actions';
import NodeEditable from './NodeEditable';
import Component from './BlockComponent';
import {isErrorFree} from '../store';
import global from '../global';
import {DragNodeSource, DropNodeTarget} from '../dnd';
import classNames from 'classnames';
import {store} from '../store';

// TODO(Oak): make sure that all use of node.<something> is valid
// since it might be cached and outdated
// EVEN BETTER: is it possible to just pass an id?

@DragNodeSource
@DropNodeTarget(({node}) => {
  node = store.getState().ast.getNodeById(node.id);
  return {from: node.from, to: node.to};
})
class Node extends Component {
  static defaultProps = {
    children: null,
    normallyEditable: false,
    expandable: true,
  }

  static propTypes = {
    node: PropTypes.instanceOf(ASTNode),
    children: PropTypes.node,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired,
    }).isRequired,
    lockedTypes: PropTypes.array.isRequired,

    connectDragSource: PropTypes.func.isRequired,
    isDragging: PropTypes.bool.isRequired,
    connectDropTarget: PropTypes.func.isRequired,
    isOver: PropTypes.bool.isRequired,

    normallyEditable: PropTypes.bool,

    isSelected: PropTypes.bool.isRequired,
    expandable: PropTypes.bool,

    toggleSelection: PropTypes.func.isRequired,
  }

  state = {editable: false}

  handleClick = e => {
    e.stopPropagation(); // prevent ancestors to steal focus
    e.preventDefault();
    if (!isErrorFree()) return;

    this.props.setFocus(this.props.node.id);
  }

  handleKeyDown = e => {
    e.stopPropagation();
    e.preventDefault();
    if (!isErrorFree()) return;

    const {
      node, expandable, isCollapsed,
      uncollapse, collapse, normallyEditable, toggleSelection,
      uncollapseAll, collapseAll, setFocus,
    } = this.props;

    switch (e.keyCode) {
    case UP:
      this.props.focusNextNode(node.id, node => node.prev);
      return;

    case DOWN:
      this.props.focusNextNode(node.id, node => node.next);
      return;

    case LEFT:
      if (e.shiftKey) {
        collapseAll();
      } else if (expandable && !isCollapsed && !this.isLocked()) {
        collapse(node.id);
      } else {
        const nextNode = node.parent;
        if (nextNode) {
          setFocus(nextNode.id);
        } else {
          // play beep
        }
      }
      return;

    case RIGHT:
      if (e.shiftKey) {
        uncollapseAll();
      } else if (expandable && isCollapsed && !this.isLocked()) {
        uncollapse(node.id);
      } else {
        const nextNode = node.next;
        if (nextNode && nextNode.level === node.level + 1) {
          setFocus(nextNode.id);
        } else {
          // play beep
        }
      }
      return;

    case SPACE:
      toggleSelection(node.id);
      return;

    case ENTER:
      if (normallyEditable || e.ctrlKey) {
        this.handleMakeEditable(e);
      } else if (expandable && !this.isLocked()) {
        (isCollapsed ? uncollapse : collapse)(node.id);
      } // else beep?
      return;

    case DELETE:
    case BACKSPACE:
      this.props.handleDelete();
      return;
    }
  }

  componentDidMount = () => {
    if (this.element && isErrorFree() && this.props.isFocused) {
      this.focusSelf(true);
    }
  }

  componentDidUpdate = this.componentDidMount

  focusSelf(noRefresh=false) {
    // NOTE(Oak): the noRefresh parameter is to circumvent
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1317098
    const scroll = global.cm.getScrollInfo();
    let {top, bottom, left, right} = this.element.getBoundingClientRect();
    const offset = global.cm.getWrapperElement().getBoundingClientRect();
    top    += scroll.top  - offset.top;
    bottom += scroll.top  - offset.top;
    left   += scroll.left - offset.left;
    right  += scroll.left - offset.left;
    global.cm.scrollIntoView({top, bottom, left, right}, 100);
    this.element.focus();
    if (!noRefresh) global.cm.refresh();
    // TODO: we need refreshing to make focusing right, but where should we put it?
  }

  handleDoubleClick = e => {
    e.stopPropagation();
    if (this.props.normallyEditable) {
      this.handleMakeEditable();
    }
  }

  handleMakeEditable = () => {
    if (!isErrorFree()) return;
    this.setState({editable: true});
    global.cm.refresh(); // is this needed?
  }

  handleEditableChange = editable => {
    this.setState({editable});
  }

  isLocked() {
    return this.props.lockedTypes.includes(this.props.node.type);
  }

  render() {
    // console.log('Node rendered', this.props.node);
    const {
      isSelected,
      isCollapsed,
      expandable,
      children,
      node,
      ...passingProps
    } = this.props;

    if (node.options.comment) {
      // TODO: can we avoid mutating in render()?
      node.options.comment.id = "block-node-" + node.id + "-comment";
    }
    const commentID = node.options.comment ? node.options.comment.id : '';

    const locked = this.isLocked();

    const props = {
      id                : `block-node-${node.id}`,
      tabIndex          : "-1",
      'aria-selected'   : isSelected,
      'aria-label'      : node.options['aria-label']+',' ,
      'aria-labelledby' : `block-node-${node.id} ${commentID}`,
      'aria-disabled'   : locked ? "true" : undefined,
      'aria-expanded'   : (expandable && !locked) ? !isCollapsed : undefined,
      'aria-setsize'    : node["aria-setsize"],
      'aria-posinset'   : node["aria-posinset"],
      'aria-level'      : node["aria-level"],
      'aria-multiselectable' : "true"
    };

    const classes = [
      {'blocks-locked': locked},
      'blocks-node',
      `blocks-${node.type}`
    ];

    if (this.state.editable) {
      // TODO: combine passingProps and contentEditableProps
      return (
        <NodeEditable {...passingProps}
                      onEditableChange={this.handleEditableChange}
                      extraClasses={classes}
                      node={node}
                      dropTarget={false}
                      contentEditableProps={props} />
      );
    } else {
      const {connectDragSource, isDragging, connectDropTarget, isOver} = this.props;
      classes.push({'blocks-over-target': isOver});
      let result = (
        <span
          {...props}
          className     = {classNames(classes)}
          ref           = {el => this.element = el}
          role          = "treeitem"
          style={{
            opacity: isDragging ? 0.5 : 1,
          }}
          onClick       = {this.handleClick}
          onDoubleClick = {this.handleDoubleClick}
          onKeyDown     = {this.handleKeyDown}>
          {children}
        {
          node.options.comment &&
            this.props.helpers.renderNodeForReact(node.options.comment)
        }
        </span>
      );
      if (this.props.normallyEditable) {
        result = connectDropTarget(result);
      }
      return connectDragSource(result);
    }
  }
}

const mapStateToProps = (
  {focusId, selections, collapsedList, ast},
  {node}
  // be careful here. Only node's id is accurate. Use getNodeById
  // to access accurate info
) => {
  return {
    isFocused: focusId === ast.getNodeById(node.id).nid,
    // NOTE(Oak): might consider using immutable.js to speed up performance
    isSelected: selections.includes(node.id),
    isCollapsed: collapsedList.includes(node.id),
  };
};

const mapDispatchToProps = dispatch => ({
  toggleSelection: id => dispatch(toggleSelection(id)),
  focusNextNode: (id, next) => dispatch(focusNextNode(id, next)),
  setFocus: id => dispatch(focusNode(id)),
  collapse: id => dispatch({type: 'COLLAPSE', id}),
  uncollapse: id => dispatch({type: 'UNCOLLAPSE', id}),
  collapseAll: () => dispatch({type: 'COLLAPSE_ALL'}),
  uncollapseAll: () => dispatch({type: 'UNCOLLAPSE_ALL'}),
  handleDelete: () => dispatch(deleteNodes()),
  onDrop: (src, dest) => dispatch(dropNode(src, dest)),
});

export default connect(mapStateToProps, mapDispatchToProps)(Node);
