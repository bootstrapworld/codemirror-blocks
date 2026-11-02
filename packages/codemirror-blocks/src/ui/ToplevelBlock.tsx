import React, {
  createContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactDOM from "react-dom";
import { poscmp } from "../utils";
import { ASTNode } from "../ast";
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
const hasLiveMarker = (node: ASTNode) => {
  const range = markers.get(node)?.find();
  if (!range || !("from" in range)) return false;
  const { from, to } = node.srcRange();
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
  const { from, to } = props.node.srcRange(); // includes the node's comment, if any
  const handle = useRef<{ marker?: BlockNodeMarker }>({});
  const { editor, node } = props;
  useLayoutEffect(() => {
    const mark = editor.replaceMarkerWidget(from, to, container);
    handle.current.marker = mark;
    markers.set(node, mark);
    // When unmounting, clean up the TextMarker
    return () => {
      mark.clear();
      if (handle.current.marker === mark) handle.current.marker = undefined;
    };
    // (the range is compared by value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, node, container, from.line, from.ch, to.line, to.ch]);

  // set elt to a cheap placeholder, OR render the entire rootNode
  const elt = renderPlaceholder ? (
    <div />
  ) : (
    <RootNodeContext value={handle.current}>
      {props.node.reactElement()}
    </RootNodeContext>
  );

  return ReactDOM.createPortal(elt, container);
};

function areNodesEqualish(prevNode: ASTNode, nextNode: ASTNode) {
  return (
    nextNode.hash === prevNode.hash &&
    nextNode.ariaSetSize === prevNode.ariaSetSize &&
    nextNode.ariaPosInset === prevNode.ariaPosInset &&
    poscmp(prevNode.from, nextNode.from) === 0 && // didn't move
    poscmp(prevNode.to, nextNode.to) === 0 // didn't resize
  );
}

export default React.memo(
  ToplevelBlock,
  (prevProps: Props, nextProps: Props) =>
    nextProps.incrementalRendering === prevProps.incrementalRendering &&
    nextProps.editor === prevProps.editor &&
    areNodesEqualish(prevProps.node, nextProps.node) && // didn't change
    hasLiveMarker(prevProps.node) // and is still drawn
);
