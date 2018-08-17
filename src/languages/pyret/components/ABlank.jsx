import React, {Component} from 'react';
import PropTypes from 'prop-types';

import {ABlank as ABlankNode} from '../ast';
import Node from '../../../components/Node';

export default class ABlank extends Component {
  // Boilerplate
  static propTypes = {
    node: PropTypes.instanceOf(ABlankNode).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired
    }).isRequired,
    lockedTypes: PropTypes.instanceOf(Array).isRequired
  }

  render() {
    const {node, helpers, lockedTypes} = this.props;
    return (
      <Node node={node} lockedTypes={lockedTypes} helpers={helpers}>
        <span className={`blocks-literal-symbol`}>
          BLANK // TODO
        </span>
      </Node>
    );
  }
}
