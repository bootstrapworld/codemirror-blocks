import React from 'react';
import PropTypes from 'prop-types';
import Component from './BlockComponent';

import {CondClause as ASTCondClauseNode} from '../ast';
import Node from './Node';
import DropTarget from './DropTarget';

export default class CondClause extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTCondClauseNode).isRequired,
    helpers: PropTypes.shape({
      renderNodeForReact: PropTypes.func.isRequired,
    }).isRequired,
    lockedTypes: PropTypes.instanceOf(Array).isRequired,
  }

  state = {editableList: {}}
  handleSetEditableArr = {}
  handleSetEditable = i => {
    if (!this.handleSetEditableArr[i]) {
      this.handleSetEditableArr[i] = b => {
        this.setState({editableList: {...this.state.editableList, [i]: b}});
      };
    }
    return this.handleSetEditableArr[i];
  }

  render() {
    const {node, helpers, lockedTypes} = this.props;
    return (
      <Node node={node} lockedTypes={lockedTypes} helpers={helpers}>
        <div className="blocks-cond-row">
          <div className="blocks-cond-predicate">
            <DropTarget location={node.testExpr.from}
                        editable={this.state.editableList[0]}
                        onSetEditable={this.handleSetEditable(0)} />
             {helpers.renderNodeForReact(node.testExpr)}
          </div>
          <div className="blocks-cond-result">
            {node.thenExprs.map((thenExpr, index) => (
              <span key={index}>
                <DropTarget location={thenExpr.from}
                            editable={this.state.editableList[index+1]}
                            onSetEditable={this.handleSetEditable(index+1)} />
                {helpers.renderNodeForReact(thenExpr)}
              </span>))}
          </div>
        </div>
        <DropTarget
          location={node.from}
          editable={this.state.editableList[node.thenExprs.length + 1]}
          onSetEditable={this.handleSetEditable(node.thenExprs.length + 1)} />
      </Node>
    );
  }
}
