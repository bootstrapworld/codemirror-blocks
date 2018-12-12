import React  from 'react';
import PropTypes from 'prop-types';
import Component from './BlockComponent';

import {Blank as ASTBlankNode} from '../ast';
import Node from './Node';

export default class extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTBlankNode).isRequired,
    lockedTypes: PropTypes.instanceOf(Array).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired,
    }).isRequired,
  }
  render() {
    const {node, lockedTypes, helpers, ...restProps} = this.props;
    return (
      <Node node={node}
            lockedTypes={lockedTypes}
            normallyEditable={true}
            expandable={false}
            helpers={helpers}
            {...restProps} >
        <span className="blocks-literal-symbol" />
      </Node>
    );
  }
}
