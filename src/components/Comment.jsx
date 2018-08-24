import React  from 'react';
import PropTypes from 'prop-types';
import Component from './BlockComponent';
import {ASTNode} from '../ast';

export default class Comment extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTNode),
    lockedTypes: PropTypes.instanceOf(Array).isRequired,
  }
  render() {
    const {node} = this.props;
    return (<span className="blocks-comment" id={node.id} aria-hidden="true">
      <span className="screenreader-only">Has comment,</span> {node.comment.toString()}
    </span>);
  }
}
