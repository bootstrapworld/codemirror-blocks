import React  from 'react';
import {connect} from 'react-redux';
import PropTypes from 'prop-types';
import {ASTNode} from '../ast';
import {partition, poscmp, getRoot,
        isControl, say, skipCollapsed, getLastVisibleNode} from '../utils';
import {dropNode, deleteNodes, copyNodes,
  pasteNodes, activate, activateByNId} from '../actions';
import NodeEditable from './NodeEditable';
import BlockComponent from './BlockComponent';
import {isErrorFree} from '../store';
import global from '../global';
import {DragNodeSource, DropNodeTarget} from '../dnd';
import classNames from 'classnames';
import {store} from '../store';
import {playSound, BEEP} from '../sound';

// TODO(Oak): make sure that all use of node.<something> is valid
// since it might be cached and outdated
// EVEN BETTER: is it possible to just pass an id?

@DragNodeSource
@DropNodeTarget(({node}) => {
  node = store.getState().ast.getNodeById(node.id);
  return {from: node.from, to: node.to};
})
class Node extends BlockComponent {
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

    activate: PropTypes.func.isRequired,
    activateByNId: PropTypes.func.isRequired,
  }

  state = {editable: false, value: null}

  handleChange = (value) => {
    this.setState({value});
  }

  handleClick = e => {
    e.stopPropagation(); // prevent ancestors to steal focus
    if (!isErrorFree()) return; // TODO(Oak): is this the best way?

    this.props.activate(this.props.node.id, {allowMove: false});
  }

  handleDoubleClick = e => {
    e.stopPropagation();
    if (this.props.normallyEditable) {
      this.handleMakeEditable();
    }
  }

  handleKeyDown = e => {
    e.stopPropagation();
    if (!isErrorFree()) return; // TODO(Oak): is this the best way?

    const {
      node, expandable, isCollapsed,
      uncollapse, collapse, normallyEditable, setCursor,
      handleCopy, handlePaste, handleDelete,
      dispatch
    } = this.props;

    const id = node.id;

    dispatch((_, getState) => {
      const state = getState();
      const {ast, selections} = state;
      // so that we get the accurate node
      const node = ast.getNodeById(id);

      const fastSkip = next => skipCollapsed(node, next, state);
      const activate = (node, options={allowMove: true, record: true}) => {
        if (!node) {
          playSound(BEEP);
        } else {
          this.props.activate(node.id, options);
        }
      };

      switch (global.keyMap[e.key]) {
      case 'prevNode':
        e.preventDefault();
        activate(fastSkip(node => node.prev));
        return;

      case 'nextNode':
        e.preventDefault();
        activate(fastSkip(node => node.next));
        return;

      case 'activateSearchDialog':
        e.preventDefault();
        global.search.onSearch(state, () => activate(node));
        return;

      case 'searchPrevious':
        e.preventDefault();
        activate(
          global.search.search(false, state),
          {allowMove: true, record: false}
        );
        return;

      case 'searchNext':
        e.preventDefault();
        activate(
          global.search.search(true, state),
          {allowMove: true, record: false}
        );
        return;

        // collapse all (shift), collapse current (if collapsable), select parent (if exists)
      case 'collapseOrSelectParent':
        e.preventDefault();
        if (e.shiftKey) { // activate the root
          dispatch({type: 'COLLAPSE_ALL'});
          activate(getRoot(node));
        } else if (expandable && !isCollapsed && !this.isLocked()) {
          collapse(id);
        } else if (node.parent) {
          activate(node.parent);
        } else {
          playSound(BEEP);
        }
        return;
        // expand all (shift), expand current (if expandable), select first child (if expanded)
      case 'expandOrSelectFirstChild':
        e.preventDefault();
        if (e.shiftKey) {
          dispatch({type: 'UNCOLLAPSE_ALL'});
        } else if (expandable && isCollapsed && !this.isLocked()) {
          uncollapse(id);
        } else if (node.next && node.next.parent === node) {
          activate(node.next);
        } else {
          playSound(BEEP);
        }
        return;
        // toggle selection
      case 'toggleSelection':
        e.preventDefault();
        if (selections.includes(id)) {
          dispatch({
            type: 'SET_SELECTIONS',
            selections: selections.filter(s => s !== id)
          });
          // announce removal
        } else {
          const {from: addedFrom, to: addedTo} = node;
          const isContained = id => {
            const {from, to} = ast.getNodeById(id);
            return poscmp(addedFrom, from) <= 0 && poscmp(to, addedTo) <= 0;
          };
          const doesContain = id => {
            const {from, to} = ast.getNodeById(id);
            return poscmp(from, addedFrom) <= 0 && poscmp(addedTo, to) <= 0;
          };
          const [removed, newSelections] = partition(selections, isContained);
          for (const r of removed) {
            // announce removal
          }
          if (newSelections.some(doesContain)) {
            // announce failure
          } else {
            // announce addition
            newSelections.push(id);
            dispatch({
              type: 'SET_SELECTIONS',
              selections: newSelections
            });
          }
        }
        return;
        // edit if normally editable, otherwise toggle collapsed state
      case 'edit':
        e.preventDefault();
        if (normallyEditable || isControl(e)) {
          this.handleMakeEditable(e);
        } else if (expandable && !this.isLocked()) {
          (isCollapsed ? uncollapse : collapse)(node.id);
        } else {
          playSound(BEEP);
        }
        return;
        // clear selection
      case 'clearSelection':
        e.preventDefault();
        dispatch({type: 'SET_SELECTIONS', selections: []});
        return;
        // delete seleted nodes
      case 'delete':
        e.preventDefault();
        handleDelete();
        return;
        // insert-right
      case 'insertRight':
        e.preventDefault();
        if (e.ctrlKey) { // strictly want ctrlKey
          // TODO: this should go up to the top level block
          if (this.props.onSetRight) {
            this.props.onSetRight(true);
          } else {
            setCursor(node.to);
          }
        }
        return;
        // insert-left
      case 'insertLeft':
        e.preventDefault();
        if (e.ctrlKey) { // strictly want ctrlKey
          // TODO: this should go up to the top level block
          if (this.props.onSetLeft) {
            this.props.onSetLeft(true);
          } else {
            setCursor(node.from);
          }
        }
        return;
        // copy
      case 'copy':
        e.preventDefault();
        if (isControl(e)) {
          handleCopy(node.id, nodeSelections => {
            if (nodeSelections.length == 0) {
              // NOTE(Oak): no nodes are selected, do it on id instead
              return [node.id, ...nodeSelections];
            } else {
              return nodeSelections;
            }
          });
        }
        return;
        // paste
      case 'paste':
        if (isControl(e)) {
          handlePaste(node.id, e.shiftKey);
        }
        return;
        // cut
      case 'cut':
        e.preventDefault();
        if (isControl(e)) {
          handleCopy(node.id, nodeSelections => {
            if (nodeSelections.length == 0) {
              say('Nothing selected');
            }
            return nodeSelections;
          });
          handleDelete();
        }
        return;
        // go to the very first node in the AST
      case 'firstNode':
        e.preventDefault();
        this.props.activateByNId(0, {allowMove: true});
        return;
        // go to last _visible_ node in the AST
      case 'lastVisibleNode':
        activate(getLastVisibleNode(state));
        return;
        // "jump to the root of the active node"
      case 'jumpToRoot':
        e.preventDefault();
        activate(getRoot(node));
        return;
        // "read all the ancestors"
      case 'describeAncestors': {
        e.preventDefault();
        const parents = [node.optinos['aria-label']];
        let next = node.parent;
        while (next) {
          parents.push(next.options['aria-label'] + ", at level " + next.level);
          next = next.parent;
        }
        if (parents.length > 1) say(parents.join(", inside "));
        else playSound(BEEP);
        return;
      }
      // "read the first set of children"
      case 'describeChildren':
        e.preventDefault();
        say(node.toDescription(node.level));
        return;

      case 'undo':
        if (isControl(e)) {
          e.preventDefault();
          if (e.shiftKey) {
            global.cm.redo();
          } else {
            global.cm.undo();
          }
        }
        return;

      case 'redo':
        if (isControl(e)) {
          e.preventDefault();
          global.cm.redo();
        }
        return;

      }
    });
  }


  handleMakeEditable = () => {
    if (!isErrorFree()) return;
    this.setState({editable: true});
    global.cm.refresh(); // is this needed?
  };

  handleDisableEditable = () => this.setState({editable: false});

  isLocked() {
    return this.props.lockedTypes.includes(this.props.node.type);
  }

  render() {
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
                      node={node}
                      value={this.state.value}
                      onChange={this.handleChange}
                      contentEditableProps={props} />
      );
    } else {
      const {connectDragSource, isDragging, connectDropTarget, isOver} = this.props;
      classes.push({'blocks-over-target': isOver, 'blocks-node': true});
      let result = (
        <span
          {...props}
          className     = {classNames(classes)}
          ref           = {el => node.element = el}
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
  {selections, collapsedList},
  {node}
  // be careful here. Only node's id is accurate. Use getNodeById
  // to access accurate info
) => {
  return {
    isSelected: selections.includes(node.id),
    isCollapsed: collapsedList.includes(node.id),
  };
};

const mapDispatchToProps = dispatch => ({
  dispatch,
  collapse: id => dispatch({type: 'COLLAPSE', id}),
  uncollapse: id => dispatch({type: 'UNCOLLAPSE', id}),
  setCursor: cur => dispatch({type: 'SET_CURSOR', cur}),
  handleDelete: () => dispatch(deleteNodes()),
  onDrop: (src, dest) => dispatch(dropNode(src, dest)),
  handleCopy: (id, selectionEditor) => dispatch(copyNodes(id, selectionEditor)),
  handlePaste: (id, isBackward) => dispatch(pasteNodes(id, isBackward)),
  activate: (id, options) => dispatch(activate(id, options)),
  activateByNId: (nid, options) => dispatch(activateByNId(nid, options)),
});

export default connect(mapStateToProps, mapDispatchToProps)(Node);
