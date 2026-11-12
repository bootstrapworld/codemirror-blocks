import { useEffect } from "react";
import type { RefObject } from "react";
import type { CMBEditor } from "../editor";

/**
 * The effect that gives a block keyboard focus when it becomes the focused one.
 * (Focus that the page drops with no render is given back by the keeper: see
 * focus.ts.)
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
}
