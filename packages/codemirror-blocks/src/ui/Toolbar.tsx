import React, { useState } from "react";
import classNames from "classnames";
import PrimitiveList from "./PrimitiveList";
import { Primitive, PrimitiveGroup } from "../parsers/primitives";
import CodeMirror from "codemirror";
import "./Toolbar.less";

type Props = {
  primitives?: PrimitiveGroup;
  languageId?: string; // used to find the .blocks-language-{languageId} CSS class
  blockMode?: boolean;
  toolbarRef: React.RefObject<HTMLInputElement>;
};

const Toolbar = (props: Props) => {
  const [search, setSearch] = useState("");
  const [selectedPrimitive, setSelectedPrimitive] = useState<
    Primitive | undefined
  >(undefined);
  const clearSearch = () => setSearch("");
  const changeSearch: React.ChangeEventHandler<HTMLInputElement> = (event) =>
    setSearch(event.target.value);
  const primitiveListRef = React.createRef<HTMLElement>();

  // Get a flat array of all primitives matching 'search'
  const getPrimitives = () =>
    (props.primitives?.filter(search).primitives || []) as Primitive[];

  // if a primitive is selected, make a block node for it
  const primitiveNode = selectedPrimitive?.getASTNode();
  const selectedPrimitiveBlock = primitiveNode ? (
    <span className="RenderedBlockNode">
      {primitiveNode.reactElement({ inToolbar: true })}
    </span>
  ) : (
    ""
  );

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (
    event
  ) => {
    const keyName = CodeMirror.keyName(event);
    console.log(keyName);
    switch (keyName) {
      case "Down":
        primitiveListRef.current?.focus();
    return;
    }
  }

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
          autoComplete="off"
          disabled={!props.blockMode}
          className="form-control"
          value={search}
          onKeyDown={handleKeyDown}
          ref={props.toolbarRef}
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
          selectedPrimitive={selectedPrimitive}
          toolbarRef={props.toolbarRef}
          setSelectedPrimitive={setSelectedPrimitive}
          selected={selectedPrimitive && selectedPrimitive.name}
          searchString={search}
          ref={primitiveListRef}
        />
      </div>
      <div
        className={classNames(
          "selected-primitive",
          `blocks-language-${props.languageId}`
        )}
      >
        <div className="block-header">Block</div>
        {selectedPrimitiveBlock}
      </div>
    </div>
  );
};

export default Toolbar;
