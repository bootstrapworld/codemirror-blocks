import React, { KeyboardEvent, ReactElement, useRef, useCallback } from "react";
import Modal from "react-modal";
import "../less/Dialog.less";

type Props = {
  closeFn: () => void;
  isOpen: boolean;
  body: {
    title: string;
    content: ReactElement;
  } | null;
  keyUp?: React.KeyboardEventHandler<HTMLDivElement>;
};

const Dialog = (props: Props) => {
  const { isOpen, closeFn, keyUp, body } = props;
  const headerRef = useRef<HTMLHeadingElement>(null);
  const focusTitle = useCallback(() => headerRef.current?.focus(), []);

  const onKeyUp = (e: KeyboardEvent): void => {
    if (e.key === "Escape") closeFn();
  };

  return (
    <Modal
      isOpen={isOpen}
      className={"madeUpClassToCancelDefaultStyles"}
      onRequestClose={closeFn}
      shouldCloseOnEsc={true}
      shouldReturnFocusAfterClose={true}
      shouldFocusAfterRender={true}
      shouldCloseOnOverlayClick={true}
      onAfterOpen={focusTitle}
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
