import React from 'react';
import PropTypes from 'prop-types';
import {Primitive} from '../parsers/primitives';
import './PrimitiveBlock.less';

const PrimitiveBlock = React.memo((props) => {
    if (!props.primitive) {
      return <div/>;
    }

    const astNode = props.primitive.getASTNode();
    const elem = astNode ? astNode.reactElement({inToolbar: true}) : props.primitive.name;
    return (
      <span className="RenderedBlockNode" ref={root => this.root = root}>
        {elem}
      </span>
    );
  }, 
  // Update only if nextProps.primitive is non-null
  (prevProps, nextProps) => nextProps.primitive !== null 
);

PrimitiveBlock.propTypes = {
  primitive: PropTypes.instanceOf(Primitive),
};

PrimitiveBlock.defaultProps = {
  primitive: null,
};

export default PrimitiveBlock