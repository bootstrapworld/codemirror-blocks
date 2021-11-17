import React, { useEffect, useMemo, useRef } from "react";
import ReactDOM from "react-dom";
import { useDispatch } from "react-redux";
import NodeEditable, { NodeEditableHandle } from "../components/NodeEditable";
import * as actions from "../state/actions";
import type { AppDispatch } from "../state/store";
import { CMBEditor } from "../editor";
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
  const onDisableEditable = () => dispatch(actions.disableQuarantine());
  const onChange = (text: string) => dispatch(actions.changeQuarantine(text));
  const { from, to, value } = props.quarantine;

  // create an empty container element to hold the rendered react
  // component. We use useMemo to make sure this element only gets
  // created the first time this component is rendered.
  const { container } = useMemo(() => {
    const container = document.createElement("span");
    container.classList.add("react-container");
    return { container };
  }, []);

  const nodeEditableHandle = useRef<NodeEditableHandle>(null);

  // after react has finished rendering, attach the container to codemirror
  // as a marker widget and select its contents.
  //
  // This has to happen after react finishes rendering because codemirror
  // calls focus() when you call CodeMirror.setBookmark, which triggers
  // this cryptic react warning: unstable_flushDiscreteUpdates: Cannot
  // flush updates when React is already rendering
  // See https://stackoverflow.com/questions/58123011/cryptic-react-error-unstable-flushdiscreteupdates-cannot-flush-updates-when-re
  // and https://github.com/facebook/react/issues/20141 for more info.
  useEffect(() => {
    const marker = props.editor.replaceMarkerWidget(from, to, container);
    nodeEditableHandle.current?.select();
    // make sure to clear the marker from codemirror
    // when the component unmounts
    return () => marker.clear();
  }, [container, props.editor, from, to]);

  return ReactDOM.createPortal(
    <NodeEditable
      ref={nodeEditableHandle}
      editor={props.editor}
      target={new actions.OverwriteTarget(from, to)}
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
