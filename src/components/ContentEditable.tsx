import React, { Component } from "react";
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
  itDidMount?: (el: HTMLElement) => void;
  value?: string;
};

export default class OneLineContentEditable extends Component<Props> {
  static defaultProps = {
    onChange: () => {},
    onKeyDown: () => {},
    itDidMount: () => {},
    value: "",
  };

  eltRef: React.RefObject<HTMLElement>;

  constructor(props: Props) {
    super(props);
    this.eltRef = React.createRef();
  }

  handleChange = (event: ContentEditableEvent) => {
    this.props.onChange(event.target.value);
  };

  handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.keyCode === 13 && !e.shiftKey) {
      // ENTER
      e.preventDefault();
    }
    e.stopPropagation();
    this.props.onKeyDown(e);
  };

  handlePaste = (ev: React.ClipboardEvent) => {
    ev.preventDefault();
    const text = ev.clipboardData.getData("text");
    document.execCommand("insertText", false, text);
  };

  componentDidMount() {
    this.props.itDidMount(this.eltRef.current);
  }

  render() {
    const { value, itDidMount, onChange, ...props } = this.props;
    return (
      <ContentEditable
        {...props}
        html={getInnerHTML(value)}
        onChange={this.handleChange}
        tagName="span"
        spellCheck={false}
        onKeyDown={this.handleKeyDown}
        onPaste={this.handlePaste}
        innerRef={this.eltRef}
      />
    );
  }
}
