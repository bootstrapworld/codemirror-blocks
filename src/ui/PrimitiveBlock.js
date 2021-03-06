import React, {Component} from 'react';
import PropTypes from 'prop-types/prop-types';
import {Primitive} from '../parsers/primitives';
import './PrimitiveBlock.less';

// TODO: Sorawee says this whole class can probably be removed.
export default class PrimitiveBlock extends Component {
  static propTypes = {
    primitive: PropTypes.instanceOf(Primitive),
    id: PropTypes.string,
  }

  static defaultProps = {
    primitive: null,
  }

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
