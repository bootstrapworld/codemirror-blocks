// TODO: Remove this file

export function click() {
  return new MouseEvent('click', {bubbles: true});
}
export function dblclick() {
  return new MouseEvent('dblclick', {bubbles: true});
}
export function blur() {
  return new Event('blur', {bubbles: true});
}
export function keydown(keyCode, other={}) {
  let event = new CustomEvent('keydown', {bubbles: true});
  event.which = event.keyCode = keyCode;
  Object.assign(event, other);
  return event;
}
export function keypress(keyCode, other={}) {
  let event = new CustomEvent('keypress', {bubbles: true});
  event.which = event.keyCode = keyCode;
  Object.assign(event, other);
  return event;
}

export function pureevent(t) {
  return new CustomEvent(t, {bubbles: true});
}

export function dragstart(data={}) {
  let event = new CustomEvent('dragstart', {bubbles: true});
  event.dataTransfer = {
    data,
    setData(type, data) {
      this.data[type] = data;
    },
    getData(type) {
      return this.data[type];
    },
    setDragImage() {}
  };

  return event;
}
export function dragenter() {
  return new CustomEvent('dragenter', {bubbles: true});
}
export function dragleave() {
  return new CustomEvent('dragleave', {bubbles: true});
}
export function drop(dataTransfer) {
  let event = new CustomEvent('drop', {bubbles: true});
  event.dataTransfer = dataTransfer;
  return event;
}
export function cut() {
  return new CustomEvent('cut', {bubbles: true});
}

// from https://github.com/facebook/react/issues/10135#issuecomment-314441175
// endorsed by Dan Abramov
// https://github.com/facebook/react/issues/11095#issuecomment-334305739
export function setNativeValue(element, value) {
  const valueSetter = Object.getOwnPropertyDescriptor(element, 'value').set;
  const prototype = Object.getPrototypeOf(element);
  const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value').set;
  if (valueSetter && valueSetter !== prototypeValueSetter) {
    prototypeValueSetter.call(element, value);
  } else {
    valueSetter.call(element, value);
  }
}
