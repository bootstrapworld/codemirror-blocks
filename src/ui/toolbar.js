import React from 'react';
import PrimitiveList from './PrimitiveList';

require('./Toolbar.less');

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

export default React.createClass({
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
