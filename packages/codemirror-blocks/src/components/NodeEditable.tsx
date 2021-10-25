import React, { useEffect, useRef } from "react";
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
import { setAfterDOMUpdate, cancelAfterDOMUpdate } from "../utils";
import { CMBEditor } from "../editor";
import { useLanguageOrThrow } from "../hooks";

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

type Props = Omit<ContentEditableProps, "value"> & {
  target: Target;
  children?: React.ReactNode;
  isInsertion: boolean;
  value?: string | null;
  onChange: (e: string | null) => void;
  onDisableEditable: () => void;
  contentEditableProps?: ContentEditableProps;
  extraClasses?: ClassNamesArgument;
  editor: CMBEditor;
};

const NodeEditable = (props: Props) => {
  const element = useRef<HTMLElement>(null);
  const dispatch: AppDispatch = useDispatch();
  const language = useLanguageOrThrow();

  const { initialValue, isErrored } = useSelector((state: RootState) => {
    const nodeId = props.target.node ? props.target.node.id : "editing";
    const isErrored = state.errorId == nodeId;

    const initialValue =
      props.value === null ? props.target.getText(state.ast, props.editor) : "";

    return { isErrored, initialValue };
  });

  useEffect(() => {
    const pendingTimeout = setAfterDOMUpdate(() => {
      const currentEl = element.current;
      if (!currentEl) {
        // element has been unmounted already, nothing to do.
        return;
      }
      selectElement(currentEl, props.isInsertion);
    });
    const text = props.value || initialValue || "";
    const annt = (props.isInsertion ? "inserting" : "editing") + ` ${text}`;
    say(annt + `.  Use Enter to save, and Alt-Q to cancel`);
    dispatch({ type: "SET_SELECTIONS", selections: [] });
    return () => cancelAfterDOMUpdate(pendingTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setErrorId = (errorId: string) =>
    dispatch({ type: "SET_ERROR_ID", errorId });

  const onBlur = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    const { target } = props;
    dispatch((dispatch: AppDispatch, getState: () => RootState) => {
      // we grab the value directly from the content editable element
      // to deal with this issue:
      // https://github.com/lovasoa/react-contenteditable/issues/161
      const value = element.current?.textContent;
      const { focusId, ast } = getState();
      // if there's no insertion value, or the new value is the same as the
      // old one, preserve focus on original node and return silently
      if (value === initialValue || !value) {
        props.onDisableEditable();
        const focusNode = focusId ? ast.getNodeById(focusId) || null : null;
        const nid = focusNode && focusNode.nid;
        dispatch(activateByNid(props.editor, nid));
        return;
      }

      const annt = `${props.isInsertion ? "inserted" : "changed"} ${value}`;
      const result = dispatch(
        insert(value, target, props.editor, language.parse, annt)
      );
      if (result.successful) {
        dispatch(activateByNid(props.editor, null, { allowMove: false }));
        props.onChange(null);
        props.onDisableEditable();
        setErrorId("");
        say(annt);
      } else {
        console.error(result.exception);
        setErrorId(target.node ? target.node.id : "editing");
        if (element.current) {
          selectElement(element.current, false);
        }
      }
    });
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
        setErrorId("");
        // TODO(pcardune): move this setAfterDOMUpdate into activateByNid
        // and then figure out how to get rid of it altogether.
        setAfterDOMUpdate(() => {
          dispatch(activateByNid(props.editor, null, { allowMove: false }));
        });
        return;
    }
  };

  const { contentEditableProps, extraClasses, value } = props;

  const classes = (
    [
      "blocks-literal",
      "quarantine",
      "blocks-editing",
      "blocks-node",
      { "blocks-error": isErrored },
    ] as ClassNamesArgument[]
  ).concat(extraClasses);
  const text = value ?? initialValue;
  return (
    <ContentEditable
      {...contentEditableProps}
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
      aria-label={text}
      value={text}
    />
  );
};
export default NodeEditable;