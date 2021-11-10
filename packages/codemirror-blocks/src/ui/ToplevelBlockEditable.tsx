import React, { useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import { useDispatch } from "react-redux";
import NodeEditable from "../components/NodeEditable";
import { OverwriteTarget } from "../state/actions";
import type { AppDispatch } from "../state/store";
import type { CMBEditor } from "../editor";
import { Quarantine } from "../state/reducers";

type Props = {
  editor: CMBEditor;
  quarantine: Quarantine;
};

/**
 * React component for an ast node that is currently being
 * edited and is at the root of the AST.
 *
 * To trigger this component, you can just paste some text into
 * the editor (outside of a node), which will cause a quarantine
 * to be created and this node to be rendered.
 */
const ToplevelBlockEditable = (props: Props) => {
  const dispatch: AppDispatch = useDispatch();
  const onDisableEditable = () => dispatch({ type: "DISABLE_QUARANTINE" });
  const onChange = (text: string) =>
    dispatch({ type: "CHANGE_QUARANTINE", text });
  const { from, to, value } = props.quarantine;

  // add a marker to codemirror, with an empty "widget" into which
  // the react component will be rendered.
  // We use useMemo to make sure this marker only gets added the first
  // time this component is rendered.
  const { container, marker } = useMemo(() => {
    const container = document.createElement("span");
    container.classList.add("react-container");
    const marker = props.editor.replaceMarkerWidget(from, to, container);
    // call endOperation to flush all buffered updates
    // forcing codemirror to put the marker into the document's DOM
    // right away, making it immediately focusable/selectable.
    // SHARED.editor.endOperation();
    return { container, marker };
  }, [props.editor, from, to]);
  // make sure to clear the marker from codemirror
  // when the component unmounts
  useEffect(() => {
    return () => marker.clear();
  }, [marker]);

  return ReactDOM.createPortal(
    <NodeEditable
      editor={props.editor}
      target={new OverwriteTarget(from, to)}
      value={value}
      onChange={onChange}
      contentEditableProps={{
        tabIndex: -1,
        role: "text box",
        "aria-setsize": 1,
        "aria-posinset": 1,
        "aria-level": 1,
      }}
      isInsertion={true}
      extraClasses={[]}
      onDisableEditable={onDisableEditable}
    />,
    container
  );
};

export default ToplevelBlockEditable;
