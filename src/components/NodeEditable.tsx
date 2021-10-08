import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import ContentEditable, {
  Props as ContentEditableProps,
} from "./ContentEditable";
import classNames, { Argument as ClassNamesArgument } from "classnames";
import { insert, activateByNid, Target } from "../actions";
import { say } from "../announcer";
import CodeMirror from "codemirror";
import { AppDispatch } from "../store";
import { RootState } from "../reducers";
import { CMBEditor } from "../editor";
import { setAfterDOMUpdate } from "../utils";

function suppressEvent(e: React.SyntheticEvent) {
  e.stopPropagation();
}

/**
 * Make the browser select the given html element and focus it
 *
 * @param element the html element to select
 * @param shouldCollapse whether or not to force the browser
 *        to collapse the selection to the end of the elements range.
 */
function selectElement(element: HTMLElement, shouldCollapse: boolean) {
  const range = document.createRange();
  range.selectNodeContents(element);
  if (shouldCollapse) {
    range.collapse(false);
  }
  const selection = window.getSelection();
  if (selection) {
    // window.getSelection can return null in firefox when rendered
    // inside a hidden iframe: https://developer.mozilla.org/en-US/docs/Web/API/Window/getSelection#return_value
    selection.removeAllRanges();
    selection.addRange(range);
  }
  element.focus();
}

export type Props = Omit<ContentEditableProps, "value"> & {
  target: Target;
  children?: React.ReactNode;
  isInsertion: boolean;
  value: string;
  onChange: (e: string | null) => void;
  onDisableEditable: () => void;
  contentEditableProps?: {};
  extraClasses?: ClassNamesArgument;
  editor: CMBEditor;
};

const saveEdit =
  (
    value: string,
    editor: CMBEditor,
    props: Pick<
      Props,
      "isInsertion" | "onDisableEditable" | "target" | "onChange"
    >
  ) =>
  (dispatch: AppDispatch, getState: () => RootState) => {
    const { focusId, ast } = getState();
    // if there's no insertion value, or the new value is the same as the
    // old one, preserve focus on original node and return silently
    if (value === "" || !value) {
      props.onDisableEditable();
      const focusNode = focusId ? ast.getNodeById(focusId) || null : null;
      const nid = focusNode && focusNode.nid;
      dispatch(activateByNid(editor, nid));
      return;
    }

    let annt = `${props.isInsertion ? "inserted" : "changed"} ${value}`;
    const result = insert(
      getState(),
      dispatch,
      value,
      props.target,
      editor,
      annt
    );
    if (result.successful) {
      dispatch(activateByNid(editor, null, { allowMove: false }));
      props.onChange(null);
      props.onDisableEditable();
      dispatch({ type: "SET_ERROR_ID", errorId: "" });
      say(annt);
    } else {
      console.error(result.exception);
      dispatch({
        type: "SET_ERROR_ID",
        errorId: props.target.node ? props.target.node.id : "editing",
      });
    }
    return result;
  };

const NodeEditable = (props: Props) => {
  const element = useRef<HTMLElement>(null);
  const dispatch: AppDispatch = useDispatch();

  const [initialValue] = useState("");

  const { isErrored } = useSelector((state: RootState) => {
    const nodeId = props.target.node ? props.target.node.id : "editing";
    return {
      isErrored: state.errorId === nodeId,
    };
  });
  useEffect(() => {
    const text = props.value || initialValue || "";
    const annt = (props.isInsertion ? "inserting" : "editing") + ` ${text}`;
    say(annt + `.  Use Enter to save, and Alt-Q to cancel`);
    selectElement(element.current!, props.isInsertion);
    // TODO(pcardune): put this somewhere else.
    // It doesn't make sense here. Maybe where editing starts?
    dispatch({ type: "SET_SELECTIONS", selections: [] });
  }, []);

  const onBlur = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    if (!element.current) {
      throw new Error(`Expected ref to be set in NodeEditable`);
    }
    // we grab the value directly from the content editable element
    // to deal with this issue:
    // https://github.com/lovasoa/react-contenteditable/issues/161
    const value = element.current.textContent ?? "";
    const result = dispatch(saveEdit(value, props.editor, props));
    if (result && !result.successful) {
      selectElement(element.current, false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (CodeMirror.keyName(e)) {
      case "Enter": {
        // blur the element to trigger handleBlur
        // which will save the edit
        element.current?.blur();
        return;
      }
      case "Alt-Q":
      case "Esc":
        e.stopPropagation();
        props.onChange(null);
        props.onDisableEditable();
        dispatch({ type: "SET_ERROR_ID", errorId: "" });
        // TODO(pcardune): move this setAfterDOMUpdate into activateByNid
        // and then figure out how to get rid of it altogether.
        setAfterDOMUpdate(() => {
          dispatch(activateByNid(props.editor, null, { allowMove: false }));
        });
        return;
    }
  };

  const classes = (
    [
      "blocks-literal",
      "quarantine",
      "blocks-editing",
      "blocks-node",
      { "blocks-error": isErrored },
    ] as ClassNamesArgument[]
  ).concat(props.extraClasses);
  return (
    <ContentEditable
      {...props.contentEditableProps}
      className={classNames(classes)}
      role="textbox"
      ref={element}
      onChange={props.onChange}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      // trap mousedown, clicks and doubleclicks, to prevent focus change, or
      // parent nodes from toggling collapsed state
      onMouseDown={suppressEvent}
      onClick={suppressEvent}
      onDoubleClick={suppressEvent}
      aria-label={props.value}
      value={props.value}
    />
  );
};
export default NodeEditable;
