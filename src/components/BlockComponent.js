import {Component} from 'react';
import shallowequal from 'shallowequal';

export default class BlockComponent extends Component {
  shouldComponentUpdate(props, state) {
    // NOTE: don't care about the node since the patching algorithm will deal
    // with the update already
    const {node: newValue, ...newProps} = props;
    const {node: oldValue, ...oldProps} = this.props;

    console.log('working on', oldValue);
    console.log('ans', !shallowequal(newProps, oldProps) || !shallowequal(state, this.state));

    return !shallowequal(newProps, oldProps) || !shallowequal(state, this.state);
  }
}
