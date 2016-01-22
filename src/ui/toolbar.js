import React from 'react';

function Primitive(props) {
  return <li className="Primitive list-group-item">{props.primitive}</li>;
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
    let primitives = parser.primitives || [];
    primitives = primitives.filter(p => p.indexOf(this.state.search) >= 0);
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
          <ul className="list-group">
           {primitives.map(p => <Primitive key={p} primitive={p} />)}
          </ul>
        </div>
      </div>
    );
  }
});
