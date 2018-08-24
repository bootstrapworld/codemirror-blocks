import React  from 'react';
import {connect} from 'react-redux';
import PropTypes from 'prop-types';
import {ASTNode} from '../ast';
import {LEFT, RIGHT, SPACE, UP, DOWN, ENTER} from '../keycode';
import {toggleSelection, focusNextNode} from '../actions';
import NodeEditable from './NodeEditable';
import Component from './BlockComponent';

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

    cm: PropTypes.object.isRequired,

    normallyEditable: PropTypes.bool,

    isSelected: PropTypes.bool.isRequired,
    expandable: PropTypes.bool,

    toggleSelection: PropTypes.func.isRequired,
  }

  state = {
    editable: false,
  }

  handleClick = e => {
    e.stopPropagation(); // prevent ancestors to steal focus
    e.preventDefault();
    if (this.props.globalHasError) return;
    this.props.setFocus(this.props.node.nid);
  }

  handleKeyDown = e => {
    e.stopPropagation();
    if (this.props.globalHasError) return;

    const {
      node, expandable, isCollapsed,
      uncollapse, collapse, normallyEditable, toggleSelection,
      uncollapseAll, collapseAll, setFocus,
    } = this.props;

    switch (e.keyCode) {
    case UP:
      e.preventDefault(); // don't scroll
      this.props.focusNextNode(node.id, node => node.prev);
      return;

    case DOWN:
      e.preventDefault(); // don't scroll
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
          setFocus(nextNode.nid);
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
          setFocus(nextNode.nid);
        } else {
          // play beep
        }
      }
      return;

    case SPACE:
      e.preventDefault(); // prevent scrolling
      toggleSelection(node.id);
      return;

    case ENTER:
      e.preventDefault(); // prevent from actually entering to the edit field
      if (normallyEditable || e.ctrlKey) {
        this.handleMakeEditable(e);
      } else if (expandable && !this.isLocked()) {
        (isCollapsed ? uncollapse : collapse)(node.id);
      } // else beep?
      return;

    }
  }

  componentDidMount = () => {
    if (this.element && !this.props.globalHasError && this.props.isFocused) {
      this.focusSelf(true);
    }
  }

  componentDidUpdate = this.componentDidMount

  focusSelf(noRefresh=false) {
    // NOTE(Oak): the noRefresh parameter is to circumvent
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1317098
    const scroll = this.props.cm.getScrollInfo();
    let {top, bottom, left, right} = this.element.getBoundingClientRect();
    const offset = this.props.cm.getWrapperElement().getBoundingClientRect();
    top    += scroll.top  - offset.top;
    bottom += scroll.top  - offset.top;
    left   += scroll.left - offset.left;
    right  += scroll.left - offset.left;
    this.props.cm.scrollIntoView({top, bottom, left, right}, 100);
    this.element.focus();
    if (!noRefresh) this.props.cm.refresh();
    // TODO: we need refreshing to make focusing right, but where should we put it?
  }

  handleDoubleClick = e => {
    e.stopPropagation();
    if (this.props.normallyEditable) {
      this.handleMakeEditable();
    }
  }

  handleMakeEditable = () => {
    if (this.props.globalHasError) return;
    this.setState({editable: true});
    this.props.cm.refresh(); // is this needed?
  }

  handleEditableChange = editable => {
    this.setState({editable});
  }

  isLocked() {
    return this.props.lockedTypes.includes(this.props.node.type);
  }

  render() {
    console.log('Node rendered', this.props.node);
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
      role              : this.props.editable ? 'textbox' : 'treeitem',
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
      locked ? "blocks-locked" : '',
      'blocks-node',
      `blocks-${node.type}`
    ];

    return (
      <NodeEditable {...passingProps}
                    editable={this.state.editable}
                    onEditableChange={this.handleEditableChange}
                    extraClasses={classes}
                    node={node}
                    contentEditableProps={props}>
        <span
          {...props}
          className     = {classes.join(' ')}
          ref           = {el => this.element = el}
          onClick       = {this.handleClick}
          onDoubleClick = {this.handleDoubleClick}
          onKeyDown     = {this.handleKeyDown}>
          {children}
          {
            node.options.comment &&
              this.props.helpers.renderNodeForReact(node.options.comment)
          }
        </span>
      </NodeEditable>
    );
  }
}

const mapStateToProps = (
  {cm, errorId, focusId, selections, parser, collapsedList},
  {node}
) => {
  return {
    cm, parser,
    isFocused: focusId === node.nid,
    globalHasError: errorId !== '',
    // NOTE(Oak): might consider using immutable.js to speed up performance
    isSelected: selections.includes(node.id),
    isCollapsed: collapsedList.includes(node.id),
  };
};

const mapDispatchToProps = dispatch => ({
  toggleSelection: id => dispatch(toggleSelection(id)),
  focusNextNode: (id, next) => dispatch(focusNextNode(id, next)),
  setFocus: focusId => dispatch({type: 'SET_FOCUS', focusId}),
  collapse: node => dispatch({type: 'COLLAPSE', id: node.id}),
  uncollapse: node => dispatch({type: 'UNCOLLAPSE', id: node.id}),
  collapseAll: () => dispatch({type: 'COLLAPSE_ALL'}),
  uncollapseAll: () => dispatch({type: 'UNCOLLAPSE_ALL'}),
});

export default connect(mapStateToProps, mapDispatchToProps)(Node);
