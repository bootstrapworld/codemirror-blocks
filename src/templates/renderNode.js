import {renderHTMLString} from '../render';
module.exports = function(node) {
  if (!node) {
    return '';
  }
  return renderHTMLString(node);
}
