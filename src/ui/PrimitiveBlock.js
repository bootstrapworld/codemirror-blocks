import React from 'react';

export default function PrimitiveBlock({primitive}) {
  if (!primitive) {
    return <div/>;
  }
  const contract = `(${primitive.name} ${primitive.argumentTypes.join(' ')}) -> ${primitive.returnType}`;
  return <div className="PrimitiveBlock">{contract}</div>;
}
