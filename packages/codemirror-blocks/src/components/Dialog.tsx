import React, { KeyboardEvent, ReactElement, useRef, useCallback } from "react";
import Modal from "react-modal";
import "../less/Dialog.less";

type Props = {
  closeFn: () => void;
  isOpen: boolean;
  body: {
    title: string;
    content: ReactElement | string;
  } | null;
  keyUp?: React.KeyboardEventHandler<HTMLDivElement>;
  /** Called once the dialog is closed, and has given focus back */
  onAfterClose?: () => void;
  /**
   * The content to hide from screenreaders while the dialog is open (see
   * react-modal's `appElement`). Without it the dialog logs a warning.
   */
  appElement?: HTMLElement;
};

const Dialog = (props: Props) => {
  const { isOpen, closeFn, keyUp } = props;
  const headerRef = useRef<HTMLHeadingElement>(null);
  const focusTitle = useCallback(() => headerRef.current?.focus(), []);

  const onKeyUp = (e: KeyboardEvent): void => {
    if (e.key === "Escape") closeFn();
  };

  return (
    <Modal
      isOpen={isOpen}
      appElement={props.appElement}
      className={"madeUpClassToCancelDefaultStyles"}
      onRequestClose={closeFn}
      shouldCloseOnEsc={true}
      shouldReturnFocusAfterClose={true}
      shouldFocusAfterRender={true}
      shouldCloseOnOverlayClick={true}
      onAfterOpen={focusTitle}
      onAfterClose={props.onAfterClose}
      aria={{ labelledby: "heading" }}
    >
      <div tabIndex={-1} id="DialogContents" onKeyUp={keyUp ?? onKeyUp}>
        <h1 tabIndex={-1} ref={headerRef}>
          {props.body?.title}
        </h1>
        {props.body?.content}
        <button className="closeDialog" onClick={() => closeFn()}>
          Close
        </button>
      </div>
    </Modal>
  );
};

export default Dialog;
