import React  from 'react';
import {connect} from 'react-redux';
import PropTypes from 'prop-types';
import {ASTNode} from '../ast';
import {partition, poscmp, getRoot, sayActionForNodes,
        isControl, say, skipCollapsed, getLastVisibleNode} from '../utils';
import {dropNode, deleteNodes, copySelectedNodes,
  pasteNodes, activate} from '../actions';
import NodeEditable from './NodeEditable';
import BlockComponent from './BlockComponent';
import {isErrorFree} from '../store';
import SHARED from '../shared';
import {DragNodeSource, DropNodeTarget} from '../dnd';
import classNames from 'classnames';
import {store} from '../store';
import {playSound, BEEP} from '../sound';


export const NodeContext = React.createContext({
  node: null,
});

// TODO(Oak): make sure that all use of node.<something> is valid
// since it might be cached and outdated
// EVEN BETTER: is it possible to just pass an id?

@DragNodeSource
@DropNodeTarget(function(monitor) {
  let node = store.getState().ast.getNodeById(this.props.node.id);
  return this.props.dispatch(dropNode(monitor.getItem(), node.srcRange()));
})
class Node extends BlockComponent {
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

    activate: PropTypes.func.isRequired,
  }

  state = {editable: false, value: null}

  componentDidMount() {
    // For testing
    this.props.node.isEditable = () => this.state.editable;
  }

  handleChange = (value) => {
    this.setState({value});
  }

  handleClick = e => {
    if(!this.props.inToolbar) e.stopPropagation(); // prevent ancestors to steal focus
    if (!isErrorFree()) return; // TODO(Oak): is this the best way?

    this.props.activate(this.props.node.id, {allowMove: false});
  }

  handleDoubleClick = e => {
    const {
      inToolbar, isCollapsed, normallyEditable, 
      collapse, uncollapse, node
    } = this.props;
    e.stopPropagation();
    if(inToolbar) return;
    if(normallyEditable) {
      this.handleMakeEditable();
    } else if(isCollapsed) {
      uncollapse(node.id);
    } else {
      collapse(node.id);
    }
  }

  handleKeyDown = e => {
    e.stopPropagation();
    if(this.props.inToolbar) return;
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
      const activate = (n, options={allowMove: true, record: true}) => {
        if (!n) { playSound(BEEP); }
        this.props.activate(n? n.id : node.id, options);
      };

      switch (SHARED.keyMap[SHARED.keyName(e)]) {
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
        SHARED.search.onSearch(state, () => activate(node));
        return;

      case 'searchPrevious':
        e.preventDefault();
        activate(
          SHARED.search.search(false, state),
          {allowMove: true, record: false}
        );
        return;

      case 'searchNext':
        e.preventDefault();
        activate(
          SHARED.search.search(true, state),
          {allowMove: true, record: false}
        );
        return;

      case 'collapseAll':
        e.preventDefault();
        dispatch({type: 'COLLAPSE_ALL'});
        activate(getRoot(node));
        return;

      // collapse current (if collapsable), select parent (if exists),  or beep
      case 'collapseOrSelectParent':
        e.preventDefault();
        if (expandable && !isCollapsed && !this.isLocked()) {
          collapse(id);
        } else if (node.parent) {
          activate(node.parent);
        } else {
          playSound(BEEP);
        }
        return;

      // if we're on a root that cannot be collapsed, beep. 
      // otherwise collapse all nodes in this root, and select the root
      case 'collapseCurrentRoot':
        e.preventDefault();
        if(!node.parent && (isCollapsed || !expandable)) {
          playSound(BEEP);
        } else {
          let root = getRoot(node); 
          let descendants = [...root.descendants()];
          descendants.forEach(d => collapse(d.id));
          activate(root);
        }
        return;

      case 'expandAll':
        e.preventDefault();
        dispatch({type: 'UNCOLLAPSE_ALL'});
        return;

      // expand current (if expandable), select first child (if expanded), or beep
      case 'expandOrSelectFirstChild':
        e.preventDefault();
        if (expandable && isCollapsed && !this.isLocked()) {
          uncollapse(id);
        } else if (node.next && node.next.parent === node) {
          activate(node.next);
        } else {
          playSound(BEEP);
        }
        return;

      // if we're on a root that cannot be collapsed, beep. 
      // otherwise collapse all nodes in this root, and select the root
      case 'expandCurrentRoot':
        e.preventDefault();
        let root = getRoot(node); 
        let descendants = [...root.descendants()];
        descendants.forEach(d => uncollapse(d.id));
        activate(root);
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
        handleDelete(node.id, nodeSelections => {
          if (nodeSelections.length == 0) {
            say('Nothing selected');
          } else {
            sayActionForNodes(nodeSelections.map(ast.getNodeById), "deleted");
          }
          return nodeSelections;
        });
        return;

      // insert-right
      case 'insertRight':
        e.preventDefault();
        if (e.ctrlKey) { // strictly want ctrlKey
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
        if (this.props.onSetLeft) {
          this.props.onSetLeft(true);
        } else {
          setCursor(node.from);
        }
        return;

      // copy
      case 'copy':
        e.preventDefault();
        handleCopy(node.id, nodeSelections => {
          // if no nodes are selected, do it on focused node's id instead
          let nodeIds = nodeSelections.length == 0 ? [node.id] : nodeSelections;
          sayActionForNodes(nodeIds.map(ast.getNodeById), "copied");
          return nodeIds;
        });
        return;

      // paste
      case 'paste':
        handlePaste(node.id, e.shiftKey);
        return;

      // cut
      case 'cut':
        e.preventDefault();
        handleCopy(node.id, nodeSelections => {
          if (nodeSelections.length == 0) {
            say('Nothing selected');
          } else {
            sayActionForNodes(nodeSelections.map(ast.getNodeById), "cut");
          }
          return nodeSelections;
        });
        handleDelete(id, (nodes) => nodes);
        return;

      // go to the very first node in the AST
      case 'firstNode':
        e.preventDefault();
        dispatch((_, getState) => {
          let ast = getState().ast;
          this.props.activate(ast.getFirstRootNode().id, {allowMove: true});
        });
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
      case 'readAncestors': {
        e.preventDefault();
        const parents = [node.options['aria-label']];
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
      case 'readChildren':
        e.preventDefault();
        say(node.describe(node.level));
        return;

      case 'undo':
        e.preventDefault();
        SHARED.cm.undo();
        return;

      case 'redo':
        e.preventDefault();
        SHARED.cm.redo();
        return;

      }
    });
  }

  handleMakeEditable = () => {
    if (!isErrorFree() || this.props.inToolbar) return;
    this.setState({editable: true});
    SHARED.cm.refresh(); // is this needed?
  };

  handleDisableEditable = () => this.setState({editable: false});

  isLocked() {
    if (SHARED.options && SHARED.options.renderOptions) {
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
                      node={node}
                      value={this.state.value}
                      onChange={this.handleChange}
                      contentEditableProps={props} />
      );
    } else {
      const {
        connectDragSource, isDragging,
        connectDropTarget, isOver,
        connectDragPreview
      } = this.props;
      classes.push({'blocks-over-target': isOver, 'blocks-node': true});
      if(textMarker && textMarker.options.className) classes.push(textMarker.options.className);

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
          onClick       = {this.handleClick}
          onDoubleClick = {this.handleDoubleClick}
          onKeyDown     = {this.handleKeyDown}>
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
  setCursor: cur => dispatch({type: 'SET_CURSOR', cur}),
  handleDelete: (id, selectionEditor) => dispatch(deleteNodes(id, selectionEditor)),
  handleCopy: (id, selectionEditor) => dispatch(copySelectedNodes(id, selectionEditor)),
  handlePaste: (id, isBackward) => dispatch(pasteNodes(id, isBackward)),
  activate: (id, options) => dispatch(activate(id, options)),
});

export default connect(mapStateToProps, mapDispatchToProps)(Node);
