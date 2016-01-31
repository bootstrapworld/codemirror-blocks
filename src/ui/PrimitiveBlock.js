import React from 'react';

export default function PrimitiveBlock({primitive}) {
  if (!primitive) {
    return <div/>;
  }
  let name = primitive;
  let args = '';
  let returnType = '';
  if (typeof primitive != 'string') {
    name = primitive.name;
    args = primitive.argumentTypes.join(' ');
    returnType = primitive.returnType;
  }
  const contract = `(${name} ${args}) -> ${returnType}`;
  return <div className="PrimitiveBlock">{contract}</div>;
}
