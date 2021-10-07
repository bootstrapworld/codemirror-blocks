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
import { useDispatch, useStore } from "react-redux";

type Props = Omit<IUnControlledCodeMirror, "editorDidMount"> & {
  editorDidMount?: (ed: Editor) => void;
};

const DragAndDropEditor = (props: Props) => {
  const cmRef = useRef<Editor>(null);
  const dispatch = useDispatch();
  const drop = useDropAction();

  const [_, connectDropTarget] = useDrop({
    accept: ItemTypes.NODE,
    drop: (_, monitor) => {
      if (monitor.didDrop()) {
        return;
      }
      const roots = cmRef.current.getAllMarks().filter((m) => m.BLOCK_NODE_ID);
      const { x: left, y: top } = monitor.getClientOffset();

      // Did we get proper coordinate information from react DND?
      let droppedOn: Element | false = false;
      if (left && top) {
        droppedOn = document.elementFromPoint(left, top);
      }

      // Do those coordinates land outside all roots, but still in CM whitespace?
      let isDroppedOnWhitespace = false;
      if (droppedOn) {
        isDroppedOnWhitespace = !roots.some((r) =>
          r.replacedWith.contains(droppedOn as Element)
        );
      }

      // If it's in a valid part of CM whitespace, translate to "insert at loc" edit
      if (isDroppedOnWhitespace) {
        const loc = cmRef.current.coordsChar({ left, top });
        drop(cmRef.current, monitor.getItem(), new OverwriteTarget(loc, loc));
        // Or else beep and make it a no-op
      } else {
        playSound(BEEP);
      }
    },
    collect: () => null,
  });

  const onEditorMounted = (ed: Editor) => {
    props.editorDidMount && props.editorDidMount(ed);
    cmRef.current = ed;
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
