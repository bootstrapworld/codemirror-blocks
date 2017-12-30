import React, {Component} from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import PrimitiveList from './PrimitiveList';
import PrimitiveBlock from './PrimitiveBlock';
import {PrimitiveGroup} from '../parsers/primitives';
import Renderer from '../Renderer';

require('./Toolbar.less');

export default class Toolbar extends Component {
  static propTypes = {
    primitives: PropTypes.instanceOf(PrimitiveGroup),
    renderer: PropTypes.instanceOf(Renderer).isRequired,
    contractStyleClass: PropTypes.instanceOf(String),
  }

  static childContextTypes = {
    renderer: PropTypes.instanceOf(Renderer).isRequired,
  }

  static defaultProps = {
    primitives: null
  }

  getChildContext() {
    return {
      renderer: this.props.renderer,
    };
  }

  state = {
    search: '',
    selectedPrimitive: null,
  }

  changeSearch = (event) => {
    this.setState({search: event.target.value});
  }

  clearSearch = (_) => {
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
    let selected = this.state.selectedPrimitive;
    return (
      <div className={classNames('blocks-ui Toolbar', {'has-selected':!!selected})}>
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
          <PrimitiveList
            primitives={primitives}
            onSelect={this.selectPrimitive}
            selected={this.state.selectedPrimitive}
          />
        </div>
        <div className={classNames('selected-primitive', this.props.contractStyleClass)}>
          <div className="contract-header">Contract</div>
          <PrimitiveBlock primitive={selected}/>
        </div>
      </div>
    );
  }
}
