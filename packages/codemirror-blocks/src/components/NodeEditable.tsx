import React, { useEffect, useLayoutEffect, useRef } from "react";
import { recordEvent } from "../state/activityLog";
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
  // Focus first: focusing can reset the selection in some browsers, so the
  // selection has to be made after it.
  element.focus();
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
}

type Props = Omit<ContentEditableProps, "value"> & {
  target: Target;
  children?: React.ReactNode;
  /** drawn beside the box, while it is open (not part of what is edited) */
  hint?: React.ReactNode;
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

const NodeEditable = ({
  ref,
  ...props
}: Props & { ref?: React.Ref<NodeEditableHandle> }) => {
  {
    const elementRef = useRef<HTMLElement>(null);
    const dispatch: AppDispatch = useDispatch();

    const ast = useSelector(selectors.getAST);

    // select a primitive so that react-redux can tell when it hasn't changed
    const nodeId = props.target.node ? props.target.node.id : "editing";
    const isErrored = useSelector(
      (state: RootState) => selectors.getErrorId(state) == nodeId
    );
    // (no value yet, as in a block nobody has edited, means "the node's own text")
    const initialValue =
      props.value === null || props.value === undefined
        ? props.target.getText(ast, props.editor)
        : "";

    // select and focus the element on mount (before the browser goes on to what
    // was typed: the key that opened the box is its first character)
    useLayoutEffect(() => {
      const currentEl = elementRef.current;
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
        if (elementRef.current) {
          selectElement(elementRef.current, props.isInsertion);
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

    // Handling a blur can focus this very box again (it is the focused node's
    // element), which blurs it again: don't handle that second blur.
    const blurringRef = useRef(false);
    const deferredRef = useRef(false);
    const onBlur = (e: React.SyntheticEvent) => {
      e.stopPropagation();
      if (blurringRef.current) return;
      // Removing a box while CodeMirror patches its display blurs it right
      // then, and handling that moves nodes CodeMirror is in the middle of
      // replacing: wait until it is done.
      if (props.editor.isRedrawing() && !deferredRef.current) {
        deferredRef.current = true;
        queueMicrotask(() => {
          onBlur(e);
          deferredRef.current = false;
        });
        return;
      }
      blurringRef.current = true;
      try {
        handleBlur();
      } finally {
        blurringRef.current = false;
      }
    };
    // A block normally takes focus back. With none to take it (an empty
    // document, or one of only comments), the box going away would leave focus
    // on the page body, and keys such as undo would stop working: keep it in
    // the editor.
    const keepFocusInEditor = (_: AppDispatch, getState: () => RootState) => {
      if (!selectors.getFocusedNode(getState())) {
        props.editor.focus();
      }
    };
    const enterRef = useRef(false);
    const handleBlur = () => {
      const { target } = props;
      dispatch((dispatch: AppDispatch, getState: () => RootState) => {
        // we grab the value directly from the content editable element
        // to deal with this issue:
        // https://github.com/lovasoa/react-contenteditable/issues/161
        const value = elementRef.current?.textContent;
        recordEvent({
          type: "EDIT",
          text: value ?? "",
          how: enterRef.current ? "enter" : "blur",
        });
        enterRef.current = false;
        const focusedNode = selectors.getFocusedNode(getState());
        // if there's no insertion value, or the new value is the same as the
        // old one, preserve focus on original node and return silently
        if (value === initialValue || !value) {
          props.onDisableEditable();
          const nid = focusedNode && focusedNode.nid;
          dispatch(activateByNid(props.editor, nid));
          dispatch(keepFocusInEditor);
          return;
        }

        // the block being edited can be gone by now (something removed it, and
        // this box is only being closed because of that): there is nothing to
        // change
        if (
          target.node &&
          !selectors.getAST(getState()).getNodeById(target.node.id)
        ) {
          props.onDisableEditable();
          dispatch(keepFocusInEditor);
          return;
        }

        const annt = `${props.isInsertion ? "inserted" : "changed"} ${value}`;
        const result = dispatch(insert(value, target, props.editor, annt));
        if (result.successful) {
          // If this blur happened because the user moved to another block, that
          // block (focused before the edit was saved) keeps focus rather than
          // the node that was just edited. (A new insertion always takes focus.)
          const newAST = selectors.getAST(getState());
          const movedElsewhere =
            !props.isInsertion &&
            focusedNode &&
            focusedNode.id !== target.node?.id &&
            newAST.getNodeById(focusedNode.id);
          dispatch(
            activateByNid(
              props.editor,
              movedElsewhere ? movedElsewhere.nid : null,
              { allowMove: false }
            )
          );
          props.onChange(null);
          props.onDisableEditable();
          dispatch(actions.clearError());
          dispatch(keepFocusInEditor);
          say(annt);
        } else {
          console.error(result.exception);
          dispatch(
            actions.setErrorId(target.node ? target.node.id : "editing")
          );
          if (elementRef.current) {
            selectElement(elementRef.current, false);
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
          enterRef.current = true;
          elementRef.current?.blur();
          return;
        }
        case "Alt-Q":
        case "Esc": {
          recordEvent({ type: "EDIT_CANCEL" });
          el.innerHTML = initialValue;
          e.stopPropagation();
          props.onChange(null);
          props.onDisableEditable();
          dispatch(actions.clearError());
          dispatch(activateByNid(props.editor, null, { allowMove: false }));
          dispatch(keepFocusInEditor);
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
    const box = (
      <ContentEditable
        {...contentEditableProps}
        className={classNames(classes)}
        role="textbox"
        ref={elementRef}
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
    return props.hint ? (
      <>
        {box}
        <span className="blocks-editing-hint">{props.hint}</span>
      </>
    ) : (
      box
    );
  }
};
export default NodeEditable;
