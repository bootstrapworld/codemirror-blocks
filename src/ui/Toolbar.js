import React, {Component} from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import PrimitiveList from './PrimitiveList';
import PrimitiveBlock from './PrimitiveBlock';
import {PrimitiveGroup} from '../parsers/primitives';
import './Toolbar.less';

export default class Toolbar extends Component {
  constructor(props) {
    super(props);
    this.selectPrimitive = this.selectPrimitive.bind(this);
  }

  static propTypes = {
    primitives: PropTypes.instanceOf(PrimitiveGroup),
    languageId: PropTypes.string, // used to find the .blocks-language-{languageId} CSS class
  }

  static defaultProps = {
    primitives: null
  }

  state = {
    search: '',
    selectedPrimitive: null,
  }

  changeSearch = (event) => {
    this.setState({search: event.target.value});
  }

  clearSearch = () => {
    this.setState({search: ''});
  }

  checkEscape = (event) => {
    if (event.key == 'Escape') {
      event.target.blur();
      event.preventDefault();
    }
  }

  selectPrimitive(selectedPrimitive) {
    if (selectedPrimitive === this.state.selectedPrimitive) {
      selectedPrimitive = null;
    }
    this.setState({selectedPrimitive});
  }

  render() {
    let primitives = [];
    if (this.props.primitives) {
      primitives = this.props.primitives.filter(this.state.search).primitives;
    }
    const selected = this.state.selectedPrimitive;
    return (
      <div className={classNames('blocks-ui Toolbar', {'has-selected':!!selected})}>
        <div className="search-box">
          <label className="screenreader-only" htmlFor="search_box">
            <h2>Search Functions</h2>
          </label>            
          <input type="search"
            id="search_box"
            placeholder="Search functions"
            className="form-control"
            value={this.state.search}
            onKeyDown={this.checkEscape}
            onChange={this.changeSearch} />
          {this.state.search ?
            <span className="glyphicon glyphicon-remove" onClick={this.clearSearch} />
            : null}
        </div>
        <div className="primitives-box">
          <PrimitiveList
            primitives={primitives}
            onSelect={this.selectPrimitive}
            selected={this.state.selectedPrimitive}
            />
        </div>
        <div className={classNames('selected-primitive', `blocks-language-${this.props.languageId}`)}>
          <div className="contract-header">Contract</div>
          <PrimitiveBlock primitive={selected}/>
        </div>
      </div>
    );
  }
}
