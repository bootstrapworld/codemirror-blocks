import React from 'react';
import classNames from 'classnames';

import Highlight from './Highlight';

require('./PrimitiveList.less');

function Primitive({primitive, highlight, className, onClick}) {
  let returnType = null;
  let argumentTypes = null;
  if (typeof primitive == 'object') {
    primitive = primitive.name;
  }
  return (
    <li className={classNames(className, "Primitive list-group-item")}
        onClick={onClick}>
      <Highlight highlight={highlight}>{primitive}</Highlight>
    </li>
  );
}

var PrimitiveGroup = React.createClass({

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

export default React.createClass({
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
      let key = primitive;
      if (typeof primitive == 'object') {
        key = primitive.name;
        if (primitive.primitives) {
          // this is a group.
          nodes.push(
            <PrimitiveGroup
              key={key}
              group={primitive}
              highlight={highlight}
              onSelect={onSelect}
              selected={selected}
            />
          );
          continue;
        }
      } else if (typeof primitive !== 'string') {
        console.error("can't understand primitive", primitive);
        continue;
      }
      nodes.push(
        <Primitive
          key={key}
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
