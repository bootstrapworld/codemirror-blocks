import React, { Component } from "react";
import classNames from "classnames";
import PropTypes from "prop-types";
import { PrimitiveGroup as PrimitiveGroupModel } from "../parsers/primitives";
import { Primitive as LanguagePrimitive } from "../parsers/primitives";
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

class BasePrimitive extends Component<BasePrimitiveProps> {
  static propTypes = {
    primitive: PropTypes.instanceOf(LanguagePrimitive).isRequired,
    className: PropTypes.string.isRequired,
    onFocus: PropTypes.func.isRequired,
    onKeyDown: PropTypes.func.isRequired,
    searchString: PropTypes.string,
    connectDragPreview: PropTypes.func.isRequired,
    connectDragSource: PropTypes.func.isRequired,
  };

  handleKeyDown = (e: React.KeyboardEvent) => {
    switch (defaultKeyMap[CodeMirror.keyName(e)]) {
      case "Copy":
        e.preventDefault();
        copy([this.props.primitive.getASTNode()]);
        say("copied " + this.props.primitive.toString());
        this.props.primitive.element?.focus(); // restore focus
        return;
      default:
        this.props.onKeyDown(e);
        return;
    }
  };

  render() {
    let {
      primitive,
      className,
      onFocus,
      connectDragPreview,
      connectDragSource,
    } = this.props;
    let elem = (
      <span
        tabIndex={-1}
        onKeyDown={this.handleKeyDown}
        onFocus={() => onFocus(primitive)}
        ref={(elem) => (primitive.element = elem)}
        className={classNames(className, "Primitive list-group-item")}
      >
        {primitive.name}
      </span>
    );
    elem = connectDragPreview(connectDragSource(elem), {
      offsetX: 1,
      offsetY: 1,
    });
    return <li>{elem}</li>;
  }
}

const Primitive = DragPrimitiveSource(BasePrimitive);

type PrimitiveGroupProps = {
  onFocus: Function;
  onKeyDown: Function;
  selected?: string; // to start, no primitive is selected
  group?: PrimitiveGroupModel;
};
export class PrimitiveGroup extends Component<PrimitiveGroupProps> {
  static defaultProps = {
    group: new PrimitiveGroupModel("", "", []),
  };

  static propTypes = {
    onFocus: PropTypes.func.isRequired,
    onKeyDown: PropTypes.func.isRequired,
    selected: PropTypes.string, // to start, no primitive is selected
    group: PropTypes.object,
  };

  state = {
    expanded: false,
  };

  toggleExpanded = () => {
    this.setState({ expanded: !this.state.expanded });
  };

  render() {
    let { group, onFocus, onKeyDown, selected } = this.props;
    let expanded = this.state.expanded;
    let expandoClass = classNames(
      "glyphicon",
      expanded ? "glyphicon-minus" : "glyphicon-plus"
    );
    return (
      <li className="PrimitiveGroup list-group-item" role="list">
        <div onFocus={this.toggleExpanded} className="group-header">
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
  }
}
type PrimitiveListProps = {
  onFocus: Function;
  onKeyDown: Function;
  selected?: string;
  primitives?: LanguagePrimitive[];
  searchString?: string;
};
export default class PrimitiveList extends Component<PrimitiveListProps> {
  static propTypes = {
    onFocus: PropTypes.func.isRequired,
    onKeyDown: PropTypes.func.isRequired,
    selected: PropTypes.string,
    primitives: PropTypes.array,
    searchString: PropTypes.string,
  };
  render() {
    const { primitives, selected, onFocus, onKeyDown, searchString } =
      this.props;
    let nodes = [];
    for (let primitive of primitives) {
      if (primitive instanceof PrimitiveGroupModel) {
        // this is a group.
        nodes.push(
          <PrimitiveGroup
            key={primitive.name}
            group={primitive}
            onFocus={onFocus}
            onKeyDown={onKeyDown}
            selected={selected}
          />
        );
        continue;
      }
      nodes.push(
        <Primitive
          key={primitive.name}
          primitive={primitive}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          className={selected == primitive.name ? "selected" : ""}
        />
      );
    }
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
          {nodes}
        </ul>
      </div>
    );
  }
}
