import React, { Component, createRef } from "react";
import {
  skipCollapsed,
  poscmp,
  skipWhile,
  getNodeContainingBiased,
} from "../../utils";
import { SearchCursor } from "codemirror";
import { Searcher } from "./Searcher";
import { ASTNode } from "../../ast";

/**
 * Returns a query from settings. If the query is a regex but is invalid (indicating
 * that users are still in the middle of writing regex),
 * returns an always failing regex instead.
 */
function getQueryFromSettings(state: SearchSettings) {
  let query = state.searchString;
  let isRegex = state.isRegex;
  let isExactMatch = state.isExactMatch;
  if (isExactMatch && !isRegex) {
    query = query.replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&");
    isRegex = true;
  }
  if (!isRegex) return query;
  if (isExactMatch) query = "\\b" + query + "\\b";
  try {
    return new RegExp(query);
  } catch (e) {
    return /$^/;
  }
}

type SearchSettings = {
  searchString: string;
  isRegex: boolean;
  isExactMatch: boolean;
  isIgnoreCase: boolean;
};

type SearchOptionProps = {
  onChange: React.ChangeEventHandler;
  setting: SearchSettings;
  name: "isRegex" | "isExactMatch" | "isIgnoreCase";
  value: string;
};
class SearchOption extends Component<SearchOptionProps> {
  render() {
    const { name, value, setting, onChange } = this.props;
    return (
      <label>
        <input
          type="checkbox"
          name={name}
          onChange={onChange}
          checked={setting[name]}
        />
        {value}
      </label>
    );
  }
}

// function getResults(settings, cm, {ast, collapsedList}, limit=Infinity) {
//   const query = getQueryFromSettings(settings);
//   const collapsedNodeList = collapsedList.map(ast.getNodeById);
//   const searchCursor = cm.getSearchCursor(
//     query, null, {caseFold: settings.isIgnoreCase}
//   );
//   const searchMatches = [];
//   while (searchCursor.findNext() && searchMatches.length < limit) {
//     const node = ast.getNodeContaining(searchCursor.from());
//     // make sure we're not just matching a comment
//     if (node && !collapsedNodeList.some(collapsed => ast.isAncestor(collapsed.id, node.id))) {
//       searchMatches.push(node);
//     }
//   }
//   return searchMatches;
// }

type Props = {
  setting: SearchSettings;
  onChange: (
    e: SearchSettings & { [targetName: string]: string | boolean }
  ) => void;
  firstTime?: boolean;
};

const ByString: Searcher<SearchSettings, Props> = {
  label: "Search by string",
  setting: {
    searchString: "",
    isRegex: false,
    isExactMatch: false,
    isIgnoreCase: false,
  },
  component: class extends Component<Props> {
    displayName = "Search by String";

    inputRef: React.RefObject<HTMLInputElement>;

    constructor(props: Props) {
      super(props);
      this.inputRef = createRef();
    }

    componentDidMount() {
      if (this.props.firstTime) {
        this.inputRef.current?.select();
      }
    }

    handleChange: React.ChangeEventHandler<
      HTMLSelectElement | HTMLInputElement
    > = (e) => {
      let value: string | boolean;
      if (
        e.target instanceof HTMLInputElement &&
        e.target.type === "checkbox"
      ) {
        value = e.target.checked;
      } else {
        value = e.target.value;
      }
      this.props.onChange({
        ...this.props.setting,
        [e.target.name]: value,
      });
    };

    render() {
      const { setting } = this.props;
      return (
        <>
          <div className="form-group">
            <input
              type="text"
              className="form-control search-input"
              name="searchString"
              ref={this.inputRef}
              aria-label="Search String"
              onChange={this.handleChange}
              value={setting.searchString}
              spellCheck="false"
            />
          </div>
          <div className="search-options">
            <SearchOption
              setting={setting}
              onChange={this.handleChange}
              name="isIgnoreCase"
              value="Ignore case"
            />
            <SearchOption
              setting={setting}
              onChange={this.handleChange}
              name="isExactMatch"
              value="Exact match"
            />
            <SearchOption
              setting={setting}
              onChange={this.handleChange}
              name="isRegex"
              value="Regex"
            />
          </div>
        </>
      );
    }
  },
  search: (cur, settings, cm, state, forward) => {
    const { ast, collapsedList } = state;
    const collapsedNodeList = collapsedList.map(ast.getNodeById);

    if (settings.searchString === "") {
      let node: ASTNode | null | undefined = getNodeContainingBiased(cur, ast);
      if (node) {
        node = skipCollapsed(
          node,
          (node) => (forward ? node?.next : node?.prev),
          state
        );
        if (node) return { node, cursor: node.from };
        return null;
      }
      node = forward ? ast.getNodeAfterCur(cur) : ast.getNodeBeforeCur(cur);
      if (node) return { node, cursor: node.from };
      return null;
    }

    const options = { caseFold: settings.isIgnoreCase };
    const query = getQueryFromSettings(settings);

    function next(searchCursor: SearchCursor) {
      const result = searchCursor.find(!forward);
      if (result) return searchCursor;
      return null;
    }

    let searchCursor = next(cm.getSearchCursor(query, cur, options));
    if (forward && searchCursor && poscmp(searchCursor.from(), cur) === 0) {
      searchCursor = next(searchCursor);
    }
    const newSearchCur = skipWhile(
      (searchCur) => {
        if (!searchCur) return false;
        const node = getNodeContainingBiased(searchCur.from(), ast);
        return (
          !!node &&
          collapsedNodeList.some(
            (collapsed) => collapsed && ast.isAncestor(collapsed.id, node.id)
          )
        );
      },
      searchCursor,
      next
    );
    if (newSearchCur) {
      const node = getNodeContainingBiased(newSearchCur.from(), ast);
      if (node) return { node, cursor: newSearchCur.from() };
    }
    return null;
  },
};

export default ByString;
