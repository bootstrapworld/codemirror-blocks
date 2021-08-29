import React, {Component} from 'react';
import classNames from 'classnames';
import PrimitiveList from './PrimitiveList';
import PrimitiveBlock from './PrimitiveBlock';
import {Primitive, PrimitiveGroup} from '../parsers/primitives';
import CodeMirror from 'codemirror';
import './Toolbar.less';

type Props = {
  primitives?: PrimitiveGroup,
  languageId?: string, // used to find the .blocks-language-{languageId} CSS class
  blockMode?: boolean,
}

type State = {
  search: string,
  selectedPrimitive: null | Primitive,
}

export default class Toolbar extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.handleFocusPrimitive = this.handleFocusPrimitive.bind(this);
    this.state = {
      search: '',
      selectedPrimitive: null,
    };
  }

  static defaultProps: Props = {
    primitives: null,
    blockMode: false
  }

  primitiveSearch: HTMLElement;

  changeSearch: React.ChangeEventHandler<HTMLInputElement> = (event) => {
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
    // If the first primitive is selected, keep it, otherwise select the previous.
    if (i === 0) i = 1;
    this.selectPrimitive(i === null ? null : primitives[i - 1]);
  }

  handleFocusPrimitive(selectedPrimitive: State['selectedPrimitive']) {
    this.setState({selectedPrimitive: selectedPrimitive});
  }

  selectPrimitive(selectedPrimitive: null | Primitive) {
    if (selectedPrimitive?.element) {
      selectedPrimitive.element.focus(); // will trigger handleFocusPrimitive
    } else {
      this.setState({selectedPrimitive: selectedPrimitive});
    }
  }

  // NOTE(DS26GTE): this is just so onBlur has a non-null value
  handleBlurPrimitive() {}

  handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = event => {
    switch(CodeMirror.keyName(event)) {
    case 'Esc':
      (event.target as HTMLInputElement).blur();
      return;
    case 'Down':
      event.preventDefault();
      this.next();
      return;
    case 'Up':
      event.preventDefault();
      this.prev();
      return;
    default:
      event.stopPropagation();
      return;
    }
  }

  getPrimitives() {
    if (this.props.primitives) {
      return this.props.primitives.filter(this.state.search).primitives as Primitive[];
    } else {
      return [];
    }
  }

  getSelectedPrimitiveIndex(primitives: (PrimitiveGroup|Primitive)[]) {
    const idx = primitives.findIndex(p => p === this.state.selectedPrimitive);
    return (idx == -1)? null : idx;
  }

  render() {
    let primitives = this.getPrimitives();
    const selected = this.state.selectedPrimitive;
    return (
      <div className={classNames('blocks-ui Toolbar', {'has-selected':!!selected})}>
        <div className="search-box" role="search">
          <label className="screenreader-only" htmlFor="search_box">
            <h2>Search Functions</h2>
          </label>
          <input type="search"
            id="search_box"
            placeholder="Search functions"
            disabled={!this.props.blockMode}
            className="form-control"
            value={this.state.search}
            onKeyDown={this.handleKeyDown}
            ref={(elt) => { this.primitiveSearch = elt; }} 
            onChange={this.changeSearch} />
          {this.state.search ?
            <button 
              aria-label="clear text" 
              className="glyphicon glyphicon-remove" 
              onClick={this.clearSearch} />
            : null}
        </div>
        <div className="primitives-box" tabIndex={-1}>
          <PrimitiveList
            primitives={primitives}
            onFocus={this.handleFocusPrimitive}
            onBlur={this.handleBlurPrimitive}
            onKeyDown={this.handleKeyDown}
            selected={selected && selected.name}
            searchString={this.state.search}
            />
        </div>
        <div className={classNames('selected-primitive', `blocks-language-${this.props.languageId}`)}>
          <div className="block-header">Block</div>
          {selected? 
            (<PrimitiveBlock 
                primitive={selected} 
                id={''+primitives.findIndex(p => p.name === selected.name)} 
            />) 
            : ""}
        </div>
      </div>
    );
  }
}