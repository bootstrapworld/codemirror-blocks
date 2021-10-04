import { fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ASTNode } from "../ast";

// These exported functions simulate browser events for testing.
// They use React's test utilities whenever possible.
//
// - `node` is the DOM element being interacted with. You may also pass an
//   `ASTNode` here, and its `.element` field will be used.
// - `key` is the name of a keyboard key, given by the `.key` property:
//   https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key
//   (You can also just look at the table in the source code below.)
// - `props` sets other properties on the event (whatever you like).

type ElementLike = Node | Element | ASTNode;

export function click(node: ElementLike) {
  fireEvent.click(toElement(node));
}
export function mouseDown(node: ElementLike) {
  fireEvent.mouseDown(toElement(node));
}
export function doubleClick(node: ElementLike) {
  fireEvent.doubleClick(toElement(node));
}
export function blur(node: ElementLike = document.activeElement) {
  fireEvent.blur(toElement(node));
}
export function paste(
  pastedString: string,
  node: ElementLike = document.activeElement
) {
  var dT = null;
  try {
    dT = new DataTransfer();
  } catch (e) {
    console.error("ERR in paste()");
  }
  var pasteEvent = new ClipboardEvent("paste", { clipboardData: dT });
  pasteEvent.clipboardData.setData("text/plain", pastedString);
  toElement(node).dispatchEvent(pasteEvent);
  //userEvent.paste(toElement(node), pastedString);
}
export function cut(node: ElementLike = document.activeElement) {
  fireEvent.cut(toElement(node));
}

function createBubbledEvent(type: string, props = {}) {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, props);
  return event;
}

export function drop() {
  let ans = createBubbledEvent("drop");
  return ans;
}

export function dragstart() {
  let ans = createBubbledEvent("dragstart");
  return ans;
}

export function dragover(node: ElementLike = document.activeElement) {
  toElement(node).dispatchEvent(createBubbledEvent("dragover"));
}

export function mouseenter() {
  return createBubbledEvent("mouseenter");
}

export function dragenter() {
  return createBubbledEvent("dragenter");
}

export function mouseover() {
  return createBubbledEvent("mouseover");
}

export function dragenterSeq(node: ElementLike = document.activeElement) {
  //toElement(node).dispatchEvent(mouseenter());
  toElement(node).dispatchEvent(dragenter());
  toElement(node).dispatchEvent(mouseover());
}

export function dragleave() {
  return createBubbledEvent("dragleave");
}

export function mouseleave() {
  return createBubbledEvent("mouseleave");
}

export function dragend() {
  return createBubbledEvent("dragend");
}

class CustomKeydownEvent extends CustomEvent<any> {
  which: number;
  keyCode: number;
  constructor(key: string) {
    super("keydown", { bubbles: true });
    this.which = this.keyCode = getKeyCode(key);
  }
}

// TODO: document.activeElement isn't always a good default to dispatch to.
// What does the _browser_ dispatch to?
export function keyDown(
  key: string,
  props = {},
  node: ElementLike = document.activeElement
) {
  node = toElement(node);
  // NOTE(Emmanuel): if it's a textarea, use native browser events
  if (node.nodeName == "TEXTAREA") {
    let event = new CustomKeydownEvent(key);
    Object.assign(event, props);
    node.dispatchEvent(event);
  } else {
    fireEvent.keyDown(node, makeKeyEvent(key, props));
  }
}
export function keyPress(
  key: string,
  props = {},
  node = document.activeElement
) {
  fireEvent.keyPress(toElement(node), makeKeyEvent(key, props));
}
export function insertText(text: string) {
  if (
    document.activeElement.tagName == "textarea" ||
    document.activeElement.tagName == "input"
  ) {
    userEvent.type(document.activeElement, text);
  } else {
    // this is some contenteditable node, so use an input event.
    // See https://github.com/testing-library/dom-testing-library/pull/235
    // for some discussion about this.
    fireEvent.input(document.activeElement, {
      target: { innerHTML: text },
    });
  }
}

// -------------------------------------------------------------------------- //

// Given a key name (like "Enter"), fill out the props properties that a key
// event should have (like `.keyCode=13`).
function makeKeyEvent<T extends {}>(key: string, props: T) {
  let keyCode = getKeyCode(key);
  let eventProps = {
    which: keyCode, // deprecated
    keyCode: keyCode, // deprecated
    key: key, // Good!
    ...props,
  };
  return eventProps;
}

// Convert a `.key` value to its corresponding keycode. The official table can
// be found here:
// https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values
function getKeyCode(key: string): number {
  // The key code for an (uppercase) letter is that letter's ascii value.
  if (key.match(/^[A-Z]$/)) {
    return key.charCodeAt(0);
  }
  // The key code for a digit is that digit's ascii value.
  if (key.match(/^[0-9]$/)) {
    return key.charCodeAt(0);
  }
  // These key names must match the `.key` event property!
  // https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values
  switch (key) {
    case "Enter":
      return 13;
    case "Tab":
      return 9;
    case " ":
      return 32;
    case "ArrowLeft":
      return 37;
    case "ArrowRight":
      return 39;
    case "ArrowDown":
      return 40;
    case "ArrowUp":
      return 38;
    case "Home":
      return 36;
    case "End":
      return 35;
    case "PageUp":
      return 33;
    case "PageDown":
      return 34;
    case "Backspace":
      return 8;
    case "Delete":
      return 46;
    case "Escape":
      return 27;
    case "F3":
      return 114;
    case "[":
      return 219;
    case "]":
      return 221;
    case "/":
      return 191;
    case "<":
      return 188;
    // If you extend this, make sure to match the official table linked above.
    default:
      throw new Error("Unknown key: " + key);
  }
}

// Return either `node` or `node.element`, whichever is an instance of a DOM
// element. If neither is, throw an error.
function toElement(node: ElementLike): Element | Node {
  if (node instanceof Element || node instanceof Node) {
    return node;
  }
  if (node && node.element instanceof Element) {
    return node.element;
  }
  throw new Error("Cannot convert value into a DOM node:" + node);
}
