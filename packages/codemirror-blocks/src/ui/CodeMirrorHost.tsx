import React, { useLayoutEffect, useRef } from "react";
import CodeMirror from "codemirror";

/**
 * The origin given to the change that makes the document match the text of a
 * newly entered mode (see `syncValue`).
 */
export const MODE_SWITCH_ORIGIN = "mode-switch";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Handler = (ed: CodeMirror.Editor, event: any) => void;

// the props that are handlers, and the CodeMirror event each one listens to
const events = {
  onFocus: "focus",
  onKeyDown: "keydown",
  onKeyPress: "keypress",
  onPaste: "paste",
  onCursorActivity: "cursorActivity",
  onDrop: "drop",
  onDragOver: "dragover",
} as const;

export type CodeMirrorHostProps = {
  /** The one CodeMirror instance, owned by ToggleEditor. */
  codemirror: CodeMirror.Editor;
  value: string;
  className?: string;
  /** May return a function that undoes what it did (called on unmount). */
  editorDidMount?: (ed: CodeMirror.Editor) => void | (() => void);
} & { [K in keyof typeof events]?: Handler };

/**
 * Make the document say `value`, changing only the part between the longest
 * common prefix and suffix, so that marks, the selection and the undo history
 * outside of that part survive (setValue would throw them all away).
 */
export const syncValue = (codemirror: CodeMirror.Editor, value: string) => {
  const old = codemirror.getValue();
  if (old === value) return;
  const min = Math.min(old.length, value.length);
  let start = 0;
  while (start < min && old[start] === value[start]) start++;
  let oldEnd = old.length;
  let newEnd = value.length;
  while (
    oldEnd > start &&
    newEnd > start &&
    old[oldEnd - 1] === value[newEnd - 1]
  ) {
    oldEnd--;
    newEnd--;
  }
  const doc = codemirror.getDoc();
  doc.replaceRange(
    value.slice(start, newEnd),
    doc.posFromIndex(start),
    doc.posFromIndex(oldEnd),
    MODE_SWITCH_ORIGIN
  );
};

/**
 * Puts an existing CodeMirror into the page, and wires its events to props.
 * (react-codemirror2 always builds its own instance, which is what made every
 * mode switch start from a blank CodeMirror: #571.)
 */
const CodeMirrorHost = (props: CodeMirrorHostProps) => {
  const { codemirror } = props;
  const hostRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const wrapper = codemirror.getWrapperElement();
    host.appendChild(wrapper);
    syncValue(codemirror, propsRef.current.value);
    codemirror.refresh();

    // the handlers are read from the latest props when an event fires
    const listeners = (Object.keys(events) as (keyof typeof events)[]).map(
      (prop) => {
        const listener: Handler = (ed, event) =>
          propsRef.current[prop]?.(ed, event);
        codemirror.on(events[prop] as any, listener as any);
        return [events[prop], listener] as const;
      }
    );
    const cleanup = propsRef.current.editorDidMount?.(codemirror);

    return () => {
      cleanup?.();
      for (const [name, listener] of listeners) {
        codemirror.off(name as any, listener as any);
      }
      wrapper.remove();
    };
  }, [codemirror]);

  // keep the document in step with the value it is given
  useLayoutEffect(() => {
    syncValue(codemirror, props.value);
  }, [codemirror, props.value]);

  const className = props.className
    ? "react-codemirror2 " + props.className
    : "react-codemirror2";
  return <div className={className} ref={hostRef} />;
};

export default CodeMirrorHost;
