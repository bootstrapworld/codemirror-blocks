import {Component, PureComponent} from 'react';

function basicallyTheSame(x, y) {
  if (typeof x === "function" && typeof y === "function") {
    // There _shouldn't_ be any relevant differences between functions in `props`.
    // We hope, we hope.
    return true;
  }
  return x === y;
}

function shallowEqual(x, y) {
  if (x === y) {
    return true;
  }
  for (let prop in x) {
    if (prop === "location") break;
    if (x.hasOwnProperty(prop) && !basicallyTheSame(x[prop], y[prop])) {
      console.log("@PropChanged:", prop, x[prop], y[prop]);
      return false;
    }
  }
  for (let prop in y) {
    if (prop === "location") break;
    if (y.hasOwnProperty(prop) && !basicallyTheSame(y[prop], x[prop])) {
      console.log("@PropChanged:", prop, y[prop], x[prop]);
      return false;
    }
  }
  return true;
}

export default class BlockComponent extends Component {
  shouldComponentUpdate(props, state) {
    // NOTE: don't care about the node since the patching algorithm will deal
    // with the update already
    const {node: newValue, ...newProps} = props;
    const {node: oldValue, ...oldProps} = this.props;

    const c1 = newValue && oldValue && newValue.hash !== oldValue.hash;
    const c2 = !shallowEqual(newProps, oldProps);
    const c3 = !shallowEqual(state, this.state);

    console.log("@BlockComponent - should update?", oldValue, newValue);
    if (!c1 && c2) {
      console.log("@Rerendering b.c. props changed", oldProps, newProps);
    } else if (!c1 && c3) {
      console.log("@Rerendering b.c. state changed", this.state, state);
    }
    
    const shouldUpdate = (
      (newValue && oldValue && newValue.hash !== oldValue.hash) ||
        !shallowEqual(newProps, oldProps) ||
        !shallowEqual(state, this.state)
    );
    if (!shouldUpdate) {
      console.log("@Skipping!", oldValue);
    }
    return shouldUpdate;
  }
}
