import {
  DomEvent,
  IUnControlledCodeMirror,
  UnControlled as CodeMirror,
} from "react-codemirror2";
import React, { useRef } from "react";
import { ItemTypes } from "../dnd";
import { OverwriteTarget, useDropAction } from "../actions";
import { playSound, BEEP } from "../utils";
import { useDrop } from "react-dnd";
import { Editor } from "codemirror";
import { CodeMirrorFacade } from "../editor";

type OurProps = {
  editorDidMount?: (ed: CodeMirrorFacade) => void;
  onFocus?: (ed: CodeMirrorFacade) => void;
  onPaste?: (ed: CodeMirrorFacade, e: ClipboardEvent) => void;
  onKeyDown?: (ed: CodeMirrorFacade, e: React.KeyboardEvent) => void;
  onCursorActivity?: (ed: CodeMirrorFacade) => void;
};
type Props = Omit<IUnControlledCodeMirror, keyof OurProps> & OurProps;

const DragAndDropEditor = (props: Props) => {
  const editorRef = useRef<CodeMirrorFacade>();
  const drop = useDropAction();

  const [_, connectDropTarget] = useDrop({
    accept: ItemTypes.NODE,
    drop: (_, monitor) => {
      if (!editorRef.current) {
        // editor hasn't mounted yet, do nothing.
        return;
      }
      if (monitor.didDrop()) {
        return;
      }
      const rootMarks = editorRef.current.getAllBlockNodeMarkers();
      const { x: left, y: top } = monitor.getClientOffset() || {};

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
          drop(
            editorRef.current,
            monitor.getItem(),
            new OverwriteTarget(loc, loc)
          );
          // Or else beep and make it a no-op
        } else {
          playSound(BEEP);
        }
      }
    },
    collect: () => null,
  });

  const onEditorMounted = (ed: Editor) => {
    const editor = new CodeMirrorFacade(ed);
    props.editorDidMount && props.editorDidMount(editor);
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

  return connectDropTarget(
    <div>
      <CodeMirror
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        {...props}
        editorDidMount={onEditorMounted}
        onCursorActivity={() =>
          props.onCursorActivity && props.onCursorActivity(editorRef.current!)
        }
        onFocus={() => props.onFocus && props.onFocus(editorRef.current!)}
        onPaste={(ed, e) =>
          props.onPaste && props.onPaste(editorRef.current!, e)
        }
        onKeyDown={(ed, e) =>
          props.onKeyDown && props.onKeyDown(editorRef.current!, e)
        }
      />
      {/* 
          Invisible form for error logging
          NOTE(Emmanuel) we should re-evaluate this when dealing 
          with pages that have multiple block editors 
        */}
      <iframe
        name="hidden_iframe"
        id="hidden_iframe"
        style={{ display: "none" }}
      ></iframe>
      <form
        method="post"
        action="https://docs.google.com/forms/d/e/1FAIpQLScJMw-00Kl3bxqp9NhCjijn0I8okCtVeX3VrwT7M1uTsYqBkw/formResponse"
        name="theForm"
        id="errorLogForm"
        target="hidden_iframe"
        style={{ display: "none" }}
      >
        <textarea
          name="entry.1311696515"
          id="description"
          defaultValue="Auto-Generated Crash Log"
        />
        <textarea
          name="entry.1568521986"
          id="history"
          defaultValue="default_history"
        />
        <textarea
          name="entry.785063835"
          id="exception"
          defaultValue="default_exception"
        />
        <input type="button" value="Submit" className="submit" />
      </form>
    </div>
  );
};

export default DragAndDropEditor;
