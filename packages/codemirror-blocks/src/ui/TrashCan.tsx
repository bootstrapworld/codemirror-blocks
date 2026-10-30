import React from "react";
import { useDrop } from "../dnd";
import { useDispatch } from "react-redux";
import { AppDispatch } from "../state/store";
import * as actions from "../state/actions";
import { CMBEditor } from "../editor";
import type { Language } from "../CodeMirrorBlocks";
require("./TrashCan.less");

const TrashCan = (props: { editor: CMBEditor; language: Language }) => {
  const dispatch: AppDispatch = useDispatch();
  const { editor } = props;
  const [{ isOver }, drop] = useDrop({
    drop: (item) => {
      if (!item.id) {
        return; // Someone dragged from the toolbar to the trash can.
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
