import React, { useContext, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AST, ASTNode, nodeElementMap } from "../ast";
import { ReplaceNodeTarget, collapseNode } from "../state/actions";
import * as actions from "../state/actions";
import NodeEditable from "./NodeEditable";
import { NodeContext, findAdjacentDropTargetId } from "./DropTarget";
import { AppDispatch } from "../state/store";
import { ItemTypes } from "../dnd";
import classNames from "classnames";
import { useDrag, useDrop } from "react-dnd";
import { RootState } from "../state/reducers";
import { isDummyPos } from "../utils";
import { keyDown } from "../keymap";
import { AppContext, EditorContext } from "./Context";
import { RootNodeContext } from "../ui/ToplevelBlock";
import * as selectors from "../state/selectors";

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

/**
 * Returns the string id that should be used for the dom element
 * that renders the given ast node.
 *
 * The id is based on the node's id, which is theoretically going
 * to be unique across multiple instances of CodeMirrorBlocks because
 * the ast node ids are generated with {@link genUniqueId}.
 */
function getNodeElementId(node: ASTNode) {
  return `block-node-${node.id}`;
}

const Node = ({ expandable = true, ...props }: Props) => {
  const isCollapsed = useSelector((state: RootState) =>
    selectors.isCollapsed(state, props.node)
  );
  const isSelected = useSelector((state: RootState) =>
    selectors.isSelected(state, props.node)
  );
  const textMarker = useSelector((state: RootState) =>
    selectors.getTextMarker(state, props.node)
  );
  const rootNode = useContext(RootNodeContext);
  useEffect(() => {
    // Whenever a node gets rerendered because it's collapsed state has changed,
    // make sure to notifiy
    // codemirror by calling marker.changed() on the rootNode
    // marker object, in case the widget's height has changed.
    rootNode.marker?.changed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCollapsed]);

  const [editable, setEditable] = useState(false);

  const [value, setValue] = useState<string | null | undefined>();
  const editor = useContext(EditorContext);

  const dispatch: AppDispatch = useDispatch();
  const appHelpers = useContext(AppContext);
  const isErrorFree = useSelector(selectors.isErrorFree);

  const handleMakeEditable = () => {
    if (!isErrorFree || props.inToolbar) {
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
        appHelpers: appHelpers,
        handleMakeEditable,
        setLeft: (ast: AST) => {
          const dropTargetId = findAdjacentDropTargetId(ast, props.node, true);
          if (dropTargetId) {
            dispatch({ type: "SET_EDITABLE", id: dropTargetId, bool: true });
          }
          return !!dropTargetId;
        },
        setRight: (ast: AST) => {
          const dropTargetId = findAdjacentDropTargetId(ast, props.node, false);
          if (dropTargetId) {
            dispatch({ type: "SET_EDITABLE", id: dropTargetId, bool: true });
          }
          return !!dropTargetId;
        },
        normallyEditable: Boolean(props.normallyEditable),
        expandable,
      })
    );
  };
  const handleClick = (e: React.MouseEvent) => {
    const { inToolbar, normallyEditable } = props;
    e.stopPropagation();
    if (inToolbar) {
      return;
    }
    if (normallyEditable) {
      handleMakeEditable();
    }
  };

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
    if (!isErrorFree) {
      // TODO(Oak): is this the best way?
      return;
    }
    dispatch(actions.activateNode(editor, props.node, { allowMove: false }));
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (props.inToolbar) {
      return;
    }
    if (isCollapsed) {
      dispatch(actions.uncollapseNode(props.node));
    } else {
      dispatch(collapseNode(props.node));
    }
  };

  const handleMouseDragRelated = (e: React.MouseEvent<HTMLSpanElement>) => {
    if (e.type === "dragstart") {
      const dt = new DataTransfer();
      dt.setData("text/plain", (e.target as HTMLSpanElement).textContent || "");
    }
  };
  const { ...passingProps } = props;

  const comment = props.node.options.comment;
  const commentElemId = comment ? getNodeElementId(comment) : "";
  const nodeElemId = getNodeElementId(props.node);
  const locked = props.node.options.isNotEditable;

  const contentEditableProps = {
    id: nodeElemId,
    tabIndex: -1,
    "aria-selected": isSelected,
    "aria-label": props.node.shortDescription() + ",",
    "aria-labelledby": `${nodeElemId} ${commentElemId}`,
    "aria-disabled": locked ? true : undefined,
    "aria-expanded": expandable && !locked ? !isCollapsed : undefined,
    "aria-setsize": props.node.ariaSetSize,
    "aria-posinset": props.node.ariaPosInset,
    "aria-level": props.node.level,
  };

  const classes: Parameters<typeof classNames> = [
    { "blocks-locked": locked },
    `blocks-${props.node.type}`,
  ];
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
      return dispatch((dispatch, getState) => {
        const ast = selectors.getAST(getState());
        const node = ast.getNodeByIdOrThrow(props.node.id);
        return dispatch(
          actions.drop(editor, monitor.getItem(), new ReplaceNodeTarget(node))
        );
      });
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

  const nodeElementRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (nodeElementRef.current) {
      nodeElementMap.set(props.node.id, nodeElementRef.current);
      return () => {
        nodeElementMap.delete(props.node.id);
      };
    }
  }, [props.node.id]);

  // If this is the currently focused node, then focus the node element
  // as soon as we finish rendering.
  const focusedNode = useSelector(selectors.getFocusedNode);
  useEffect(() => {
    if (
      !editor?.hasFocus() &&
      document.activeElement !== document.body &&
      document.activeElement !== null &&
      document.activeElement.id !== "SR_fix_for_slow_dom"
    ) {
      // If the editor doesn't have focus, then we don't want to steal
      // focus from something else.
      return;
    }
    if (nodeElementRef.current && focusedNode?.id === props.node.id) {
      nodeElementRef.current?.focus();
    }
  }, [editor, focusedNode?.id, props.node.id, editable]);

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
    if (textMarker?.options.className) {
      classes.push(textMarker.options.className);
    }
    let result: React.ReactElement | null = (
      <span
        {...contentEditableProps}
        className={classNames(classes)}
        ref={nodeElementRef}
        role={props.inToolbar ? "listitem" : "treeitem"}
        style={
          {
            opacity: isDragging ? 0.5 : 1,
            cssText: textMarker ? textMarker.options.css : null,
            // TODO(pcardune): figure out what cssText is supposed to be
            // as it doesn't typecheck.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any
        }
        title={textMarker?.options.title}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onDragStart={handleMouseDragRelated}
        onDragEnd={handleMouseDragRelated}
        onDrop={handleMouseDragRelated}
        onKeyDown={handleKeyDown}
      >
        {props.children}
        {comment && comment.reactElement({ id: commentElemId })}
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
