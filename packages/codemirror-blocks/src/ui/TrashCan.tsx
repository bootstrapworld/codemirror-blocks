import React from "react";
import { ItemTypes } from "../dnd";
import { useDrop } from "react-dnd";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch } from "../state/store";
import * as selectors from "../state/selectors";
import * as actions from "../state/actions";
import { CMBEditor } from "../editor";
import type { Language } from "../CodeMirrorBlocks";
require("./TrashCan.less");

const TrashCan = (props: { editor: CMBEditor; language: Language }) => {
  const dispatch: AppDispatch = useDispatch();
  const ast = useSelector(selectors.getAST);
  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: ItemTypes.NODE,
      drop: (item: { id: string }) => {
        const srcNode = item.id ? ast.getNodeByIdOrThrow(item.id) : null; // null if dragged from toolbar
        if (!srcNode) {
          return; // Someone dragged from the toolbar to the trash can.
        }
        return dispatch(actions.deleteASTNode(props.editor, srcNode.id));
      },
      collect: (monitor) => ({ isOver: monitor.isOver() }),
    }),
    [ast]
  );

  const classNames = "TrashCan" + (isOver ? " over" : "");
  return (
    <div ref={drop} className={classNames} aria-hidden={true}>
      🗑️
    </div>
  );
};

export default TrashCan;
