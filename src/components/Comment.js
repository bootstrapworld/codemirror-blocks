import React, {PureComponent} from 'react';
import PropTypes from 'prop-types';

import {ASTNode} from '../ast';

export default class Comment extends PureComponent {
  static propTypes = {
    node: PropTypes.instanceOf(ASTNode),
    lockedTypes: PropTypes.instanceOf(Array).isRequired,
  }
  render() {
    const {node} = this.props;
    return (<span className="blocks-comment" id={node.id}>
              {node.comment.toString()}
            </span>);
  }
}
