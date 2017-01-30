import React, {PureComponent, PropTypes} from 'react';

import {ASTNode} from '../ast';

export default class Comment extends PureComponent {
  static propTypes = {
    node: PropTypes.instanceOf(ASTNode)
  }
  render() {
    const {node} = this.props;
    return (<span className="blocks-comment">
        {node.comment.toString()}
        </span>)
  }
}
