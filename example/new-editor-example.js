import 'babel-polyfill';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/monokai.css';
import 'codemirror/addon/search/searchcursor.js';
import '../src/languages/wescheme';
import React from 'react';
import ReactDOM from 'react-dom';
import Editor from '../src/ui/NewEditor';
import './example-page.less';
import Parser from '../src/languages/wescheme/WeschemeParser';
import PropTypes from 'prop-types';
// import exampleWeSchemeCode from './cow-game.rkt';


import Modal from 'react-modal';
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs';

const exampleWeSchemeCode = `(a)(x y)`;

const parser = new Parser();

const cmOptions = {
  lineNumbers: true,
  viewportMargin: 10,
};

const options = {
  renderOptions: {
    lockNodesOfType: ['comment', 'functionDef', 'variableDef', 'struct']
  },
  willInsertNode: (cm, sourceNodeText, sourceNode, destination) => {
    const line = cm.getLine(destination.line);
    const prev = line[destination.ch - 1] || '\n';
    const next = line[destination.ch] || '\n';
    sourceNodeText = sourceNodeText.trim();
    if (!/\s|[([{]/.test(prev)) {
      sourceNodeText = ' ' + sourceNodeText;
    }
    if (!/\s|[)\]}]/.test(next)) {
      sourceNodeText += ' ';
    }
    return sourceNodeText;
  },
  parser
};


// class SearchDialog extends React.Component {
//   static propTypes = {
//     showSearchDialog: PropTypes.bool.isRequired,
//   }

//   render() {
//     const tabs = this.props.searchModes.map(({label}, i) => <Tab key={i}>{label}</Tab>);
//     const tabPanels = this.props.searchModes.map(({component: SearchMode}, i) => (
//       <TabPanel key={i}>
//         <SearchMode state={this.state} handleChange={this.handleChange}
//                     blocks={this.props.blocks} />
//       </TabPanel>
//     ));

//     const {showSearchDialog} = this.props;

//     return (
//     );
//   }
// }

Modal.setAppElement('#cmb-editor');

function attachSearch(Editor) {
  return class extends React.Component {

    state = {
      showSearchDialog: false,
      searchEngine: 0,
    }

    handleActivateSearch = () => {
      this.setState({showSearchDialog: true});
    }

    handleCloseModal = () => {
      this.setState({showSearchDialog: false});
    }

    handleSearchPrevious = x => {
      console.log('searchBefore', x);
      return x;
    }

    handleSearchNext = x => {
      console.log('searchAfter', x);
      return x;
    }


    handleKeyModal = e => {
      if (e.key === 'Enter' || e.key === 'Escape') { // enter or escape
        this.handleCloseModal();
      }
    }

    handleTab = searchEngine => this.setState({searchEngine})

    render() {
      return (
        <React.Fragment>
          <Editor {...this.props}
                  search={{
                    searchNext: this.handleSearchNext,
                    searchPrevious: this.handleSearchPrevious,
                    onSearch: this.handleActivateSearch,
                  }} />

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
                  <Tabs selectedIndex={0} onSelect={this.handleTab} defaultFocus={true}>
                    <TabList><Tab>abc</Tab></TabList>
                    <TabPanel>
                      aaaa
                    </TabPanel>
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
}

/*

  <Tabs selectedIndex={this.state.tabIndex} onSelect={this.handleTab}
  defaultFocus={true}>
  <TabList>{tabs}</TabList>
  {tabPanels}
  </Tabs>

*/

const EditorWithSearch = attachSearch(Editor);

class EditorInstance extends React.Component {
  render() {
    return (
      <EditorWithSearch
        language="wescheme"
        value={exampleWeSchemeCode}
        options={options}
        parser={parser}
        cmOptions={cmOptions} />
    );
  }
}

ReactDOM.render(<EditorInstance />, document.getElementById('cmb-editor'));
