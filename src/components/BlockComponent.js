import {Component, PureComponent} from 'react';

// Check to see whether two `prop` or `state` objects are roughly equal to each
// other, enough so that we don't need to re-render a node if that's all that
// changed.
function vaguelyEqual(x, y) {
  const ignoreProps = ["location", "children"];
  function ignoreProp(object, prop) {
    // There _shouldn't_ be any relevant differences between functions in `props`.
    // We hope, we hope.
    return ignoreProps.includes(prop) || typeof object[prop] === "function";
  }
  
  if (x === y) {
    return true;
  }
  for (let prop in x) {
    if (x.hasOwnProperty(prop) && !ignoreProp(x, prop) && x[prop] !== y[prop]) {
      return false;
    }
  }
  for (let prop in y) {
    if (y.hasOwnProperty(prop) && !ignoreProp(y, prop) && y[prop] !== x[prop]) {
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

    const shouldUpdate = (
      (newValue && oldValue && newValue.hash !== oldValue.hash) ||
        !vaguelyEqual(newProps, oldProps) ||
        !vaguelyEqual(state, this.state)
    );
    return shouldUpdate;
  }
}
