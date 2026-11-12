import React, {
  createContext,
  useCallback,
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDispatch, useStore } from "react-redux";
import {
  AST,
  ASTNode,
  DrawnNode,
  currentNode as currentNodeIn,
  nodeElementMap,
} from "../ast";
import {
  CommentTarget,
  ReplaceNodeTarget,
  collapseNode,
} from "../state/actions";
import * as actions from "../state/actions";
import NodeEditable from "./NodeEditable";
import { NodeContext, findAdjacentDropTargetId } from "./DropTarget";
import { AppDispatch } from "../state/store";
import classNames from "classnames";
import { useDrag, useDrop } from "../dnd";
import { recordEvent } from "../state/activityLog";
import { RootState } from "../state/reducers";
import { isDummyPos, playSound, BEEP } from "../utils";
import { say } from "../announcer";
import { keyDown } from "../keymap";
import { AppContext, EditorContext } from "./Context";
import type { BlockNodeMarker } from "../editor";
import { RootNodeContext, areNodesEqualish } from "../ui/ToplevelBlock";
import * as selectors from "../state/selectors";
import { useIdState } from "../state/nodeSubscriptions";
import { useCommentBoxPlacement } from "./commentBox";

// TODO(Oak): make sure that all use of node.<something> is valid
// since it might be cached and outdated
// EVEN BETTER: is it possible to just pass an id?

