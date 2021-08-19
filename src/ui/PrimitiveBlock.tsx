import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {Primitive} from '../parsers/primitives';
import './PrimitiveBlock.less';

type Props = {
  id?: string,
  primitive?: Primitive,
}

// TODO: Sorawee says this whole class can probably be removed.
export default class PrimitiveBlock extends Component<Props> {
  static propTypes = {
    primitive: PropTypes.instanceOf(Primitive),
    id: PropTypes.string,
  }

  static defaultProps = {
    primitive: null,
  }

  root: HTMLSpanElement;

  render() {
    const astNode = this.props.primitive.getASTNode();
    const elem = astNode ? astNode.reactElement({inToolbar: true}) : this.props.primitive.name;
    return (
      <span className="RenderedBlockNode" ref={root => this.root = root} key={this.props.id}>
        {elem}
      </span>
    );
  }
}
