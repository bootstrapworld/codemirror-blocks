import React, {Component} from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import {PrimitiveGroup as PrimitiveGroupModel} from '../parsers/primitives';
import {RenderedBlockNode} from './PrimitiveBlock';
import {Primitive as LanguagePrimitive} from '../parsers/primitives';
import {DragPrimitiveSource} from '../dnd';
import {say, dummyPos} from '../utils';
import SHARED from '../shared';
import {copyNodes} from '../actions';

require('./PrimitiveList.less');


@DragPrimitiveSource
class Primitive extends Component {
  static propTypes = {
    primitive: PropTypes.instanceOf(LanguagePrimitive).isRequired,
    className: PropTypes.string.isRequired,
    onFocus: PropTypes.func.isRequired,
    onBlur: PropTypes.func.isRequired,
    onKeyDown: PropTypes.func.isRequired,
  }

  handleKeyDown = e => {
    switch (SHARED.keyMap[SHARED.keyName(e)]) {
    case 'copy':
      e.preventDefault();
      copyNodes([this.props.primitive]);
      say("copied " + this.props.primitive.toString());
      if (this.props.primitive.element) {
        this.props.primitive.element.focus(); // restore focus
      }
      return;
    default:
      this.props.onKeyDown(e);
      return;
    }
  }
  
  render() {
    let {primitive, className, onFocus, onBlur, onKeyDown,
         connectDragPreview, connectDragSource} = this.props;
    let elem = (
      <span tabIndex={-1}
            onKeyDown={this.handleKeyDown}
            onFocus={() => onFocus(primitive)}
            onBlur={() => onBlur(primitive)}
            ref = {elem => primitive.element = elem}
            className={classNames(className, "Primitive list-group-item")}>
        {primitive.name}
      </span>
    );
    elem = connectDragPreview(connectDragSource(elem), {offsetX: 1, offsetY: 1});
    return (<li>{elem}</li>);
  }
}

class PrimitiveGroup extends Component {
  static defaultProps = {
    group: {
      name: '',
      primitives: []
    }
  }

  static propTypes = {
    onFocus: PropTypes.func.isRequired,
    onBlur: PropTypes.func.isRequired,
    onKeyDown: PropTypes.func.isRequired,
    selected: PropTypes.string, // to start, no primitive is selected
  }

  state = {
    expanded: false
  }

  toggleExpanded = () => {
    this.setState({expanded: !this.state.expanded});
  }

  render() {
    let {group, onFocus, onBlur, onKeyDown, selected} = this.props;
    let expanded = this.state.expanded;
    let expandoClass = classNames(
      'glyphicon',
      expanded ? 'glyphicon-minus' : 'glyphicon-plus'
    );
    return (
      <li className="PrimitiveGroup list-group-item" role="list">
        <div onFocus={this.toggleExpanded} className="group-header">
          <span className={expandoClass} aria-hidden="true"/>
        </div>
        {expanded ?
          <PrimitiveList
            primitives={group.primitives}
            onFocus={onFocus}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            selected={selected}
          />
          : null}
      </li>
    );
  }
}

export default class PrimitiveList extends Component {
  static defaultProps = {
    selected: null,
  }

  static propTypes = {
    onFocus: PropTypes.func.isRequired,
    onBlur: PropTypes.func.isRequired,
    onKeyDown: PropTypes.func.isRequired,
    selected: PropTypes.string,
  }
  render() {
    const {primitives, selected, onFocus, onBlur, onKeyDown} = this.props;
    let nodes = [];
    for (let primitive of primitives) {
      if (primitive instanceof PrimitiveGroupModel) {
        // this is a group.
        nodes.push(
          <PrimitiveGroup
            key={primitive.name}
            group={primitive}
            onFocus={onFocus}
            onBlur={onBlur}
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
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          className={selected == primitive ? 'selected' : ''}
        />
      );

    }
    return (
      <div>
        <h3 id="toolbar_heading" className="screenreader-only">Built-ins</h3>
        <ul className="PrimitiveList list-group" aria-labelledby="toolbar_heading">{nodes}</ul>
      </div>
    );
  }
}
