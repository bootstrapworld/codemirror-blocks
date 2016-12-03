import React, {Component} from 'react';
import ReactDOM from 'react-dom';

import Node from '../../../components/Node';

export default class Literal extends Component {
  render() {
    const {node} = this.props;
    return (
      <Node type="literal" node={node}>
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
