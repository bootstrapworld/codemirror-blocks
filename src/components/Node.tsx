import React, { HTMLAttributes, useContext, useEffect, useState } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { ASTNode } from "../ast";
import { useDropAction, activateByNid, ReplaceNodeTarget } from "../actions";
import NodeEditable from "./NodeEditable";
import { NodeContext, findAdjacentDropTargetId } from "./DropTarget";
import { AppDispatch, AppStore } from "../store";
import { ItemTypes } from "../dnd";
import classNames from "classnames";
import { useDrag, useDrop } from "react-dnd";
import { RootState } from "../reducers";
import { isDummyPos } from "../utils";
import { keyDown } from "../keymap";
import { EditorContext } from "./Context";
import { useLanguageOrThrow, useSearchOrThrow } from "../hooks";

// TODO(Oak): make sure that all use of node.<something> is valid
// since it might be cached and outdated
// EVEN BETTER: is it possible to just pass an id?

export type Props = {
  node: ASTNode;
  inToolbar?: boolean;
  normallyEditable?: boolean;
  expandable?: boolean;
  children?: React.ReactNode | React.ReactElement;
};

const Node = ({ expandable = true, ...props }: Props) => {
  const stateProps = useSelector(
    ({ selections, collapsedList, markedMap }: RootState) => {
      // be careful here. Only node's id is accurate. Use getNodeById
      // to access accurate info
      return {
        isSelected: selections.includes(props.node.id),
        isCollapsed: collapsedList.includes(props.node.id),
        textMarker: markedMap[props.node.id],
      };
    }
  );

  useEffect(() => {
    // if its a top level node (ie - it has a CM mark on the node) AND
    // its isCollapsed property has changed, call mark.changed() to
    // tell CodeMirror that the widget's height may have changed
    // TODO(pcardune): Does this logic perhaps belong in ToplevelBlock?
    if (props.node.mark) {
      props.node.mark.changed();
    }
  }, [stateProps.isCollapsed, props.node.mark]);

  const [editable, setEditable] = useState(false);
  props.node.isEditable = () => editable;

  const [value, setValue] = useState<string | null | undefined>();
  const editor = useContext(EditorContext);
  const isLocked = () => props.node.isLockedP;

  const dispatch: AppDispatch = useDispatch();
  const store: AppStore = useStore();
  const language = useLanguageOrThrow();
  const search = useSearchOrThrow();

  const isErrorFree = () => store.getState().errorId === "";

  const handleMakeEditable = () => {
    if (!isErrorFree() || props.inToolbar) {
      return;
    }
    setEditable(true);
    editor?.refresh(); // is this needed?
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!editor) {
      // codemirror hasn't mounted yet, do nothing.
      return;
    }
    dispatch(
      keyDown(e, {
        isNodeEnv: true,
        node: props.node,
        editor: editor,
        language: language,
        search: search,

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
        normallyEditable: Boolean(props.normallyEditable),
        expandable,
        isCollapsed: stateProps.isCollapsed,
      })
    );
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
    if (!editor) {
      // codemirror hasn't mounted yet, do nothing
      return;
    }
    if (props.inToolbar) {
      // do not process toolbar nodes
      return;
    } else {
      // prevent ancestors from stealing focus
      e.stopPropagation();
    }
    const { ast } = store.getState();
    if (!isErrorFree()) {
      // TODO(Oak): is this the best way?
      return;
    }
    const currentNode = ast.getNodeByIdOrThrow(props.node.id);
    dispatch(
      activateByNid(editor, search, currentNode.nid, { allowMove: false })
    );
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (props.inToolbar) return;
    if (stateProps.isCollapsed) {
      dispatch({ type: "UNCOLLAPSE", id: props.node.id });
    } else {
      dispatch({ type: "COLLAPSE", id: props.node.id });
    }
  };

  const handleMouseDragRelated = (e: React.MouseEvent<HTMLSpanElement>) => {
    if (e.type === "dragstart") {
      let dt = new DataTransfer();
      dt.setData("text/plain", (e.target as HTMLSpanElement).textContent || "");
    }
  };
  const { ...passingProps } = props;

  let comment = props.node.options.comment;
  if (comment) comment.id = `block-node-${props.node.id}-comment`;
  const locked = isLocked();

  const contentEditableProps: HTMLAttributes<HTMLSpanElement> = {
    id: `block-node-${props.node.id}`,
    tabIndex: -1,
    "aria-selected": stateProps.isSelected,
    "aria-label": props.node.shortDescription() + ",",
    "aria-labelledby": `block-node-${props.node.id} ${
      comment ? comment.id : ""
    }`,
    "aria-disabled": locked ? "true" : undefined,
    "aria-expanded":
      expandable && !locked ? !stateProps.isCollapsed : undefined,
    "aria-setsize": props.node["aria-setsize"],
    "aria-posinset": props.node["aria-posinset"],
    "aria-level": props.node.level,
  };

  const classes: Parameters<typeof classNames> = [
    { "blocks-locked": locked },
    `blocks-${props.node.type}`,
  ];
  const drop = useDropAction();
  const [{ isOver }, connectDropTarget] = useDrop({
    accept: ItemTypes.NODE,
    drop: (_item, monitor) => {
      if (!editor) {
        // codemirror hasn't mounted yet, do nothing
        return;
      }
      if (monitor.didDrop()) {
        return;
      }
      const node = store.getState().ast.getNodeByIdOrThrow(props.node.id);
      return drop(editor, monitor.getItem(), new ReplaceNodeTarget(node));
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
    if (!editor) {
      throw new Error("can't edit nodes before codemirror has mounted");
    }
    // TODO: combine passingProps and contentEditableProps
    return (
      <NodeEditable
        {...passingProps}
        editor={editor}
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
    if (stateProps.textMarker?.options.className) {
      classes.push(stateProps.textMarker.options.className);
    }
    let result: React.ReactElement | null = (
      <span
        {...contentEditableProps}
        className={classNames(classes)}
        ref={(el) => (props.node.element = el)}
        role={props.inToolbar ? "listitem" : "treeitem"}
        style={
          {
            opacity: isDragging ? 0.5 : 1,
            cssText: stateProps.textMarker
              ? stateProps.textMarker.options.css
              : null,
          } as any
        }
        title={stateProps.textMarker?.options.title}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onDragStart={handleMouseDragRelated}
        onDragEnd={handleMouseDragRelated}
        onDrop={handleMouseDragRelated}
        onKeyDown={handleKeyDown}
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

export default Node;
