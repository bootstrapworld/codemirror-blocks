import React from 'react';

function Primitive(props) {
  let primitive = props.primitive;
  let returnType = null;
  let argumentTypes = null;
  if (typeof props.primitive == 'object') {
    primitive = props.primitive.name;
  }
  return <li className="Primitive list-group-item">{primitive}</li>;
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

function PrimitiveList(props) {
  let nodes = [];
  for (let primitive of props.primitives) {
    if (typeof primitive == 'string') {
      nodes.push(<Primitive key={primitive} primitive={primitive} />);
    } else if (typeof primitive == 'object') {
      if (primitive.primitives) {
        // this is a group.
        nodes.push(
          <li className="primitive-group list-group-item" key={primitive.name}>
            {primitive.name}
            <PrimitiveList primitives={primitive.primitives} />
          </li>
        );
      } else {
        // this is just a primitive with additional config
        nodes.push(<Primitive key={primitive.name} primitive={primitive} />);
      }
    } else {
      console.error("can't understand primitive", primitive);
    }
  }
  return <ul className="list-group">{nodes}</ul>;
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

  render() {
    let parser = this.props.blocks.parser;
    let primitives = filterPrimitives(parser.primitives || [], this.state.search);
    return (
      <div className="blocks-ui Toolbar">
        <div className="search-box">
          <input type="search"
                 placeholder="Search"
                 className="form-control"
                 value={this.state.search}
                 onChange={this.changeSearch}
                 />
        </div>
        <div className="primitives-box">
          <PrimitiveList primitives={primitives} />
        </div>
      </div>
    );
  }
});
