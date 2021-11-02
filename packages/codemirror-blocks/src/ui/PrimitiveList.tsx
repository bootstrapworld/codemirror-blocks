import React, { useState } from "react";
import classNames from "classnames";
import {
  PrimitiveGroup as PrimitiveGroupModel,
  Primitive as LanguagePrimitive,
} from "../parsers/primitives";
import { ItemTypes } from "../dnd";
import { say } from "../announcer";
import { copy } from "../state/actions";
import CodeMirror from "codemirror";
import { defaultKeyMap } from "../keymap";
import { useSelector } from "react-redux";
import { RootState } from "../state/reducers";
import { useDrag } from "react-dnd";

require("./PrimitiveList.less");

type BasePrimitiveProps = {
  primitive: LanguagePrimitive;
  className: string;
  onFocus: (primitive: LanguagePrimitive) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
};

export const Primitive = (props: BasePrimitiveProps) => {
  const { primitive, className, onFocus, onKeyDown } = props;

  const { ast, focusId } = useSelector(({ ast, focusId }: RootState) => ({
    ast,
    focusId,
  }));

  const [_, connectDragSource, connectDragPreview] = useDrag({
    type: ItemTypes.NODE,
    item: { content: primitive.name },
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (defaultKeyMap[CodeMirror.keyName(e)]) {
      case "Copy": {
        e.preventDefault();
        const node = primitive.getASTNode();
        copy({ ast, focusId }, [node]);
        say("copied " + primitive.toString());
        primitive.element?.focus(); // restore focus
        return;
      }
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
      onFocus={() => onFocus(primitive)}
      // NOTE(Emmanuel): is this still appropriate style for using refs?
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

type PrimitiveGroupProps = {
  onFocus: BasePrimitiveProps["onFocus"];
  onKeyDown: BasePrimitiveProps["onKeyDown"];
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
  onFocus: BasePrimitiveProps["onFocus"];
  onKeyDown: BasePrimitiveProps["onKeyDown"];
  selected?: string;
  primitives?: LanguagePrimitive[];
  searchString?: string;
};
export const PrimitiveList = (props: PrimitiveListProps) => {
  const { primitives = [], selected, onFocus, onKeyDown, searchString } = props;
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
