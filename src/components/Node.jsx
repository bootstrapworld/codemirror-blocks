import React  from 'react';
import {connect} from 'react-redux';
import PropTypes from 'prop-types';
import {ASTNode} from '../ast';
import {partition, getRoot, sayActionForNodes,
        isControl, say, skipCollapsed, getLastVisibleNode} from '../utils';
import {drop, delete_, copy, paste, activate, setCursor,
        InsertTarget, ReplaceNodeTarget, OverwriteTarget} from '../actions';
import NodeEditable from './NodeEditable';
import BlockComponent from './BlockComponent';
import {NodeContext, DropTargetContext, findAdjacentDropTargetId} from './DropTarget';
import {isErrorFree} from '../store';
import SHARED from '../shared';
import {DragNodeSource, DropNodeTarget} from '../dnd';
import classNames from 'classnames';
import {store} from '../store';
import {playSound, BEEP} from '../sound';

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

    activate: PropTypes.func.isRequired,
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

  handleMouseDown = e => {
    if(!this.props.inToolbar) e.stopPropagation(); // prevent ancestors to steal focus
    if (!isErrorFree()) return; // TODO(Oak): is this the best way?
    this.props.activate(this.props.node.id, {allowMove: false});
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
    //e.preventDefault();
    //e.stopPropagation();
    //console.log('DS26GTE handle', e.type, '(N) CALLED!');
    if (e.type === 'dragstart') {
      let dt = new DataTransfer();
      dt.setData('text/plain', e.target.innerText);
    }
  }

  handleKeyDown = e => {
    e.stopPropagation();
    if(this.props.inToolbar) return;
    if (!isErrorFree()) return; // TODO(Oak): is this the best way?

    const {
      node, expandable, isCollapsed,
      uncollapse, collapse, normallyEditable, setCursor,
      dispatch
    } = this.props;

    const activateNoRecord = node => {
      if(!node){ playSound(BEEP); } // nothing to activate
      else { dispatch(activate(node.id, {record: false, allowMove: true})); }
    };

    const id = node.id;

    dispatch((_, getState) => {
      const state = getState();
      const {ast, selections} = state;
      // so that we get the accurate node
      const node = ast.getNodeById(id);
      let result;

      const fastSkip = next => skipCollapsed(node, next, state);
      const activate = (n, options={allowMove: true, record: true}) => {
        if (!n) { playSound(BEEP); }
        this.props.activate(n? n.id : node.id, options);
      };

      const keyname = SHARED.keyName(e);
      const message = SHARED.keyMap[keyname];
      switch (message) {
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
        SHARED.search.onSearch(
          state,
          () => { this.props.activate },
          () => activateNoRecord(SHARED.search.search(true, state))
        );
        return;

      case 'searchPrevious':
        e.preventDefault();
        activateNoRecord(SHARED.search.search(false, state));
        return;

      case 'searchNext':
        e.preventDefault();
        activateNoRecord(SHARED.search.search(true, state));
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
          const isContained = id => ast.isAncestor(node.id, id);
          const doesContain = id => ast.isAncestor(id, node.id);
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
        if (selections.length === 0) {
          say('Nothing selected');
          return;
        }
        const nodesToDelete = selections.map(ast.getNodeById);
        sayActionForNodes(nodesToDelete, "deleted");
        delete_(nodesToDelete);
        return;

      // insert-right
      case 'insertRight':
        e.preventDefault();
        const rightTargetId = findAdjacentDropTargetId(this.props.node, false);
        if (rightTargetId) { this.props.setEditable(rightTargetId, true); }
        else { setCursor(node.srcRange().to); }
        return;

      // insert-left
      case 'insertLeft':
        e.preventDefault();
        const leftTargetId = findAdjacentDropTargetId(this.props.node, true);
        if (leftTargetId) { this.props.setEditable(leftTargetId, true); }
        else { setCursor(node.srcRange().from); }
        return;

      // copy
      case 'copy':
        e.preventDefault();
        // if no nodes are selected, do it on focused node's id instead
        const nodeIds = selections.length == 0 ? [node.id] : selections;
        const nodesToCopy = nodeIds.map(ast.getNodeById);
        sayActionForNodes(nodesToCopy, "copied");
        copy(nodesToCopy);
        return;

      // paste
      case 'paste':
        if (selections.includes(id)) {
          paste(new ReplaceNodeTarget(node));
        } else if (node.parent) {
          // We're inside the AST somewhere. Try to paste to the left/right.
          const pos = e.shiftKey ? node.srcRange().from : node.srcRange().to;
          const target = new InsertTarget(this.context.node, this.context.field, pos);
          if (target) {
            paste(target);
          } else {
            let direction = e.shiftKey ? "before" : "after";
            say(`Cannot paste ${direction} this node.`);
          }
        } else {
          // We're at a root node. Insert to the left or right, at the top level.
          const pos = e.shiftKey ? node.srcRange().from : node.srcRange().to;
          paste(new OverwriteTarget(pos, pos));
        }
        return;

      // cut
      case 'cut':
        e.preventDefault();
        if (selections.length === 0) {
          say('Nothing selected');
          return;
        }
        const nodesToCut = selections.map(ast.getNodeById);
        sayActionForNodes(nodesToCut, "cut");
        copy(nodesToCut);
        delete_(nodesToCut);
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
/*
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
*/
  isLocked() {
    if (SHARED.options && SHARED.options.renderOptions) {
      const lockedList = SHARED.options.renderOptions.lockNodesOfType;
      return lockedList.includes(this.props.node.type);
    }
    return false;
  }

  render() {
    //console.log('DS26GTE calling Node/render');
    //console.log(this.props);
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
          onMouseDown   = {this.handleMouseDown}
          onClick       = {this.handleClick}
          onDoubleClick = {this.handleDoubleClick}
          onDragStart   = {this.handleMouseDragRelated}
          onDragEnd     = {this.handleMouseDragRelated}
          onDrop        = {this.handleMouseDragRelated}
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
  setCursor: cur => dispatch(setCursor(cur)),
  activate: (id, options) => dispatch(activate(id, options)),
  setEditable: (id, bool) => dispatch({type: 'SET_EDITABLE', id, bool}),
});

export default connect(mapStateToProps, mapDispatchToProps)(Node);
