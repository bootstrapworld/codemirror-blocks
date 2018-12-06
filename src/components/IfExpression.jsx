import React from 'react';
import PropTypes from 'prop-types';
import Component from './BlockComponent';

import {IfExpression as ASTIfExpressionNode} from '../ast';
import Node from './Node';
import DropTarget from './DropTarget';

export default class IfExpression extends Component {
  static propTypes = {
    node: PropTypes.instanceOf(ASTIfExpressionNode).isRequired,
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
        <span className="blocks-operator">if</span>
        <div className="blocks-cond-table">
          <div className="blocks-cond-row">
            <div className="blocks-cond-predicate">
              <DropTarget location={node.testExpr.from}
                          editable={this.state.editableList[0]}
                          onSetEditable={this.handleSetEditable(0)} />
              {helpers.renderNodeForReact(node.testExpr)}
            </div>
            <div className="blocks-cond-result">
              <DropTarget location={node.thenExpr.from}
                          editable={this.state.editableList[1]}
                          onSetEditable={this.handleSetEditable(1)} />
              {helpers.renderNodeForReact(node.thenExpr)}
            </div>
          </div>
          <div className="blocks-cond-row">
            <div className="blocks-cond-predicate blocks-cond-else">
              else
            </div>
            <div className="blocks-cond-result">
              <DropTarget location={node.elseExpr.from}
                          editable={this.state.editableList[2]}
                          onSetEditable={this.handleSetEditable(2)} />
              {helpers.renderNodeForReact(node.elseExpr)}
            </div>
            <div className="blocks-cond-result">
              <DropTarget location={node.elseExpr.to}
                          editable={this.state.editableList[3]}
                          onSetEditable={this.handleSetEditable(3)} />
            </div>
          </div>
        </div>
      </Node>
    );
  }
}

