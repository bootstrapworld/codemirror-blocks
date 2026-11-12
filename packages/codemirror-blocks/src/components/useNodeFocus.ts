import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { CMBEditor } from "../editor";

/**
 * The effects that give a block keyboard focus when it is the focused one, and
 * that take it back when the browser or the editor has dropped it. Returns
 * `notePress`, to be called when the block is pressed with the mouse.
 */
export function useNodeFocus({
  editor,
  nodeElementRef,
  isFocused,
  editable,
}: {
  editor: CMBEditor | null;
  nodeElementRef: RefObject<HTMLSpanElement | null>;
  isFocused: boolean;
  editable: boolean;
}) {
  // when this block was last pressed with the mouse (see the effect below)
  const pressedAtRef = useRef(0);
  const notePress = () => {
    pressedAtRef.current = Date.now();
  };
  useEffect(() => {
    if (
      !editor?.hasFocus() &&
      document.activeElement !== document.body &&
      document.activeElement !== null &&
      document.activeElement.id !== "cmb-focus-placeholder"
    ) {
      // If the editor doesn't have focus, then we don't want to steal
      // focus from something else.
      return;
    }
    if (nodeElementRef.current && isFocused) {
      nodeElementRef.current?.focus();
    }
    // (the refs are parameters here, so the rule does not know they never change)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, isFocused, editable]);

  // A press on a block makes it the focused block, and CodeMirror, handling the
  // same press, then focuses its keyboard buffer (the textarea): so the block's
  // focus is taken from it, if the effect that gives it runs before CodeMirror
  // has done that (as it does when effects run right after the render). Only for
  // a block that has just been pressed: the buffer has focus on purpose when
  // someone clicks beside the blocks to type, or after an undo.
  useEffect(() => {
    if (!isFocused || Date.now() - pressedAtRef.current > 500) return;
    let frame = 0;
    let tries = 0;
    const watch = () => {
      const active = document.activeElement;
      if (active?.tagName === "TEXTAREA" && active.closest(".CodeMirror")) {
        nodeElementRef.current?.focus();
      }
      if (++tries <= 5) frame = requestAnimationFrame(watch);
    };
    frame = requestAnimationFrame(watch);
    return () => cancelAnimationFrame(frame);
    // (the ref is a parameter here, so the rule does not know it never changes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);

  return { notePress };
}
