import React from 'react';
import classNames from 'classnames';

require('./toolbar.less');

function Highlight({children: text, highlight, className}) {
  const classes = classNames("Highlight", className);
  let startIndex = text.indexOf(highlight);
  let endIndex = startIndex + highlight.length;

  if (!highlight || startIndex == -1) {
    return <span className={classes}>{text}</span>;
  }
  return (
    <span className={classes}>
      {text.slice(0, startIndex)}
      <span className="highlighted">{text.slice(startIndex, endIndex)}</span>
      {text.slice(endIndex)}
    </span>
  );
}

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

function PrimitiveList({primitives, highlight}) {
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

function filterPrimitives(primitives, search) {
  let result = [];
  for (let primitive of primitives) {
    if (typeof primitive == 'string') {
      if (primitive.indexOf(search) >= 0) {
        result.push(primitive);
      }
    } else if (typeof primitive == 'object') {
      // either a group or a primitive config
      if (primitive.name.indexOf(search) >= 0) {
        // let's display the entire group and/or primitive
        result.push(primitive);
      } else if (primitive.primitives) {
        // it's a group with a name that doesn't match
        // let's see if child primitives/groups match
        let filtered = filterPrimitives(primitive.primitives, search);
        if (filtered.length > 0) {
          // great, lets return a new group with just the sub-primitives
          // that matched
          result.push({name: primitive.name, primitives: filtered});
        }
      }
    }
  }
  return result;
}

export var Toolbar = React.createClass({
  displayName: 'Toolbar',

  getDefaultProps() {
    return {
      blocks: {parser:{}}
    };
  },

  getInitialState() {
    return {
      search: ''
    };
  },

  changeSearch(event) {
    this.setState({search: event.target.value});
  },

  clearSearch() {
    this.setState({search: ''});
  },

  checkEscape(event) {
    if (event.key == 'Escape') {
      event.target.blur();
      event.preventDefault();
    }
  },

  render() {
    let parser = this.props.blocks.parser;
    let primitives = filterPrimitives(parser.primitives || [], this.state.search);
    return (
      <div className="blocks-ui Toolbar">
        <div className="search-box">
          <input type="search"
                 placeholder="Search Primitives"
                 className="form-control"
                 value={this.state.search}
                 onKeyDown={this.checkEscape}
                 onChange={this.changeSearch} />

          {this.state.search ?
           <span className="glyphicon glyphicon-remove" onClick={this.clearSearch} />
           : null}
        </div>
        <div className="primitives-box">
          <PrimitiveList primitives={primitives} highlight={this.state.search}/>
        </div>
      </div>
    );
  }
});
