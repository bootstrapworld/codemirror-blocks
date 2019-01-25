import React, {Component} from 'react';
import Modal from 'react-modal';
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs';
import 'react-tabs/style/react-tabs.less';

export default (Editor, searchModes) => {
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

    componentDidMount(){
      Modal.setAppElement(this.props.AppElement);
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