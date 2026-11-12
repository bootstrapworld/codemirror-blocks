import React, {
  createContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactDOM from "react-dom";
import { useStore } from "react-redux";
import { poscmp } from "../utils";
import { ASTNode, Pos, currentNode } from "../ast";
import * as selectors from "../state/selectors";
import type { RootState } from "../state/reducers";
import { BlockNodeMarker, CMBEditor } from "../editor";

type Props = {
  incrementalRendering: boolean;
  node: ASTNode;
  editor: CMBEditor;
};

export const RootNodeContext = createContext<{
  /**
   * The codemirror block node marker that was created
   * when the root node was rendered. We make this
   * available in a context so that child nodes can
   * call the changed() method when they rerender.
   */
  marker?: BlockNodeMarker;
}>({});

// The marker each node was last drawn with.
const markers = new WeakMap<ASTNode, BlockNodeMarker>();

// CodeMirror drops a marker when the text under it is replaced, even if the new
// text parses to the very same block (deleting a `...` placeholder, or moving a
// block to where it already was). The AST looks unchanged then, so unless we
// notice, the block would never be drawn again.
//
// A marker whose edge was at the start or end of the replaced text can survive,
// but shrunk (replacing the first child of a root with its own text leaves the
// root's marker starting after it), so it must still cover the node's range.
const hasLiveMarker = (node: ASTNode, wanted: { from: Pos; to: Pos }) => {
  const range = markers.get(node)?.find();
  if (!range || !("from" in range)) return false;
  const { from, to } = wanted;
  return poscmp(range.from, from) === 0 && poscmp(range.to, to) === 0;
};

const ToplevelBlock = (props: Props) => {
  const [renderPlaceholder, setRenderPlaceholder] = useState(
    props.incrementalRendering
  );
  useEffect(() => {
    if (renderPlaceholder) {
      // if we've rendered a placeholder, then wait 250ms and switch to rendering
      // the full element.
      const timeout = setTimeout(() => setRenderPlaceholder(false), 250);
      return () => clearTimeout(timeout);
    }
  }, [renderPlaceholder]);

  const { container } = useMemo(() => {
    const container = document.createElement("span");
    container.classList.add("react-container");
    return { container };
  }, []);

  // The block marker is made once the portal's container is filled, not while
  // rendering: making and clearing a marker updates CodeMirror's display, which
  // must not happen in the middle of React's render (the display could then be
  // patched while React is still moving the nodes it holds).
  const store = useStore<RootState>();
  const markerRef = useRef<{ marker?: BlockNodeMarker }>({});
  const { editor, node } = props;
  useLayoutEffect(() => {
    // (a marker that was cleared from outside, such as by a box that took its
    // place for a while, is made again: this runs after every render)
    // (where the node is now: this block was not drawn again if it only moved)
    const { from, to } = currentNode(
      selectors.getAST(store.getState()),
      node
    ).srcRange(); // includes the node's comment, if any
    if (markerRef.current.marker && hasLiveMarker(node, { from, to })) return;
    markerRef.current.marker?.clear();
    const mark = editor.replaceMarkerWidget(from, to, container);
    markerRef.current.marker = mark;
    markers.set(node, mark);
  });
  // When unmounting, clean up the TextMarker
  useLayoutEffect(() => {
    const current = markerRef.current;
    return () => {
      current.marker?.clear();
      current.marker = undefined;
    };
  }, []);

  // set elt to a cheap placeholder, OR render the entire rootNode
  const elt = renderPlaceholder ? (
    <div />
  ) : (
    <RootNodeContext value={markerRef.current}>
      {props.node.reactElement()}
    </RootNodeContext>
  );

  return ReactDOM.createPortal(elt, container);
};

/**
 * Whether drawing `nextNode` would give the same result as `prevNode`: same
 * text, same place among its siblings, and the same shape (the number of lines
 * and where it ends on its last one). Where it starts doesn't count: inserting
 * or deleting above a block moves it, and that's not a reason to draw it again
 * (CodeMirror's marker moves with the text). The block's own handlers look up
 * the current node by id.
 *
 * The nodes inside must have the same ids too. The page registers each drawn
 * element under its node's id, and a block that is not drawn again keeps the
 * ids it was drawn with; a new parse can give identical code new ids (a node
 * that patchAst found no match for), and then the page would hold elements for
 * ids that are no longer in the AST, and none for the ones that are.
 */
export function areNodesEqualish(prevNode: ASTNode, nextNode: ASTNode) {
  // (the marker covers the node's comment too, which the hash and the node's
  // own range don't say anything about)
  const shape = (n: ASTNode) => {
    const { from, to } = n.srcRange();
    const own = n.to.line - n.from.line;
    return [
      to.line - from.line,
      to.line === from.line ? to.ch - from.ch : to.ch,
      from.line === n.from.line ? n.from.ch - from.ch : n.from.ch,
      own,
      own === 0 ? n.to.ch - n.from.ch : n.to.ch,
    ].join();
  };
  return (
    nextNode.id === prevNode.id &&
    nextNode.hash === prevNode.hash &&
    nextNode.ariaSetSize === prevNode.ariaSetSize &&
    nextNode.ariaPosInset === prevNode.ariaPosInset &&
    nextNode.level === prevNode.level &&
    shape(prevNode) === shape(nextNode) &&
    haveSameIds(prevNode, nextNode)
  );
}

// (the hashes are equal, so the nodes inside line up one to one)
function haveSameIds(prevNode: ASTNode, nextNode: ASTNode) {
  const next = nextNode.descendants()[Symbol.iterator]();
  for (const prev of prevNode.descendants()) {
    if (prev.id !== next.next().value?.id) return false;
  }
  return true;
}

export default React.memo(
  ToplevelBlock,
  (prevProps: Props, nextProps: Props) =>
    nextProps.incrementalRendering === prevProps.incrementalRendering &&
    nextProps.editor === prevProps.editor &&
    areNodesEqualish(prevProps.node, nextProps.node) && // didn't change
    hasLiveMarker(prevProps.node, nextProps.node.srcRange()) // and is still drawn where it is now
);
