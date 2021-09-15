import React, {
  Component,
  ForwardedRef,
  ReactElement,
  useEffect,
  useRef,
} from "react";
import { connect } from "react-redux";
import ContentEditable, {
  Props as ContentEditableProps,
} from "./ContentEditable";
import SHARED from "../shared";
import classNames, { Argument as ClassNamesArgument } from "classnames";
import { insert, activateByNid, Target } from "../actions";
import { say } from "../announcer";
import CodeMirror from "codemirror";
import { AppDispatch } from "../store";
import { RootState } from "../reducers";
import { setAfterDOMUpdate, cancelAfterDOMUpdate } from "../utils";
import type { afterDOMUpdateHandle } from "../utils";
import { ContentEditableEvent } from "react-contenteditable";

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

function saveEditAction(
  {
    value,
    initialValue,
    isInsertion,
    onDisableEditable,
    onChange,
    setErrorId,
    target,
  }: Props,
  onError: () => void
) {
  return (dispatch: AppDispatch, getState: () => RootState) => {
    const { focusId, ast } = getState();
    // if there's no insertion value, or the new value is the same as the
    // old one, preserve focus on original node and return silently
    if (value === initialValue || !value) {
      onDisableEditable(false);
      const focusNode = ast.getNodeById(focusId);
      const nid = focusNode && focusNode.nid;
      dispatch(activateByNid(nid));
      return;
    }

    let annt = `${isInsertion ? "inserted" : "changed"} ${value}`;
    const onSuccess = () => {
      dispatch(activateByNid(null, { allowMove: false }));
      onChange(null);
      onDisableEditable(false);
      setErrorId("");
      say(annt);
    };
    insert(value, target, onSuccess, onError, annt);
  };
}

type Props = ContentEditableProps & {
  // created by redux mapStateToProps
  initialValue: string;
  isErrored: boolean;
  dispatch: AppDispatch;
  setErrorId: (errorId: string) => void;
  focusSelf: () => void;
  clearSelections: () => void;

  // passed from above
  target?: Target;
  children?: ReactElement;
  isInsertion: boolean;
  value?: string | null;
  onChange?: (e: string) => void;
  onDisableEditable?: Function;
  contentEditableProps?: {};
  extraClasses?: ClassNamesArgument;
};

const NodeEditable = (props: Props) => {
  const element = useRef<HTMLElement>(null);

  useEffect(() => {
    const pendingTimeout = setAfterDOMUpdate(() => {
      const currentEl = element.current;
      if (!currentEl) {
        // element has been unmounted already, nothing to do.
        return;
      }
      selectElement(currentEl, props.isInsertion);
    });
    const text = props.value || props.initialValue || "";
    const annt = (props.isInsertion ? "inserting" : "editing") + ` ${text}`;
    say(annt + `.  Use Enter to save, and Alt-Q to cancel`);
    props.clearSelections();
    return () => cancelAfterDOMUpdate(pendingTimeout);
  }, []);

  const onBlur = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    const { target, setErrorId, dispatch } = props;
    const onError = () => {
      const errorText = SHARED.getExceptionMessage(e);
      console.log(errorText);
      setErrorId(target.node ? target.node.id : "editing");
      if (element.current) {
        selectElement(element.current, false);
      }
    };
    dispatch(
      // we override value in the line below to deal with this issue:
      // https://github.com/lovasoa/react-contenteditable/issues/161
      saveEditAction({ ...props, value: element.current.innerText }, onError)
    );
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (CodeMirror.keyName(e)) {
      case "Enter": {
        // blur the element to trigger handleBlur
        // which will save the edit
        element.current.blur();
        return;
      }
      case "Alt-Q":
      case "Esc":
        e.stopPropagation();
        props.onChange(null);
        props.onDisableEditable(false);
        props.setErrorId("");
        props.focusSelf();
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
      { "blocks-error": props.isErrored },
    ] as ClassNamesArgument[]
  ).concat(extraClasses);
  const text = value ?? props.initialValue;
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

const mapStateToProps = (
  state: RootState,
  props: { value?: string | null; target: Target }
) => {
  const nodeId = props.target.node ? props.target.node.id : "editing";
  const isErrored = state.errorId == nodeId;

  const initialValue =
    props.value === null ? props.target.getText(state.ast) : "";

  return { isErrored, initialValue };
};

const mapDispatchToProps = (dispatch: AppDispatch) => ({
  dispatch,
  setErrorId: (errorId: string) => dispatch({ type: "SET_ERROR_ID", errorId }),
  focusSelf: () =>
    // TODO(pcardune): move this setAfterDOMUpdate into activateByNid
    // and then figoure out how to get rid of it.
    setAfterDOMUpdate(() =>
      dispatch(activateByNid(null, { allowMove: false }))
    ),
  clearSelections: () => dispatch({ type: "SET_SELECTIONS", selections: [] }),
});

export default connect(mapStateToProps, mapDispatchToProps)(NodeEditable);
