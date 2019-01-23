import React, {Component} from 'react';
import Modal from 'react-modal';
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs';
import 'react-tabs/style/react-tabs.less';


export default (Editor, searchModes) => {
  Modal.setAppElement(document.createElement('div'));
  const settings = searchModes.reduce((acc, searchMode, i) => {
    acc[i] = searchMode.setting;
    return acc;
  }, {});

  return class extends Component {
    state = {
      showSearchDialog: false,
      searchEngine: 0,
      cursor: null,
      settings: settings,
      cmbState: null,
    }

    handleChangeSetting = i => setting => {
      this.setState({settings: {...this.state.settings, [i]: setting}});
    }

    handleActivateSearch = (state, done) => {
      this.setState({showSearchDialog: true});
      this.callback = done;
      this.setState({cmbState: state});
    }

    handleCloseModal = () => {
      this.setState({showSearchDialog: false});
      this.callback();
    }

    handleSearch = (forward, cmbState) => {
      const result = searchModes[this.state.searchEngine].search(
        this.state.cursor,
        this.state.settings[this.state.searchEngine],
        this.cm,
        cmbState,
        forward,
      );
      if (result !== null) {
        const {node, cursor} = result;
        console.log('search cursor 2', cursor);
        this.setState({cursor});
        return node;
      } else {
        return null;
      }
    }

    handleKeyModal = e => {
      if (e.key === 'Enter' || e.key === 'Escape') { // enter or escape
        this.handleCloseModal();
      }
    }

    handleSetCursor = cursor => {
      console.log('search cursor', cursor);
      this.setState({cursor});
    }

    handleTab = searchEngine => this.setState({searchEngine})

    handleSetCM = cm => this.cm = cm

    search = {
      onSearch: this.handleActivateSearch,
      search: this.handleSearch,
      setCursor: this.handleSetCursor,
      setCM: this.handleSetCM,
    }

    render() {
      const tabs = searchModes.map(({label}, i) => <Tab key={i}>{label}</Tab>);
      const tabPanels = searchModes.map(({component: SearchMode}, i) => (
        <TabPanel key={i}>
          <SearchMode setting={this.state.settings[i]}
                      onChange={this.handleChangeSetting(i)}
                      cmbState={this.state.cmbState} />
        </TabPanel>
      ));
      return (
        <React.Fragment>
          <Editor {...this.props} search={this.search} />

          <Modal isOpen={this.state.showSearchDialog}
                 className="wrapper-modal">
            <div tabIndex="-1" className="react-modal" onKeyUp={this.handleKeyModal}
                 role="dialog">
              <div className="modal-content" role="document">
                <div className="modal-header">
                  <button type="button" className="close" data-dismiss="modal"
                          aria-label="Close"
                          onClick={this.handleCloseModal}>
                    &times;
                  </button>
                  <h5 className="modal-title">Search</h5>
                </div>
                <div className="modal-body">
                  <Tabs selectedIndex={this.state.searchEngine}
                        onSelect={this.handleTab}
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
        </React.Fragment>
      );
    }
  };
};


// export default class extends Component {

//   static propTypes = {
//     searchModes: PropTypes.array.isRequired,
//     blocks: PropTypes.object.isRequired,
//   }
//   find(forward, e) {
//     const searchConfig = this.props.searchModes[this.state.tabIndex].find(
//       this.props.blocks,
//       this.state,
//       forward,
//       e
//     );
//     if (!searchConfig) return;

//     const {initialStart, wrapStart, match, ending, next, getResult, beep} = searchConfig;
//     if (beep) playSound(WRAP);
//     const skipper = obj => !ending(obj) && !match(obj);
//     let result = skipWhile(skipper, initialStart(), next);
//     if (ending(result)) {
//       if (!beep) playSound(WRAP); // we have already beep
//       result = skipWhile(skipper, wrapStart(), next);
//       if (ending(result)) return;
//     }
//     let node = getResult(result);

//     const ancestors = [node];
//     let p = this.props.blocks.ast.getNodeParent(node);
//     while (p) {
//       ancestors.push(p);
//       p = this.props.blocks.ast.getNodeParent(p);
//     }
//     ancestors.reverse();
//     if (this.props.blocks.renderOptions.lockNodesOfType.includes(ancestors[0].type)) {
//       node = ancestors[0];
//     } else {
//       ancestors.forEach(a => this.props.blocks.maybeChangeNodeExpanded(a, true));
//     }
//     this.props.blocks.activateNode(node, e);
//     this.props.blocks.cm.refresh();
//     // saying this is not accurate since some matches are not this.props.blocks
//     // this.props.blocks.say(
//     //   (forward ? index + 1 : matches.length - index) +
//     //     " of " + matches.length,
//     //   100
//     // );
//   }


//   handleCloseModal = () => {
//     if (!this.props.searchModes[this.state.tabIndex]
//         .hasMatch(this.state, this.props.blocks)) {
//       playSound(WRAP);
//     }
//     this.setState({showSearchModal: false});
//   }

//   handleChange = e => {
//     this.setState({
//       [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value
//     });
//   }
// }
