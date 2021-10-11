import React from "react";
import { ItemTypes } from "../dnd";
import { useDrop } from "react-dnd";
import { useSelector, useStore } from "react-redux";
import { RootState } from "../reducers";
import { edit_delete, usePerformEdits } from "../edits/performEdits";
import SHARED from "../shared";
import { AppStore } from "../store";
import { CMBEditor } from "../editor";
require("./TrashCan.less");

const TrashCan = (props: { editor: CMBEditor }) => {
  const performEdits = usePerformEdits();

  const { ast } = useSelector(({ ast }: RootState) => ({ ast }));
  const store: AppStore = useStore();
  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: ItemTypes.NODE,
      drop: (item: { id: string }) => {
        const srcNode = item.id ? ast.getNodeById(item.id) : null; // null if dragged from toolbar
        if (!srcNode) return; // Someone dragged from the toolbar to the trash can.
        let edits = [
          edit_delete(store.getState().ast.getNodeByIdOrThrow(srcNode.id)),
        ];
        performEdits("cmb:trash-node", edits, SHARED.parse, props.editor);
      },
      collect: (monitor) => ({ isOver: monitor.isOver() }),
    }),
    [performEdits, ast]
  );

  const classNames = "TrashCan" + (isOver ? " over" : "");
  return (
    <div ref={drop} className={classNames} aria-hidden={true}>
      🗑️
    </div>
  );
};

export default TrashCan;
