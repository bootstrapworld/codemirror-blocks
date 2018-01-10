import React, {Component} from 'react';
import PropTypes from 'prop-types';

import Node from '../../../components/Node';
import {Literal as LiteralASTNode} from '../../../ast';

export default class Literal extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(LiteralASTNode),
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired,
    }).isRequired
  }

  render() {
    const {node, helpers} = this.props;
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