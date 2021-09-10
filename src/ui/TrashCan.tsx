import React from "react";
import { ItemTypes } from "../dnd";
import { dropOntoTrashCan } from "../actions";
import { useDrop } from "react-dnd";
require("./TrashCan.less");

export default function TrashCan() {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: ItemTypes.NODE,
    drop: (item: { id: string }) => {
      dropOntoTrashCan(item);
    },
    collect: (monitor) => ({ isOver: monitor.isOver() }),
  }));

  const classNames = "TrashCan" + (isOver ? " over" : "");
  return (
    <div ref={drop} className={classNames} aria-hidden={true}>
      🗑️
    </div>
  );
}
