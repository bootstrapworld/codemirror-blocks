import React from "react";
import { ItemTypes } from "../dnd";
import { useDrop } from "react-dnd";
import { useDispatch } from "react-redux";
import { AppDispatch } from "../state/store";
import * as actions from "../state/actions";
import { CMBEditor } from "../editor";
import type { Language } from "../CodeMirrorBlocks";
require("./TrashCan.less");

const TrashCan = (props: { editor: CMBEditor; language: Language }) => {
  const dispatch: AppDispatch = useDispatch();
  const { editor } = props;
  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: ItemTypes.NODE,
      drop: (item: { id?: string }) => {
        if (!item.id) {
          return; // Someone dragged from the toolbar to the trash can.
        }
        // deleteASTNode reads the current AST itself, so a stale handler can't
        // look the node up in an old tree. The editor, however, is captured
        // here and changes when the mode is toggled, so it must be a dep.
        return dispatch(actions.deleteASTNode(editor, item.id));
      },
      collect: (monitor) => ({ isOver: monitor.isOver() }),
    }),
    [editor, dispatch]
  );

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
