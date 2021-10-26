import React, { createContext, useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { poscmp, setAfterDOMUpdate, cancelAfterDOMUpdate } from "../utils";
import { ASTNode, NodeRef } from "../ast";
import { BlockNodeMarker, CMBEditor } from "../editor";

type Props = {
  incrementalRendering: boolean;
  node: NodeRef;
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

const ToplevelBlock = (props: Props) => {
  const [renderPlaceholder, setRenderPlaceholder] = useState(
    props.incrementalRendering
  );
  useEffect(() => {
    if (renderPlaceholder) {
      // if we've rendered a placeholder, then wait 250ms and switch to rendering
      // the full element.
      const timeout = setAfterDOMUpdate(() => setRenderPlaceholder(false), 250);
      return () => cancelAfterDOMUpdate(timeout);
    }
  }, [renderPlaceholder]);

  const { container } = useMemo(() => {
    const container = document.createElement("span");
    container.classList.add("react-container");
    return { container };
  }, []);

  // make a new block marker, and fill it with the portal
  const { from, to } = props.node.srcRange(); // includes the node's comment, if any
  const mark = props.editor.replaceMarkerWidget(from, to, container);

  // set elt to a cheap placeholder, OR render the entire rootNode
  const elt = renderPlaceholder ? (
    <div />
  ) : (
    <RootNodeContext.Provider value={{ marker: mark }}>
      {props.node.reactElement()}
    </RootNodeContext.Provider>
  );

  useEffect(() => {
    // When unmounting, clean up the TextMarker
    return () => {
      mark.clear();
    };
  });

  return ReactDOM.createPortal(elt, container);
};

function areNodesEqualish(prevNode: ASTNode, nextNode: ASTNode) {
  return (
    nextNode.hash === prevNode.hash &&
    nextNode["aria-setsize"] === prevNode["aria-setsize"] &&
    nextNode["aria-posinset"] === prevNode["aria-posinset"] &&
    poscmp(prevNode.from, nextNode.from) === 0 && // didn't move
    poscmp(prevNode.to, nextNode.to) === 0 // didn't resize
  );
}

export default React.memo(
  ToplevelBlock,
  (prevProps: Props, nextProps: Props) =>
    nextProps.incrementalRendering === prevProps.incrementalRendering &&
    nextProps.editor === prevProps.editor &&
    areNodesEqualish(prevProps.node.node, nextProps.node.node) // didn't change
);
