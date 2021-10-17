import React, { Component } from "react";
import Dialog from "../components/Dialog";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import "react-tabs/style/react-tabs.less";
import { playSound, WRAP } from "../utils";
import { say } from "../announcer";
import { BlockEditorComponentClass, Search } from "./BlockEditor";
import { Searcher } from "./searchers/Searcher";
import { GetProps } from "react-redux";
import { ASTNode, Pos } from "../ast";
import { RootState } from "../reducers";
import { ReadonlyCMBEditor } from "../editor";

export default function attachSearch(
  Editor: BlockEditorComponentClass,
  searchModes: Searcher<any, any>[]
) {
  const settings = searchModes.reduce((acc, searchMode, i) => {
    acc[i] = searchMode.setting;
    return acc;
  }, {} as { [index: number]: unknown });

  type Props = GetProps<BlockEditorComponentClass> & {
    onSearchMounted: (search: Search) => void;
  };

  type State = {
    showSearchDialog: boolean;
    searchEngine: number | null;
    cursor: null | Pos;
    settings: typeof settings;
    firstTime: boolean;
    searchForward?: () => void;
  };

  return class extends Component<Props, State> {
    state: State = {
      showSearchDialog: false,
      searchEngine: null,
      cursor: null,
      settings: settings,
      firstTime: true,
    };
    editor: ReadonlyCMBEditor;
    callback: () => void;

    displayName = "Search Component";

    handleChangeSetting = (i: number) => (setting: unknown) => {
      this.setState({
        settings: { ...this.state.settings, [i]: setting },
        searchEngine: i,
      });
    };
    handleActivateSearch = (
      done: () => void,
      searchForward: State["searchForward"]
    ) => {
      this.setState({ showSearchDialog: true });
      this.callback = done;
      this.setState({ searchForward: searchForward });
    };

    handleCloseModal = () => {
      this.setState({ showSearchDialog: false, firstTime: true });
      this.callback();
    };

    handleSearch = (
      forward: boolean,
      cmbState: RootState,
      overrideCur: State["cursor"]
    ): ASTNode | null => {
      if (this.state.searchEngine == null) {
        say("No search settings have been selected");
        return null;
      }
      let result;

      // keep searching until we find an unfocused node, or we run out of results
      let searchFrom = overrideCur || this.state.cursor;
      do {
        if (!searchFrom) {
          break;
        }
        result = searchModes[this.state.searchEngine].search(
          searchFrom,
          this.state.settings[this.state.searchEngine],
          this.editor,
          cmbState,
          forward
        );

        if (result) {
          searchFrom = result.cursor;
        }
      } while (!(result && result.node.id !== cmbState.focusId));

      if (result) {
        const { node, cursor } = result;
        this.setState({ cursor });
        return node;
      } else {
        if (overrideCur) {
          return null; // if there's no wrapped match, give up
        }
        playSound(WRAP);

        const wrappedStart = forward
          ? { line: 0, ch: 0 }
          : this.editor.getLastPos();
        return this.handleSearch(forward, cmbState, wrappedStart);
      }
    };

    handleKeyModal = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "Escape") {
        // enter or escape
        this.handleCloseModal();
        if (e.key === "Escape") {
          return; // don't initiate search
        }
        this.state.searchForward && this.state.searchForward();
        say(
          "Searching for next match. Use PageUp and PageDown to search forwards and backwards"
        );
      }
    };

    handleSetCursor = (cursor: State["cursor"]) => {
      this.setState({ cursor });
    };

    // Override default: only allow tab switching via left/right, NOT up/down
    handleTab = (
      searchEngine: number | null,
      lastTabIdx: number,
      event: KeyboardEvent
    ) => {
      this.setState({ firstTime: false });
      if (["ArrowDown", "ArrowUp"].includes(event.key)) return false;
      return this.setState({ searchEngine });
    };

    handleSetCM = (editor: ReadonlyCMBEditor) => (this.editor = editor);

    search: Search = {
      onSearch: this.handleActivateSearch,
      search: this.handleSearch,
      setCursor: this.handleSetCursor,
      setCM: this.handleSetCM,
    };

    componentDidMount() {
      // TODO(pcardune): delete this onSearchMounted crud. It's only necessary
      // because the search object isn't created until this component is mounted
      // but is required by components higher up in the component tree
      // (TrashCan via ToggleEditor). If search is really needed everywhere, it
      // should be instantiated at the top level and not here.
      this.props.onSearchMounted(this.search);
    }

    render() {
      const tabs = searchModes.map(({ label }, i) => (
        <Tab key={i}>{label}</Tab>
      ));
      const tabPanels = searchModes.map(({ component: SearchMode }, i) => (
        <TabPanel key={i}>
          <SearchMode
            setting={this.state.settings[i]}
            firstTime={this.state.firstTime}
            onChange={this.handleChangeSetting(i)}
          />
        </TabPanel>
      ));

      const content = (
        <>
          <i>
            What should <kbd>PgUp</kbd> and <kbd>PgDown</kbd> search for?
          </i>
          <Tabs onSelect={this.handleTab} defaultFocus={true}>
            <TabList>{tabs}</TabList>
            {tabPanels}
          </Tabs>
          <div className="modal-footer">
            <small className="form-text text-muted">
              <div>
                <kbd>&larr;</kbd>
                <kbd>&rarr;</kbd> to change modes; &nbsp;
                <kbd>&crarr;</kbd>
                <kbd>esc</kbd> to close and find next;
              </div>
            </small>
          </div>
        </>
      );

      const { onSearchMounted, ...editorProps } = this.props;

      return (
        <>
          <Editor {...editorProps} search={this.search} />

          <Dialog
            isOpen={this.state.showSearchDialog}
            closeFn={this.handleCloseModal}
            keyUp={this.handleKeyModal}
            body={{ title: "Search Settings", content: content }}
          ></Dialog>
        </>
      );
    }
  };
}
