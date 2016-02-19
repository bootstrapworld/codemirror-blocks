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
