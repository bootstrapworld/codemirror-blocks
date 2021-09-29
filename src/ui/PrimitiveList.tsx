import React, { useState } from "react";
import classNames from "classnames";
import {
  PrimitiveGroup as PrimitiveGroupModel,
  Primitive as LanguagePrimitive,
} from "../parsers/primitives";
import { DragPrimitiveSource } from "../dnd";
import { say } from "../announcer";
import { copy } from "../actions";
import CodeMirror from "codemirror";
import { defaultKeyMap } from "../keymap";

require("./PrimitiveList.less");

type BasePrimitiveProps = {
  primitive: LanguagePrimitive;
  className: string;
  onFocus: Function;
  onKeyDown: Function;
  searchString?: string;
  connectDragPreview: Function;
  connectDragSource: Function;
};

export const BasePrimitive = (props: BasePrimitiveProps) => {
  const {
    primitive,
    className,
    onFocus,
    onKeyDown,
    connectDragPreview,
    connectDragSource,
  } = props;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (defaultKeyMap[CodeMirror.keyName(e)]) {
      case "Copy":
        e.preventDefault();
        copy([primitive.getASTNode()]);
        say("copied " + primitive.toString());
        primitive.element?.focus(); // restore focus
        return;
      default:
        onKeyDown(e);
        return;
    }
  };

  // Build the primitive block and return it inside a list item
  const elem = (
    <span
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      // NOTE(Emmanuel): is this still appropriate style for using refs?
      onFocus={() => onFocus(primitive)}
      ref={(elem) => (primitive.element = elem)}
      className={classNames(className, "Primitive list-group-item")}
    >
      {primitive.name}
    </span>
  );
  const draggableElem = connectDragPreview(connectDragSource(elem), {
    offsetX: 1,
    offsetY: 1,
  });
  return <li>{draggableElem}</li>;
};

const Primitive = DragPrimitiveSource(BasePrimitive);

type PrimitiveGroupProps = {
  onFocus: Function;
  onKeyDown: Function;
  selected?: string; // to start, no primitive is selected
  group?: PrimitiveGroupModel;
};

export const PrimitiveGroup = (props: PrimitiveGroupProps) => {
  const { onFocus, onKeyDown, selected } = props;
  const group = props.group ?? new PrimitiveGroupModel("", "", []);
  const [expanded, setExpanded] = useState(false);
  const toggleExpanded = () => setExpanded(!expanded);

  const expandoClass = classNames(
    "glyphicon",
    expanded ? "glyphicon-minus" : "glyphicon-plus"
  );
  return (
    <li className="PrimitiveGroup list-group-item" role="list">
      <div onFocus={toggleExpanded} className="group-header">
        <span className={expandoClass} aria-hidden="true" />
      </div>
      {expanded ? (
        <PrimitiveList
          primitives={[...group.flatPrimitivesIter()]}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          selected={selected}
        />
      ) : null}
    </li>
  );
};

type PrimitiveListProps = {
  onFocus: Function;
  onKeyDown: Function;
  selected?: string;
  primitives?: LanguagePrimitive[];
  searchString?: string;
};
export const PrimitiveList = (props: PrimitiveListProps) => {
  const { primitives, selected, onFocus, onKeyDown, searchString } = props;
  const renderGroup = (g: PrimitiveGroupModel) => (
    <PrimitiveGroup
      key={g.name}
      group={g}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      selected={selected}
    />
  );
  const renderPrimitive = (p: LanguagePrimitive) => (
    <Primitive
      key={p.name}
      primitive={p}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      className={selected == p.name ? "selected" : ""}
    />
  );

  const text = searchString
    ? (primitives.length == 0 ? "No" : primitives.length) + " blocks found"
    : "blocks";

  return (
    <div>
      <h3
        id="toolbar_heading"
        className="screenreader-only"
        aria-live="assertive"
        aria-atomic="true"
      >
        {text}
      </h3>
      <ul
        className="PrimitiveList list-group"
        aria-labelledby="toolbar_heading"
      >
        {primitives.map((item) =>
          item instanceof PrimitiveGroupModel
            ? renderGroup(item)
            : renderPrimitive(item)
        )}
      </ul>
    </div>
  );
};

export default PrimitiveList;
