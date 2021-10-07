import React, { HTMLAttributes, useContext } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { ASTNode } from "../ast";
import { useDropAction, activateByNid, ReplaceNodeTarget } from "../actions";
import NodeEditable from "./NodeEditable";
import BlockComponent from "./BlockComponent";
import { NodeContext, findAdjacentDropTargetId } from "./DropTarget";
import { AppDispatch, isErrorFree } from "../store";
import { ItemTypes } from "../dnd";
import classNames from "classnames";
import CodeMirror from "codemirror";
import { GetProps, useDrag, useDrop } from "react-dnd";
import { RootState } from "../reducers";
import { isDummyPos } from "../utils";
import { InputEnv, keyDown } from "../keymap";
import { CMContext } from "./Context";

// TODO(Oak): make sure that all use of node.<something> is valid
// since it might be cached and outdated
// EVEN BETTER: is it possible to just pass an id?

type NodeState = { editable: boolean; value: string | null };

class BlockComponentNode extends BlockComponent<EnhancedNodeProps, NodeState> {
  static defaultProps = {
    normallyEditable: false,
    expandable: true,
  };

  state: NodeState = { editable: false, value: null };

  componentDidMount() {
    // For testing
    this.props.node.isEditable = () => this.state.editable;
  }

  // if its a top level node (ie - it has a CM mark on the node) AND
  // its isCollapsed property has changed, call mark.changed() to
  // tell CodeMirror that the widget's height may have changed
  componentDidUpdate(prevProps: EnhancedNodeProps) {
    if (
      this.props.node.mark &&
      prevProps.isCollapsed !== this.props.isCollapsed
    ) {
      this.props.node.mark.changed();
    }
  }

  render() {
    return (
      <Node
        {...this.props}
        state={this.state}
        setState={(s) => this.setState(s)}
      />
    );
  }
}

