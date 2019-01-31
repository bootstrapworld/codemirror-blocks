import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {ASTNode} from '../ast';
import {Primitive} from '../parsers/primitives';
import './PrimitiveBlock.less';

// TODO: Sorawee says this whole class can probably be removed.
export default class PrimitiveBlock extends Component {
  static propTypes = {
    primitive: PropTypes.instanceOf(Primitive),
  }

  static defaultProps = {
    primitive: null,
  }

  render() {
    if (!this.props.primitive) {
      return <div/>;
    }

    const astNode = this.props.primitive.getASTNode();
    const elem = astNode ? astNode.render({inToolbar: true}) : this.props.primitive.name;
    return (
      <span className="RenderedBlockNode" ref={root => this.root = root}>
        {elem}
      </span>
    );
  }
}
