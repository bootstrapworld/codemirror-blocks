import React, {
  Component,
  KeyboardEvent,
  ReactElement,
  useState,
  useEffect,
  useRef,
} from "react";
import classNames from "classnames";
import PrimitiveList from "./PrimitiveList";
import PrimitiveBlock from "./PrimitiveBlock";
import { Primitive, PrimitiveGroup } from "../parsers/primitives";
import CodeMirror from "codemirror";
import "./Toolbar.less";

type Props = {
  primitives?: PrimitiveGroup;
  languageId?: string; // used to find the .blocks-language-{languageId} CSS class
  blockMode?: boolean;
  toolbarRef: React.RefObject<HTMLInputElement>;
};

var Toolbar = (props: Props) => {
  const { primitives, languageId, blockMode, toolbarRef } = props;

  const [search, setSearch] = useState("");
  const [selectedPrimitive, setSelectedPrimitive] = useState(null);
  const clearSearch = () => setSearch("");
  const changeSearch: React.ChangeEventHandler<HTMLInputElement> = (event) =>
    setSearch(event.target.value);

  // Get a flat array of all primitives matching 'search'
  const getPrimitives = () =>
    (primitives?.filter(search).primitives || []) as Primitive[];

  // Set selectedPrimitive state, depending on whether we go up or down
  const move = (dir: string) => {
    let primitives = getPrimitives();
    console.log(primitives);
    if (primitives.length == 0) return; // Nothing to select. Bail.
    let i = primitives.indexOf(selectedPrimitive); // -1 if nothing selected
    if (dir == "Down") {
      i = Math.min(i + 1, primitives.length - 1);
    } else {
      i = Math.max(i - 1, 0);
    }
    if (primitives[i]?.element) {
      primitives[i].element.focus(); // should *not* apply useCallback, correct?
    } else {
      setSelectedPrimitive(primitives[i]);
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (
    event
  ) => {
    switch (CodeMirror.keyName(event)) {
      case "Down":
      case "Up":
        event.preventDefault();
        move(CodeMirror.keyName(event));
        return;
      case "Esc":
        toolbarRef.current.focus();
      default:
        event.stopPropagation();
        return;
    }
  };

  return (
    <div
      className={classNames("blocks-ui Toolbar", {
        "has-selected": !!selectedPrimitive,
      })}
    >
      <div className="search-box" role="search">
        <label className="screenreader-only" htmlFor="search_box">
          <h2>Search Functions</h2>
        </label>
        <input
          type="search"
          id="search_box"
          placeholder="Search functions"
          disabled={!blockMode}
          className="form-control"
          value={search}
          onKeyDown={handleKeyDown}
          ref={toolbarRef}
          onChange={changeSearch}
        />
        {search ? (
          <button
            aria-label="clear text"
            className="glyphicon glyphicon-remove"
            onClick={clearSearch}
          />
        ) : null}
      </div>
      <div className="primitives-box">
        <PrimitiveList
          primitives={getPrimitives()}
          onFocus={setSelectedPrimitive}
          onKeyDown={handleKeyDown}
          selected={selectedPrimitive && selectedPrimitive.name}
          searchString={search}
        />
      </div>
      <div
        className={classNames(
          "selected-primitive",
          `blocks-language-${languageId}`
        )}
      >
        <div className="block-header">Block</div>
        {selectedPrimitive ? (
          <PrimitiveBlock
            primitive={selectedPrimitive}
            id={getPrimitives().indexOf(selectedPrimitive)}
          />
        ) : (
          ""
        )}
      </div>
    </div>
  );
};

export default Toolbar;
