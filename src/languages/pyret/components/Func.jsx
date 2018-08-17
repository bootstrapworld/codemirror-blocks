import React, {Component} from 'react';
import PropTypes from 'prop-types';

import {Func as FuncNode} from '../ast';
import Node from '../../../components/Node';
import DropTarget from '../../../components/DropTarget';

export default class Func extends Component {
  // Boilerplate
  static propTypes = {
    node: PropTypes.instanceOf(FuncNode).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired
    }).isRequired,
    lockedTypes: PropTypes.instanceOf(Array).isRequired
  }

  render() {
    const {node, helpers, lockedTypes} = this.props;
    let args = [];
    node.args.forEach((arg, index) => {
      args.push(helpers.renderNodeForReact(arg, 'node-'+index));
      args.push(<span className="blocks-drop-target blocks-white-space"
                      location={arg.to} key={'drop-'+index} />);
    });
    return (
      <Node node={node} lockedTypes={lockedTypes} helpers={helpers}>
        <span className="blocks-operator">
          <span className="blocks-literal-symbol">
            <DropTarget location={node.from} />
            {node.name}
            (<DropTarget location={args[0].from} />
            {args})
          </span>
        </span>
        <span className="blocks-args">
          {helpers.renderNodeForReact(node.body)}
        </span>
      </Node>
    );
  }
}
