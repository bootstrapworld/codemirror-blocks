import React from "react";
import ContentEditable, { ContentEditableEvent } from "react-contenteditable";
import type { Props as ContentEditableProps } from "react-contenteditable";

/**
 * Single line contentEditable
 *
 * This component creates a span with contenteditable
 * It only supports one line content, so users are expected
 * to pass in onKeyDown and intercept the enter key.
 *
 * There are a number of tricky issues when using content editable
 * html components with react, which is why we use the react-contenteditable
 * library. In short, a naive use of contenteditable in react causes the
 * caret position to change on every update.
 * See this stackoverflow answer for an overview:
 * https://stackoverflow.com/questions/22677931/react-js-onchange-event-for-contenteditable/27255103#27255103
 *
 * To test this component manually, fire up the block editor and double click
 * on a leaf node to edit it. Typing in the leaf node should not result in
 * the caret moving to the beginning on every keypress.
 */

// use a plaintext INPUT elt to avoid characters being
// converted to html entities ()
function getInnerHTML(txt: string) {
  const el = document.createElement("input");
  el.value = txt;
  return el.value;
}

export type Props = Omit<
  ContentEditableProps,
  | "html"
  | "onChange"
  | "tagName"
  | "spellCheck"
  | "onKeyDown"
  | "onPaste"
  | "innerRef"
  | "ref"
> & {
  onChange?: (e: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  value?: string;
};

function OneLineContentEditable(
  props: Props & { forwardedRef: React.Ref<HTMLElement> }
) {
  const { value, onChange, onKeyDown, forwardedRef, ...rest } = props;

  const handleChange = (event: ContentEditableEvent) => {
    onChange && onChange(event.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.keyCode === 13 && !e.shiftKey) {
      // ENTER
      e.preventDefault();
    }
    e.stopPropagation();
    onKeyDown && onKeyDown(e);
  };

  const handlePaste = (ev: React.ClipboardEvent) => {
    ev.preventDefault();
    const text = ev.clipboardData.getData("text");
    document.execCommand("insertText", false, text);
  };

  return (
    <ContentEditable
      {...rest}
      html={getInnerHTML(value ?? "")}
      onChange={handleChange}
      tagName="span"
      spellCheck={false}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      innerRef={forwardedRef || undefined}
    />
  );
}

export default React.forwardRef<HTMLElement, Props>((props, ref) => (
  <OneLineContentEditable {...props} forwardedRef={ref} />
));