const Node = (
  props: EnhancedNodeProps & {
    state: NodeState;
    setState: (s: NodeState) => void;
  }
) => {
  const editable = props.state.editable;
  const setEditable = (editable: boolean) =>
    props.setState({ ...props.state, editable });
  const value = props.state.value;
  const setValue = (value: string) => props.setState({ ...props.state, value });
  const cm = useContext(CMContext);
  const isLocked = () => props.node.isLockedP;
  const handleMakeEditable = () => {
    if (!isErrorFree() || props.inToolbar) return;
    props.setState({ ...props.state, editable: true });
    setEditable(true);
    cm.refresh(); // is this needed?
  };

  const dispatch: AppDispatch = useDispatch();

  const keydownEnv: InputEnv = {
    isNodeEnv: true,
    node: props.node,
    cm: cm,

    isLocked,
    handleMakeEditable,
    setLeft: () => {
      const dropTargetId = findAdjacentDropTargetId(props.node, true);
      if (dropTargetId) {
        dispatch({ type: "SET_EDITABLE", id: dropTargetId, bool: true });
      }
      return !!dropTargetId;
    },
    setRight: () => {
      const dropTargetId = findAdjacentDropTargetId(props.node, false);
      if (dropTargetId) {
        dispatch({ type: "SET_EDITABLE", id: dropTargetId, bool: true });
      }
      return !!dropTargetId;
    },
    normallyEditable: props.normallyEditable,
    expandable: props.expandable,
    isCollapsed: props.isCollapsed,

    dispatch,
  };
  const handleClick = (e: React.MouseEvent) => {
    const { inToolbar, normallyEditable } = props;
    e.stopPropagation();
    if (inToolbar) return;
    if (normallyEditable) handleMakeEditable();
  };
  // nid can be stale!! Always obtain a fresh copy of the node
  // from getState() before calling activateByNid
  const handleMouseDown = (e: React.MouseEvent) => {
    if (props.inToolbar) return;
    // do not process toolbar nodes
    else e.stopPropagation(); // prevent ancestors from stealing focus
    if (!isErrorFree()) return; // TODO(Oak): is this the best way?
    const { ast } = store.getState();
    const currentNode = ast.getNodeById(props.node.id);
    dispatch(activateByNid(cm, currentNode.nid, { allowMove: false }));
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (props.inToolbar) return;
    if (props.isCollapsed) {
      dispatch({ type: "UNCOLLAPSE", id: props.node.id });
    } else {
      dispatch({ type: "COLLAPSE", id: props.node.id });
    }
  };

  const handleMouseDragRelated = (e: React.MouseEvent<HTMLSpanElement>) => {
    if (e.type === "dragstart") {
      let dt = new DataTransfer();
      dt.setData("text/plain", (e.target as HTMLSpanElement).textContent);
    }
  };
  const { ...passingProps } = props;

  let comment = props.node.options.comment;
  if (comment) comment.id = `block-node-${props.node.id}-comment`;
  const locked = isLocked();

  const contentEditableProps: HTMLAttributes<HTMLSpanElement> = {
    id: `block-node-${props.node.id}`,
    tabIndex: -1,
    "aria-selected": props.isSelected,
    "aria-label": props.node.shortDescription() + ",",
    "aria-labelledby": `block-node-${props.node.id} ${
      comment ? comment.id : ""
    }`,
    "aria-disabled": locked ? "true" : undefined,
    "aria-expanded":
      props.expandable && !locked ? !props.isCollapsed : undefined,
    "aria-setsize": props.node["aria-setsize"],
    "aria-posinset": props.node["aria-posinset"],
    "aria-level": props.node.level,
  };

  const classes: Parameters<typeof classNames> = [
    { "blocks-locked": locked },
    `blocks-${props.node.type}`,
  ];
  const drop = useDropAction();
  const store = useStore();
  const [{ isOver }, connectDropTarget] = useDrop({
    accept: ItemTypes.NODE,
    drop: (_item, monitor) => {
      if (monitor.didDrop()) {
        return;
      }
      const node = store.getState().ast.getNodeById(props.node.id);
      return drop(cm, monitor.getItem(), new ReplaceNodeTarget(node));
    },
    collect: (monitor) => {
      return {
        isOver: monitor.isOver({ shallow: true }),
      };
    },
  });
  const [{ isDragging }, connectDragSource, connectDragPreview] = useDrag({
    type: ItemTypes.NODE,
    item: () => {
      if (isDummyPos(props.node.from) && isDummyPos(props.node.to)) {
        return { content: props.node.toString() };
      }
      return { id: props.node.id };
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  if (editable) {
    // TODO: combine passingProps and contentEditableProps
    return (
      <NodeEditable
        {...passingProps}
        cm={cm}
        onDisableEditable={() => setEditable(false)}
        extraClasses={classes}
        isInsertion={false}
        target={new ReplaceNodeTarget(props.node)}
        value={value}
        onChange={(value) => setValue(value)}
        onDragStart={handleMouseDragRelated}
        onDragEnd={handleMouseDragRelated}
        onDrop={handleMouseDragRelated}
        contentEditableProps={contentEditableProps}
      >
        {props.children}
      </NodeEditable>
    );
  } else {
    classes.push({ "blocks-over-target": isOver, "blocks-node": true });
    if (props.textMarker?.options.className) {
      classes.push(props.textMarker.options.className);
    }
    let result = (
      <span
        {...contentEditableProps}
        className={classNames(classes)}
        ref={(el) => (props.node.element = el)}
        role={props.inToolbar ? "listitem" : "treeitem"}
        style={
          {
            opacity: isDragging ? 0.5 : 1,
            cssText: props.textMarker ? props.textMarker.options.css : null,
          } as any
        }
        title={props.textMarker ? props.textMarker.options.title : null}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onDragStart={handleMouseDragRelated}
        onDragEnd={handleMouseDragRelated}
        onDrop={handleMouseDragRelated}
        onKeyDown={(e) => keyDown(e, keydownEnv)}
      >
        {props.children}
        {comment && comment.reactElement()}
      </span>
    );
    if (props.normallyEditable) {
      result = connectDropTarget(result);
    }
    result = connectDragPreview(connectDragSource(result), {
      offsetX: 1,
      offsetY: 1,
    });
    result = (
      <NodeContext.Provider value={{ node: props.node }}>
        {result}
      </NodeContext.Provider>
    );
    return result;
  }
};

type ReduxProps = {
  isSelected: boolean;
  isCollapsed: boolean;
  textMarker: CodeMirror.TextMarker;
};

export type EnhancedNodeProps = ConnectedNodeProps & ReduxProps;

type ConnectedNodeProps = {
  node: ASTNode;
  inToolbar?: boolean;
  normallyEditable?: boolean;
  expandable: boolean;
  children?: React.ReactNode | React.ReactElement;
};

const ConnectedNode = (props: ConnectedNodeProps) => {
  const { node } = props;
  const stateProps = useSelector(
    ({ selections, collapsedList, markedMap }: RootState) => {
      // be careful here. Only node's id is accurate. Use getNodeById
      // to access accurate info
      return {
        isSelected: selections.includes(node.id),
        isCollapsed: collapsedList.includes(node.id),
        textMarker: markedMap.get(node.id),
      };
    }
  );
  return <BlockComponentNode {...stateProps} {...props} />;
};

export type NodeProps = GetProps<typeof ConnectedNode>;

export default ConnectedNode;
