import React from "react";
import { useDrop } from "../dnd";
import { useDispatch } from "react-redux";
import { AppDispatch } from "../state/store";
import * as actions from "../state/actions";
import { CMBEditor } from "../editor";
import type { Language } from "../CodeMirrorBlocks";

const TrashCan = (props: { editor: CMBEditor; language: Language }) => {
  const dispatch: AppDispatch = useDispatch();
  const { editor } = props;
  const [{ isOver }, drop] = useDrop({
    describe: () => ({ trash: true as const }),
    drop: (item) => {
      if (!item.id) {
        return; // Someone dragged from the toolbar to the trash can.
      }
      // A box being typed in is left as it is by a press on a block, as a click
      // elsewhere would leave it, so the drop would change the blocks around it
      // (and take it away) with the keyboard focus still in it: end the edit
      // first.
      const typing = document.activeElement;
      if (
        typing instanceof HTMLElement &&
        typing.getAttribute("contenteditable") === "true"
      ) {
        typing.blur();
        // (one that cannot be saved stays open, with an error: give it up, as
        // Escape does)
        if (
          typing.isConnected &&
          typing.getAttribute("contenteditable") === "true"
        ) {
          typing.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: "Escape",
              keyCode: 27,
              bubbles: true,
              cancelable: true,
            })
          );
        }
      }
      // deleteASTNode reads the current AST itself, so a stale handler can't
      // look the node up in an old tree.
      dispatch(actions.deleteASTNode(editor, item.id));
    },
  });

  const classNames = "TrashCan" + (isOver ? " over" : "");
  return (
    <div
      ref={(el) => {
        drop(el);
      }}
      className={classNames}
      aria-hidden={true}
    >
      🗑️
    </div>
  );
};

export default TrashCan;
