import React, {
  Component,
  KeyboardEvent,
  ReactElement,
  useEffect,
  useRef,
} from "react";
import Modal from "react-modal";
import PropTypes from "prop-types";
import "../less/Dialog.less";

type Props = {
  appElement: string | HTMLElement;
  closeFn: () => void;
  isOpen: boolean;
  body: {
    title: string;
    content: ReactElement;
  } | null;
  keyUp?: React.KeyboardEventHandler<HTMLDivElement>;
};

const Dialog = (props: Props) => {
  const { appElement, isOpen, closeFn, keyUp, body } = props;
  var headerRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    Modal.setAppElement(appElement);
  }, []);

  const onKeyUp = (e: KeyboardEvent): void => {
    if (e.key === "Escape") closeFn();
  };

  // NOTE(Emmanuel): this feels like a level of indirection
  // that refs are supposed to deal with.
  const focusTitle = () => {
    headerRef.current.focus();
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
      <div tabIndex={-1} id="DialogContents" onKeyUp={keyUp || onKeyUp}>
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