export type Props = {
  /** (a node that may be older than the document: see {@link DrawnNode}) */
  node: DrawnNode;
  inToolbar?: boolean;
  normallyEditable?: boolean;
  expandable?: boolean;
  /**
   * What the editor's default style draws it as, whatever kind of node it is:
   * `"compound"` is a frame with a black strip at the top (a call, a
   * definition), and `"value"` is a pill (a name, a number). The block has the
   * class `blocks-compound` or `blocks-value`.
   */
  variant?: "compound" | "value";
  /**
   * Drawn beside the edit box while the block is being edited (the box takes
   * the place of the block's children, so they are not drawn then): a hint
   * about what to type, such as the names in scope. It can read
   * {@link useNodeState}, as the children can.
   */
  editingHint?: React.ReactNode;
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
function getNodeElementId(node: { id: string }) {
  return `block-node-${node.id}`;
}

// markers whose widget has a changed() call waiting
const pendingChanged = new Set<BlockNodeMarker>();

/** What is said just before the text of a comment that goes with a node */
export const COMMENT_PREFIX = "with comment: ";

/**
 * What a block can read about itself (see {@link useNodeState}): the state the
 * editor keeps for it, as plain values.
 */
export type NodeState = {
  /** it has keyboard focus (it is the active block) */
  focused: boolean;
  /** it is one of the selected blocks */
  selected: boolean;
  /** it is collapsed */
  collapsed: boolean;
  /** it is being dragged */
  dragging: boolean;
  /** something being dragged is over it, to be dropped on it */
  over: boolean;
  /** it is the block whose edit was refused */
  errored: boolean;
  /** it is in the toolbar, not in the program */
  inToolbar: boolean;
  /** its text is being edited (its children are not drawn: see `editingHint`) */
  editing: boolean;
};

const noState: NodeState = {
  focused: false,
  selected: false,
  collapsed: false,
  dragging: false,
  over: false,
  errored: false,
  inToolbar: false,
  editing: false,
};
const NodeStateContext = createContext<NodeState>(noState);

/**
 * The state of the block this is drawn in (read only; it re-renders the
 * component that calls it when one of the values changes). Use it in a
 * component drawn inside a `<Node>`, not in `render()` itself, as a hook can
 * only be called by a component: outside any block everything is false.
 */
export const useNodeState = (): NodeState => use(NodeStateContext);

/**
 * What a screen reader says for a block: what the node says it is, then the
 * text of the comment that goes with it (once), then a comma to pause.
 */
export function spokenLabel(
  node: Pick<ASTNode, "shortDescription" | "options">
): string {
  const comment = node.options.comment;
  return (
    node.shortDescription() +
    (comment
      ? ` ${COMMENT_PREFIX}${String(comment.fields.comment).trim()}`
      : "") +
    ","
  );
}

const Node = ({ expandable = true, ...props }: Props) => {
  // (useIdState wakes this block only when the store changes something about
  // this node, instead of running the selector on every update)
  const isCollapsed = useIdState(props.node.id, (state) =>
    selectors.isCollapsed(state, props.node)
  );
  const isSelected = useIdState(props.node.id, (state) =>
    selectors.isSelected(state, props.node)
  );
  const textMarker = useIdState(props.node.id, (state) =>
    selectors.getTextMarker(state, props.node)
  );
  const rootNode = use(RootNodeContext);
  useEffect(() => {
    // Whenever a node gets rerendered because it's collapsed state has changed,
    // make sure to notifiy
    // codemirror by calling marker.changed() on the rootNode
    // marker object, in case the widget's height has changed. (Once per marker, however
    // many of its nodes changed: collapsing everything changes tens of
    // thousands.)
    const marker = rootNode.marker;
    if (!marker || pendingChanged.has(marker)) return;
    pendingChanged.add(marker);
    queueMicrotask(() => {
      pendingChanged.delete(marker);
      marker.changed();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCollapsed]);

  const [editable, setEditable] = useState(false);
  // The box for the node's comment is open, with the text of the node it would
  // go with (taken when the box is opened)
  const [commentEditor, setCommentEditor] = useState<CommentTarget | null>(
    null
  );
  const [commentValue, setCommentValue] = useState<string | null | undefined>(
    null
  );
  // (a stable value, so the drop targets inside don't render whenever this does)
  const nodeContext = useMemo(() => ({ node: props.node }), [props.node]);

  const [value, setValue] = useState<string | null | undefined>();
  const editor = use(EditorContext);

  const dispatch: AppDispatch = useDispatch();
  // A block whose text didn't change is not drawn again when it only moves
  // (see areNodesEqualish), so props.node can be an older node object, with
  // older positions. Anything that acts on the node's place in the document
  // starts from the current one.
  const store = useStore<RootState>();
  const currentNode = () =>
    currentNodeIn(selectors.getAST(store.getState()), props.node);
  const appHelpers = use(AppContext);
  const isErrorFree = useIdState(props.node.id, selectors.isErrorFree);

  const handleMakeEditable = () => {
    if (!isErrorFree || props.inToolbar) {
      return;
    }
    setEditable(true);
    editor?.refresh(); // is this needed?
  };
  const handleEditComment = () => {
    if (!isErrorFree || props.inToolbar || !editor) {
      return;
    }
    const node = currentNode();
    if (node.options.orphan) {
      // (a comment block is edited like any block, with Enter)
      say("Press Enter to edit a comment block");
      playSound(BEEP);
      return;
    }
    if (!selectors.getAST(store.getState()).language.blockComment) {
      say("This language has no comments");
      playSound(BEEP);
      return;
    }
    // (a collapsed block hides what is in it, the box for its comment too: it
    // would be open, and take no focus, so keys would go on to something else)
    if (isCollapsed) {
      dispatch(actions.uncollapseNode(node));
    }
    setCommentValue(null);
    setCommentEditor(
      new CommentTarget(node, editor.getRange(node.from, node.to))
    );
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!editor) {
      // codemirror hasn't mounted yet, do nothing.
      return;
    }
    dispatch(
      keyDown(e, {
        isNodeEnv: true,
        node: currentNode(),
        editor: editor,
        appHelpers: appHelpers,
        handleMakeEditable,
        handleEditComment,
        setLeft: (ast: AST) => {
          const dropTargetId = findAdjacentDropTargetId(
            ast,
            currentNode(),
            true
          );
          if (dropTargetId) {
            dispatch({ type: "SET_EDITABLE", id: dropTargetId, bool: true });
          }
          return !!dropTargetId;
        },
        setRight: (ast: AST) => {
          const dropTargetId = findAdjacentDropTargetId(
            ast,
            currentNode(),
            false
          );
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
      recordEvent({ type: "MOUSE", nid: currentNode().nid });
    }
    if (!isErrorFree) {
      // TODO(Oak): is this the best way?
      return;
    }
    dispatch(actions.activateNode(editor, currentNode(), { allowMove: false }));
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (props.inToolbar) {
      return;
    }
    if (isCollapsed) {
      dispatch(actions.uncollapseNode(currentNode()));
    } else {
      dispatch(collapseNode(currentNode()));
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
    // (a comment is part of the name through aria-labelledby, which names the
    // comment's own element: that is how every screen reader has read it)
    "aria-label": comment
      ? props.node.shortDescription()
      : spokenLabel(props.node),
    "aria-labelledby": comment ? `${nodeElemId} ${commentElemId}` : nodeElemId,
    "aria-disabled": locked ? true : undefined,
    "aria-expanded": expandable && !locked ? !isCollapsed : undefined,
    "aria-setsize": props.node.ariaSetSize,
    "aria-posinset": props.node.ariaPosInset,
    "aria-level": props.node.level,
  };

  const classes: Parameters<typeof classNames> = [
    { "blocks-locked": locked },
    `blocks-${props.node.type}`,
    props.variant && `blocks-${props.variant}`,
  ];
  const [{ isOver }, connectDropTarget] = useDrop({
    describe: () => ({ nid: currentNode().nid }),
    drop: (item, info) => {
      if (!editor) {
        // codemirror hasn't mounted yet, do nothing
        return;
      }
      if (info.didDrop) {
        return;
      }
      return dispatch((dispatch, getState) => {
        const ast = selectors.getAST(getState());
        const node = ast.getNodeByIdOrThrow(props.node.id);
        return dispatch(
          actions.drop(editor, item, new ReplaceNodeTarget(node))
        );
      });
    },
  });
  const [{ isDragging }, connectDragSource] = useDrag({
    describe: () =>
      isDummyPos(currentNode().from) && isDummyPos(currentNode().to)
        ? { tool: props.node.toString() }
        : { nid: currentNode().nid },
    item: () => {
      if (isDummyPos(currentNode().from) && isDummyPos(currentNode().to)) {
        return { content: props.node.toString() };
      }
      return { id: props.node.id };
    },
  });

  const nodeElementRef = useRef<HTMLSpanElement | null>(null);

  // The node's element is a drag source (and its own drag preview), maybe a
  // drop target, and is remembered in nodeElementRef. These callbacks are
  // stable across renders, so that the drag layer doesn't reconnect on every one.
  const normallyEditable = Boolean(props.normallyEditable);
  const setNodeElement = useCallback(
    (el: HTMLSpanElement | null) => {
      nodeElementRef.current = el;
      if (normallyEditable) {
        connectDropTarget(el);
      }
      connectDragSource(el);
    },
    [normallyEditable, connectDropTarget, connectDragSource]
  );

  // The element can be replaced without the id changing (editing a node swaps
  // it for the editing box and back), so register it after every render.
  useEffect(() => {
    // (while it is being edited, the element is the editing box)
    const el =
      nodeElementRef.current ??
      (editable ? document.getElementById(nodeElemId) : null);
    if (el) {
      nodeElementMap.set(props.node.id, el);
    }
  });
  useEffect(() => {
    const id = props.node.id;
    return () => {
      nodeElementMap.delete(id);
    };
  }, [props.node.id]);

  // If this is the currently focused node, then focus the node element
  // as soon as we finish rendering.
  // (a boolean for this node, not the focused node itself: a new AST makes new
  // node objects, and a selector returning those would re-render every block
  // on every edit and every arrow key)
  const isFocused = useIdState(props.node.id, (state) =>
    selectors.isFocused(state, props.node)
  );

  // When the box this block is edited in closes, it takes the focus it had with
  // it, and the block that takes its place is not given focus by anyone: tell
  // the editor's keeper, once the block is on the page. (Not when the box is
  // removed: Preact does that before the new element is in place.)
  const wasEditableRef = useRef(false);
  useEffect(() => {
    if (wasEditableRef.current && !editable) editor?.checkFocus();
    wasEditableRef.current = editable;
  }, [editable, editor]);

  // The popup with this node's comment is placed (see placeCommentBox)
  const commentText = comment ? String(comment.fields.comment) : "";
  useCommentBoxPlacement({
    nodeElementRef,
    isFocused,
    commentText,
    commentEditor,
  });

  // Something else took focus without the box seeing a blur (the text was
  // changed from outside while editing, and the focus moved to another node):
  // the edit is over, so don't leave an orphaned box behind.
  useEffect(() => {
    if (!editable) return;
    const check = () => {
      const { focusId } = store.getState();
      if (!focusId || focusId === props.node.id) return;
      const box = document.getElementById(nodeElemId);
      // eslint-disable-next-line @eslint-react/set-state-in-effect
      if (box && box !== document.activeElement) setEditable(false);
    };
    check();
    // (the focus itself moves a moment after the store says where it goes)
    document.addEventListener("focusin", check);
    const unsubscribe = store.subscribe(check);
    return () => {
      document.removeEventListener("focusin", check);
      unsubscribe();
    };
  }, [editable, store, props.node.id, nodeElemId]);

  const isErrored = useIdState(
    props.node.id,
    (state) => selectors.getErrorId(state) === props.node.id
  );
  const inToolbar = Boolean(props.inToolbar);
  const nodeState = useMemo<NodeState>(
    () => ({
      focused: isFocused,
      selected: isSelected,
      collapsed: isCollapsed,
      dragging: isDragging,
      over: isOver,
      errored: isErrored,
      inToolbar,
      editing: Boolean(editable),
    }),
    [
      isFocused,
      isSelected,
      isCollapsed,
      isDragging,
      isOver,
      isErrored,
      inToolbar,
      editable,
    ]
  );

  if (editable) {
    if (!editor) {
      throw new Error("can't edit nodes before codemirror has mounted");
    }
    // TODO: combine passingProps and contentEditableProps
    return (
      <NodeStateContext value={nodeState}>
        <NodeEditable
          {...passingProps}
          editor={editor}
          onDisableEditable={() => setEditable(false)}
          extraClasses={classes}
          isInsertion={false}
          target={new ReplaceNodeTarget(currentNode())}
          value={value}
          onChange={(value: string | null) => setValue(value)}
          contentEditableProps={contentEditableProps}
          hint={props.editingHint}
        >
          {props.children}
        </NodeEditable>
      </NodeStateContext>
    );
  } else {
    classes.push({ "blocks-over-target": isOver, "blocks-node": true });
    if (textMarker?.options.className) {
      classes.push(textMarker.options.className);
    }
    const result = (
      <span
        {...contentEditableProps}
        className={classNames(classes)}
        ref={setNodeElement}
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
        onKeyDown={handleKeyDown}
      >
        {props.children}
        {commentEditor && editor ? (
          // (keys in the box are not commands for the block around it)
          <span onKeyDown={(e) => e.stopPropagation()}>
            <NodeEditable
              editor={editor}
              onDisableEditable={() => setCommentEditor(null)}
              extraClasses={["blocks-comment", "blocks-comment-editing"]}
              isInsertion={false}
              target={commentEditor}
              value={commentValue}
              onChange={setCommentValue}
              contentEditableProps={{
                id: `comment-edit-for-${nodeElemId}`,
                tabIndex: -1,
              }}
            />
          </span>
        ) : (
          comment && comment.reactElement({ id: commentElemId })
        )}
      </span>
    );
    return (
      <NodeContext value={nodeContext}>
        <NodeStateContext value={nodeState}>
          {comment && !props.inToolbar ? (
            // A speech balloon at the top right corner of the node. It sits beside
            // the node, not in it, so that the node's own box does not clip it; the
            // wrapper is what the corner is measured from. It is only to be seen:
            // the comment is read through the node's name.
            <span className="blocks-comment-wrap" role="presentation">
              {result}
              <span className="blocks-comment-badge" aria-hidden="true">
                💬
              </span>
            </span>
          ) : (
            result
          )}
        </NodeStateContext>
      </NodeContext>
    );
  }
};

// Drawing a node again gives the same result when it is the same code in the
// same place among its siblings (children are made from the node, so they
// don't need comparing); only the position in the document may have moved.
export default React.memo(Node, (prev: Props, next: Props) => {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  keys.delete("node");
  keys.delete("children");
  keys.delete("editingHint");
  for (const key of keys) {
    if (prev[key as keyof Props] !== next[key as keyof Props]) return false;
  }
  // (the one place that compares positions: both nodes really are ASTNodes)
  return (
    prev.node === next.node ||
    areNodesEqualish(prev.node as ASTNode, next.node as ASTNode)
  );
});
