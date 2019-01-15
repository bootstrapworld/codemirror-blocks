import React, {Component} from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import {PrimitiveGroup as PrimitiveGroupModel} from '../parsers/primitives';
import {RenderedBlockNode} from './PrimitiveBlock';
import {Primitive as LanguagePrimitive} from '../parsers/primitives';

require('./PrimitiveList.less');

class Primitive extends Component {
  static propTypes = {
    primitive: PropTypes.instanceOf(LanguagePrimitive).isRequired,
    className: PropTypes.string.isRequired,
    onClick: PropTypes.instanceOf(Function).isRequired,
  }

  render() {
    var {primitive, className, onClick} = this.props;
    let astNode = primitive.getLiteralNode();
    astNode.inToolbar = true;
    const elem = astNode ? astNode.reactElement() : primitive.name;
    return (
      <li className={classNames(className, "Primitive list-group-item")} onClick={onClick}>
        {elem}
      </li>
    );
  }
}

class PrimitiveGroup extends Component {
  static defaultProps = {
    group: {
      name: '',
      primitives: []
    },
    onSelect: null,
    selected: null,
  }

  static propTypes = {
    //group: PropTypes.instanceOf(ASTFunctionDefinitionNode).isRequired,
    onSelect: PropTypes.instanceOf(Function).isRequired,
    selected: PropTypes.instanceOf(String), // to start, no primitive is selected
  }

  state = {
    expanded: false
  }

  toggleExpanded = () => {
    this.setState({expanded: !this.state.expanded});
  }

  render() {
    let {group, onSelect, selected} = this.props;
    let expanded = this.state.expanded;
    let expandoClass = classNames(
      'glyphicon',
      expanded ? 'glyphicon-minus' : 'glyphicon-plus'
    );
    return (
      <li className="PrimitiveGroup list-group-item" role="list">
        <div onClick={this.toggleExpanded} className="group-header">
          <span className={expandoClass} aria-hidden="true"/>
        </div>
        {expanded ?
          <PrimitiveList
            primitives={group.primitives}
            onSelect={onSelect}
            selected={selected}
          />
          : null}
      </li>
    );
  }
}

export default class PrimitiveList extends Component {
  static defaultProps = {
    primitive: null,
    onSelect: null,
    selected: null,
  }

  static propTypes = {
    onSelect: PropTypes.instanceOf(Function).isRequired,
    selected: PropTypes.instanceOf(String),
  }
  render() {
    const {primitives, selected} = this.props;
    const onSelect = this.props.onSelect || function(){};
    let nodes = [];
    for (let primitive of primitives) {
      if (primitive instanceof PrimitiveGroupModel) {
        // this is a group.
        nodes.push(
          <PrimitiveGroup
            key={primitive.name}
            group={primitive}
            onSelect={onSelect}
            selected={selected}
          />
        );
        continue;
      }
      nodes.push(
        <Primitive
          key={primitive.name}
          primitive={primitive}
          onClick={() => onSelect(primitive)}
          className={selected == primitive ? 'selected' : ''}
        />
      );

    }
    return (
      <div>
        <h3 id="toolbar_heading" className="screenreader-only">Built-ins</h3>
        <ul className="PrimitiveList list-group" tabIndex="0" aria-labelledby="toolbar_heading">{nodes}</ul>
      </div>
    );
  }
}
