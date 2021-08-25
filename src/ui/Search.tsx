import React, {Component} from 'react';
import Dialog from '../components/Dialog';
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs';
import 'react-tabs/style/react-tabs.less';
import {say, getBeginCursor, getEndCursor, playSound, WRAP} from '../utils';
import { BlockEditorComponentClass } from './BlockEditor';
import { Searcher } from './searchers/Searcher';
import { GetProps } from 'react-redux';

export default function attachSearch(
  Editor: BlockEditorComponentClass,
  searchModes: Searcher<any, any>[]
) {

  const settings = searchModes.reduce((acc, searchMode, i) => {
    acc[i] = searchMode.setting;
    return acc;
  }, {} as {[index:number]:unknown});

  type Props = GetProps<BlockEditorComponentClass> & {
    appElement: HTMLElement;
  }

  type State = {
    showSearchDialog: boolean,
    searchEngine: number|null,
    cursor: null,
    settings: typeof settings,
    cmbState: null,
    firstTime: boolean,
    searchForward?: () => void,
  };

  return class extends Component<Props, State> {

    state: State = {
      showSearchDialog: false,
      searchEngine: null,
      cursor: null,
      settings: settings,
      cmbState: null,
      firstTime: true
    }
    cm: CodeMirror.Editor;
    callback: () => void;

    displayName = 'Search Component'

    handleChangeSetting = i => setting => {
      this.setState({
        settings: {...this.state.settings, [i]: setting}, 
        searchEngine: i
      });
    }
    handleActivateSearch = (state, done, searchForward) => {
      this.setState({showSearchDialog: true});
      this.callback = done;
      this.setState({cmbState: state});
      this.setState({searchForward: searchForward});
    }

    handleCloseModal = () => {
      this.setState({showSearchDialog: false, firstTime: true});
      this.callback();
    }

    handleSearch = (forward, cmbState, overrideCur) => {
      if(this.state.searchEngine == null) {
        say("No search settings have been selected");
        return;
      }
      var searchFrom = overrideCur || this.state.cursor, result;
      // keep searching until we find an unfocused node, or we run out of results
      while((result = searchModes[this.state.searchEngine].search(
        searchFrom,
        this.state.settings[this.state.searchEngine],
        this.cm,
        cmbState,
        forward))) {
        if(result && result.node.id !== cmbState.focusId) break;
        searchFrom = result.cursor;
      }
      if (result !== null) {
        const {node, cursor} = result;
        this.setState({cursor});
        return node;
      } else {
        if(overrideCur) return null; // if there's no wrapped match, give up
        playSound(WRAP);
        const wrappedStart = (forward? getBeginCursor : getEndCursor)(this.cm);
        return this.handleSearch(forward, cmbState, wrappedStart);
      }
    }

    handleKeyModal = e => {
      if (e.key === 'Enter' || e.key === 'Escape') { // enter or escape
        this.handleCloseModal();
        if (e.key === 'Escape') return; // don't initiate search
        this.state.searchForward();
        say("Searching for next match. Use PageUp and PageDown to search forwards and backwards");
      }
    }

    handleSetCursor = cursor => {
      this.setState({cursor});
    }

    // Override default: only allow tab switching via left/right, NOT up/down
    handleTab = (searchEngine: number|null, lastTabIdx:number, event: KeyboardEvent) => {
      this.setState({firstTime: false});
      if(["ArrowDown", "ArrowUp"].includes(event.key)) return false;
      return this.setState({searchEngine});
    }

    handleSetCM = (cm: CodeMirror.Editor) => this.cm = cm

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
                      firstTime={this.state.firstTime}
                      onChange={this.handleChangeSetting(i)}
                      cmbState={this.state.cmbState} />
        </TabPanel>
      ));

      const content = (
        <>
          <i>What should <kbd>PgUp</kbd> and <kbd>PgDown</kbd> search for?</i>
            <Tabs onSelect={this.handleTab} defaultFocus={true}>
              <TabList>{tabs}</TabList>
              {tabPanels}
            </Tabs>
          <div className="modal-footer">
            <small className="form-text text-muted">
              <div>
                <kbd>&larr;</kbd>
                <kbd>&rarr;</kbd> to change modes;
                &nbsp;
                <kbd>&crarr;</kbd>
                <kbd>esc</kbd> to close and find next;
              </div>
            </small>
          </div>
        </>);

      return (
        <>
          <Editor {...this.props} search={this.search} />

          <Dialog isOpen={this.state.showSearchDialog}
                  closeFn={this.handleCloseModal}
                  appElement={this.props.appElement}
                  keyUp={this.handleKeyModal}
                  body={ {title: "Search Settings", content: content} }>
          </Dialog>
        </>
      );
    }
  };
};