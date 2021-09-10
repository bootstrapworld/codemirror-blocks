import React, { Component } from "react";
import PropTypes from "prop-types";
import shallowequal from "shallowequal";

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
  itDidMount?: Function;
  value?: string;
  id?: string;
  "aria-label"?: string;
};

export default class ContentEditable extends Component<ContentEditableProps> {
  static defaultProps = {
    onChange: () => {},
    onKeyDown: () => {},
    itDidMount: () => {},
    value: "",
  };

  static propTypes = {
    onChange: PropTypes.func,
    onKeyDown: PropTypes.func,
    itDidMount: PropTypes.func,
    value: PropTypes.string,
    id: PropTypes.string,
    "aria-label": PropTypes.string,
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

  /*eslint no-unused-vars: "off"*/
  shouldComponentUpdate(props: ContentEditableProps) {
    const { value: newValue, "aria-label": newAriaLabel, ...newProps } = props;
    const {
      value: oldValue,
      "aria-label": oldAriaLabel,
      ...oldProps
    } = this.props;
    return (
      getInnerHTML(newValue) !== this.eltRef.current.textContent ||
      !shallowequal(newProps, oldProps)
    );
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
