import React, {
  createContext,
  useCallback,
  use,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useDispatch, useStore } from "react-redux";
import NodeEditable from "./NodeEditable";
import { useDrop } from "../dnd";
import classNames from "classnames";
import { AppDispatch } from "../state/store";
import { genUniqueId } from "../utils";
import * as actions from "../state/actions";
import * as selectors from "../state/selectors";
import { currentNode } from "../ast";
import type { ASTNode, AST, DrawnNode } from "../ast";
import { List } from "../nodeSpec";
import { EditorContext } from "./Context";
import { useIdState } from "../state/nodeSubscriptions";
import type { RootState } from "../state/reducers";

// Provided by `Node`
export const NodeContext = createContext<{ node: DrawnNode | null }>({
  node: null,
});

/**
 * Where `child` is among the lists of its parent: the field, and its index in
 * it (null if it is not an element of a list, or is a root).
 */
export function findInsertionPlace(
  ast: AST,
  child: ASTNode
): { parent: ASTNode; field: string; index: number } | null {
  const parent = ast.getNodeParent(child);
  if (!parent) return null;
  for (const spec of parent.spec.childSpecs) {
    if (!(spec instanceof List)) continue;
    const index = spec.getField(parent).findIndex((n) => n.id === child.id);
    if (index >= 0) return { parent, field: spec.fieldName, index };
  }
  return null;
}

const dropTargetPrefix = "block-drop-target-";

/** The drop targets drawn for the lists of `parent`, in the order of the page */
const dropTargetsOf = (parent: ASTNode) =>
  [...document.querySelectorAll<HTMLElement>("[data-drop-parent]")].filter(
    (el) =>
      el.dataset.dropParent === parent.id && el.id.startsWith(dropTargetPrefix)
  );

/**
 * The id of the drop target (if any) on the given side of `child`.
 *
 * For an element of a list, it is the one drawn for the gap before it (or after
 * it) in that list, wherever the layout put it in the page. A node that is not
 * an element of a list (the operator of a call, say) has no index to go by, so
 * it is the nearest of its parent's targets on that side, with no other child
 * of the parent in between.
 */
export function findAdjacentDropTargetId(
  ast: AST,
  child: ASTNode,
  onLeft: boolean
): string | null {
  const idOf = (el: Element | undefined) =>
    el ? el.id.substring(dropTargetPrefix.length) : null;
  const place = findInsertionPlace(ast, child);
  if (place) {
    const index = onLeft ? place.index : place.index + 1;
    return idOf(
      dropTargetsOf(place.parent).find(
        (el) =>
          el.dataset.field === place.field && el.dataset.index === String(index)
      )
    );
  }
  const parent = ast.getNodeParent(child);
  const childEl = document.getElementById(`block-node-${child.id}`);
  if (!parent || !childEl) return null;
  const side = onLeft
    ? Node.DOCUMENT_POSITION_PRECEDING
    : Node.DOCUMENT_POSITION_FOLLOWING;
  const others = [...parent.children()]
    .filter((n) => n.id !== child.id)
    .map((n) => document.getElementById(`block-node-${n.id}`))
    .filter((el): el is HTMLElement => !!el);
  const candidates = dropTargetsOf(parent).filter(
    (el) =>
      childEl.compareDocumentPosition(el) & side &&
      !childEl.contains(el) &&
      // (nothing else of the parent is between: it would be the next one's)
      !others.some(
        (other) =>
          other.compareDocumentPosition(el) & side &&
          other.compareDocumentPosition(childEl) &
            (onLeft
              ? Node.DOCUMENT_POSITION_FOLLOWING
              : Node.DOCUMENT_POSITION_PRECEDING)
      )
  );
  // the nearest: the last one before, or the first one after
  return idOf(onLeft ? candidates[candidates.length - 1] : candidates[0]);
}

