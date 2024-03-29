import React, { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import ContentEditable, {
  Props as ContentEditableProps,
} from "./ContentEditable";
import classNames, { Argument as ClassNamesArgument } from "classnames";
import { insert, activateByNid, Target } from "../state/actions";
import { say } from "../announcer";
import CodeMirror from "codemirror";
import { AppDispatch } from "../state/store";
import { RootState } from "../state/reducers";
import { CMBEditor } from "../editor";
import * as selectors from "../state/selectors";
import * as actions from "../state/actions";

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

export type NodeEditableHandle = {
  /**
   * Selects and focuses the text in the node editable component
   */
  select: () => void;
};

const NodeEditable = React.forwardRef<NodeEditableHandle, Props>(
  (props, ref) => {
    const element = useRef<HTMLElement>(null);
    const dispatch: AppDispatch = useDispatch();

    const ast = useSelector(selectors.getAST);

    const { initialValue, isErrored } = useSelector((state: RootState) => {
      const nodeId = props.target.node ? props.target.node.id : "editing";
      const isErrored = selectors.getErrorId(state) == nodeId;

      const initialValue =
        props.value === null ? props.target.getText(ast, props.editor) : "";

      return { isErrored, initialValue };
    });

    // select and focus the element on mount
    useEffect(() => {
      const currentEl = element.current;
      if (!currentEl) {
        // element has been unmounted already, nothing to do.
        return;
      }
      selectElement(currentEl, props.isInsertion);
    }, [props.isInsertion]);

    // expose an imperative handle for selecting the contents
    // of the rendered element in case it needs to be done after
    // later. This is only necessary in cases where the component
    // is rendered to a container that won't be in the document
    // until later, as is the case with TopLevelNodeEditable
    React.useImperativeHandle(ref, () => ({
      select: () => {
        if (element.current) {
          selectElement(element.current, props.isInsertion);
        }
      },
    }));

    useEffect(() => {
      const text = props.value || initialValue || "";
      const annt = (props.isInsertion ? "inserting" : "editing") + ` ${text}`;
      say(annt + `.  Use Enter to save, and Alt-Q to cancel`);
      dispatch(actions.setSelectedNodeIds([]));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onBlur = (e: React.SyntheticEvent) => {
      e.stopPropagation();
      const { target } = props;
      dispatch((dispatch: AppDispatch, getState: () => RootState) => {
        // we grab the value directly from the content editable element
        // to deal with this issue:
        // https://github.com/lovasoa/react-contenteditable/issues/161
        const value = element.current?.textContent;
        const focusedNode = selectors.getFocusedNode(getState());
        // if there's no insertion value, or the new value is the same as the
        // old one, preserve focus on original node and return silently
        if (value === initialValue || !value) {
          props.onDisableEditable();
          const nid = focusedNode && focusedNode.nid;
          dispatch(activateByNid(props.editor, nid));
          return;
        }

        const annt = `${props.isInsertion ? "inserted" : "changed"} ${value}`;
        const result = dispatch(insert(value, target, props.editor, annt));
        if (result.successful) {
          dispatch(activateByNid(props.editor, null, { allowMove: false }));
          props.onChange(null);
          props.onDisableEditable();
          dispatch(actions.clearError());
          say(annt);
        } else {
          console.error(result.exception);
          dispatch(
            actions.setErrorId(target.node ? target.node.id : "editing")
          );
          if (element.current) {
            selectElement(element.current, false);
          }
        }
      });
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      const el = e.target as HTMLDivElement;
      switch (CodeMirror.keyName(e)) {
        case "Enter": {
          // blur the element to trigger handleBlur
          // which will save the edit
          element.current?.blur();
          return;
        }
        case "Alt-Q":
        case "Esc": {
          el.innerHTML = initialValue;
          e.stopPropagation();
          props.onChange(null);
          props.onDisableEditable();
          dispatch(actions.clearError());
          dispatch(activateByNid(props.editor, null, { allowMove: false }));
          return;
        }
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
  }
);
export default NodeEditable;
