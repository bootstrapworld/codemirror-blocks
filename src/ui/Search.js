import React, {Component} from 'react';
import Modal from 'react-modal';
import {ESC, ENTER, PGUP, PGDN, F3} from '../keycode';
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs';
import {playSound, WRAP} from '../sound';
import {skipWhile} from '../utils';
import 'react-tabs/style/react-tabs.less';

// TODO: Make sure to bind modal to your appElement (http://reactcommunity.org/react-modal/accessibility/)
// Modal.setAppElement('#yourAppElement');

export default class extends Component {
  // NOTE(Oak): we need to store all panels' states here so that the states are not
  // forgotten

  // NOTE(Oak): the prop `searchModes` should not be changed once it's given
  // (could potentially make it changeable by using getDerivedStatefromProps)
  constructor(props) {
    super(props);
    let state = {showSearchModal: false, tabIndex: 0};
    for (const searchMode of this.props.searchModes) {
      state = {...state, ...searchMode.init}; // just merge this in
    }
    this.state = state;
  }

  handleKeyModal = e => {
    if (e.keyCode === ENTER || e.keyCode === ESC) { // enter or escape
      this.handleCloseModal();
      return;
    }
  }

  find(forward, e) {
    const searchConfig = this.props.searchModes[this.state.tabIndex].find(
      this.props.blocks,
      this.state,
      forward,
      e
    );
    if (!searchConfig) return;

    const {initialStart, wrapStart, match, ending, next, getResult, beep} = searchConfig;
    if (beep) playSound(WRAP);
    const skipper = obj => !ending(obj) && !match(obj);
    let result = skipWhile(skipper, initialStart(), next);
    if (ending(result)) {
      if (!beep) playSound(WRAP); // we have already beep
      result = skipWhile(skipper, wrapStart(), next);
      if (ending(result)) return;
    }
    let node = getResult(result);

    const ancestors = [node];
    let p = this.props.blocks.ast.getNodeParent(node);
    while (p) {
      ancestors.push(p);
      p = this.props.blocks.ast.getNodeParent(p);
    }
    ancestors.reverse();
    if (this.props.blocks.renderOptions.lockNodesOfType.includes(ancestors[0].type)) {
      node = ancestors[0];
    } else {
      ancestors.forEach(a => this.props.blocks.maybeChangeNodeExpanded(a, true));
    }
    this.props.blocks.activateNode(node, e);
    this.props.blocks.cm.refresh();
    // saying this is not accurate since some matches are not this.props.blocks
    // this.props.blocks.say(
    //   (forward ? index + 1 : matches.length - index) +
    //     " of " + matches.length,
    //   100
    // );
  }

  handleKeyGlobal = e => {
    if (!this.props.blocks.blockMode) return;

    switch (e.keyCode) {
    case F3:
      e.preventDefault(); // prevent the browser search
      this.setState({showSearchModal: true});
      return;

    case PGUP: {
      e.preventDefault(); // we never want pgup and pgdn to actually do pgup and pgdn
      this.find(false, e);
      return;
    }

    case PGDN: {
      e.preventDefault(); // we never want pgup and pgdn to actually do pgup and pgdn
      this.find(true, e);
      return;
    }

    }
  }

  handleTab = tabIndex => this.setState({tabIndex})

  handleCloseModal = () => {
    if (!this.props.searchModes[this.state.tabIndex]
        .hasMatch(this.state, this.props.blocks)) {
      playSound(WRAP);
    }
    this.setState({showSearchModal: false});
  }

  // NOTE: to intercept f3, we need to use keydown
  componentDidMount() {
    document.body.addEventListener("keydown", this.handleKeyGlobal, true);
  }

  componentWillUnmount() {
    document.body.removeEventListener("keydown", this.handleKeyGlobal, true);
  }

  handleChange = e => {
    this.setState({
      [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value
    });
  }

  render() {
    const tabs = this.props.searchModes.map(({label}, i) => <Tab key={i}>{label}</Tab>);
    const tabPanels = this.props.searchModes.map(({component: SearchMode}, i) => (
      <TabPanel key={i}>
        <SearchMode state={this.state} handleChange={this.handleChange}
                    blocks={this.props.blocks} />
      </TabPanel>
    ));

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
              <Tabs selectedIndex={this.state.tabIndex} onSelect={this.handleTab}
                    defaultFocus={true}>
                <TabList>{tabs}</TabList>
                {tabPanels}
              </Tabs>
            </div>
            <div className="modal-footer">
              <small className="form-text text-muted">
                <div>
                  <kbd>&uarr;</kbd>
                  <kbd>&darr;</kbd> to change modes;
                  <kbd>&crarr;</kbd>
                  <kbd>esc</kbd> to save search config;
                  <kbd>⇥</kbd> to focus next element
                </div>
              </small>
            </div>
          </div>
        </div>
      </Modal>
    );
  }
}
