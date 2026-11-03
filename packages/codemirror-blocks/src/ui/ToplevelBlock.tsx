import React, {
  createContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactDOM from "react-dom";
import { useSelector, useStore } from "react-redux";
import * as selectors from "../state/selectors";
import { poscmp } from "../utils";
import { ASTNode, nodeElementMap } from "../ast";
import type { RootState } from "../state/reducers";
import { BlockNodeMarker, CMBEditor } from "../editor";

type Props = {
  incrementalRendering: boolean;
  /** the program is big: draw this block's content only once it is needed */
  virtual: boolean;
  /** the block is in, or near, the visible part of the editor */
  inView: boolean;
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
const hasLiveMarker = (node: ASTNode) => {
  const range = markers.get(node)?.find();
  if (!range || !("from" in range)) return false;
  const { from, to } = node.srcRange();
  return poscmp(range.from, from) === 0 && poscmp(range.to, to) === 0;
};

const ESTIMATED_LINE_HEIGHT = 22;

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

  // In a big program a block is drawn when it comes into view, or has focus or
  // a selection, and then stays drawn (CodeMirror keeps the elements of a
  // widget that scrolled away, and draws them again as they are).
  const inUse = useSelector((state: RootState) =>
    selectors.getRootIdsInUse(state).has(props.node.id)
  );
  const wanted = !props.virtual || props.inView || inUse;
  const [drawn, setDrawn] = useState(wanted);
  useEffect(() => {
    // eslint-disable-next-line @eslint-react/set-state-in-effect
    if (wanted && !drawn) setDrawn(true);
  }, [wanted, drawn]);
  const showContent = wanted || drawn;

  const { container } = useMemo(() => {
    const container = document.createElement("span");
    container.classList.add("react-container");
    return { container };
  }, []);

  // The block marker is made once the portal's container is filled, not while
  // rendering: making and clearing a marker updates CodeMirror's display, which
  // must not happen in the middle of React's render (the display could then be
  // patched while React is still moving the nodes it holds).
  const { from, to } = props.node.srcRange(); // includes the node's comment, if any
  const markerRef = useRef<{ marker?: BlockNodeMarker }>({});
  const { editor, node } = props;
  useLayoutEffect(() => {
    // (a marker that was cleared from outside, such as by a box that took its
    // place for a while, is made again: this runs after every render)
    if (markerRef.current.marker && hasLiveMarker(node)) return;
    markerRef.current.marker?.clear();
    const mark = editor.replaceMarkerWidget(from, to, container);
    markerRef.current.marker = mark;
    markers.set(node, mark);
  });
  // Remaking the marker moves the block's elements, and the browser drops focus
  // that was on one of them. The blocks inside don't notice (they are not drawn
  // again when only their place changed), so give focus back to the focused one.
  const store = useStore<RootState>();
  useEffect(() => {
    const active = document.activeElement;
    if (
      active &&
      active !== document.body &&
      active.id !== "SR_fix_for_slow_dom"
    ) {
      return;
    }
    const { focusId } = store.getState();
    const el = focusId ? nodeElementMap.get(focusId) : undefined;
    if (el && container.contains(el)) el.focus();
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
  const sourceLines = to.line - from.line + 1;
  const elt = !showContent ? (
    // (as tall as the source is long, so that the scrollbar is about right)
    <div style={{ height: sourceLines * ESTIMATED_LINE_HEIGHT }} />
  ) : renderPlaceholder ? (
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
    nextNode.hash === prevNode.hash &&
    nextNode.ariaSetSize === prevNode.ariaSetSize &&
    nextNode.ariaPosInset === prevNode.ariaPosInset &&
    nextNode.level === prevNode.level &&
    shape(prevNode) === shape(nextNode)
  );
}

export default React.memo(
  ToplevelBlock,
  (prevProps: Props, nextProps: Props) =>
    nextProps.incrementalRendering === prevProps.incrementalRendering &&
    nextProps.virtual === prevProps.virtual &&
    nextProps.inView === prevProps.inView &&
    nextProps.editor === prevProps.editor &&
    areNodesEqualish(prevProps.node, nextProps.node) && // didn't change
    hasLiveMarker(prevProps.node) // and is still drawn
);
