import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import NodeEditable from "./NodeEditable";
import { useDrop } from "react-dnd";
import classNames from "classnames";
import { AppDispatch } from "../state/store";
import { genUniqueId } from "../utils";
import * as actions from "../state/actions";
import * as selectors from "../state/selectors";
import type { ASTNode, AST, Pos } from "../ast";
import { ItemTypes } from "../dnd";
import { EditorContext } from "./Context";
import { createSelector } from "reselect";

// Provided by `Node`
export const NodeContext = createContext<{ node: ASTNode | null }>({
  node: null,
});

// Find the id of the drop target (if any) on the given side of `child` node.
export function findAdjacentDropTargetId(
  ast: AST,
  child: ASTNode,
  onLeft: boolean
) {
  let prevDropTargetId: string | null = null;
  const targetId = `block-node-${child.id}`;

  function findDT(elem: Element): string | null {
    if (!elem.children) {
      return null;
    }
    // Convert array-like object into an Array.
    const children = [...elem.children];
    // If we want the drop-target to the right, iterate in reverse
    if (!onLeft) {
      children.reverse();
    }

    for (const sibling of children) {
      if (sibling.id?.startsWith("block-drop-target-")) {
        // We've hit a drop-target. Remember its id, in case it's adjacent to the node.
        prevDropTargetId = sibling.id.substring(18); // skip "block-drop-target-"
      } else if (sibling.id == targetId) {
        // We've found this node! Return the id of the adjacent drop target.
        return prevDropTargetId;
      } else if (sibling.id?.startsWith("block-node-")) {
        // It's a different node. Skip it.
      } else if (sibling.children) {
        // We're... somewhere else. If it has children, traverse them to look for the node.
        const result = findDT(sibling);
        if (result !== null) {
          return result; // node found.
        }
      }
    }
    return null;
  }
  const parentEl = ast.getNodeParent(child)?.element;
  if (!parentEl) {
    return null;
  }
  return findDT(parentEl);
}

const getLocation = ({
  ast,
  id,
  context,
}: {
  ast: AST;
  id: string;
  context: { node: ASTNode; field: string };
}) => {
  let prevNodeId: string | null = null;
  const targetId = `block-drop-target-${id}`;
  let dropTargetWasFirst = false;

  function findLoc(elem: Element | null): Pos | null {
    if (elem == null || elem.children == null) {
      // if it's a new element (insertion)
      return null;
    }
    // We've hit an ASTNode. Remember its id, in case it's the node just before the drop target.
    if (elem.id?.startsWith("block-node-")) {
      prevNodeId = elem.id.substring(11); // skip "block-node-"
    }
    for (const sibling of elem.children) {
      if (sibling.id?.startsWith("block-node-")) {
        // We've hit an ASTNode. Remember its id, in case it's the node just before the drop target.
        prevNodeId = sibling.id.substring(11); // skip "block-node-"
        if (dropTargetWasFirst) {
          // Edge case: the drop target was literally the first thing, so we
          // need to return the `from` of its _next_ sibling. That's this one.
          return ast.getNodeByIdOrThrow(prevNodeId).from;
        }
      } else if (sibling.id == targetId) {
        // We've found this drop target! Return the `to` location of the previous ASTNode.
        if (prevNodeId) {
          return ast.getNodeByIdOrThrow(prevNodeId).to;
        } else {
          // Edge case: nothing is before the drop target.
          dropTargetWasFirst = true;
        }
      } else if (sibling.id?.startsWith("block-drop-target")) {
        // It's a different drop target. Skip it.
      } else if (sibling.children) {
        // We're... somewhere else. If it has children, traverse them to look for the drop target.
        const result = findLoc(sibling);
        if (result !== null) {
          return result; // drop target found.
        }
      }
    }
    return null;
  }
  const loc = findLoc(context.node.element);
  if (!loc) {
    throw new Error(`Can't determine location for InsertTarget`);
  }
  return loc;
};

