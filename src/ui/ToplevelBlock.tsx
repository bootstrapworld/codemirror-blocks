import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { poscmp, setAfterDOMUpdate, cancelAfterDOMUpdate } from "../utils";
import { ASTNode } from "../ast";
import { CMBEditor } from "../editor";

type Props = {
  incrementalRendering: boolean;
  node: ASTNode;
  editor: CMBEditor;
};

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

  // set elt to a cheap placeholder, OR render the entire rootNode
  const elt = renderPlaceholder ? <div /> : props.node.reactElement();

  // make a new block marker, and fill it with the portal
  const { from, to } = props.node.srcRange(); // includes the node's comment, if any
  const mark = props.editor.replaceMarkerWidget(from, to, container);
  props.node.mark = mark;

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
    areNodesEqualish(prevProps.node, nextProps.node) && // didn't change
    document.contains(nextProps.node.mark?.replacedWith || null) // wasn't removed from dom
);
