import React, { Component, ReactElement } from "react";
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

class NodeEditable extends Component<Props> {
  element = React.createRef<HTMLElement>();
  pendingTimeout?: afterDOMUpdateHandle;

  componentDidMount() {
    this.pendingTimeout = setAfterDOMUpdate(() => {
      const element = this.element.current;
      if (!element) {
        // element has been unmounted already, nothing to do.
        return;
      }
      selectElement(element, this.props.isInsertion);
    });
    const text = this.props.value || this.props.initialValue || "";
    const annt =
      (this.props.isInsertion ? "inserting" : "editing") + ` ${text}`;
    say(annt + `.  Use Enter to save, and Alt-Q to cancel`);
    this.props.clearSelections();
  }

  // Teardown any pending timeouts
  componentWillUnmount() {
    cancelAfterDOMUpdate(this.pendingTimeout);
  }

  /*
   * No need to reset text because we assign new key (via the parser + patching)
   * to changed nodes, so they will be completely unmounted and mounted back
   * with correct values.
   */

  render() {
    const saveEdit = (e: React.SyntheticEvent) => {
      e.stopPropagation();
      const { target, setErrorId, dispatch } = this.props;

      const onError = () => {
        const errorText = SHARED.getExceptionMessage(e);
        console.log(errorText);
        setErrorId(target.node ? target.node.id : "editing");
        if (this.element.current) {
          selectElement(this.element.current, false);
        }
      };
      dispatch(saveEditAction(this.props, onError));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      switch (CodeMirror.keyName(e)) {
        case "Enter": {
          // blur the element to trigger handleBlur
          // which will save the edit
          this.element.current.blur();
          return;
        }
        case "Alt-Q":
        case "Esc":
          e.stopPropagation();
          this.props.onChange(null);
          this.props.onDisableEditable(false);
          this.props.setErrorId("");
          this.props.focusSelf();
          return;
      }
    };

    const { contentEditableProps, extraClasses, value, onChange } = this.props;

    const classes = (
      [
        "blocks-literal",
        "quarantine",
        "blocks-editing",
        "blocks-node",
        { "blocks-error": this.props.isErrored },
      ] as ClassNamesArgument[]
    ).concat(extraClasses);

    const text = value !== null ? value : this.props.initialValue;
    return (
      <ContentEditable
        {...contentEditableProps}
        className={classNames(classes)}
        role="textbox"
        ref={this.element}
        onChange={onChange}
        onBlur={saveEdit}
        onKeyDown={handleKeyDown}
        // trap mousedown, clicks and doubleclicks, to prevent focus change, or
        // parent nodes from toggling collapsed state
        onMouseDown={suppressEvent}
        onClick={suppressEvent}
        onDoubleClick={suppressEvent}
        aria-label={text}
        value={text}
      />
    );
  }
}

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
