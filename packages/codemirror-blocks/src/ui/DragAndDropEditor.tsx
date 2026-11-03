import CodeMirror from "codemirror";
import React, { useRef } from "react";
import CodeMirrorHost from "./CodeMirrorHost";
import * as actions from "../state/actions";
import { playSound, BEEP } from "../utils";
import { useDrop } from "../dnd";
import { CodeMirrorFacade } from "../editor";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "../state/store";

type Props = {
  codemirror: CodeMirror.Editor;
  value: string;
  className?: string;
  editorDidMount?: (ed: CodeMirror.Editor) => void | (() => void);
  onKeyPress?: (ed: CodeMirror.Editor, e: React.KeyboardEvent) => void;
  onFocus?: (ed: CodeMirrorFacade) => void;
  onPaste?: (ed: CodeMirrorFacade, e: ClipboardEvent) => void;
  onKeyDown?: (ed: CodeMirrorFacade, e: React.KeyboardEvent) => void;
  onCursorActivity?: (ed: CodeMirrorFacade) => void;
};

const DragAndDropEditor = (props: Props) => {
  const editorRef = useRef<CodeMirrorFacade | undefined>(undefined);
  const dispatch: AppDispatch = useDispatch();
  const [, connectDropTarget] = useDrop({
    describe: (_el, info) => {
      const { x: left, y: top } = info.clientOffset;
      const cm = editorRef.current;
      const droppedOn = left && top && document.elementFromPoint(left, top);
      if (!cm || !droppedOn) return undefined;
      const onWhitespace = !cm
        .getAllBlockNodeMarkers()
        .some((mark) => mark.replacedWith.contains(droppedOn as Element));
      if (!onWhitespace) return undefined;
      const { line, ch } = cm.codemirror.coordsChar({ left, top });
      return { ws: { line, ch } };
    },
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
    editorRef.current = editor;
    return props.editorDidMount && props.editorDidMount(ed);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDragOver = (_ed: CodeMirror.Editor, e: any) => {
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
      <CodeMirrorHost
        codemirror={props.codemirror}
        value={props.value}
        className={props.className}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onKeyPress={props.onKeyPress}
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
