import React from 'react';
import {renderHTMLString} from '../render';
import {Expression, Literal, Blank} from '../ast';

export default function PrimitiveBlock({primitive}) {
  if (!primitive) {
    return <div/>;
  }

  const expr = new Expression(
    {line:0, ch:0},
    {line:0, ch:0},
    new Literal(
      {line: 0, ch: 0},
      {line:0, ch:0},
      primitive.name,
      'symbol'
    ),
    primitive.argumentTypes.map(() =>
      new Blank(
        {line: 0, ch: 0},
        {line: 0, ch: 0},
        ''
      )
    )
  );
  let html = {__html:renderHTMLString(expr)};
  return (
    <div className="PrimitiveBlock"
         dangerouslySetInnerHTML={html}>
    </div>
  );
}
