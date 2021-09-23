import React, { Component, createContext, useContext } from "react";
import { useDispatch, useSelector } from "react-redux";
import PropTypes from "prop-types";
import NodeEditable from "./NodeEditable";
import { useDrop } from "react-dnd";
import classNames from "classnames";
import { AppDispatch, isErrorFree } from "../store";
import { genUniqueId } from "../utils";
import { drop, InsertTarget } from "../actions";
import { ASTNode, Pos } from "../ast";
import { RootState } from "../reducers";
import { AST } from "../CodeMirrorBlocks";
import { ItemTypes } from "../dnd";

// Provided by `Node`
export const NodeContext = createContext({
  node: null,
});

// Provided by `DropTargetContainer`
export const DropTargetContext = createContext({
  node: null,
  field: null,
});

// Find the id of the drop target (if any) on the given side of `child` node.
export function findAdjacentDropTargetId(child: ASTNode, onLeft: boolean) {
  let prevDropTargetId: string | null = null;
  let targetId = `block-node-${child.id}`;

  function findDT(elem: Element): string | null {
    if (!elem.children) {
      return null;
    }
    // Convert array-like object into an Array.
    let children = [...elem.children];
    // If we want the drop-target to the right, iterate in reverse
    if (!onLeft) {
      children.reverse();
    }

    for (let sibling of children) {
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
        let result = findDT(sibling);
        if (result !== null) {
          return result; // node found.
        }
      }
    }
    return null;
  }
  if (!child.parent) return null;
  return findDT(child.parent.element);
}

// NOTE(Justin) It sure would be nice to generate the id inside of DropTarget.
// But AFAIK that's not feasible, because the `id` needs to be accessible
// inside `mapStateToProps`, and it's only accessible if it's a `prop`.
// Hence this extraneous class.
export class DropTarget extends Component<{ field: string }> {
  static contextType = NodeContext;

  static propTypes = {
    field: PropTypes.string.isRequired,
  };

  id: string = genUniqueId(); // generate a unique ID

  render() {
    const value = {
      field: this.props.field,
      node: this.context.node,
    };

    // ensure that the field property is set
    if (!value.field) {
      console.error(
        `
A dropTarget must be created with a prop 'field'. 
Check the render() function for the ${value.node.type} 
Component, and make sure all DropTargets have a 
field declared. The node was:`,
        value.node
      );
    }

    return (
      <DropTargetContext.Provider value={value}>
        <ActualDropTargetEnhanced id={this.id} />
      </DropTargetContext.Provider>
    );
  }
}

type ActualDropTargetProps = {
  // Every DropTarget has a globally unique `id` which can be used to look up
  // its corresponding DOM element.
  id: string;

  // fulfilled by DropNodeTarget
  connectDropTarget: Function;
  isOver: boolean;

  // fulfilled by redux
  ast: AST.AST;
  isEditable: boolean;
  setEditable: (bool: boolean) => void;
};

type ActualDropTargetState = { value: string; mouseOver: boolean };
type $TSFixMe = any;
const getLocation = ({
  ast,
  id,
  context,
}: {
  ast: AST.AST;
  id: string;
  context: { pos?: $TSFixMe; node: $TSFixMe; field: $TSFixMe };
}) => {
  let prevNodeId: string | null = null;
  let targetId = `block-drop-target-${id}`;
  let dropTargetWasFirst = false;

  function findLoc(elem: Element): Pos {
    if (elem == null || elem.children == null) {
      // if it's a new element (insertion)
      return null;
    }
    // We've hit an ASTNode. Remember its id, in case it's the node just before the drop target.
    if (elem.id?.startsWith("block-node-")) {
      prevNodeId = elem.id.substring(11); // skip "block-node-"
    }
    for (let sibling of elem.children) {
      if (sibling.id?.startsWith("block-node-")) {
        // We've hit an ASTNode. Remember its id, in case it's the node just before the drop target.
        prevNodeId = sibling.id.substring(11); // skip "block-node-"
        if (dropTargetWasFirst) {
          // Edge case: the drop target was literally the first thing, so we
          // need to return the `from` of its _next_ sibling. That's this one.
          return ast.getNodeById(prevNodeId).from;
        }
      } else if (sibling.id == targetId) {
        // We've found this drop target! Return the `to` location of the previous ASTNode.
        if (prevNodeId) {
          return ast.getNodeById(prevNodeId).to;
        } else {
          // Edge case: nothing is before the drop target.
          dropTargetWasFirst = true;
        }
      } else if (sibling.id?.startsWith("block-drop-target")) {
        // It's a different drop target. Skip it.
      } else if (sibling.children) {
        // We're... somewhere else. If it has children, traverse them to look for the drop target.
        let result = findLoc(sibling);
        if (result !== null) {
          return result; // drop target found.
        }
      }
    }
    return null;
  }
  return findLoc(context.node.element) || context.pos;
};

