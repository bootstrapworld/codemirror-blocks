import React, { useContext } from "react";
import { ItemTypes } from "../dnd";
import { useDrop } from "react-dnd";
import { useDispatch, useSelector, useStore } from "react-redux";
import { RootState } from "../reducers";
import { edit_delete, performEdits } from "../edits/performEdits";
import { AppDispatch, AppStore } from "../store";
import { CMBEditor } from "../editor";
import type { Language } from "../CodeMirrorBlocks";
import { SearchContext } from "../components/Context";
require("./TrashCan.less");

const TrashCan = (props: { editor: CMBEditor; language: Language }) => {
  const dispatch: AppDispatch = useDispatch();
  const search = useContext(SearchContext);

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
        if (!search) {
          throw new Error(`Can't perform edits before search has mounted`);
        }
        return dispatch(
          performEdits(search, edits, props.language.parse, props.editor)
        );
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
