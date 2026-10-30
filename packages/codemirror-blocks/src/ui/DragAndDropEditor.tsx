import {
  DomEvent,
  IUnControlledCodeMirror,
  UnControlled as CodeMirror,
} from "react-codemirror2";
import React, { useRef } from "react";
import * as actions from "../state/actions";
import { playSound, BEEP } from "../utils";
import { useDrop } from "../dnd";
import { CodeMirrorFacade } from "../editor";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "../state/store";

type OurProps = {
  editorDidMount?: (ed: CodeMirror.Editor) => void;
  onFocus?: (ed: CodeMirrorFacade) => void;
  onPaste?: (ed: CodeMirrorFacade, e: ClipboardEvent) => void;
  onKeyDown?: (ed: CodeMirrorFacade, e: React.KeyboardEvent) => void;
  onCursorActivity?: (ed: CodeMirrorFacade) => void;
};
type Props = Omit<IUnControlledCodeMirror, keyof OurProps> & OurProps;

const DragAndDropEditor = (props: Props) => {
  const editorRef = useRef<CodeMirrorFacade | undefined>(undefined);
  const dispatch: AppDispatch = useDispatch();
  const [, connectDropTarget] = useDrop({
    drop: (item, info) => {
      if (!editorRef.current) {
        // editor hasn't mounted yet, do nothing.
        return;
      }
      if (info.didDrop) {
        return;
      }
      const rootMarks = editorRef.current.getAllBlockNodeMarkers();
      const { x: left, y: top } = info.clientOffset;

      // Did we get proper coordinate information from react DND?
      if (left && top) {
        const droppedOn = document.elementFromPoint(left, top);
        // Do those coordinates land outside all roots, but still in CM whitespace?
        let isDroppedOnWhitespace = false;
        if (droppedOn) {
          isDroppedOnWhitespace = !rootMarks.some((mark) =>
            mark.replacedWith.contains(droppedOn as Element)
          );
        }

        // If it's in a valid part of CM whitespace, translate to "insert at loc" edit
        if (isDroppedOnWhitespace) {
          const loc = editorRef.current.codemirror.coordsChar({ left, top });
          dispatch(
            actions.drop(
              editorRef.current,
              item,
              new actions.OverwriteTarget(loc, loc)
            )
          );
          // Or else beep and make it a no-op
        } else {
          playSound(BEEP);
        }
      }
    },
  });

  const onEditorMounted = (ed: CodeMirror.Editor) => {
    const editor = new CodeMirrorFacade(ed);
    props.editorDidMount && props.editorDidMount(ed);
    editorRef.current = editor;
  };

  const handleDragOver: DomEvent = (ed, e) => {
    if (!e.target.classList.contains("CodeMirror-line")) {
      e.preventDefault();
    }
  };

  const handleDrop = () => {
    // :( this never fire because of the other onDrop, although this onDrop
    // has the access to the information whether we drop at the right place :(
  };

  return (
    <div
      ref={(el) => {
        connectDropTarget(el);
      }}
    >
      <CodeMirror
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        {...props}
        editorDidMount={onEditorMounted}
        onCursorActivity={() =>
          editorRef.current &&
          props.onCursorActivity &&
          props.onCursorActivity(editorRef.current)
        }
        onFocus={() =>
          editorRef.current && props.onFocus && props.onFocus(editorRef.current)
        }
        onPaste={(ed, e) =>
          editorRef.current &&
          props.onPaste &&
          props.onPaste(editorRef.current, e)
        }
        onKeyDown={(ed, e) =>
          editorRef.current &&
          props.onKeyDown &&
          props.onKeyDown(editorRef.current, e)
        }
      />
    </div>
  );
};

export default DragAndDropEditor;
