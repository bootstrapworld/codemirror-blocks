import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { poscmp, setAfterDOMUpdate, cancelAfterDOMUpdate } from "../utils";
import shouldBlockComponentUpdate from "../components/shouldBlockComponentUpdate";
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

export default React.memo(
  ToplevelBlock,
  (prevProps: Props, nextProps: Props) => {
    return !(
      poscmp(prevProps.node.from, nextProps.node.from) !== 0 || // moved
      poscmp(prevProps.node.to, nextProps.node.to) !== 0 || // resized
      shouldBlockComponentUpdate(prevProps, null, nextProps, null) || // changed
      !document.contains(nextProps.node.mark?.replacedWith || null)
    ); // removed from DOM
  }
);
