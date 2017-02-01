import React, {Component, PropTypes} from 'react';

import Node from '../../../components/Node';
import {Literal as LiteralASTNode} from '../../../ast';

export default class Literal extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(LiteralASTNode),
  }

  render() {
    const {node} = this.props;
    return (
      <Node type="prog" node={node}>
        <h4>Your Lambda Program</h4>
        {node.prog.map((node, index) => (
             <span key={index}>
               {helpers.renderNodeForReact(node)}
             </span>
           ))}
      </Node>
    );
  }
}