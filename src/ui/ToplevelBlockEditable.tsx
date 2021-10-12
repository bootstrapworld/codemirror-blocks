import React, { useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import SHARED from "../shared";
import NodeEditable from "../components/NodeEditable";
import { OverwriteTarget } from "../actions";
import type { AppDispatch } from "../store";
import type { RootState } from "../reducers";
import type { CMBEditor } from "../editor";

type Props = {
  editor: CMBEditor;
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
  const [start, end, value] = useSelector(({ quarantine }: RootState) => {
    if (!quarantine) {
      // TODO(pcardune): instead of grabbing the quarantine out of state,
      // make it a prop that gets passed in. Then the type system will force
      // the parent component to do this check and we won't have unexpected
      // runtime errors.
      throw new Error(
        "ToplevelBlockEditable should only be rendered when there's a quarantine"
      );
    }
    return quarantine;
  });

  // add a marker to codemirror, with an empty "widget" into which
  // the react component will be rendered.
  // We use useMemo to make sure this marker only gets added the first
  // time this component is rendered.
  const { container, marker } = useMemo(() => {
    const container = document.createElement("span");
    container.classList.add("react-container");
    const marker = props.editor.replaceMarkerWidget(start, end, container);
    // call endOperation to flush all buffered updates
    // forcing codemirror to put the marker into the document's DOM
    // right away, making it immediately focusable/selectable.
    // SHARED.editor.endOperation();
    return { container, marker };
  }, []);
  // make sure to clear the marker from codemirror
  // when the component unmounts
  useEffect(() => {
    return () => marker.clear();
  }, []);

  return ReactDOM.createPortal(
    <NodeEditable
      editor={props.editor}
      target={new OverwriteTarget(start, end)}
      value={value}
      onChange={onChange}
      contentEditableProps={{
        tabIndex: "-1",
        role: "text box",
        "aria-setsize": "1",
        "aria-posinset": "1",
        "aria-level": "1",
      }}
      isInsertion={true}
      extraClasses={[]}
      onDisableEditable={onDisableEditable}
    />,
    container
  );
};

export default ToplevelBlockEditable;
