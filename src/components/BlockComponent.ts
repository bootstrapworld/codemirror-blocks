import { Component } from 'react';
import PropTypes from 'prop-types';
import type { ASTNode } from '../ast';

// Check to see whether two `prop` or `state` objects are roughly equal to each
// other, enough so that we don't need to re-render a node if that's all that
// changed.
function vaguelyEqual(x:{[i:string]:any}, y:{[i:string]:any}) {
  const ignoreProps = ["location", "children", "ast", "hash"];
  function ignoreProp(object:{[i:string]:any}, prop: string) {
    // There _shouldn't_ be any relevant differences between functions in `props`.
    // We hope, we hope.
    return ignoreProps.includes(prop) || typeof object[prop] === "function";
  }
  
  if (x === y) {
    return true;
  }
  for (let prop in x) {
    if (Object.prototype.hasOwnProperty.call(x,prop)
     && !ignoreProp(x, prop) && x[prop] !== y[prop]) {
      return false;
    }
  }
  for (let prop in y) {
    if (Object.prototype.hasOwnProperty.call(y,prop) 
      && !ignoreProp(y, prop) && y[prop] !== x[prop]) {
      return false;
    }
  }
  return true;
}

export default class BlockComponent<Props extends {node: ASTNode}, State> extends Component<Props, State> {

  // update if one of the nodes is null, the hash has changed, the props or state
  // have changed, or if the aria properties have changed
  shouldComponentUpdate(props: Props, state: State) {
    // NOTE: don't care about the node since the patching algorithm will deal
    // with the update already
    const {node: newValue, ...newProps} = props;
    const {node: oldValue, ...oldProps} = this.props;

    const shouldUpdate = (
      !(newValue && oldValue) ||
      (newValue.hash !== oldValue.hash) ||
      !vaguelyEqual(newProps, oldProps) ||
      !vaguelyEqual(state, this.state) ||
      (newValue['aria-setsize']  !== oldValue['aria-setsize']) ||
      (newValue['aria-posinset'] !== oldValue['aria-posinset'])
    );
    
    return shouldUpdate;
  }
}