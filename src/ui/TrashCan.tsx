import React from "react";
import SHARED from "../shared";
import { ItemTypes } from "../dnd";
import { dropOntoTrashCan } from "../actions";
import { useDrop } from "react-dnd";
require("./TrashCan.less");

const TrashCan = () => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: ItemTypes.NODE,
    drop: (item: { id: string }) => {
      dropOntoTrashCan(SHARED.cm, item);
    },
    collect: (monitor) => ({ isOver: monitor.isOver() }),
  }));

  const classNames = "TrashCan" + (isOver ? " over" : "");
  return (
    <div ref={drop} className={classNames} aria-hidden={true}>
      🗑️
    </div>
  );
};

export default TrashCan;
