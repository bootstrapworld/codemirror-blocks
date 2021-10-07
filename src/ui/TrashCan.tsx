import React from "react";
import { ItemTypes } from "../dnd";
import { useDrop } from "react-dnd";
import { Editor } from "codemirror";
import { useSelector } from "react-redux";
import { RootState } from "../reducers";
import { edit_delete, usePerformEdits } from "../edits/performEdits";
import SHARED from "../shared";
require("./TrashCan.less");

const TrashCan = (props: { cm: Editor }) => {
  const performEdits = usePerformEdits();

  const { ast } = useSelector(({ ast }: RootState) => ({ ast }));

  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: ItemTypes.NODE,
      drop: (item: { id: string }) => {
        const srcNode = item.id ? ast.getNodeById(item.id) : null; // null if dragged from toolbar
        if (!srcNode) return; // Someone dragged from the toolbar to the trash can.
        let edits = [edit_delete(srcNode)];
        performEdits("cmb:trash-node", edits, SHARED.parse, props.cm);
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
