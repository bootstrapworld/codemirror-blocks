import React from 'react';
import classNames from 'classnames';

require('./Highlight.less');
export default function Highlight({children: text, highlight, className}) {
  const classes = classNames("Highlight", className);
  let startIndex = text.indexOf(highlight);
  let endIndex = startIndex + highlight.length;

  if (!highlight || startIndex == -1) {
    return <span className={classes}>{text}</span>;
  }
  return (
    <span className={classes}>
      {text.slice(0, startIndex)}
      <span className="highlighted">{text.slice(startIndex, endIndex)}</span>
      {text.slice(endIndex)}
    </span>
  );
}
