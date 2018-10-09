import {Component, PureComponent} from 'react';
import shallowequal from 'shallowequal';

export default class BlockComponent extends PureComponent {
  // shouldComponentUpdate(props, state) {
  //   // NOTE: don't care about the node since the patching algorithm will deal
  //   // with the update already
  //   const {node: newValue, ...newProps} = props;
  //   const {node: oldValue, ...oldProps} = this.props;

  //   const shouldUpdate = (
  //     (newValue && oldValue && newValue.id !== oldValue.id) ||
  //       !shallowequal(newProps, oldProps) ||
  //       !shallowequal(state, this.state)
  //   );
  //   // if (!shouldUpdate) {
  //   //   console.log('abort on ', oldValue);
  //   // }
  //   return shouldUpdate;
  // }
}