// TODO(pcardune): verify that this does not need to extend BlockComponent.
// BlockComponent requires a node in the props, just so it can have a custom
// shouldComponentUpdate method that compares node hash values. But we were
// never passing in a node to this component, in which case shouldComponentUpdate
// would always return true.
class ActualDropTarget extends Component<
  ActualDropTargetProps,
  ActualDropTargetState
> {
  static contextType = DropTargetContext;
  declare context: React.ContextType<typeof DropTargetContext>;

  state: ActualDropTargetState = {
    value: "",
    mouseOver: false,
  };

  render() {
    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isErrorFree()) return; // TODO(Oak): is this the best way to handle this?
      this.props.setEditable(true);
    };
    const handleMouseEnterRelated = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.setState({ mouseOver: true });
    };

    const handleMouseLeaveRelated = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.setState({ mouseOver: false });
    };
    const handleMouseDragRelated = () => {
      //NOTE(ds26gte): dummy handler
    };
    const handleChange = (value: string) => {
      this.setState({ value });
    };

    const props = {
      tabIndex: "-1",
      role: "textbox",
      "aria-setsize": "1",
      "aria-posinset": "1",
      "aria-level": "1",
      id: `block-drop-target-${this.props.id}`,
    };

    if (this.props.isEditable) {
      const target = new InsertTarget(
        this.context.node,
        this.context.field,
        getLocation({
          ast: this.props.ast,
          id: this.props.id,
          context: this.context,
        })
      );
      return (
        <NodeEditable
          target={target}
          value={this.state.value}
          onChange={handleChange}
          onMouseEnter={handleMouseEnterRelated}
          onDragEnter={handleMouseEnterRelated}
          onMouseLeave={handleMouseLeaveRelated}
          onDragLeave={handleMouseLeaveRelated}
          onMouseOver={handleMouseDragRelated}
          onDragOver={handleMouseDragRelated}
          onDrop={handleMouseDragRelated}
          isInsertion={true}
          contentEditableProps={props}
          extraClasses={["blocks-node", "blocks-white-space"]}
          onDisableEditable={() => this.props.setEditable(false)}
        />
      );
    }
    const classes = [
      "blocks-drop-target",
      "blocks-white-space",
      { "blocks-over-target": this.props.isOver || this.state.mouseOver },
    ];
    return this.props.connectDropTarget(
      <span
        id={`block-drop-target-${this.props.id}`}
        className={classNames(classes)}
        onMouseEnter={handleMouseEnterRelated}
        onDragEnter={handleMouseEnterRelated}
        onMouseLeave={handleMouseLeaveRelated}
        onDragLeave={handleMouseLeaveRelated}
        onMouseOver={handleMouseDragRelated}
        onDragOver={handleMouseDragRelated}
        onDrop={handleMouseDragRelated}
        onClick={handleClick}
        data-field={this.context.field}
      />
    );
  }
}

const DropTargetWithDnd = (props: {
  // Every DropTarget has a globally unique `id` which can be used to look up
  // its corresponding DOM element.
  id: string;
  // fulfilled by redux
  ast: AST.AST;
  isEditable: boolean;
  setEditable: (bool: boolean) => void;
}) => {
  const context = useContext(DropTargetContext);
  const [{ isOver }, connectDropTarget] = useDrop({
    accept: ItemTypes.NODE,
    drop: (item: { id: string; content: string }, monitor) => {
      if (monitor.didDrop()) {
        return;
      }
      const target = new InsertTarget(
        context.node,
        context.field,
        getLocation({
          id: props.id,
          ast: props.ast,
          context,
        })
      );
      return drop(item, target);
    },
    collect: (monitor) => {
      return { isOver: monitor.isOver({ shallow: true }) };
    },
  });
  return (
    <ActualDropTarget
      {...props}
      isOver={isOver}
      connectDropTarget={connectDropTarget}
    />
  );
};

const ActualDropTargetEnhanced = (props: { id: string }) => {
  const dispatch: AppDispatch = useDispatch();
  const { ast, isEditable } = useSelector((state: RootState) => {
    return { ast: state.ast, isEditable: state.editable[props.id] ?? false };
  });
  // These `isEditable` and `setEditable` methods allow DropTargetSiblings to
  // check to see whether an adjacent DropTarget is being edited, or, for when the
  // insert-left or insert-right shortcut is pressed, _set_ an adjacent DropTarget
  // as editable.
  const setEditable = (bool: boolean) =>
    dispatch({ type: "SET_EDITABLE", id: props.id, bool });
  return (
    <DropTargetWithDnd
      id={props.id}
      ast={ast}
      isEditable={isEditable}
      setEditable={setEditable}
    />
  );
};
