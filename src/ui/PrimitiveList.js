import React from 'react';
import classNames from 'classnames';

import {PrimitiveGroup as PrimitiveGroupModel} from '../parsers/primitives';
import {RenderedBlockNode} from './PrimitiveBlock';
import Highlight from './Highlight';

require('./PrimitiveList.less');

const Primitive = React.createClass({
  render() {
    var {primitive, className, onClick} = this.props;
    let astNode = primitive.getLiteralNode();
    return (
      <li className={classNames(className, "Primitive list-group-item")}
          onClick={onClick}>
        <RenderedBlockNode node={astNode} text={primitive.name} />
      </li>
    );
  },
});

const PrimitiveGroup = React.createClass({

  getDefaultProps() {
    return {
      group: {
        name: '',
        primitives: []
      },
      highlight: '',
      onSelect: null,
      selected: null,
    };
  },

  getInitialState() {
    return {
      expanded: false
    };
  },

  toggleExpanded() {
    this.setState({expanded: !this.state.expanded});
  },

  render() {
    let {group, highlight, onSelect, selected} = this.props;
    let expanded = this.state.expanded || this.props.highlight;
    let expandoClass = classNames(
      'glyphicon',
      expanded ? 'glyphicon-minus' : 'glyphicon-plus'
    );
    return (
      <li className="PrimitiveGroup list-group-item">
        <div onClick={this.toggleExpanded} className="group-header">
          <span className={expandoClass} aria-hidden="true"/>
          <Highlight className="group-name" highlight={highlight}>{group.name}</Highlight>
        </div>
        {expanded ?
          <PrimitiveList
            primitives={group.primitives}
            highlight={highlight}
            onSelect={onSelect}
            selected={selected}
          />
          : null}
      </li>
    );
  }
});

const PrimitiveList = React.createClass({
  displayName: 'PrimitiveList',

  getInitialProps() {
    return {
      primitive: null,
      highlight: '',
      onSelect: null,
      selected: null,
    };
  },

  render() {
    const {primitives, highlight, selected} = this.props;
    const onSelect = this.props.onSelect || function(){};
    let nodes = [];
    for (let primitive of primitives) {
      if (primitive instanceof PrimitiveGroupModel) {
        // this is a group.
        nodes.push(
          <PrimitiveGroup
            key={primitive.name}
            group={primitive}
            highlight={highlight}
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
          highlight={highlight}
          onClick={() => onSelect(primitive)}
          className={selected == primitive && 'selected'}
        />
      );

    }
    return (
      <ul className="PrimitiveList list-group">{nodes}</ul>
    );
  }
});

export default PrimitiveList;
