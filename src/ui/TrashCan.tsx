import React from "react";
import { ItemTypes } from "../dnd";
import { dropOntoTrashCan } from "../actions";
import { useDrop } from "react-dnd";
import { Editor } from "codemirror";
require("./TrashCan.less");

const TrashCan = (props: { cm: Editor }) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: ItemTypes.NODE,
    drop: (item: { id: string }) => {
      dropOntoTrashCan(props.cm, item);
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