/** What is wrong with the field and index of a DropTarget drawn in `node`, if anything */
function dropTargetMistake(
  node: ASTNode,
  field: string,
  index: number
): string | null {
  const where = `A DropTarget in the render() of '${node.type}'`;
  if (!field) {
    return `${where} needs a 'field': the list field of the node that a node dropped there joins.`;
  }
  const spec = node.spec.childSpecs.find((s) => s.fieldName === field);
  if (!(spec instanceof List)) {
    return `${where} names the field '${field}', which is not a list field of '${node.type}'. Its fields are ${node.spec.fieldNames().join(", ")}.`;
  }
  const length = spec.getField(node).length;
  if (!Number.isInteger(index) || index < 0 || index > length) {
    return `${where} for the list '${field}' has the index ${String(index)}, which is not a whole number from 0 to ${length}: it is the place in the list it goes (the element it goes before, or ${length} for the end, counting any orphan comments in the list).`;
  }
  return null;
}

type DropTargetProps = {
  /** the list field of the node this is drawn in, that a node dropped here joins */
  field: string;
  /**
   * Where in that list it goes: as element `index`, so before the element that
   * is there now. The end of the list is `list.length`. (The place of a drop
   * target in the page does not say anything about this.)
   */
  index: number;
};

export const DropTarget = (props: DropTargetProps) => {
  // Every DropTarget has a globally unique `id` which can be used to look up
  // its corresponding DOM element.
  const id = useMemo(genUniqueId, [genUniqueId]);

  const node = use(NodeContext).node;
  if (!node) {
    throw new Error("DropTarget can only be rendered from inside a Node");
  }
  const editor = use(EditorContext);

  const isErrorFree = useIdState(id, selectors.isErrorFree);

  const [value, setValue] = useState<string | null>("");
  const [mouseOver, setMouseOver] = useState(false);

  const dispatch: AppDispatch = useDispatch();

  const createTarget = useCallback(
    (ast: AST) =>
      new actions.InsertTarget(
        currentNode(ast, node),
        props.field,
        props.index
      ),
    [node, props.field, props.index]
  );

  // The insertTarget is null if the gap is not editable. (Only an editable gap
  // looks at the AST, and then it is woken when the AST changes.)
  const store = useStore<RootState>();
  // Say what is wrong with the field and the index, if anything (the language
  // that draws this has made a mistake), once the page is there to be asked
  useEffect(() => {
    const ast = selectors.getAST(store.getState());
    const mistake = dropTargetMistake(
      currentNode(ast, node),
      props.field,
      props.index
    );
    if (mistake) console.error(mistake, node);
  }, [store, node, props.field, props.index]);
  const editableAst = useIdState(id, (state) =>
    state.editable[id] ? state.astData : null
  );
  const insertTarget = useMemo(() => {
    if (!editableAst) return null;
    try {
      return createTarget(selectors.getAST(store.getState()));
    } catch (e) {
      // The store can hold a newer AST than the page this target was
      // drawn for (it is about to be redrawn, or gone), so the blocks
      // around it can be missing: it has no insertion point meanwhile.
      return null;
    }
  }, [editableAst, createTarget, store]);
  // These `isEditable` and `setEditable` methods allow DropTargetSiblings to
  // check to see whether an adjacent DropTarget is being edited, or, for when the
  // insert-left or insert-right shortcut is pressed, _set_ an adjacent DropTarget
  // as editable.
  const setEditable = (bool: boolean) =>
    dispatch({ type: "SET_EDITABLE", id: id, bool });

  const [{ isOver }, connectDropTarget] = useDrop({
    // (the n-th gap in the editor, in document order)
    describe: (el) => ({
      gap: [
        ...(el.closest(".CodeMirror") ?? document).querySelectorAll(
          ".blocks-drop-target"
        ),
      ].indexOf(el),
    }),
    drop: (item, info) => {
      if (!editor) {
        // codemirror hasn't mounted yet, do nothing.
        return;
      }
      if (info.didDrop) {
        return;
      }
      return dispatch((dispatch, getState) => {
        const ast = selectors.getAST(getState());
        return dispatch(actions.drop(editor, item, createTarget(ast)));
      });
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
  const handleChange = (value: string | null) => {
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
  return (
    <span
      ref={(el) => {
        connectDropTarget(el);
      }}
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
      data-index={props.index}
      data-drop-parent={node.id}
    />
  );
};
