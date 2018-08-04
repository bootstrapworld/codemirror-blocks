import React, {Component} from 'react';
import Modal from 'react-modal';
import {UP, DOWN, ESC, ENTER, PGUP, PGDN, F3} from '../keycode';

// TODO: Make sure to bind modal to your appElement (http://reactcommunity.org/react-modal/accessibility/)
// Modal.setAppElement('#yourAppElement');

export default class extends Component {
  constructor(props) {
    super(props);

    this.state = {showSearchModal: false, searchString: '', searchMode: 0};
    this.searchBoxNode = null;
  }

  handleKeyModal = e => {
    if (e.keyCode === ENTER || e.keyCode === ESC) { // enter or escape
      this.setState({showSearchModal: false});

      // NOTE(Oak): getActiveNode uses document.activeElement, but right now
      // our focus is on the modal, so we use setTimeout to wait for the modal to close
      // first
      setTimeout(() => {
        if (this.state.searchString === '') return;
        this.props.searchModes[this.state.searchMode].initSearch(this.state.searchString);
      });

    } else if (e.keyCode === UP) {
      if (this.state.searchMode > 0) {
        this.setState((prevState => ({searchMode: prevState.searchMode - 1})));
      }
    } else if (e.keyCode === DOWN) {
      if (this.state.searchMode < this.props.searchModes.length - 1) {
        this.setState((prevState => ({searchMode: prevState.searchMode + 1})));
      }
    }
  }


  handleKeyGlobal = e => {
    switch (e.keyCode) {
    case F3:
      e.preventDefault(); // prevent the browser search

      this.setState({showSearchModal: true});
      return;

    case PGUP:
      e.preventDefault(); // we never want pgup and pgdn to actually do pgup and pgdn

      // NOTE: Oak doesn't think the next line is right. We ought to support
      // searching in non block mode too, but this's the current behavior
      if (!this.props.blocks.blockMode) return;

      if (this.state.searchString === '') {
        this.props.blocks.switchNodes(cur => this.props.blocks.ast.getNodeBefore(cur), e);
      } else {
        this.props.searchModes[this.state.searchMode].find(false, e);
      }
      return;

    case PGDN:
      e.preventDefault(); // we never want pgup and pgdn to actually do pgup and pgdn

      // NOTE: Oak doesn't think the next line is right. We ought to support
      // searching in non block mode too, but this's the current behavior
      if (!this.props.blocks.blockMode) return;

      if (this.state.searchString === '') {
        this.props.blocks.switchNodes(cur => this.props.blocks.ast.getNodeAfter(cur), e);
      } else {
        this.props.searchModes[this.state.searchMode].find(true, e);
      }
      return;
    }
  }

  handleChangeSearchString = e => {
    this.setState({searchString: e.target.value});
  }

  handleClickSearchMode = i => () => {
    this.setState({searchMode: i});
    this.searchBoxNode.focus();
  }

  handleCloseModal = () => {
    this.setState({showSearchModal: false});
  }

  // NOTE: to intercept f3, we need to use keydown

  componentDidMount() {
    document.addEventListener("keydown", this.handleKeyGlobal);
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this.handleKeyGlobal);
  }

  render() {
    return (
      <Modal isOpen={this.state.showSearchModal}
             className="wrapper-modal">
        <div tabIndex="-1" className="react-modal" onKeyUp={this.handleKeyModal}
             role="dialog">
          <div className="modal-content" role="document">
            <div className="modal-header">
              <button type="button" className="close" data-dismiss="modal"
                      onClick={this.handleCloseModal}>
                &times;
              </button>
              <h5 className="modal-title">Search</h5>
            </div>
            <div className="modal-body">
              <input type="text" className="form-control search-input"
                     autoFocus onChange={this.handleChangeSearchString}
                     value={this.state.searchString}
                     ref={searchBoxNode => { this.searchBoxNode = searchBoxNode; }} />
              <div className="list-group"> {
                  this.props.searchModes.map((searchMode, i) => {
                    return (
                      <SearchMode active={i === this.state.searchMode}
                                  onClick={this.handleClickSearchMode(i)}
                                  key={i} >
                        {searchMode.getLabel()}
                      </SearchMode>
                    );
                  })
              }</div>
            </div>
          </div>
        </div>
      </Modal>
    );
  }
}

class SearchMode extends Component {
  render() {
    return (
      <a href="#"
         className={`list-group-item list-group-item-action flex-column align-items-start ${this.props.active ? 'active' : ''}`} onClick={this.props.onClick}>
        <div>{this.props.children}</div>
      </a>
    );
  }
}
