import React from 'react';
import classNames from 'classnames';

import Highlight from './Highlight';

require('./PrimitiveList.less');

function Primitive({primitive, highlight}) {
  let returnType = null;
  let argumentTypes = null;
  if (typeof primitive == 'object') {
    primitive = primitive.name;
  }
  return (
    <li className="Primitive list-group-item">
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
      highlight: ''
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
    let {group, highlight} = this.props;
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
          <PrimitiveList primitives={group.primitives}
                         highlight={highlight}/>
          : null}
      </li>
    );
  }
});

export default function PrimitiveList({primitives, highlight}) {
  let nodes = [];
  for (let primitive of primitives) {
    if (typeof primitive == 'string') {
      nodes.push(
        <Primitive key={primitive}
                   primitive={primitive}
                   highlight={highlight}/>
      );
    } else if (typeof primitive == 'object') {
      if (primitive.primitives) {
        // this is a group.
        nodes.push(
          <PrimitiveGroup key={primitive.name} group={primitive} highlight={highlight} />
        );
      } else {
        // this is just a primitive with additional config
        nodes.push(
          <Primitive key={primitive.name}
                     primitive={primitive}
                     highlight={highlight}/>);
      }
    } else {
      console.error("can't understand primitive", primitive);
    }
  }
  return <ul className="PrimitiveList list-group">{nodes}</ul>;
}