export const DropTarget = (props: { field: string }) => {
  // Every DropTarget has a globally unique `id` which can be used to look up
  // its corresponding DOM element.
  const id = useMemo(genUniqueId, [genUniqueId]);

  const node = useContext(NodeContext).node;
  if (!node) {
    throw new Error("DropTarget can only be rendered from inside a Node");
  }
  const editor = useContext(EditorContext);

  const isErrorFree = useSelector(selectors.isErrorFree);

  // ensure that the field property is set
  if (!props.field) {
    console.error(
      `
A dropTarget must be created with a prop 'field'. 
Check the render() function for the ${node.type} 
Component, and make sure all DropTargets have a 
field declared. The node was:`,
      node
    );
  }

  const [value, setValue] = useState("");
  const [mouseOver, setMouseOver] = useState(false);

  const dispatch: AppDispatch = useDispatch();

  const createTarget = useCallback(
    (ast: AST) =>
      new actions.InsertTarget(
        node,
        props.field,
        getLocation({
          id,
          ast,
          context: {
            field: props.field,
            node,
          },
        })
      ),
    [id, node, props.field]
  );

  // create and use a new insertTarget selector for evey
  // DropTarget instance to avoid re-rerendering every
  // drop target when any other drop target's editable
  // state changes. The insertTarget will be null if
  // the node is not editable.
  const insertTarget = useSelector(
    useMemo(
      () =>
        createSelector(
          [selectors.getAST, selectors.getEditable],
          (ast, editable) => (editable[id] ? createTarget(ast) : null)
        ),
      [id, createTarget]
    )
  );
  // These `isEditable` and `setEditable` methods allow DropTargetSiblings to
  // check to see whether an adjacent DropTarget is being edited, or, for when the
  // insert-left or insert-right shortcut is pressed, _set_ an adjacent DropTarget
  // as editable.
  const setEditable = (bool: boolean) =>
    dispatch({ type: "SET_EDITABLE", id: id, bool });

  const [{ isOver }, connectDropTarget] = useDrop({
    accept: ItemTypes.NODE,
    drop: (item: { id: string; content: string }, monitor) => {
      if (!editor) {
        // codemirror hasn't mounted yet, do nothing.
        return;
      }
      if (monitor.didDrop()) {
        return;
      }
      return dispatch((dispatch, getState) => {
        const ast = selectors.getAST(getState());
        return dispatch(actions.drop(editor, item, createTarget(ast)));
      });
    },
    collect: (monitor) => {
      return { isOver: monitor.isOver({ shallow: true }) };
    },
  });

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isErrorFree) {
      // TODO(Oak): is this the best way to handle this?
      return;
    }
    setEditable(true);
  };
  const handleMouseEnterRelated = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMouseOver(true);
  };

  const handleMouseLeaveRelated = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMouseOver(false);
  };
  const handleMouseDragRelated = () => {
    //NOTE(ds26gte): dummy handler
  };
  const handleChange = (value: string) => {
    setValue(value);
  };

  const contentEditableProps = {
    tabIndex: -1,
    role: "textbox",
    "aria-setsize": 1,
    "aria-posinset": 1,
    "aria-level": 1,
    id: `block-drop-target-${id}`,
  };

  if (insertTarget) {
    if (!editor) {
      throw new Error("can't edit a DropTarget before codemirror has mounted");
    }

    return (
      <NodeEditable
        editor={editor}
        target={insertTarget}
        value={value}
        onChange={handleChange}
        onMouseEnter={handleMouseEnterRelated}
        onDragEnter={handleMouseEnterRelated}
        onMouseLeave={handleMouseLeaveRelated}
        onDragLeave={handleMouseLeaveRelated}
        onMouseOver={handleMouseDragRelated}
        onDragOver={handleMouseDragRelated}
        onDrop={handleMouseDragRelated}
        isInsertion={true}
        contentEditableProps={contentEditableProps}
        extraClasses={["blocks-node", "blocks-white-space"]}
        onDisableEditable={() => setEditable(false)}
      />
    );
  }
  const classes = [
    "blocks-drop-target",
    "blocks-white-space",
    { "blocks-over-target": isOver || mouseOver },
  ];
  return connectDropTarget(
    <span
      id={`block-drop-target-${id}`}
      className={classNames(classes)}
      onMouseEnter={handleMouseEnterRelated}
      onDragEnter={handleMouseEnterRelated}
      onMouseLeave={handleMouseLeaveRelated}
      onDragLeave={handleMouseLeaveRelated}
      onMouseOver={handleMouseDragRelated}
      onDragOver={handleMouseDragRelated}
      onDrop={handleMouseDragRelated}
      onClick={handleClick}
      data-field={props.field}
    />
  );
};
