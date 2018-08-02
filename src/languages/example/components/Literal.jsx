import React, {Component} from 'react';
import PropTypes from 'prop-types';

import Node from '../../../components/Node';
import {Literal as LiteralASTNode} from '../../../ast';

export default class Literal extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(LiteralASTNode),
    lockedTypes: PropTypes.instanceOf(Array).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired,
    }).isRequired,
  }

  render() {
    const {node, helpers, lockedTypes} = this.props;
    return (
      <Node node={node} helpers={helpers} lockedTypes={lockedTypes}>
        <span className="data-type">
          ({node.dataType})
        </span>
        <br />
        <span className={`blocks-literal-${node.dataType}`}>
          {node.toString()}
        </span>
      </Node>
    );
  }
}
