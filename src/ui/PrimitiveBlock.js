import React from 'react';
import {renderHTMLString} from '../render';

export default function PrimitiveBlock({primitive}) {
  if (!primitive) {
    return <div/>;
  }

  const astNode = primitive.getASTNode();
  if (astNode) {
    let html = {__html:renderHTMLString(astNode)};
    return (
      <div className="PrimitiveBlock"
           dangerouslySetInnerHTML={html}>
      </div>
    );
  }

  return <div/>;

}
