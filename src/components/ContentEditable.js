import React, {Component} from 'react';
import PropTypes from 'prop-types/prop-types';
import shallowequal from 'shallowequal';

/**
 * Single line contentEditable
 *
 * This component creates a span with contenteditable
 * It only supports one line content, so users are expected
 * to pass in onKeyDown and intercept the enter key
 */

function getInnerHTML(txt) {
  const el = document.createElement('div');
  el.textContent = txt;
  return el.innerHTML;
}

export default class ContentEditable extends Component {
  static defaultProps = {
    onChange: () => {},
    onKeyDown: () => {},
    itDidMount: () => {},
    value: '',
  }

  static propTypes = {
    onChange: PropTypes.func,
    onKeyDown: PropTypes.func,
    itDidMount: PropTypes.func,
    value: PropTypes.string,
    id: PropTypes.string,
    'aria-label': PropTypes.string,
  }

  handleChange = _ => {
    this.props.onChange(this.elem.textContent);
  }

  handleKeyDown = e => {
    if (e.keyCode === 13 && !e.shiftKey) { // ENTER
      e.preventDefault();
    }
    e.stopPropagation();
    this.props.onKeyDown(e);
  }

  handlePaste = ev => {
    ev.preventDefault();
    const text = ev.clipboardData.getData('text');
    document.execCommand('insertText', false, text);
  }

  componentDidMount() {
    this.props.itDidMount(this.elem);
    this.elem.spellcheck = false;
    this.elem.focus();
  }

  shouldComponentUpdate(props) {
    const {value: newValue, 'aria-label': newAriaLabel, ...newProps} = props;
    const {value: oldValue, 'aria-label': oldAriaLabel, ...oldProps} = this.props;
    return (
      (getInnerHTML(newValue) !== this.elem.innerHTML) ||
       !shallowequal(newProps, oldProps)
    );
  }

  render () {
    const {value, itDidMount, ...props} = this.props;
    return (
      <span
        {...props}
        ref={elem => this.elem = elem}
        dangerouslySetInnerHTML={{__html: getInnerHTML(value)}}
        contentEditable={true}
        onInput={this.handleChange}
        onKeyDown={this.handleKeyDown}
        onPaste={this.handlePaste} />
    );
  }
}
