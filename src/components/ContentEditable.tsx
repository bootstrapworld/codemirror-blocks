import React, { Component } from "react";

/**
 * Single line contentEditable
 *
 * This component creates a span with contenteditable
 * It only supports one line content, so users are expected
 * to pass in onKeyDown and intercept the enter key
 */

// use a plaintext INPUT elt to avoid characters being
// converted to html entities ()
function getInnerHTML(txt: string) {
  const el = document.createElement("input");
  el.value = txt;
  return el.value;
}

export type ContentEditableProps = Omit<
  React.ComponentPropsWithoutRef<"span">,
  "onChange"
> & {
  onChange?: (e: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  itDidMount?: (el: HTMLElement) => void;
  value?: string;
};

export default class ContentEditable extends Component<ContentEditableProps> {
  static defaultProps = {
    onChange: () => {},
    onKeyDown: () => {},
    itDidMount: () => {},
    value: "",
  };

  eltRef: React.RefObject<HTMLSpanElement>;

  constructor(props: ContentEditableProps) {
    super(props);
    this.eltRef = React.createRef();
  }

  handleChange = () => {
    this.props.onChange(this.eltRef.current.textContent);
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
      <span
        {...props}
        ref={this.eltRef}
        dangerouslySetInnerHTML={{ __html: getInnerHTML(value) }}
        contentEditable={"plaintext-only" as any}
        spellCheck={false}
        onInput={this.handleChange}
        onKeyDown={this.handleKeyDown}
        onPaste={this.handlePaste}
      />
    );
  }
}
