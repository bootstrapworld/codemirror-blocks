import React, {Component} from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import PrimitiveList from './PrimitiveList';
import PrimitiveBlock from './PrimitiveBlock';
import {PrimitiveGroup} from '../parsers/primitives';
import './Toolbar.less';
import SHARED from '../shared';

export default class Toolbar extends Component {
  constructor(props) {
    super(props);
    this.handleFocusPrimitive = this.handleFocusPrimitive.bind(this);
    this.handleBlurPrimitive  = this.handleBlurPrimitive.bind(this);
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

  next() {
    let primitives = this.getPrimitives();
    if (primitives.length == 0) return; // Nothing to select.
    let i = this.getSelectedPrimitiveIndex(primitives);
    // If nothing is selected, select the first primitive, otherwise select the next.
    if (i === primitives.length - 1) i -= 1;
    if (i === null) i = -1;
    this.selectPrimitive(primitives[i + 1]);
  }

  prev() {
    let primitives = this.getPrimitives();
    if (primitives.length == 0) return; // Nothing to select.
    let i = this.getSelectedPrimitiveIndex(primitives);
    // If the first primitive is selected, unselect, otherwise select the previous.
    this.selectPrimitive((i == null || i == 0) ? null : primitives[i - 1]);
  }

  handleFocusPrimitive(selectedPrimitive) {
    this.setState({selectedPrimitive});
  }

  selectPrimitive(selectedPrimitive) {
    if (selectedPrimitive.element) {
      selectedPrimitive.element.focus(); // will set state
    } else {
      this.setState({selectedPrimitive});
    }
  }

  handleBlurPrimitive(primitive) {
    // NOTE(Justin): This fires in many situations, including on `next` and
    // `prev`. We really only care about the case where the focus entirely
    // leaves the toolbar, but I don't know of a way to do that without
    // responding to every single blur.
    if (this.state.selectedPrimitive === primitive) {
      this.setState({selectedPrimitive: null});
    }
  }

  handleKeyDown = event => {
    event.stopPropagation();
    switch(SHARED.keyName(event)) {
    case 'Esc':
      event.target.blur();
      return;
    case 'Down':
      this.next();
      return;
    case 'Up':
      this.prev();
      return;
    }
  }

  getPrimitives() {
    if (this.props.primitives) {
      return this.props.primitives.filter(this.state.search).primitives;
    } else {
      return [];
    }
  }

  getSelectedPrimitiveIndex(primitives) {
    for (let i = 0; i < primitives.length; i++) {
      if (primitives[i] === this.state.selectedPrimitive) {
        return i;
      }
    }
    return null;
  }

  render() {
    let primitives = this.getPrimitives();
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
            onKeyDown={this.handleKeyDown}
            onChange={this.changeSearch} />
          {this.state.search ?
            <span className="glyphicon glyphicon-remove" onClick={this.clearSearch} />
            : null}
        </div>
        <div className="primitives-box">
          <PrimitiveList
            primitives={primitives}
            onFocus={this.handleFocusPrimitive}
            onBlur={this.handleBlurPrimitive}
            onKeyDown={this.handleKeyDown}
            selected={selected && selected.name}
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
