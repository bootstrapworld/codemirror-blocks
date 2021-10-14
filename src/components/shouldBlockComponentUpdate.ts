import type { ASTNode } from "../ast";

// Check to see whether two `prop` or `state` objects are roughly equal to each
// other, enough so that we don't need to re-render a node if that's all that
// changed.
function vaguelyEqual(x: { [i: string]: any }, y: { [i: string]: any }) {
  const ignoreProps = ["location", "children", "ast", "hash"];
  function ignoreProp(object: { [i: string]: any }, prop: string) {
    // There _shouldn't_ be any relevant differences between functions in `props`.
    // We hope, we hope.
    return ignoreProps.includes(prop) || typeof object[prop] === "function";
  }

  if (x === y) {
    return true;
  }
  for (let prop in x) {
    if (
      Object.prototype.hasOwnProperty.call(x, prop) &&
      !ignoreProp(x, prop) &&
      x[prop] !== y[prop]
    ) {
      return false;
    }
  }
  for (let prop in y) {
    if (
      Object.prototype.hasOwnProperty.call(y, prop) &&
      !ignoreProp(y, prop) &&
      y[prop] !== x[prop]
    ) {
      return false;
    }
  }
  return true;
}

export default function shouldBlockComponentUpdate<
  Props extends { node: ASTNode },
  State
>(oldProps: Props, oldState: State, newProps: Props, newState: State) {
  // NOTE: don't care about the node since the patching algorithm will deal
  // with the update already
  const { node: newValue, ...newOtherProps } = newProps;
  const { node: oldValue, ...oldOtherProps } = oldProps;

  const shouldUpdate =
    !(newValue && oldValue) ||
    newValue.hash !== oldValue.hash ||
    !vaguelyEqual(newOtherProps, oldOtherProps) ||
    !vaguelyEqual(newState, oldState) ||
    newValue["aria-setsize"] !== oldValue["aria-setsize"] ||
    newValue["aria-posinset"] !== oldValue["aria-posinset"];

  return shouldUpdate;
}
