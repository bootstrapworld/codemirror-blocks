import React  from 'react';
import PropTypes from 'prop-types';
import {Literal as ASTLiteralNode} from '../ast';
import Node from './Node';
import Component from './BlockComponent';

export default class Literal extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTLiteralNode).isRequired,
    lockedTypes: PropTypes.instanceOf(Array).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired,
    }).isRequired,
  }

  render() {
    const {node, lockedTypes, helpers} = this.props;
    return (
      <Node node={node}
            lockedTypes={lockedTypes}
            normallyEditable={true}
            expandable={false}
            helpers={helpers}>
        <span className={`blocks-literal-${node.dataType}`}>
          {node.value.toString()}
        </span>
      </Node>
    );
  }
}
