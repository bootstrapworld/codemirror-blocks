import React, {Component} from 'react';
import PropTypes from 'prop-types';

import {Bind as BindNode} from '../ast';
import Node from '../../../components/Node';

export default class Bind extends Component {
  // Boilerplate
  static propTypes = {
    node: PropTypes.instanceOf(BindNode).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired
    }).isRequired,
    lockedTypes: PropTypes.instanceOf(Array).isRequired
  }

  render() {
    const {node, helpers, lockedTypes} = this.props;
    return helpers.renderNodeForReact(node.id);
  }
}
